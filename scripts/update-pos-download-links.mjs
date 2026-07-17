#!/usr/bin/env node
/**
 * Updates src/lib/site.ts `posDownloads` to match a POS release version.
 *
 * Usage:
 *   node scripts/update-pos-download-links.mjs           # reads apps/pos/package.json
 *   node scripts/update-pos-download-links.mjs 0.5.2     # explicit version
 *   node scripts/update-pos-download-links.mjs v0.5.2    # tag-style also accepted
 *
 * Asset names must match electron-builder output published to andiko-pos-releases:
 *   Andiko.POS.Setup.<ver>.exe
 *   Andiko.POS-<ver>-arm64.dmg
 *   Andiko.POS-<ver>.dmg
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const sitePath = join(root, 'src/lib/site.ts')
const posPkgPath = join(root, 'apps/pos/package.json')

const RELEASES_BASE = 'https://github.com/cristianemoyano/andiko-pos-releases/releases'

function resolveVersion() {
  const arg = process.argv[2]?.trim()
  if (arg) return arg.replace(/^v/, '')
  const pkg = JSON.parse(readFileSync(posPkgPath, 'utf8'))
  if (!pkg.version) throw new Error('apps/pos/package.json has no version')
  return String(pkg.version).replace(/^v/, '')
}

function buildBlock(version) {
  return `  posDownloads: {
    version: '${version}',
    releasesUrl: \`\${POS_RELEASES_BASE}/latest\`,
    windows: \`\${POS_RELEASES_BASE}/download/v${version}/Andiko.POS.Setup.${version}.exe\`,
    macAppleSilicon: \`\${POS_RELEASES_BASE}/download/v${version}/Andiko.POS-${version}-arm64.dmg\`,
    macIntel: \`\${POS_RELEASES_BASE}/download/v${version}/Andiko.POS-${version}.dmg\`,
  },`
}

const version = resolveVersion()
if (!/^\d+\.\d+\.\d+([.-][\w.-]+)?$/.test(version)) {
  console.error(`Invalid POS version: ${version}`)
  process.exit(1)
}

const source = readFileSync(sitePath, 'utf8')
const nextBlock = buildBlock(version)

if (!source.includes('posDownloads:')) {
  console.error('src/lib/site.ts has no posDownloads block — add it before running this script')
  process.exit(1)
}

const updated = source.replace(/  posDownloads:\s*\{[\s\S]*?\},/, nextBlock)
if (updated === source) {
  // Idempotent: already correct
  const current = source.match(/version:\s*'([^']+)'/)
  if (current?.[1] === version) {
    console.log(`posDownloads already at v${version}`)
    process.exit(0)
  }
  console.error('Failed to replace posDownloads block in src/lib/site.ts')
  process.exit(1)
}

writeFileSync(sitePath, updated)
console.log(`Updated landing POS download links → v${version}`)
console.log(`  Windows: ${RELEASES_BASE}/download/v${version}/Andiko.POS.Setup.${version}.exe`)
console.log(`  macOS:   ${RELEASES_BASE}/download/v${version}/Andiko.POS-${version}-arm64.dmg`)
console.log(`  Intel:   ${RELEASES_BASE}/download/v${version}/Andiko.POS-${version}.dmg`)
