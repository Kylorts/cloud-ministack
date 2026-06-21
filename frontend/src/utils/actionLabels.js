// Label ramah (Bahasa Indonesia) untuk kode action di activity_logs.
// Dipakai bersama oleh halaman Riwayat Aktivitas user & log/audit admin.
export const ACTION_LABELS = {
  // Akun & keamanan
  USER_LOGIN: 'Login Berhasil',
  USER_REGISTERED: 'Daftar Akun',
  PASSWORD_RESET_REQUESTED: 'Minta Reset Sandi',
  PASSWORD_RESET_COMPLETED: 'Reset Sandi Berhasil',
  USER_STATUS_CHANGED: 'Ubah Status Akun',
  PASSWORD_CHANGED: 'Ubah Kata Sandi',
  PIN_SET: 'Atur PIN Transaksi',
  PIN_CHANGED: 'Ubah PIN Transaksi',
  PIN_REMOVED: 'Nonaktifkan PIN',
  // Langganan & paket
  PACKAGE_SUBSCRIBED: 'Berlangganan Paket',
  PACKAGE_UPGRADED: 'Upgrade Paket',
  PACKAGE_DOWNGRADED: 'Downgrade Paket',
  DOWNGRADE_SCHEDULED: 'Jadwalkan Downgrade',
  DOWNGRADE_SCHEDULE_CANCELLED: 'Batalkan Jadwal Downgrade',
  SUBSCRIPTION_CANCELLED: 'Batalkan Langganan',
  SUBSCRIPTION_SUSPENDED: 'Langganan Disuspend',
  SUBSCRIPTION_UNSUSPENDED: 'Langganan Dipulihkan',
  SUBSCRIPTION_REPAIRED: 'Perbaiki Langganan',
  BUCKET_REPAIRED: 'Perbaiki Bucket',
  // Storage
  BUCKET_CREATED: 'Buat Bucket',
  BUCKET_DELETED: 'Hapus Bucket',
  FILE_UPLOADED: 'Unggah File',
  FILE_DELETED: 'Hapus File',
  // Hosting
  STATIC_SITE_CREATED: 'Buat Situs',
  STATIC_SITE_DEPLOYED: 'Deploy Static Site',
  STATIC_SITE_ROLLBACK: 'Rollback Situs',
  STATIC_SITE_DELETED: 'Hapus Situs',
  STATIC_SITE_DEPLOYMENT_DELETED: 'Hapus Deployment',
  STATIC_SITE_DEACTIVATED: 'Nonaktifkan Situs',
  STATIC_SITE_ACTIVATED: 'Aktifkan Situs',
  // Access key
  ACCESS_KEY_CREATED: 'Buat Access Key',
  ACCESS_KEY_REVOKED: 'Cabut Access Key',
  // Admin
  ADMIN_PLAN_CHANGE: 'Ubah Paket (Admin)',
  ADMIN_KEY_REVOKED: 'Cabut Access Key (Admin)',
  PLAN_CREATED: 'Buat Paket',
  PLAN_UPDATED: 'Ubah Paket',
  PLAN_DELETED: 'Hapus Paket',
  IAM_POLICY_CREATED: 'Buat IAM Policy',
  IAM_POLICY_UPDATED: 'Ubah IAM Policy',
  IAM_POLICY_DELETED: 'Hapus IAM Policy',
}

export function actionLabel(a) {
  return ACTION_LABELS[a] || a
}
