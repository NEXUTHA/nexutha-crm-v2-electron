const { app, BrowserWindow, shell, Menu, dialog, globalShortcut, protocol, net } = require('electron');
const { autoUpdater } = require('electron-updater');
const log = require('electron-log');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const http = require('http');
const { pathToFileURL } = require('url');

// ================================================================
// 白画面の構造的根治: UI を HTTP 配信から外し、ローカルから app:// で読む
//   これまで UI(index.html/js/css) を Python(:9876) が配信していたため、
//   バックエンドが起動しきるまで画面が空白になる構造だった。
//   UI をアプリ同梱ファイルから app:// で読み込めば、UIの外枠は常に即描画され、
//   バックエンドはデータ専用API(/api/*)に格下げできる。白画面は構造上ありえなくなる。
//   ※ app:// を「標準・セキュア・fetch可」スキームとして登録（whenReady前に必須）。
//     Service Worker は使わないので allowServiceWorkers は付けない。
// ================================================================
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }
]);

// app:// が配信するフロント一式の場所（バックエンドが従来配信していたのと同一の出所）
//   配布版: Contents/Resources/（extraResources で index.html/js/style.css 等を配置済み）
//   開発版: プロジェクト直下
function frontendDir() {
  return app.isPackaged ? process.resourcesPath : __dirname;
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.map': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm'
};

// app:// のリクエストをローカルファイルに解決して返すハンドラ（whenReady内で登録）
function registerAppProtocol() {
  protocol.handle('app', async (request) => {
    try {
      const root = frontendDir();
      const u = new URL(request.url);
      let rel = decodeURIComponent(u.pathname || '/');
      if (rel === '/' || rel === '') rel = '/index.html';
      // パストラバーサル防御: 正規化し、root配下に収まることを保証
      const safeRel = path.normalize(rel).replace(/^(\.\.[/\\])+/, '');
      let filePath = path.join(root, safeRel);
      if (!filePath.startsWith(root)) filePath = path.join(root, 'index.html');
      if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
        // SPAフォールバック（未知パスは index.html を返す）
        filePath = path.join(root, 'index.html');
      }
      const data = await fs.promises.readFile(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream' };
      return new Response(data, { status: 200, headers });
    } catch (e) {
      log.error('app://ハンドラ失敗: ' + e);
      return new Response('Internal Error', { status: 500, headers: { 'Content-Type': 'text/plain' } });
    }
  });
  log.info('app:// プロトコルを登録（フロント配信元=' + frontendDir() + '）');
}

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

// ================================================================
// 多重起動防止（白画面・ポート競合の主因対策）
//   同じアプリが二重に起動するとバックエンドが2つ立ち上がり、ポート9876の
//   奪い合い→片方が起動失敗→古い方が応答 or 接続拒否で白画面、という事故が起きる。
//   2つ目の起動は即終了し、既存ウィンドウを前面に出す。
//   ※ 公式パターン: ロックを取得できた時だけ起動処理(whenReady)を登録する。
//     こうしないと、2つ目のインスタンスでも whenReady 内の reclaimPort() が走り、
//     1つ目のバックエンドを殺してしまう事故が起きる。
//   ※ translocation修復(app.relaunch)時は、古いインスタンスがapp.exit(0)で
//     ロックを解放してから新インスタンスが取得するため競合しない。
// ================================================================
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  log.warn('既に起動済みのため、この2つ目のインスタンスを終了します（起動処理は実行しない）');
  app.quit();
}

// ================================================================
// アップデート後の「画面が古いまま」問題への対処
//   レンダラは http://localhost:9876 から index.html/js/css を読み込むが、
//   ElectronのHTTPディスクキャッシュはアプリ更新後も残り、旧バージョンの
//   index.html等を配信し続ける（=UI/JSの修正がユーザーに届かない）。
//   そこで、前回起動時とアプリ版が変わっていたらHTTPキャッシュを一度クリアし、
//   必ず新しい画面リソースを読み込ませる。データ(Cookie/localStorage/DB)は消さない。
// ================================================================
async function clearHttpCacheOnVersionChange() {
  try {
    const { session } = require('electron');
    const verFile = path.join(app.getPath('userData'), 'last-run-version.txt');
    let last = null;
    try { last = fs.readFileSync(verFile, 'utf8').trim(); } catch (e) {}
    const cur = app.getVersion();
    if (last !== cur) {
      log.info(`バージョン変更を検出(${last || '初回'} → ${cur})。HTTPキャッシュをクリアします`);
      await session.defaultSession.clearCache();
      try { fs.writeFileSync(verFile, cur); } catch (e) { log.warn('版ファイル書込失敗: ' + e); }
    } else {
      log.info('バージョン変更なし。キャッシュ維持');
    }
  } catch (e) {
    log.warn('キャッシュクリア処理でエラー: ' + e);
  }
}

// ================================================================
// インストール場所の自動修復（新規購入者が何もしなくても自動更新が効くように）
//   購入者がブラウザでdmgをDL→/Applicationsへ入れると com.apple.quarantine が付き、
//   App Translocation で読み取り専用パスから実行され、自動更新の適用が不可能になる。
//   そこで起動時(ウィンドウ生成前)に、ユーザー操作なしで自動修復する:
//     A. translocation検出時: /Applications の本体から隔離属性を除去し、正規パスで再起動
//     B. /Applications 外で実行時: 公式API moveToApplicationsFolder() で移動(成功で自動再起動)
//   無限ループ防止のため userData に試行フラグを置き、各エピソードで修復は1回だけ試みる。
//   ※ 隔離属性除去とアプリ移動のみ。データ(DB/設定/Cookie/localStorage)には一切触れない。
//   戻り値: true = 再起動/終了を開始した(以降の起動処理を止める) / false = 通常起動を続行
// ================================================================
function handleInstallLocation() {
  try {
    if (!app.isPackaged) return false; // 開発版は対象外（誤ってmove等しない）
    if (process.platform !== 'darwin') return false;

    const flagFile = path.join(app.getPath('userData'), 'install-repair-attempted.txt');
    const translocated = isTranslocated();
    let inApps = false;
    try { inApps = app.isInApplicationsFolder(); } catch (e) { log.warn('isInApplicationsFolder失敗: ' + e); }
    log.info(`インストール場所チェック: translocated=${translocated} inApplications=${inApps}`);

    // 理想状態（正規/Applications・非translocation）。修復フラグを掃除して通常起動
    if (!translocated && inApps) {
      try { if (fs.existsSync(flagFile)) fs.unlinkSync(flagFile); } catch (e) {}
      return false;
    }

    const alreadyTried = fs.existsSync(flagFile);

    // --- A. translocation の自動修復 ---
    if (translocated) {
      if (alreadyTried) {
        log.warn('translocation: 自動修復済フラグありだが未解消。ループ防止のため案内に切替');
        return false; // setupAutoUpdater 側で warnTranslocation() が出る
      }
      // 元の/Applications本体パスを execPath のバンドル名から推定
      const m = process.execPath.match(/\/([^/]+\.app)\//);
      const bundle = m ? m[1] : (app.getName() + '.app');
      const original = '/Applications/' + bundle;
      const originalBin = original + '/Contents/MacOS/' + path.basename(process.execPath);
      if (!fs.existsSync(originalBin)) {
        log.warn('translocation: 元アプリが見つからない(' + original + ')。案内に切替');
        return false;
      }
      log.info('translocation検出 → 自動修復: 隔離属性を除去 ' + original);
      try { fs.writeFileSync(flagFile, 'A'); } catch (e) { log.warn('フラグ書込失敗: ' + e); }
      const { spawnSync } = require('child_process');
      const r = spawnSync('/usr/bin/xattr', ['-dr', 'com.apple.quarantine', original]);
      log.info('xattr -dr com.apple.quarantine 終了コード=' + r.status);
      if (r.status === 0) {
        log.info('隔離属性を除去。正規パスから再起動します: ' + originalBin);
        app.relaunch({ execPath: originalBin });
        app.exit(0);
        return true;
      }
      log.warn('xattr失敗(status=' + r.status + ')。再起動せず案内に切替');
      return false;
    }

    // --- B. /Applications 外で実行 → 公式APIで移動 ---
    if (!inApps) {
      if (alreadyTried) {
        log.warn('move: 既に試行済。ループ防止のため通常起動を続行');
        return false;
      }
      try { fs.writeFileSync(flagFile, 'B'); } catch (e) {}
      try {
        log.info('/Applications外で実行中 → moveToApplicationsFolder()');
        const moved = app.moveToApplicationsFolder();
        if (moved) { log.info('moveToApplicationsFolder成功(自動で再起動)'); return true; }
        log.warn('moveToApplicationsFolder: ユーザーがキャンセル。通常起動を続行');
        return false;
      } catch (e) {
        log.error('moveToApplicationsFolder失敗: ' + e);
        return false;
      }
    }
    return false;
  } catch (e) {
    log.error('インストール場所修復で例外: ' + e);
    return false;
  }
}

let mainWindow;
let pythonProcess;
let isQuitting = false;   // アプリ終了中（バックエンドの自動再起動を抑止）
let isUpdating = false;   // 更新適用中（quitAndInstall。バックエンド再起動を抑止）
let reloadAttempts = 0;   // 本体読み込みの再試行回数（指数バックオフ用）
let reloadTimer = null;   // 再読み込みの予約タイマー
let backendRestartAttempts = 0;     // バックエンドの連続再起動回数（暴走防止）
let backendRestartTimer = null;     // バックエンド再起動の予約タイマー
const MAX_BACKEND_RESTARTS = 5;     // この回数連続で失敗したら再起動を諦める
// 配布版（パッケージ済み）は9876、開発版は3456でポートを完全分離
const PORT = app.isPackaged ? 9876 : 3456;

// ================================================================
// ポート衛生: 残存バックエンドの掃除
//   PyInstaller製バックエンドは「親(起動役)＋子(本体)」の2プロセス構成で、
//   過去の更新・異常終了で子プロセスが生き残り9876を握り続けることがある。
//   その状態だと新バージョンのバックエンドが起動できず、古い版が配信され続けたり
//   接続拒否で白画面になる。起動直後にポートの占有者を強制終了して必ず再取得する。
//   ※ 9876/3456 は本アプリ専用ポート。占有者は自分自身のバックエンドに限られる。
// ================================================================
function reclaimPort() {
  try {
    const { execSync } = require('child_process');
    let out = '';
    try {
      out = execSync(`/usr/sbin/lsof -nP -iTCP:${PORT} -sTCP:LISTEN -t`, { encoding: 'utf8' }).trim();
    } catch (e) { return; } // 占有者なし(lsofは非ゼロ終了)→何もしない
    if (!out) return;
    out.split('\n').forEach((pidStr) => {
      const pid = Number((pidStr || '').trim());
      if (pid && pid !== process.pid) {
        log.warn(`ポート${PORT}を占有する残存プロセス pid=${pid} を終了します`);
        try { process.kill(pid, 'SIGKILL'); } catch (e) { log.warn('残存プロセスkill失敗: ' + e); }
      }
    });
  } catch (e) {
    log.warn('reclaimPortで例外: ' + e);
  }
}

// バックエンドをプロセスグループごと確実に終了する（子プロセスの取り残し防止）
function killBackend() {
  if (!pythonProcess) return;
  const pid = pythonProcess.pid;
  try {
    if (pid) {
      // detached:true で起動しているのでプロセスグループ(-pid)ごと終了できる
      try { process.kill(-pid, 'SIGTERM'); }
      catch (e) { try { pythonProcess.kill('SIGTERM'); } catch (_) {} }
    }
  } catch (e) {
    log.warn('killBackend失敗: ' + e);
  }
  pythonProcess = null;
}

function startPythonServer() {
  const isDev = !app.isPackaged;

  // detached:true でバックエンドを新しいプロセスグループのリーダーにする。
  // こうすると killBackend() が子プロセスごと(-pid)確実に終了でき、
  // 9876を握ったままの取り残し(=更新後に古い版が残る/白画面)を防げる。
  if (isDev) {
    // 開発版: Pythonで直接起動
    const pythonCmd = '/Users/runa.yasu/.pyenv/versions/3.10.6/bin/python3.10';
    const backendPath = path.join(__dirname, 'backend', 'app.py');
    console.log('Backend (dev):', pythonCmd, backendPath);
    pythonProcess = spawn(pythonCmd, [backendPath], {
      cwd: __dirname,
      env: { ...process.env },
      detached: true
    });
  } else {
    // 配布版: PyInstaller onedir。実行ファイルは Resources/backend/backend、
    // 依存(_internal/*.so,*.dylib)は同じ backend ディレクトリ内にある。
    const backendDir = path.join(process.resourcesPath, 'backend');
    const backendBin = path.join(backendDir, 'backend');
    console.log('Backend (prod):', backendBin);
    pythonProcess = spawn(backendBin, [], {
      cwd: backendDir,
      env: { ...process.env },
      detached: true
    });
  }

  log.info('バックエンド起動 pid=' + (pythonProcess && pythonProcess.pid));
  pythonProcess.stdout.on('data', (data) => console.log(`Backend: ${data}`));
  pythonProcess.stderr.on('data', (data) => console.error(`Backend Error: ${data}`));
  pythonProcess.on('error', (err) => { console.error('バックエンドエラー:', err); log.error('バックエンドspawnエラー: ' + err); });
  // バックエンドが予期せず落ちたら、終了/更新中でない限り自動復旧する（白画面の自己回復）。
  // ただし無間隔・無制限に再起動すると暴走するので、指数バックオフ＋連続失敗上限を設ける。
  pythonProcess.on('exit', (code, signal) => {
    log.warn(`バックエンド終了 code=${code} signal=${signal}`);
    pythonProcess = null;
    if (isQuitting || isUpdating) return;
    scheduleBackendRestart();
  });
}

// バックエンドの再起動を指数バックオフで予約する。
//   ・間隔: 1,2,4,8,15秒(上限)。 ・連続失敗が上限に達したら諦めてエラー画面に切替。
//   ・健全化に成功したら backendRestartAttempts は 0 にリセット（loadMainApp内）。
function scheduleBackendRestart() {
  if (backendRestartTimer || isQuitting || isUpdating) return;
  if (backendRestartAttempts >= MAX_BACKEND_RESTARTS) {
    // UI(app://)は既に描画済みで、レンダラ側の接続ゲート/監視が画面内に
    // 「エラー＋再試行」を表示する。ここでスプラッシュに切り替えると逆に
    // 生きているUIを潰してしまうため、ログのみ残して再起動を停止する。
    // （ユーザーが画面内の「再試行」を押すと nx-retry でカウンタがリセットされ再開する）
    log.error(`バックエンドの再起動に${MAX_BACKEND_RESTARTS}回連続で失敗しました。自動再起動を停止します（画面内の再試行で再開可能）`);
    return;
  }
  backendRestartAttempts++;
  const delay = Math.min(1000 * Math.pow(2, backendRestartAttempts - 1), 15000); // 1,2,4,8,15s上限
  log.warn(`バックエンドを${delay}ms後に再起動します(${backendRestartAttempts}/${MAX_BACKEND_RESTARTS})`);
  // ※ UI(app://)は再読み込みしない。UIはローカルで生きており、データ取得の可否は
  //   レンダラ側の接続ゲート/ヘルス監視が画面内に表示する。ここでUIをいじると、
  //   再起動のたびに接続ゲートが振り出しに戻り「接続中…」が無限ループ＋health連打に
  //   なる。よってここはバックエンドプロセスの再起動だけを行う。
  backendRestartTimer = setTimeout(() => {
    backendRestartTimer = null;
    if (isQuitting || isUpdating) return;
    reclaimPort();
    startPythonServer();
  }, delay);
}

function waitForServer(onReady, retries = 60, onTimeout) {
  const req = http.get(`http://localhost:${PORT}/api/health`, (res) => {
    if (res.statusCode === 200) {
      res.resume();
      onReady();
    } else {
      res.resume();
      retry();
    }
  });
  req.on('error', retry);
  req.setTimeout(2000, () => { try { req.destroy(); } catch (e) {} });
  function retry() {
    if (retries > 0) {
      setTimeout(() => waitForServer(onReady, retries - 1, onTimeout), 1000);
    } else {
      log.error('サーバー起動タイムアウト');
      if (typeof onTimeout === 'function') onTimeout();
    }
  }
  req.end();
}

// ================================================================
// スプラッシュ／エラー画面（純粋な白画面を絶対に出さないための同梱ローカル画面）
//   mode='loading' = 起動中スピナー / mode='error' = 再試行中表示
// ================================================================
function showSplash(mode) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const file = path.join(__dirname, 'loading.html');
  mainWindow.loadFile(file, { hash: mode === 'error' ? 'error' : 'loading' })
    .catch((e) => log.warn('スプラッシュ表示失敗: ' + e));
}

// ================================================================
// UI を app:// からローカルで読み込む（バックエンドを待たない＝白画面が構造上出ない）。
//   バックエンドの準備状況は、レンダラ側の接続ゲート(/api/health監視)が扱う。
//   app:// の読み込み自体に失敗した場合のみ、安全網として再試行する。
// ================================================================
function loadMainApp() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  log.info('UIをローカル(app://)から読み込みます');
  mainWindow.loadURL('app://crm/')
    .catch((e) => {
      // ERR_ABORTED(-3) は後続ナビゲーションに置き換えられた正常な中断。失敗扱いしない。
      const msg = String(e && (e.message || e));
      if (msg.includes('ERR_ABORTED')) { log.info('app:// 読み込みが中断(後続ナビゲーション)。無視'); return; }
      log.error('app:// 読み込み失敗: ' + msg);
      showSplash('error');
      scheduleReload();
    });
}

// 読み込み失敗時に指数バックオフで再読み込みを予約（永久白画面の防止）
function scheduleReload() {
  if (reloadTimer || isQuitting || isUpdating) return;
  reloadAttempts++;
  const delay = Math.min(1000 * Math.pow(2, reloadAttempts - 1), 15000); // 1,2,4,8,15s上限
  log.info(`本体の再読み込みを${delay}ms後に試行します(${reloadAttempts}回目)`);
  reloadTimer = setTimeout(() => {
    reloadTimer = null;
    if (isQuitting || isUpdating) return;
    // バックエンドが落ちている場合は、上限付きの再起動スケジューラに委ねる
    // （ここで直接起動すると連続失敗の上限を回避してしまうため）
    if (!pythonProcess) { scheduleBackendRestart(); return; }
    loadMainApp();
  }, delay);
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
    backgroundColor: '#0e0e10',   // 描画前でも白くならないようUIと同じ暗色を初期背景に
    title: app.isPackaged ? 'NEXUTHA CRM' : 'NEXUTHA CRM DEV',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      additionalArguments: [
        `--nexutha-isdev=${!app.isPackaged}`,
        `--nexutha-version=${app.getVersion()}`,
        `--nexutha-apibase=http://localhost:${PORT}`,
      ],
    },
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
  });


  // UIは app:// からローカルで即読み込む（白画面は構造上出ない）。背景色を暗色にして
  // あるため描画前でも白くならない。起動時スプラッシュは使わず、app:// 読み込み自体が
  // 失敗した時だけ loading.html#error を出す（安全網）。
  //   ※ 起動時に loadFile(splash) と loadURL(app://) を二重に走らせると互いを
  //     ERR_ABORTED で中断し合い、誤判定でスプラッシュとapp://が交互に切り替わる不具合が出た。
  //     そのため起動時の事前スプラッシュは行わない。
  if (!app.isPackaged) mainWindow.webContents.openDevTools(); // 開発時のみ

  // UI(app://)の読み込み失敗を捕捉して自動復帰（永久白画面の防止・安全網）
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDesc, validatedURL, isMainFrame) => {
    if (errorCode === -3) return; // ERR_ABORTED（loadURL差し替え時の正常な中断）は無視
    if (!isMainFrame) return;
    // 対象は app:// 本体の読み込み失敗のみ（スプラッシュ等のローカルfileは対象外）
    if (!validatedURL || !validatedURL.startsWith('app://')) return;
    log.error(`UI(app://)読み込み失敗 code=${errorCode} desc=${errorDesc} url=${validatedURL}`);
    showSplash('error');
    scheduleReload();
  });

  mainWindow.webContents.on('did-finish-load', () => {
    const url = mainWindow.webContents.getURL();
    if (url && url.startsWith('app://')) {
      reloadAttempts = 0; // 成功したのでバックオフをリセット
      log.info('UI(app://)の読み込み完了');
    }
  });

  mainWindow.webContents.on('render-process-gone', (event, details) => {
    log.error('レンダラプロセス消失: ' + JSON.stringify(details));
    if (isQuitting || isUpdating) return;
    showSplash('error');
    scheduleReload();
  });

  mainWindow.on('unresponsive', () => log.warn('ウィンドウが応答なし'));

  // レンダラ(画面)のJS例外を electron-log に記録（preload経由）。
  // 今後JSエラーで白画面になっても main.log に原因が残る。
  const { ipcMain } = require('electron');
  ipcMain.removeAllListeners('renderer-error');
  ipcMain.on('renderer-error', (ev, info) => {
    try { log.error('レンダラエラー: ' + JSON.stringify(info)); } catch (e) { log.error('レンダラエラー(整形不可)'); }
  });

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
        isUpdating = true; // バックエンドのexitで自動再起動しないように
        if (reloadTimer) { clearTimeout(reloadTimer); reloadTimer = null; }
        if (backendRestartTimer) { clearTimeout(backendRestartTimer); backendRestartTimer = null; }
        setImmediate(() => {
          app.removeAllListeners('window-all-closed');
          // 子プロセス(Pythonバックエンド)をプロセスグループごと確実に終了させてから入れ替え
          killBackend();
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

// ロックを取得できたインスタンスだけが起動処理を行う（2つ目は上で app.quit() 済み）
if (gotSingleInstanceLock) app.whenReady().then(async () => {
  // 新規購入者が何もしなくても自動更新が効くよう、インストール場所を自動修復。
  // translocation解消や/Applicationsへの移動で再起動する場合はここで処理を止める。
  if (handleInstallLocation()) return;
  // アップデート後に古い画面が出る問題を防ぐため、版が変わっていればHTTPキャッシュをクリア
  await clearHttpCacheOnVersionChange();
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

  // app:// プロトコル（UIのローカル配信）を登録
  registerAppProtocol();

  // 2つ目の起動が来たら既存ウィンドウを前面に出す
  app.on('second-instance', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  // 起動順: ポート掃除 → ウィンドウ(スプラッシュ即表示) → UIをapp://で即読み込み →
  //         バックエンド起動(データ用) → 自動更新設定。
  //   UIはバックエンドを待たずに描画され、データ取得はレンダラの接続ゲートが扱う。
  reclaimPort();
  createWindow();      // 暗色背景のウィンドウを生成（描画前でも白くならない）
  loadMainApp();       // app://crm/ を即読み込み（バックエンド非依存・UIは即描画）
  startPythonServer(); // データ専用API（/api/*）を起動
  setupAutoUpdater();

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

  // 「再試行」要求（スプラッシュのエラー画面 or 画面内の接続エラーから）。
  //   バックエンドが落ちていれば掃除して再起動し、再試行カウンタをリセット。
  //   UIがスプラッシュ等(app://以外)を表示中なら app:// を読み直す。
  ipcMain.on("nx-retry", () => {
    if (isQuitting || isUpdating) return;
    log.info('再試行要求(nx-retry)を受信');
    reloadAttempts = 0;
    backendRestartAttempts = 0;
    if (reloadTimer) { clearTimeout(reloadTimer); reloadTimer = null; }
    if (backendRestartTimer) { clearTimeout(backendRestartTimer); backendRestartTimer = null; }
    if (!pythonProcess) { reclaimPort(); startPythonServer(); }
    try {
      const url = mainWindow && !mainWindow.isDestroyed() ? mainWindow.webContents.getURL() : '';
      if (!url || !url.startsWith('app://')) loadMainApp();
    } catch (e) { log.warn('nx-retry時のURL確認失敗: ' + e); }
  });

  globalShortcut.register("CommandOrControl+Shift+A", () => {
    createAIWindow();
  });
});

app.on('window-all-closed', () => {
  killBackend();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    // ユーザー操作による再表示なので、諦め状態でも再起動の機会を与える（カウンタリセット）
    backendRestartAttempts = 0;
    if (backendRestartTimer) { clearTimeout(backendRestartTimer); backendRestartTimer = null; }
    // バックエンドが落ちていれば掃除して立て直してから読み込む
    if (!pythonProcess) { reclaimPort(); startPythonServer(); }
    createWindow();
    loadMainApp();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  if (reloadTimer) { clearTimeout(reloadTimer); reloadTimer = null; }
  if (backendRestartTimer) { clearTimeout(backendRestartTimer); backendRestartTimer = null; }
  killBackend();
});


