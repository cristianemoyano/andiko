export type UserRole = 'sys-admin' | 'admin' | 'operator' | 'readonly'

// sys-admin: cross-org superuser, bypasses all permission checks when not impersonating; often no `org_id`.
// ERP writes need org context: effective `org_id`, or `actingOrgId` if real sys-admin without org, or impersonation.
