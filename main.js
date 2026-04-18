const { app, BrowserWindow, shell, Menu, dialog, globalShortcut } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

let mainWindow;
let pythonProcess;
const PORT = 9876;

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
    title: 'NEXUTHA CRM',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
    },
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
  });


  mainWindow.loadURL(`http://localhost:${PORT}`);
  mainWindow.webContents.openDevTools(); // デバッグ用

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
// 自動アップデート設定
// ================================================================
function setupAutoUpdater() {
  // ログ出力
  autoUpdater.logger = require('electron').app ? console : null;

  autoUpdater.on('checking-for-update', () => {
    console.log('アップデート確認中...');
  });

  autoUpdater.on('update-available', (info) => {
    console.log('アップデートあり:', info.version);
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'アップデートあり',
      message: `NEXUTHA CRM v${info.version} が利用可能です。ダウンロードします...`,
      buttons: ['OK']
    });
  });

  autoUpdater.on('update-not-available', () => {
    console.log('最新版です');
  });

  autoUpdater.on('download-progress', (progress) => {
    console.log(`ダウンロード中: ${Math.round(progress.percent)}%`);
  });

  autoUpdater.on('update-downloaded', (info) => {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'アップデート準備完了',
      message: `v${info.version} のインストール準備ができました。再起動して適用しますか？`,
      buttons: ['今すぐ再起動', 'あとで']
    }).then(result => {
      if (result.response === 0) {
        autoUpdater.quitAndInstall();
      }
    });
  });

  autoUpdater.on('error', (err) => {
    console.error('アップデートエラー:', err.message);
  });

  // 起動時にアップデートチェック（配布版のみ）
  if (app.isPackaged) {
    autoUpdater.checkForUpdates();
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


