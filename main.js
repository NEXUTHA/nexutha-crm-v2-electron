const { app, BrowserWindow, shell, Menu } = require('electron');
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
    }
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


