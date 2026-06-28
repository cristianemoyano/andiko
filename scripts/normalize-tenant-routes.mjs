#!/usr/bin/env node
/**
 * Normalizes org/tenant context usage in API routes:
 * - makeTenantContext(session.user) → resolveTenantContext with 422 guard
 * - resolveOrgIdForMutation + ORG_REQUIRED_RESPONSE → resolveOrgScope
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const apiRoot = path.join(root, 'src/app/api/v1')

function walk(dir) {
  const out = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(full))
    else if (entry.name === 'route.ts') out.push(full)
  }
  return out
}

const TENANT_VAR_NAMES = ['tenantCtx', 'ctxTenant', 'ctx', 'tenant', 'tenantContext']

function patchMakeTenantContext(content) {
  if (!content.includes('makeTenantContext(session.user)')) return content
  if (content.includes('resolveTenantContext(session.user)')) return content

  let next = content

  for (const varName of TENANT_VAR_NAMES) {
    const re = new RegExp(`const ${varName} = await makeTenantContext\\(session\\.user\\)`, 'g')
    if (!re.test(next)) continue
    next = next.replace(
      re,
      `const ${varName}Result = await resolveTenantContext(session.user)
    if ('error' in ${varName}Result) return ${varName}Result.error
    const ${varName} = ${varName}Result.ctx`,
    )
  }

  if (next.includes('resolveTenantContext') && next.includes("from '@/lib/tenancy'")) {
    next = next.replace(
      /from '@\/lib\/tenancy'/,
      (match, offset) => {
        const slice = next.slice(Math.max(0, offset - 200), offset + 80)
        if (slice.includes('resolveTenantContext')) return match
        return match.replace(
          "'@/lib/tenancy'",
          "'@/lib/tenancy'",
        )
      },
    )
    next = next.replace(
      /import \{([^}]*)\} from '@\/lib\/tenancy'/,
      (full, imports) => {
        if (imports.includes('resolveTenantContext')) return full
        const trimmed = imports.trim().replace(/,\s*$/, '')
        return `import { ${trimmed}, resolveTenantContext } from '@/lib/tenancy'`
      },
    )
  }

  return next
}

function patchOrgRequired(content) {
  if (!content.includes('ORG_REQUIRED_RESPONSE')) return content

  let next = content

  next = next.replace(
    /const ORG_REQUIRED_RESPONSE = \{[\s\S]*?\}\s*\n\n?/g,
    '',
  )

  next = next.replace(
    /const orgId = await resolveOrgIdForMutation\(session\.user\)\s*\n\s*if \(!orgId\) return NextResponse\.json\(ORG_REQUIRED_RESPONSE, \{ status: 422 \}\)\s*\n/g,
    `const orgScope = await resolveOrgScope(session.user)
  if ('error' in orgScope) return orgScope.error
  const orgId = orgScope.orgId
`,
  )

  next = next.replace(
    /const orgId\s+=\s+await resolveOrgIdForMutation\(session\.user\)\s*\n\s*if \(!orgId\) return NextResponse\.json\(ORG_REQUIRED_RESPONSE, \{ status: 422 \}\)\s*\n/g,
    `const orgScope = await resolveOrgScope(session.user)
  if ('error' in orgScope) return orgScope.error
  const orgId = orgScope.orgId
`,
  )

  if (next.includes('resolveOrgScope')) {
    next = next.replace(
      /import \{ resolveOrgIdForMutation \} from '@\/lib\/session-org'/,
      "import { resolveOrgScope } from '@/lib/session-org'",
    )
    if (next.includes('resolveOrgIdForMutation') && next.includes("from '@/lib/session-org'")) {
      next = next.replace(
        /import \{ resolveOrgIdForMutation \} from '@\/lib\/session-org'/,
        "import { resolveOrgIdForMutation, resolveOrgScope } from '@/lib/session-org'",
      )
    } else if (!next.includes("resolveOrgScope") && !next.includes("from '@/lib/session-org'")) {
      next = next.replace(
        /(import \{ withPermission[^}]+\} from '@\/lib\/api-handler'\n)/,
        "$1import { resolveOrgScope } from '@/lib/session-org'\n",
      )
    }
  }

  next = next.replace(
    /if \(err\.message === 'ORG_CONTEXT_REQUIRED'\) return NextResponse\.json\(ORG_REQUIRED_RESPONSE, \{ status: 422 \}\)\s*\n/g,
    '',
  )

  return next
}

function patchRemainingOrgMutation(content) {
  if (!content.includes('resolveOrgIdForMutation')) return content

  let next = content

  // Multi-line if (!orgId) { return NextResponse.json({ error: '...long...' }) }
  next = next.replace(
    /const orgId = await resolveOrgIdForMutation\(session\.user\)\s*\n\s*if \(!orgId\) \{\s*\n\s*return NextResponse\.json\([\s\S]*?\{ status: 422 \}\s*\)\s*\n\s*\}\s*\n/g,
    `const orgScope = await resolveOrgScope(session.user)
  if ('error' in orgScope) return orgScope.error
  const orgId = orgScope.orgId
`,
  )

  // Short if (!orgId) single-line return
  next = next.replace(
    /const orgId\s+=\s+await resolveOrgIdForMutation\(session\.user\)\s*\n\s*if \(!orgId\) \{\s*\n\s*return NextResponse\.json\(\{ error: '[^']*', code: 'ORG_CONTEXT_REQUIRED' \}, \{ status: 422 \}\)\s*\n\s*\}\s*\n/g,
    `const orgScope = await resolveOrgScope(session.user)
  if ('error' in orgScope) return orgScope.error
  const orgId = orgScope.orgId
`,
  )

  // const orgId  = await (double space)
  next = next.replace(
    /const orgId\s+=\s+await resolveOrgIdForMutation\(session\.user\)\s*\n(?!\s*if)/g,
    `const orgScope = await resolveOrgScope(session.user)
  if ('error' in orgScope) return orgScope.error
  const orgId = orgScope.orgId
`,
  )

  if (next.includes('resolveOrgScope')) {
    next = next.replace(
      /import \{ resolveOrgIdForMutation \} from '@\/lib\/session-org'/g,
      "import { resolveOrgScope } from '@/lib/session-org'",
    )
  }

  return next
}

function patchCatalogOrgId(content) {
  if (!content.includes('session.user.orgId')) return content

  let next = content

  if (!next.includes('resolveTenantContext')) {
    next = next.replace(
      /(import \{ withPermission, resolveActorId \} from '@\/lib\/api-handler'\n)/,
      "$1import { resolveTenantContext } from '@/lib/tenancy'\n",
    )
  }

  // Inject tenant resolution at start of handler bodies that use session.user.orgId
  // Replace session.user.orgId with tenant.orgId after adding resolution block is hard automatically.
  // Instead replace direct usages:
  next = next.replace(/session\.user\.orgId/g, 'tenant.orgId')

  // Add tenant resolution before first tenant.orgId usage in each export - manual for safety
  return next
}

let changed = 0
for (const file of walk(apiRoot)) {
  const original = fs.readFileSync(file, 'utf8')
  let updated = original
  updated = patchMakeTenantContext(updated)
  updated = patchOrgRequired(updated)
  updated = patchRemainingOrgMutation(updated)
  if (updated !== original) {
    fs.writeFileSync(file, updated)
    changed++
    console.log('patched', path.relative(root, file))
  }
}

console.log(`Done. ${changed} files updated.`)
