#!/usr/bin/env node
/**
 * Rebuild better-sqlite3 for Electron. CXXFLAGS is Unix-only; Windows uses prebuilt
 * binaries or MSVC defaults without inline env assignment in package.json scripts.
 */
import { spawnSync } from 'node:child_process'
import { platform } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const posDir = resolve(__dirname, '../apps/pos')

const env = { ...process.env }
if (platform() !== 'win32') {
  env.CXXFLAGS = '-std=c++20'
}

const args = ['exec', 'electron-rebuild', '-f', '-w', 'better-sqlite3']
const arch = process.env.POS_REBUILD_ARCH
if (arch) {
  args.push(`--arch=${arch}`)
}

const result = spawnSync('pnpm', args, {
  cwd: posDir,
  stdio: 'inherit',
  env,
  shell: platform() === 'win32',
})

process.exit(result.status ?? 1)
