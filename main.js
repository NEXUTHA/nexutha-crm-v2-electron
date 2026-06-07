const { app, BrowserWindow, shell, Menu, dialog, globalShortcut } = require('electron');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

// ================================================================
// ログ設定（electron-log）
//   配布版でも ~/Library/Logs/NEXUTHA CRM/main.log に全イベントが残る。
//   今まで console だけで配布版ではどこにも記録されず、自動更新の失敗原因が
//   一切追えなかった。これを解消する。
// ================================================================
log.transports.file.level = 'info';
log.transports.console.level = 'info';
log.info('==== アプリ起動 ==== version=' + app.getVersion() + ' isPackaged=' + app.isPackaged);
log.info('実行パス(execPath)=' + process.execPath);

let mainWindow;
let pythonProcess;
// 配布版（パッケージ済み）は9876、開発版は3456でポートを完全分離
const PORT = app.isPackaged ? 9876 : 3456;

function startPythonServer() {
  const isDev = !app.isPackaged;

  if (isDev) {
    // 開発版: Pythonで直接起動
    const pythonCmd = '/Users/runa.yasu/.pyenv/versions/3.10.6/bin/python3.10';
    const backendPath = path.join(__dirname, 'backend', 'app.py');
    console.log('Backend (dev):', pythonCmd, backendPath);
    pythonProcess = spawn(pythonCmd, [backendPath], {
      cwd: __dirname,
      env: { ...process.env }
    });
  } else {
    // 配布版: PyInstallerバイナリ
    const backendBin = path.join(process.resourcesPath, 'backend');
    console.log('Backend (prod):', backendBin);
    pythonProcess = spawn(backendBin, [], {
      cwd: process.resourcesPath,
      env: { ...process.env }
    });
  }

  pythonProcess.stdout.on('data', (data) => console.log(`Backend: ${data}`));
  pythonProcess.stderr.on('data', (data) => console.error(`Backend Error: ${data}`));
  pythonProcess.on('error', (err) => console.error('バックエンドエラー:', err));
}

function waitForServer(callback, retries = 60) {
  const req = http.get(`http://localhost:${PORT}/api/health`, (res) => {
    if (res.statusCode === 200) {
      callback();
    } else {
      setTimeout(() => waitForServer(callback, retries - 1), 1000);
    }
  });
  req.on('error', () => {
    if (retries > 0) {
      setTimeout(() => waitForServer(callback, retries - 1), 1000);
    } else {
      console.error('サーバー起動タイムアウト');
    }
  });
  req.end();
}

function createWindow() {
  // 開発時のキャッシュ無効化
  const { session } = require('electron');
  if (!app.isPackaged) session.defaultSession.clearCache();
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    title: app.isPackaged ? 'NEXUTHA CRM' : 'NEXUTHA CRM DEV',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      additionalArguments: [`--nexutha-isdev=${!app.isPackaged}`, `--nexutha-version=${app.getVersion()}`],
    },
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
  });


  mainWindow.loadURL(`http://localhost:${PORT}`);
  if (!app.isPackaged) mainWindow.webContents.openDevTools(); // 開発時のみ

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // 右クリックメニュー（コピペ対応）
  mainWindow.webContents.on('context-menu', (event, params) => {
    const contextMenu = Menu.buildFromTemplate([
      { label: 'コピー', role: 'copy', enabled: params.selectionText.length > 0 },
      { label: '貼り付け', role: 'paste' },
      { label: '切り取り', role: 'cut', enabled: params.selectionText.length > 0 },
      { type: 'separator' },
      { label: 'すべてを選択', role: 'selectAll' },
    ]);
    contextMenu.popup();
  });
}

// ================================================================
// AIチャットウィンドウ
// ================================================================
let aiWindow = null;

function createAIWindow(model) {
  const modelName = model || 'Llama-3.2-1B-Instruct-q4f32_1-MLC';
  if (aiWindow) {
    aiWindow.close();
    aiWindow = null;
  }
  aiWindow = new BrowserWindow({
    width: 460,
    height: 700,
    title: "NEXUTHA AI",
    resizable: true,
    minimizable: true,
    maximizable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  aiWindow.loadFile(path.join(__dirname, "ai-chat.html"), {
    query: { model: modelName }
  });
  aiWindow.on("closed", () => { aiWindow = null; });
}

// ================================================================
// App Translocation（アプリ隔離リダイレクト）検知
//   macOS Sierra以降、隔離属性(com.apple.quarantine)が付いたままのアプリは
//   読み取り専用のランダムなパスにコピーされて実行される。この状態だと
//   electron-updater(Squirrel.Mac)は実行中の読み取り専用コピーを置き換えようと
//   して必ず失敗する＝「ダウンロードは成功するのに適用されない」の主因。
//   この場合は自動更新を試みず、正しい再インストールを案内する。
//   参考: Apple Gatekeeper Path Randomization / electron-userland/electron-builder#7356
// ================================================================
function isTranslocated() {
  // 隔離リダイレクト時、実行パスに /AppTranslocation/ が含まれる
  return process.platform === 'darwin' && process.execPath.includes('/AppTranslocation/');
}

function warnTranslocation() {
  log.warn('App Translocation 検出: 読み取り専用パスで実行中のため自動更新は適用不可');
  dialog.showMessageBox(mainWindow, {
    type: 'warning',
    title: '自動更新を有効にするための設定',
    message: 'アプリが保護モードで起動しているため、自動更新を適用できません。',
    detail:
      '以下の手順で一度だけ設定すると、今後は自動更新が正しく動作します。\n\n' +
      '1. アプリを終了する\n' +
      '2. 「アプリケーション」フォルダを開く\n' +
      '3. 「NEXUTHA CRM」を右クリック →「開く」を選び、確認ダイアログで「開く」を押す\n\n' +
      'それでも改善しない場合は、最新版のインストーラ(dmg)を再ダウンロードし、' +
      'アプリを「アプリケーション」フォルダにドラッグして入れ直してください。',
    buttons: ['OK']
  });
}

// ================================================================
// 自動アップデート設定
// ================================================================
function setupAutoUpdater() {
  // ログを electron-log に接続（配布版でもファイルに残る）
  autoUpdater.logger = log;

  autoUpdater.on('checking-for-update', () => {
    log.info('アップデート確認中...');
  });

  autoUpdater.on('update-available', (info) => {
    log.info('アップデートあり: ' + info.version);
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'アップデートあり',
      message: `NEXUTHA CRM v${info.version} が利用可能です。ダウンロードします...`,
      buttons: ['OK']
    });
  });

  autoUpdater.on('update-not-available', () => {
    log.info('最新版です');
  });

  autoUpdater.on('download-progress', (progress) => {
    log.info(`ダウンロード中: ${Math.round(progress.percent)}%`);
  });

  autoUpdater.on('update-downloaded', (info) => {
    log.info('ダウンロード完了: ' + info.version + ' / 適用待ち');
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'アップデート準備完了',
      message: `v${info.version} のインストール準備ができました。再起動して適用しますか？`,
      buttons: ['今すぐ再起動', 'あとで']
    }).then(result => {
      if (result.response === 0) {
        log.info('ユーザーが再起動を選択 → quitAndInstall を実行');
        // macOSでquitAndInstallが「無反応／適用されない」既知問題への公式対処:
        //  1) setImmediate内で呼び、ダイアログ/シートのウィンドウ解放を待つ
        //  2) window-all-closed リスナを除去（quitを妨げないように）
        //  3) 全ウィンドウを明示的にclose
        //  4) quitAndInstall(false) を呼ぶ
        // 参考: electron-userland/electron-builder#1604 (maintainer develarの回答)
        setImmediate(() => {
          app.removeAllListeners('window-all-closed');
          // 子プロセス(Pythonバックエンド)を確実に終了させてから入れ替え
          if (pythonProcess) { try { pythonProcess.kill(); } catch (e) { log.warn('backend kill失敗: ' + e); } }
          BrowserWindow.getAllWindows().forEach(w => { try { w.close(); } catch (e) {} });
          autoUpdater.quitAndInstall(false);
        });
      } else {
        log.info('ユーザーは「あとで」を選択（次回起動時に自動適用される）');
      }
    });
  });

  autoUpdater.on('error', (err) => {
    log.error('アップデートエラー: ' + (err == null ? 'unknown' : (err.stack || err.message || err)));
  });

  // 起動時にアップデートチェック（配布版のみ）
  if (app.isPackaged) {
    if (isTranslocated()) {
      // 隔離状態では自動更新が原理的に効かないので、試みず案内に切り替える
      warnTranslocation();
    } else {
      autoUpdater.checkForUpdates();
    }
  }
}

app.whenReady().then(() => {
  // macOSのコピペメニューを有効化
  const template = [
    { label: 'NEXUTHA CRM' },
    {
      label: '編集',
      submenu: [
        { role: 'undo', label: '元に戻す' },
        { role: 'redo', label: 'やり直す' },
        { type: 'separator' },
        { role: 'cut', label: 'カット' },
        { role: 'copy', label: 'コピー' },
        { role: 'paste', label: 'ペースト' },
        { role: 'selectAll', label: 'すべてを選択' }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  startPythonServer();
  waitForServer(() => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      setupAutoUpdater();
    }
  });

  // Cmd+Option+I でDevToolsを開閉
  globalShortcut.register('CommandOrControl+Alt+I', () => {
    if (mainWindow) mainWindow.webContents.toggleDevTools();
  });

  // Cmd+Shift+A でAIチャットを開く
  // IPCでAIウィンドウを開く
  const { ipcMain } = require("electron");
  ipcMain.on("check-for-updates", () => {
    log.info('手動アップデート確認 要求');
    if (isTranslocated()) {
      warnTranslocation();
    } else {
      autoUpdater.checkForUpdates();
    }
  });

  ipcMain.on("open-ai-window", (event, model) => {
    createAIWindow(model);
  });

  globalShortcut.register("CommandOrControl+Shift+A", () => {
    createAIWindow();
  });
});

app.on('window-all-closed', () => {
  if (pythonProcess) pythonProcess.kill();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('before-quit', () => {
  if (pythonProcess) pythonProcess.kill();
});


