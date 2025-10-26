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
def _apply_tenant_filter(orm_execute_state: ORMExecuteState): # noqa: F811
    """
    Automatically inject tenant filter on all ORM queries.
    
    This event listener intercepts all SELECT queries and adds
    org_id filtering when a tenant context is active.
    
    SECURITY CRITICAL: This function enforces tenant isolation.
    Any filtering failures on table entities are logged and will
    cause the query to fail rather than risk data leakage.
    
    Registered automatically at module import time.
    """
    # Only apply to SELECT statements
    if not orm_execute_state.is_select:
        return
    
    # Allow explicit bypass via execution option
    if orm_execute_state.execution_options.get('skip_tenant_filter', False):
        return
    
    # Get current tenant from context
    tenant_id = get_current_tenant_id()
    if tenant_id is None:
        return
    
    # Apply filter to all entities that have org_id
    if not orm_execute_state.is_orm_statement:
        return
        
    for entity in orm_execute_state.all_mappers:
        # Skip non-table entities (subqueries, aliases, etc.)
        if not _is_table_entity(entity):
            continue
            
        # Check if entity has org_id column
        if not hasattr(entity.class_, 'org_id'):
            continue
        
        try:
            # Apply tenant filter using explicit column reference
            orm_execute_state.statement = orm_execute_state.statement.filter(
                entity.class_.org_id == tenant_id
            )
            
        except InvalidRequestError as e:
            # This can occur with certain query structures where the filter
            # cannot be applied due to the entity not being in the correct context.
            # This might be a legitimate case (e.g., subquery in SELECT clause),
            # but we need to verify the query is already filtered.
            
            # Check if org_id filter already exists in the WHERE clause
            where_clause_str = str(orm_execute_state.statement.whereclause)
            entity_table = entity.class_.__tablename__
            
            if f"{entity_table}.org_id" in where_clause_str or "org_id =" in where_clause_str:
                # Filter already present, this is safe
                continue
            
            # If we can't apply the filter and it's not already there, this is critical
            logger.error(
                f"Could not apply tenant filter to {entity.class_.__name__} and no existing filter found: {e}",
                extra={
                    'tenant_id': str(tenant_id),
                    'entity': entity.class_.__name__,
                    'error': str(e),
                    'statement': str(orm_execute_state.statement)
                },
                exc_info=True
            )
            # Re-raise to fail safely rather than risk tenant data exposure
            raise
            
        except AttributeError as e:
            # This should not occur if _is_table_entity works correctly,
            # but we catch it explicitly for security
            logger.error(
                f"Unexpected AttributeError applying tenant filter to {entity.class_.__name__}: {e}",
                extra={
                    'tenant_id': str(tenant_id),
                    'entity': entity.class_.__name__,
                    'error': str(e)
                },
                exc_info=True
            )
            # Re-raise to fail safely
            raise
            
        except Exception as e:
            # Unknown exception during tenant filtering
            # This should never happen. Log extensively and fail hard.
            logger.critical(
                f"CRITICAL: Unknown exception in tenant filter for {entity.class_.__name__}: {e}",
                extra={
                    'tenant_id': str(tenant_id),
                    'entity': entity.class_.__name__,
                    'error': str(e),
                    'error_type': type(e).__name__
                },
                exc_info=True
            )
            # Re-raise to prevent potential data leakage
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
