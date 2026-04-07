const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("clipboardAPI", {
  onHistoryUpdated: (callback) => ipcRenderer.on("history-updated", (event, data) => callback(data)),
  requestHistory: () => ipcRenderer.send("request-history"),
  copyItem: (id) => ipcRenderer.send("copy-item", id),
  pinItem: (id) => ipcRenderer.send("pin-item", id),
  deleteItem: (id) => ipcRenderer.send("delete-item", id),
  clearHistory: () => ipcRenderer.send("clear-history"),
  hideWindow: () => ipcRenderer.send("hide-window")   
});