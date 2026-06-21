import type { IpcMain } from 'electron'
import { db } from './db'
import { settings } from '../db/schema'

// Directly-connected scale (serial/USB) support.
//
// This is device-local: each terminal configures its own port + protocol via
// the POS Settings screen (keys below). `serialport` is an OPTIONAL native
// dependency — it is imported lazily so the app builds/runs even when it is not
// installed; in that case scale reads degrade to a clear "not available" error.
//
// Settings keys (local `settings` table):
//   scale_enabled        '1' | '0'
//   scale_port           e.g. 'COM3' or '/dev/ttyUSB0'
//   scale_baud           e.g. '9600'
//   scale_weight_regex   capture group 1 = weight; default '(\\d+[.,]\\d{1,3})'

type ScaleReading = { ok: boolean; weightKg?: number; error?: string }
type PortInfo = { path: string; manufacturer?: string }

// Minimal structural types so we don't depend on serialport's type defs at build time.
type SerialPortLike = {
  isOpen: boolean
  on(ev: 'data', cb: (chunk: Buffer) => void): void
  on(ev: 'error', cb: (err: Error) => void): void
  close(cb?: () => void): void
}
type SerialPortModule = {
  SerialPort: (new (opts: { path: string; baudRate: number }) => SerialPortLike) & {
    list(): Promise<PortInfo[]>
  }
}

const DEFAULT_WEIGHT_REGEX = '(\\d+[.,]\\d{1,3})'

function getSettings(): Record<string, string> {
  const rows = db().select().from(settings).all()
  return Object.fromEntries(rows.map((r) => [r.key, r.value]))
}

async function loadSerialPort(): Promise<SerialPortModule | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (await import('serialport' as any)) as unknown as SerialPortModule
  } catch {
    return null
  }
}

function parseWeight(line: string, regexSrc: string): number | null {
  let re: RegExp
  try {
    re = new RegExp(regexSrc)
  } catch {
    return null
  }
  const m = re.exec(line)
  if (!m || !m[1]) return null
  const kg = parseFloat(m[1].replace(',', '.'))
  return Number.isFinite(kg) && kg > 0 ? kg : null
}

/** Open the configured port, read one stable weight, then close. */
async function readWeight(timeoutMs = 4000): Promise<ScaleReading> {
  const s = getSettings()
  if (s['scale_enabled'] !== '1') return { ok: false, error: 'La balanza conectada está deshabilitada' }
  const path = s['scale_port'] ?? ''
  if (!path) return { ok: false, error: 'No hay puerto de balanza configurado' }
  const baudRate = parseInt(s['scale_baud'] ?? '9600', 10) || 9600
  const regexSrc = s['scale_weight_regex'] || DEFAULT_WEIGHT_REGEX

  const mod = await loadSerialPort()
  if (!mod) return { ok: false, error: 'Soporte de balanza no instalado (serialport)' }

  return new Promise<ScaleReading>((resolve) => {
    let settled = false
    let buffer = ''
    let port: SerialPortLike
    const finish = (r: ScaleReading) => {
      if (settled) return
      settled = true
      try { port?.close() } catch { /* ignore */ }
      resolve(r)
    }
    try {
      port = new mod.SerialPort({ path, baudRate })
    } catch (e) {
      return resolve({ ok: false, error: e instanceof Error ? e.message : String(e) })
    }
    const timer = setTimeout(() => finish({ ok: false, error: 'Sin lectura estable de la balanza' }), timeoutMs)
    port.on('error', (err) => { clearTimeout(timer); finish({ ok: false, error: err.message }) })
    port.on('data', (chunk) => {
      buffer += chunk.toString('ascii')
      const lines = buffer.split(/[\r\n]+/)
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const kg = parseWeight(line, regexSrc)
        if (kg != null) { clearTimeout(timer); finish({ ok: true, weightKg: kg }); return }
      }
    })
  })
}

export function registerScaleHandlers(ipc: IpcMain) {
  ipc.handle('scale:listPorts', async (): Promise<{ ok: boolean; ports: PortInfo[]; error?: string }> => {
    const mod = await loadSerialPort()
    if (!mod) return { ok: false, ports: [], error: 'Soporte de balanza no instalado (serialport)' }
    try {
      const ports = await mod.SerialPort.list()
      return { ok: true, ports: ports.map((p) => ({ path: p.path, manufacturer: p.manufacturer })) }
    } catch (e) {
      return { ok: false, ports: [], error: e instanceof Error ? e.message : String(e) }
    }
  })

  ipc.handle('scale:readWeight', async (): Promise<ScaleReading> => readWeight())

  ipc.handle('scale:status', async (): Promise<{ enabled: boolean; port: string; available: boolean }> => {
    const s = getSettings()
    const mod = await loadSerialPort()
    return { enabled: s['scale_enabled'] === '1', port: s['scale_port'] ?? '', available: mod != null }
  })
}
