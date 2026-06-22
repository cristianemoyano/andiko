import type { IpcMain, WebContentsPrintOptions } from 'electron'
import { BrowserWindow } from 'electron'

/** 80 mm thermal roll — used only when silent/device printing is wired up later. */
export const TICKET_PAGE_SIZE = {
  width: 80_000,
  height: 250_000,
} as const

const RECEIPT_PRINT_OPTIONS: WebContentsPrintOptions = {
  silent: false,
  printBackground: true,
  margins: { marginType: 'none' },
  // Paper size comes from CSS @page in the renderer. Custom micron pageSize breaks
  // the macOS print sheet when no thermal driver is selected.
}

export function registerPrintHandlers(ipc: IpcMain) {
  ipc.handle('print:receipt', async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return { ok: false as const, error: 'Ventana no disponible' }

    return new Promise<{ ok: boolean; error?: string }>((resolve) => {
      let settled = false
      const finish = (result: { ok: boolean; error?: string }) => {
        if (settled) return
        settled = true
        resolve(result)
      }

      win.webContents.print(RECEIPT_PRINT_OPTIONS, (success, failureReason) => {
        if (success) finish({ ok: true })
        else finish({ ok: false, error: failureReason || 'Impresión cancelada' })
      })

      setTimeout(() => finish({ ok: false, error: 'Tiempo de espera agotado' }), 120_000)
    })
  })
}
