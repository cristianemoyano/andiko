"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("pos", {
  products: {
    search: (query) => electron.ipcRenderer.invoke("products:search", query)
  },
  customers: {
    search: (query) => electron.ipcRenderer.invoke("customers:search", query)
  },
  users: {
    search: (query) => electron.ipcRenderer.invoke("users:search", query),
    verifyPin: (args) => electron.ipcRenderer.invoke("users:verifyPin", args)
  },
  draftSales: {
    getActive: () => electron.ipcRenderer.invoke("draftSales:getActive"),
    list: (args) => electron.ipcRenderer.invoke("draftSales:list", args),
    get: (draftSaleId) => electron.ipcRenderer.invoke("draftSales:get", draftSaleId),
    createOrResume: (args) => electron.ipcRenderer.invoke("draftSales:createOrResume", args),
    update: (args) => electron.ipcRenderer.invoke("draftSales:update", args),
    checkout: (args) => electron.ipcRenderer.invoke("draftSales:checkout", args)
  },
  draftSaleItems: {
    upsert: (args) => electron.ipcRenderer.invoke("draftSaleItems:upsert", args),
    remove: (args) => electron.ipcRenderer.invoke("draftSaleItems:remove", args)
  },
  sales: {
    create: (sale) => electron.ipcRenderer.invoke("sales:create", sale),
    listToday: () => electron.ipcRenderer.invoke("sales:list-today"),
    list: (args) => electron.ipcRenderer.invoke("sales:list", args),
    get: (saleId) => electron.ipcRenderer.invoke("sales:get", saleId)
  },
  sync: {
    checkLicense: () => electron.ipcRenderer.invoke("license:check"),
    license: () => electron.ipcRenderer.invoke("sync:license"),
    catalog: () => electron.ipcRenderer.invoke("sync:catalog"),
    sales: () => electron.ipcRenderer.invoke("sync:sales")
  },
  settings: {
    save: (kv) => electron.ipcRenderer.invoke("settings:save", kv),
    get: () => electron.ipcRenderer.invoke("settings:get")
  }
});
