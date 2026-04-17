const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  openAI: (model) => ipcRenderer.send('open-ai-window', model)
});
