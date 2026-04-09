const { contextBridge } = require('electron');
// 必要に応じてAPIを公開
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform
});
