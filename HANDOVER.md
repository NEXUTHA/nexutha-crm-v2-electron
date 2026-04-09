# NEXUTHA CRM V2 - Electron版 引き継ぎ書

## このリポジトリについて
NEXUTHA CRM V2のElectronデスクトップアプリ版。
ダブルクリックで起動できる .dmg 配布を目的とする。

## 関連リポジトリ
- CRMソースコード: git@github.com:NEXUTHA/nexutha-crm-v2.git
- このリポジトリ: git@github.com:NEXUTHA/nexutha-crm-v2-electron.git

## 現在の状態（2026-04-09）
- Electron + uvicorn(FastAPI) で動作確認済み
- ライセンス認証・ダッシュボード表示確認済み
- 開発用ライセンスキー: NXTH-0001-3C6B-BF0B

## 起動方法（開発時）
前提: ~/NEXUTHA-CRM-V2/ が存在していること

pkill -f uvicorn 2>/dev/null
cd ~/NEXUTHA-CRM-V2-electron
npx electron .

## 仕組み
1. main.js が Electronウィンドウを起動
2. 裏で uvicorn を使って FastAPI サーバーを起動
   - Python: /Users/runa.yasu/.pyenv/versions/3.10.6/bin/python3.10
   - 起動コマンド: python3.10 -m uvicorn backend.app:app --host 127.0.0.1 --port 8083
   - プロジェクトルート: ~/NEXUTHA-CRM-V2/
3. ElectronウィンドウでCRMを表示（http://localhost:8083）

## ファイル構成
main.js      - Electronメインプロセス・Pythonサーバー起動
preload.js   - ElectronプリロードAPI
package.json - electron-builder設定含む
.gitignore   - node_modules除外済み
assets/      - アイコン置き場（未設定）

## 次にやること
1. Pythonをアプリに同梱（PyInstaller）
   → ユーザーのMacにPythonが不要になる
   → PyInstallerでbackend/app.pyをバイナリ化
2. .dmgビルド（electron-builder）
   → npm run build:mac
3. キー発行スクリプト作成
4. Stripe連携（購入→自動キー発行→メール送付）

## 価格戦略
- スタンダード版（Electron・ワンクリック起動・一般向け）: 19,800円
- プロ版（Docker・カスタマイズ可能・法人向け）: 29,800円
- キーは購入者ごとにユニーク（ID=1〜65535）

## 審判の掟
- ソースコードは必ずGitHubにプッシュ
- node_modules はGitHubに上げない（.gitignore済み）
- 配布物（.dmg）とソースコードは絶対に混ぜない
