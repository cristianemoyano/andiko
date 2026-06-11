"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("pos", {
  sales: {
    create: (sale) => electron.ipcRenderer.invoke("sales:create", sale),
    listToday: () => electron.ipcRenderer.invoke("sales:list-today")
  },
  sync: {
    catalog: () => electron.ipcRenderer.invoke("sync:catalog"),
    sales: () => electron.ipcRenderer.invoke("sync:sales")
  },
  settings: {
    save: (kv) => electron.ipcRenderer.invoke("settings:save", kv),
    get: () => electron.ipcRenderer.invoke("settings:get")
  }
});
