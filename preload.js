const { contextBridge, ipcRenderer } = require('electron');
// 開発版かどうかは main.js が additionalArguments で渡す（配布版では false）
const isDev = process.argv.some(a => a === '--nexutha-isdev=true');
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isDev: isDev,
  openAI: (model) => ipcRenderer.send('open-ai-window', model),
  checkForUpdates: () => ipcRenderer.send('check-for-updates')
});
