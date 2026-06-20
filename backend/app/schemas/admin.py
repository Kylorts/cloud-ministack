from datetime import datetime
from pydantic import BaseModel


class StatsResponse(BaseModel):
    # Simulasi (tidak ada node fisik nyata)
    uptime_percent: float
    physical_nodes_healthy: int
    # Real
    active_clients: int
    active_subscriptions: int
    new_clients_this_month: int
    storage_used_bytes: int
    storage_cap_bytes: int
    object_storage_bytes: int
    hosting_build_bytes: int


class AdminResourceItem(BaseModel):
    id: int
    name: str
    owner_name: str
    type: str               # "S3-Compat" | "Static"
    utilization_percent: int
    status: str


class AdminAccessKeyItem(BaseModel):
    id: int
    access_key_id: str
    owner_name: str
    status: str
    category: str
    permission: str = "full"
    policy_name: str | None = None
    last_used_at: datetime | None = None
    created_at: datetime


# ── Fase B: Pengguna ──
class AdminUserItem(BaseModel):
    id: int
    name: str
    email: str
    role: str
    status: str
    plan_name: str | None
    created_at: datetime


class AdminUserResource(BaseModel):
    id: int
    name: str
    type: str           # "Object Storage" | "Static Hosting"
    status: str


class AdminActivityItem(BaseModel):
    id: int
    action: str
    description: str
    ip_address: str | None
    created_at: datetime


class AdminUserDetail(BaseModel):
    id: int
    name: str
    email: str
    role: str
    status: str
    created_at: datetime
    # kuota & pemakaian
    bucket_count: int
    bucket_limit: int
    site_count: int
    site_limit: int
    access_key_count: int
    access_key_limit: int
    storage_used_bytes: int
    storage_limit_bytes: int
    bandwidth_used_bytes: int
    bandwidth_limit_bytes: int
    storage_plan_name: str | None
    hosting_plan_name: str | None
    resources: list[AdminUserResource]
    activities: list[AdminActivityItem]


class StatusUpdateRequest(BaseModel):
    status: str         # "active" | "suspended"


# ── Fase C: Paket ──
class AdminPlanItem(BaseModel):
    id: int
    name: str
    category: str
    price: float
    storage_limit_bytes: int
    max_file_size_bytes: int
    bandwidth_limit_bytes: int
    bucket_limit: int
    static_site_limit: int
    access_key_limit: int
    is_active: bool
    subscriber_count: int = 0


class AdminPlanWrite(BaseModel):
    name: str
    category: str        # "storage" | "hosting"
    price: float
    storage_limit_bytes: int = 0
    max_file_size_bytes: int = 0
    bandwidth_limit_bytes: int = 0
    bucket_limit: int = 0
    static_site_limit: int = 0
    access_key_limit: int = 1
    is_active: bool = True


# ── Fase D: Langganan ──
class AdminSubscriptionItem(BaseModel):
    id: int
    client_name: str
    plan_name: str
    category: str
    status: str
    current_period_end: datetime
    scheduled_change: str | None = None


class AdminPlanChange(BaseModel):
    created_at: datetime
    action: str
    detail: str
    by: str


class AdminSubscriptionDetail(BaseModel):
    id: int
    client_name: str
    client_email: str
    plan_name: str
    category: str
    status: str
    price: float
    current_period_start: datetime
    current_period_end: datetime
    grace_until: datetime | None = None
    suspended_at: datetime | None = None
    storage_used_bytes: int
    storage_limit_bytes: int
    bandwidth_used_bytes: int
    bandwidth_limit_bytes: int
    history: list[AdminPlanChange]


class ChangePlanRequest(BaseModel):
    plan_id: int


# ── Fase E: Transaksi (DUMMY / simulasi, tanpa Midtrans asli) ──
class AdminTransactionItem(BaseModel):
    id: int                 # = subscription id (kunci dummy)
    invoice_no: str
    client_name: str
    amount: float
    invoice_status: str     # PAID | UNPAID
    midtrans_status: str    # settlement | pending
    method: str             # QRIS | BVA
    date: datetime


class AdminTransactionDetail(AdminTransactionItem):
    midtrans_id: str
    raw_notification: dict


# ── Fase F: Monitoring Sumber Daya ──
class AdminTopUser(BaseModel):
    name: str
    used_bytes: int


class AdminMonitoring(BaseModel):
    storage_used_bytes: int
    storage_cap_bytes: int
    bandwidth_used_bytes: int
    bucket_count: int
    site_count: int
    top_storage_users: list[AdminTopUser]
    nodes_active: int
    nodes_total: int
    capacity_percent: int
    avg_load_percent: int
    healthy: bool


class AdminBucketRow(BaseModel):
    id: int
    name: str
    owner_name: str
    object_count: int
    total_size_bytes: int
    status: str


class AdminBucketObject(BaseModel):
    key: str
    size_bytes: int
    content_type: str | None
    uploaded_at: datetime | None


class AdminBucketDetail(BaseModel):
    id: int
    name: str
    owner_name: str
    visibility: str
    object_count: int
    total_size_bytes: int
    objects: list[AdminBucketObject]


class AdminSiteRow(BaseModel):
    id: int
    name: str
    owner_name: str
    url: str
    last_deployed_at: datetime | None
    status: str


# ── Fase G: Keamanan & Log Sistem ──
class AdminLogItem(BaseModel):
    id: int
    actor_type: str
    actor_name: str
    action: str
    target: str
    ip_address: str | None
    created_at: datetime


class AdminLogPage(BaseModel):
    items: list[AdminLogItem]
    total: int


class AdminAuditItem(BaseModel):
    id: int
    admin_name: str
    affected: str
    action: str
    note: str
    created_at: datetime


class IamPolicyItem(BaseModel):
    id: int
    name: str
    description: str | None
    policy_type: str
    document: str
    created_by: str | None
    created_at: datetime


class IamPolicyWrite(BaseModel):
    name: str
    description: str | None = None
    document: str
