const { contextBridge, ipcRenderer } = require('electron');
// 開発版かどうかは main.js が additionalArguments で渡す（配布版では false）
const isDev = process.argv.some(a => a === '--nexutha-isdev=true');
// 実行中アプリの実体バージョン（app.getVersion()）を main.js が渡す。
// これが「現在のバージョン」表示の唯一の正となる（ハードコード禁止）。
const versionArg = process.argv.find(a => a.startsWith('--nexutha-version='));
const appVersion = versionArg ? versionArg.split('=')[1] : null;
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isDev: isDev,
  appVersion: appVersion,
  openAI: (model) => ipcRenderer.send('open-ai-window', model),
  checkForUpdates: () => ipcRenderer.send('check-for-updates')
});
