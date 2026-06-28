export type UserRole = 'sys-admin' | 'admin' | 'operator' | 'readonly' | 'branch-admin'

// sys-admin: cross-org superuser, bypasses all permission checks when not impersonating; often no `org_id`.
// ERP writes need org context: effective `org_id`, or `actingOrgId` if real sys-admin without org, or impersonation.
//
// `operator` is legacy as a standalone built-in role (Operativo). It remains in the DB enum as the carrier
// value for users assigned a custom org role (`org_role_id` set); those users are shown by org role name in UI.
