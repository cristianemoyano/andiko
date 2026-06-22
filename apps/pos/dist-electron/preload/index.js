"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("pos", {
  products: {
    search: (query) => electron.ipcRenderer.invoke("products:search", query),
    getByPlu: (plu) => electron.ipcRenderer.invoke("products:getByPlu", plu)
  },
  customers: {
    search: (query) => electron.ipcRenderer.invoke("customers:search", query),
    get: (id) => electron.ipcRenderer.invoke("customers:get", id)
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
    checkout: (args) => electron.ipcRenderer.invoke("draftSales:checkout", args),
    cancel: (draftSaleId) => electron.ipcRenderer.invoke("draftSales:cancel", draftSaleId)
  },
  draftSaleItems: {
    upsert: (args) => electron.ipcRenderer.invoke("draftSaleItems:upsert", args),
    remove: (args) => electron.ipcRenderer.invoke("draftSaleItems:remove", args)
  },
  cashSessions: {
    getCurrent: () => electron.ipcRenderer.invoke("cashSessions:getCurrent"),
    open: (args) => electron.ipcRenderer.invoke("cashSessions:open", args),
    close: (args) => electron.ipcRenderer.invoke("cashSessions:close", args),
    list: (args) => electron.ipcRenderer.invoke("cashSessions:list", args),
    get: (sessionId) => electron.ipcRenderer.invoke("cashSessions:get", sessionId)
  },
  sales: {
    create: (sale) => electron.ipcRenderer.invoke("sales:create", sale),
    listToday: () => electron.ipcRenderer.invoke("sales:list-today"),
    list: (args) => electron.ipcRenderer.invoke("sales:list", args),
    get: (saleId) => electron.ipcRenderer.invoke("sales:get", saleId),
    authorizeFiscal: (saleId) => electron.ipcRenderer.invoke("sales:authorizeFiscal", saleId),
    closingReport: (date) => electron.ipcRenderer.invoke("sales:closingReport", date)
  },
  paymentMethods: {
    list: () => electron.ipcRenderer.invoke("paymentMethods:list")
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
  },
  scale: {
    listPorts: () => electron.ipcRenderer.invoke("scale:listPorts"),
    readWeight: () => electron.ipcRenderer.invoke("scale:readWeight"),
    status: () => electron.ipcRenderer.invoke("scale:status")
  },
  dev: {
    resetLocalData: () => electron.ipcRenderer.invoke("dev:resetLocalData")
  },
  print: {
    receipt: () => electron.ipcRenderer.invoke("print:receipt")
  }
});
