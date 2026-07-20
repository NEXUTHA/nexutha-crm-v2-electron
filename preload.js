const { contextBridge, ipcRenderer } = require('electron');
// 開発版かどうかは main.js が additionalArguments で渡す（配布版では false）
const isDev = process.argv.some(a => a === '--nexutha-isdev=true');
// 実行中アプリの実体バージョン（app.getVersion()）を main.js が渡す。
// これが「現在のバージョン」表示の唯一の正となる（ハードコード禁止）。
const versionArg = process.argv.find(a => a.startsWith('--nexutha-version='));
const appVersion = versionArg ? versionArg.split('=')[1] : null;
// UIは app:// からローカルで読み込むため、データAPIの宛先(オリジン)を main.js が明示的に渡す。
// これにより API_BASE を location.protocol からの推測に頼らず、dev(3456)/配布(9876)を確実化する。
const apiBaseArg = process.argv.find(a => a.startsWith('--nexutha-apibase='));
const appApiBase = apiBaseArg ? apiBaseArg.split('=')[1] : null;
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isDev: isDev,
  appVersion: appVersion,
  appApiBase: appApiBase,
  openAI: (model) => ipcRenderer.send('open-ai-window', model),
  checkForUpdates: () => ipcRenderer.send('check-for-updates'),
  // 「再試行」: スプラッシュのエラー画面や、画面内の接続エラーから呼ぶ。
  // main.js がバックエンドを必要なら再起動し、UI(app://)を読み直す。
  nxRetry: () => ipcRenderer.send('nx-retry')
});

// 画面(レンダラ)のJS例外を main.js 経由で electron-log に記録する。
// preloadはページと同じwindowのイベントを購読できるため、index.html を
// 触らずに未捕捉エラー・未処理Promiseを拾える。今後JSエラーで白画面に
// なっても ~/Library/Logs/NEXUTHA CRM/main.log に原因が残る。
window.addEventListener('error', (e) => {
  try {
    ipcRenderer.send('renderer-error', {
      kind: 'error',
      message: e.message,
      source: e.filename,
      line: e.lineno,
      col: e.colno,
      stack: e.error && e.error.stack ? String(e.error.stack) : undefined
    });
  } catch (_) {}
});
window.addEventListener('unhandledrejection', (e) => {
  try {
    const r = e.reason;
    ipcRenderer.send('renderer-error', {
      kind: 'unhandledrejection',
      message: r && r.message ? r.message : String(r),
      stack: r && r.stack ? String(r.stack) : undefined
    });
  } catch (_) {}
});
