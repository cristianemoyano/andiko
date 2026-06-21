/** Wait two animation frames so @media print styles apply before printing. */
function waitForPrintLayout(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
}

/**
 * Print the #pos-receipt block (80 mm ticket via CSS @page).
 * Uses window.print() — reliable on macOS/Electron for the system dialog.
 */
export async function printPosReceipt(): Promise<{ ok: boolean; error?: string }> {
  document.body.setAttribute('data-printing', '1')
  document.documentElement.setAttribute('data-print-receipt', '1')
  await waitForPrintLayout()

  try {
    return await new Promise((resolve) => {
      let settled = false
      const finish = (result: { ok: boolean; error?: string }) => {
        if (settled) return
        settled = true
        window.removeEventListener('afterprint', onAfterPrint)
        resolve(result)
      }

      const onAfterPrint = () => finish({ ok: true })

      window.addEventListener('afterprint', onAfterPrint)
      window.print()

      // Electron/macOS sometimes skips afterprint; don't block the UI.
      setTimeout(() => finish({ ok: true }), 5_000)
    })
  } finally {
    document.body.removeAttribute('data-printing')
    document.documentElement.removeAttribute('data-print-receipt')
  }
}
