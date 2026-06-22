#!/usr/bin/env node
/**
 * Ensures the Electron runtime binary is present under node_modules/electron/dist.
 * pnpm hoists electron to the workspace root; postinstall can leave dist incomplete
 * when extract-zip fails silently on macOS .app bundles.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { platform } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const require = createRequire(join(root, 'package.json'))

const electronDir = join(root, 'node_modules', 'electron')
const distDir = join(electronDir, 'dist')
const pathFile = join(electronDir, 'path.txt')

function platformPath() {
  switch (platform()) {
    case 'darwin':
      return 'Electron.app/Contents/MacOS/Electron'
    case 'win32':
      return 'electron.exe'
    default:
      return 'electron'
  }
}

function isInstalled() {
  const rel = platformPath()
  const binary = join(distDir, rel)
  if (!existsSync(binary)) return false
  try {
    const { version } = require(join(electronDir, 'package.json'))
    const distVersion = readFileSync(join(distDir, 'version'), 'utf8').replace(/^v/, '').trim()
    if (distVersion !== version) return false
    if (!existsSync(pathFile)) return false
    if (readFileSync(pathFile, 'utf8') !== rel) return false
    return true
  } catch {
    return false
  }
}

function runInstallJs() {
  const result = spawnSync(process.execPath, [join(electronDir, 'install.js')], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, force_no_cache: 'true' },
  })
  return result.status === 0
}

async function unzipFromCache() {
  const { downloadArtifact } = require('@electron/get')
  const { version } = require(join(electronDir, 'package.json'))
  const arch = process.arch === 'arm64' && platform() === 'darwin' ? 'arm64' : process.arch
  const zipPath = await downloadArtifact({
    version,
    artifactName: 'electron',
    platform: platform() === 'win32' ? 'win32' : platform() === 'darwin' ? 'darwin' : 'linux',
    arch,
    force: true,
  })

  rmSync(distDir, { recursive: true, force: true })
  mkdirSync(distDir, { recursive: true })

  const unzip = spawnSync('unzip', ['-q', zipPath, '-d', distDir], { stdio: 'inherit' })
  if (unzip.status !== 0) {
    throw new Error(`unzip failed (exit ${unzip.status}) for ${zipPath}`)
  }

  writeFileSync(pathFile, platformPath(), 'utf8')
}

async function main() {
  if (!existsSync(electronDir)) {
    console.error('[pos-install-electron] node_modules/electron not found — run pnpm install first')
    process.exit(1)
  }

  if (isInstalled()) {
    console.log('[pos-install-electron] Electron runtime already installed')
    return
  }

  console.log('[pos-install-electron] Installing Electron runtime…')
  runInstallJs()

  if (!isInstalled()) {
    console.log('[pos-install-electron] install.js incomplete — falling back to unzip')
    await unzipFromCache()
  }

  if (!isInstalled()) {
    console.error('[pos-install-electron] Failed to install Electron runtime')
    process.exit(1)
  }

  console.log('[pos-install-electron] Done:', readdirSync(distDir).join(', '))
}

main().catch((err) => {
  console.error('[pos-install-electron]', err)
  process.exit(1)
})
