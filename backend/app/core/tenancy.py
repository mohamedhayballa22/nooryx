"""
Multi-tenant context management and automatic query filtering.
"""
from contextvars import ContextVar
from typing import Optional
from uuid import UUID
from sqlalchemy import event, inspect as sa_inspect
from sqlalchemy.orm import Session, ORMExecuteState
from sqlalchemy.sql import expression
from sqlalchemy.exc import InvalidRequestError
from app.core.logger_config import logger

# Thread-safe context variable for current tenant
_current_tenant_id: ContextVar[Optional[UUID]] = ContextVar('current_tenant_id', default=None)


def get_current_tenant_id() -> Optional[UUID]:
    """Get the current tenant ID from context."""
    return _current_tenant_id.get()


def set_current_tenant_id(tenant_id: UUID) -> None:
    """Set the current tenant ID in context."""
    _current_tenant_id.set(tenant_id)


def clear_current_tenant_id() -> None:
    """Clear the current tenant ID from context."""
    _current_tenant_id.set(None)


class TenantContext:
    """Context manager for setting tenant scope."""
    
    def __init__(self, tenant_id: UUID):
        self.tenant_id = tenant_id
        self.token = None
    
    def __enter__(self):
        self.token = _current_tenant_id.set(self.tenant_id)
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        _current_tenant_id.reset(self.token)
    
    async def __aenter__(self):
        self.token = _current_tenant_id.set(self.tenant_id)
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        _current_tenant_id.reset(self.token)


def _is_table_entity(entity) -> bool:
    """
    Determine if an entity mapper represents an actual table model.
    
    Returns False for subqueries, aliases, or other non-table constructs.
    Uses SQLAlchemy's inspection API to reliably distinguish entity types.
    
    Args:
        entity: Mapper entity to inspect
        
    Returns:
        True if entity is a real table model, False otherwise
    """
    try:
        # Get the inspection object for the entity
        insp = sa_inspect(entity)
        
        # For aliased entities, check the underlying selectable
        if hasattr(insp, 'selectable'):
            selectable = insp.selectable
            # Subqueries and aliases are not table entities
            if isinstance(selectable, (expression.Alias, expression.Subquery)):
                return False
        
        # Check if it's a proper mapped class with a table
        if hasattr(insp, 'mapped_table') and insp.mapped_table is not None:
            return True
            
        # If we have a class with __tablename__, it's likely a table model
        if hasattr(entity, 'class_') and hasattr(entity.class_, '__tablename__'):
            return True
            
        return False
        
    except (InvalidRequestError, AttributeError) as e:
        # These exceptions indicate the entity is not inspectable as a mapper
        # This is expected for certain construct types
        logger.warning(
            f"Entity inspection failed (non-table construct): {e}",
            extra={'entity': str(entity)}
        )
        return False


@event.listens_for(Session, "do_orm_execute")
def _apply_tenant_filter(orm_execute_state: ORMExecuteState):  # noqa: F811
    """
    Automatically inject tenant filter on all ORM queries.

    This event listener intercepts all SELECT queries and adds
    org_id filtering when a tenant context is active.

    SECURITY CRITICAL: This function enforces tenant isolation.
    Any filtering failures on table entities are logged and will
    cause the query to fail rather than risk data leakage.

    Behavior / protections included:
    * Only applies to ORM SELECT statements (is_orm_statement)
    * Honors execution option 'skip_tenant_filter' to bypass
    * Attempts to identify the primary/root mapper(s) for the statement
      and only applies tenant filters to those root mappers. This prevents
      filtering on optional/joined tables (e.g. User in a LEFT JOIN).
    * If a candidate model lacks 'org_id' we skip it (no AttributeError).
    * Extensive logging; fails fast on unknown/critical errors to avoid leakage.
    """
    # Only apply to SELECT statements
    if not orm_execute_state.is_select:
        return

    # Allow explicit bypass via execution option
    if orm_execute_state.execution_options.get("skip_tenant_filter", False):
        return

    # Get current tenant from context
    tenant_id = get_current_tenant_id()
    if tenant_id is None:
        return

    # Only apply to ORM statements
    if not orm_execute_state.is_orm_statement:
        return

    try:
        stmt = orm_execute_state.statement

        # Primary mapper(s) detection:
        # Prefer the ORM-internal propagated "plugin_subject" which, for ORM
        # selects, represents the mapped entity(ies) which are the primary target.
        primary_mappers = None
        try:
            propagated = getattr(stmt, "_propagated_attrs", None)
            if propagated:
                plugin_subject = propagated.get("plugin_subject", None)
                if plugin_subject:
                    # plugin_subject may be a single mapper or a collection
                    if isinstance(plugin_subject, (list, tuple, set)):
                        primary_mappers = list(plugin_subject)
                    else:
                        primary_mappers = [plugin_subject]
        except Exception as e:
            # Defensive: do not trust private internals — fall back later.
            logger.debug("Could not read stmt._propagated_attrs.plugin_subject", extra={"error": str(e)})

        # Fallback: attempt to infer root classes from column_descriptions (if available)
        if not primary_mappers:
            try:
                col_desc = getattr(stmt, "column_descriptions", None)
                if col_desc:
                    types = {d.get("type") for d in col_desc if isinstance(d.get("type"), type)}
                    inferred = []
                    for mapper in orm_execute_state.all_mappers:
                        if mapper.class_ in types:
                            inferred.append(mapper)
                    if inferred:
                        primary_mappers = inferred
            except Exception as e:
                logger.debug("Fallback inference from column_descriptions failed", extra={"error": str(e)})

        # Final conservative fallback: treat the first mapper as primary (if nothing else)
        if not primary_mappers:
            try:
                primary_mappers = [next(iter(orm_execute_state.all_mappers))]
            except StopIteration:
                # No mappers — nothing to do
                return

        # Apply filter only to primary mappers that explicitly define org_id.
        # Also support an optional per-model opt-in flag '__tenant_scoped__' that allows
        # you to explicitly mark tenant-owned models (recommended for long-term clarity).
        models_filtered = []
        for primary in primary_mappers:
            model = getattr(primary, "class_", None)
            if model is None:
                continue

            # Optional explicit opt-in: if model defines __tenant_scoped__ = False, skip it.
            if getattr(model, "__tenant_scoped__", None) is False:
                logger.debug("Skipping tenant filter for model marked __tenant_scoped__ = False", extra={"model": model.__name__})
                continue

            # Only apply tenant filter if model has org_id attribute
            if not hasattr(model, "org_id"):
                logger.debug("Primary model has no org_id, skipping tenant filter", extra={"model": model.__name__})
                continue

            # Safe: attach the filter to the statement. Keep track for logging
            try:
                stmt = stmt.filter(getattr(model, "org_id") == tenant_id)
                models_filtered.append(model.__name__)
            except InvalidRequestError as e:
                logger.error(
                    f"Could not apply tenant filter to {model.__name__}: {e}",
                    extra={
                        "tenant_id": str(tenant_id),
                        "entity": model.__name__,
                        "error": str(e),
                    },
                    exc_info=True,
                )
                # Fail safe — do not allow query to run partially filtered.
                raise
            except AttributeError as e:
                # Unexpected; log and fail — prefer failing loud than leaking data.
                logger.error(
                    f"Unexpected AttributeError applying tenant filter to {model.__name__}: {e}",
                    extra={"tenant_id": str(tenant_id), "entity": model.__name__, "error": str(e)},
                    exc_info=True,
                )
                raise
            except Exception as e:
                logger.critical(
                    f"CRITICAL: Unknown exception in tenant filter for {model.__name__}: {e}",
                    extra={
                        "tenant_id": str(tenant_id),
                        "entity": model.__name__,
                        "error": str(e),
                        "error_type": type(e).__name__,
                    },
                    exc_info=True,
                )
                raise

        # Replace the statement with the filtered one (if any filters applied)
        if models_filtered:
            orm_execute_state.statement = stmt
            logger.debug("Tenant filter applied", extra={"tenant_id": str(tenant_id), "models_filtered": models_filtered})
        else:
            logger.debug("No tenant filters applied for this statement", extra={"tenant_id": str(tenant_id)})

    except Exception:
        # Defensive: we prefer failing loudly (preventing leakage) than returning possibly unfiltered results.
        logger.exception("Tenant filtering failed in an unexpected way; aborting to avoid leakage")
        # Re-raise so callers observe failure and we do not execute potentially unfiltered queries.
        raise


def bypass_tenant_filter(statement):
    """
    Execution option to bypass tenant filtering for specific queries.
    
    USE WITH EXTREME CAUTION: This bypasses tenant isolation.
    Only use for:
    - Administrative queries that need cross-tenant visibility
    - System-level operations
    - Queries where tenant filtering is manually implemented
    
    Args:
        statement: SQLAlchemy statement to execute without tenant filtering
        
    Returns:
        Statement with skip_tenant_filter execution option set
    """
    return statement.execution_options(skip_tenant_filter=True)
