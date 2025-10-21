"""
Multi-tenant context management and automatic query filtering.
"""
from contextvars import ContextVar
from typing import Optional
from uuid import UUID
from sqlalchemy import event
from sqlalchemy.orm import Session, ORMExecuteState

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


# Register event listener at module import time
@event.listens_for(Session, "do_orm_execute")
def _apply_tenant_filter(orm_execute_state: ORMExecuteState): # noqa: F811
    """
    Automatically inject tenant filter on all ORM queries.
    
    This event listener intercepts all SELECT queries and adds
    org_id filtering when a tenant context is active.
    
    Registered automatically, not called directly.
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
    if orm_execute_state.is_orm_statement:
        for entity in orm_execute_state.all_mappers:
            # Check if entity mapper has org_id column
            if hasattr(entity.class_, 'org_id'):
                orm_execute_state.statement = orm_execute_state.statement.filter_by(
                    org_id=tenant_id
                )


def bypass_tenant_filter(statement):
    """
    Execution option to bypass tenant filtering for specific queries.
    
    Usage:
        stmt = select(User).execution_options(skip_tenant_filter=True)
        result = await db.execute(stmt)
    """
    return statement.execution_options(skip_tenant_filter=True)
