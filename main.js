const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');

let mainWindow;
let pythonProcess;
const PORT = 8083;

function startPythonServer() {
  const pythonCmd = '/Users/runa.yasu/.pyenv/versions/3.10.6/bin/python3.10';
  
  // 開発時とビルド後でパスを切り替え
  const isDev = !app.isPackaged;
  const backendPath = isDev
    ? path.join(__dirname, '..', 'NEXUTHA-CRM-V2', 'backend')
    : path.join(process.resourcesPath, 'backend');

  const projectRoot = isDev
    ? path.join(__dirname, '..', 'NEXUTHA-CRM-V2')
    : path.join(process.resourcesPath);

  console.log('Python:', pythonCmd);
  console.log('Project root:', projectRoot);

  pythonProcess = spawn(pythonCmd, [
    '-m', 'uvicorn', 'backend.app:app',
    '--host', '127.0.0.1',
    '--port', String(PORT)
  ], {
    cwd: projectRoot,
    env: { ...process.env }
  });

  pythonProcess.stdout.on('data', (data) => console.log(`Python: ${data}`));
  pythonProcess.stderr.on('data', (data) => console.error(`Python Error: ${data}`));
  
  pythonProcess.on('error', (err) => {
    console.error('Pythonプロセスエラー:', err);
  });
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
}

app.whenReady().then(() => {
  startPythonServer();
  waitForServer(() => createWindow());
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
