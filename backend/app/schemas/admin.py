from pydantic import BaseModel


class StatsResponse(BaseModel):
    uptime_percent: float
    physical_nodes_healthy: int
    active_users: int
    total_instances: int
