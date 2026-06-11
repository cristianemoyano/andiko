import { app, BrowserWindow, ipcMain, globalShortcut } from 'electron'
import { join } from 'path'
import { initDb } from './db'
import { registerSyncHandlers } from './sync'
import { registerSalesHandlers } from './sales'
import { registerProductsHandlers } from './products'
import { registerCustomersHandlers } from './customers'
import { registerDraftSalesHandlers } from './draft-sales'
import { registerCashSessionHandlers } from './cash-sessions'

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    fullscreen: process.env.NODE_ENV !== 'development',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // F11 — toggle fullscreen
  globalShortcut.register('F11', () => {
    mainWindow?.setFullScreen(!mainWindow.isFullScreen())
  })

  // Cmd+Option+I (mac) / Ctrl+Shift+I (win/linux) — toggle DevTools for debugging
  globalShortcut.register('CommandOrControl+Alt+I', () => {
    mainWindow?.webContents.toggleDevTools()
  })
}

app.whenReady().then(async () => {
  try {
    initDb()
  } catch (err) {
    console.error('[DB] Failed to initialize database:', err)
  }
  registerSalesHandlers(ipcMain)
  registerProductsHandlers(ipcMain)
  registerCustomersHandlers(ipcMain)
  registerDraftSalesHandlers(ipcMain)
  registerCashSessionHandlers(ipcMain)
  registerSyncHandlers(ipcMain)
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
