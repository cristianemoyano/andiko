import sequelize from '@/lib/db'
import { QueryTypes } from 'sequelize'

async function run() {
  if (process.env.NODE_ENV !== 'development') {
    throw new Error('check-permissions is only allowed in development')
  }

  const orgRows = await sequelize.query<{ id: string }>(
    `select id from organizations where slug = :slug limit 1`,
    { type: QueryTypes.SELECT, replacements: { slug: 'demo' } },
  )
  const orgId = orgRows[0]?.id ?? null

  const permissionsCount = await sequelize.query<{ c: number }>(
    `select count(*)::int as c from permissions`,
    { type: QueryTypes.SELECT },
  )

  const rpGlobal = await sequelize.query<{ role: string; c: number }>(
    `select role, count(*)::int as c
     from role_permissions
     where org_id is null
     group by role
     order by role`,
    { type: QueryTypes.SELECT },
  )

  const rpOrg = orgId
    ? await sequelize.query<{ role: string; c: number }>(
      `select role, count(*)::int as c
       from role_permissions
       where org_id = :orgId
       group by role
       order by role`,
      { type: QueryTypes.SELECT, replacements: { orgId } },
    )
    : []

  const adminHasGlobal = await sequelize.query<{ ok: boolean }>(
    `select exists (
       select 1
       from role_permissions rp
       join permissions p on p.id = rp.permission_id
       where rp.role = 'admin' and rp.org_id is null and p.name = 'products:read'
     ) as ok`,
    { type: QueryTypes.SELECT },
  )

  const adminHasOrg = orgId
    ? await sequelize.query<{ ok: boolean }>(
      `select exists (
         select 1
         from role_permissions rp
         join permissions p on p.id = rp.permission_id
         where rp.role = 'admin' and rp.org_id = :orgId and p.name = 'products:read'
       ) as ok`,
      { type: QueryTypes.SELECT, replacements: { orgId } },
    )
    : [{ ok: false }]

  console.log({
    orgId,
    permissionsCount: permissionsCount[0]?.c ?? null,
    rolePermissionsGlobal: rpGlobal,
    rolePermissionsOrg: rpOrg,
    adminHasProductsReadGlobal: adminHasGlobal[0]?.ok ?? null,
    adminHasProductsReadOrg: adminHasOrg[0]?.ok ?? null,
  })
}

run()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => sequelize.close())

