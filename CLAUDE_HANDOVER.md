# NEXUTHA CRM V2 引き継ぎ書
> 作成日：2026-04-18　作成者：山下泰秀（NEXUTHA）

---

## 2026-04-20 販売前全タスク完了

- テスト購入フロー全体確認完了（購入→メール→ライセンス認証→アプリ起動）
- ライセンス認証をSupabase API方式に変更
- CSPにSupabaseのURLを追加
- nexutha.comをnexutha.netに修正
- Resendドメイン認証（nexutha.net）完了
- Stripe本番キー・Webhook設定完了
- **販売開始可能な状態 ✅**

## プロジェクト概要

個人事業主・小規模法人向けの買い切りローカル型CRM。
データは外部サーバーに送らない完全ローカル動作が絶対のコンセプト。
非エンジニアがAIとコマンドコピペで構築・維持可能な設計。

---

## リポジトリ

| 種別 | URL |
|------|-----|
| CRMソース（Docker版） | git@github.com:NEXUTHA/nexutha-crm-v2.git |
| Electron版 | git@github.com:NEXUTHA/nexutha-crm-v2-electron.git |
| ローカルパス（Docker版） | ~/NEXUTHA-CRM-V2/ |
| ローカルパス（Electron版） | ~/NEXUTHA-CRM-V2-electron/ |

---

## 技術スタック

| 項目 | 内容 |
|------|------|
| フロントエンド | HTML/CSS/JS（単一index.html・約6000行） |
| バックエンド | FastAPI + SQLite（backend/app.py） |
| 外部ファイル | js/state.js・js/renderer.js・js/pdf.js・style.css |
| デスクトップ | Electron（マザーボードとして使用） |
| AIプラグイン | WebLLM（5段階レベル選択・ローカルLLM） |
| 自動テスト | Playwright |

---

## ポート番号一覧

| 用途 | ポート |
|------|--------|
| 本番（Docker版） | 8083 |
| Electron版（配布版） | 9876 |
| Electron版（開発版） | 3456 |
| テスト専用 | 9999（本番DBに絶対触れない） |

> 似た番号のポートは絶対に使わない。

---

## 価格戦略

| プラン | 価格 | 対象 |
|--------|------|------|
| スタンダード版（Electron・ワンクリック起動） | 1,980円 | 個人事業主・小規模法人 |
| プロ版（Docker・法人向け） | 29,800円 | 法人 |

販売方式：nexutha.netにStripe決済埋め込み → ライセンスキー自動発行 → Resendでメール送信

---

## 開発ライセンスキー---

## 環境起動コマンド

```bash
# Docker版（開発）
cd ~/NEXUTHA-CRM-V2 && docker compose up -d
# → http://localhost:8083

# Electron版（開発）
cd ~/NEXUTHA-CRM-V2-electron && npx electron .

# Electron版（配布用dmgビルド）
cd ~/NEXUTHA-CRM-V2-electron && npm run build:mac
# → dist/NEXUTHA CRM-2.2.0-arm64.dmg（Apple Silicon）
# → dist/NEXUTHA CRM-2.2.0.dmg（Intel）
```

---

## Playwrightテスト

### Docker版（17本・全グリーン確認済み）
```bash
cd ~/NEXUTHA-CRM-V2 && npx playwright test tests/ --headed
```
- workers:1
- globalSetupでテスト用コンテナ起動・自社情報・テスト顧客登録
- globalTeardownでテスト用コンテナ・DB自動削除
- テスト用コンテナはdocker-compose.test.yml（ポート9999）

### Electron版（8本・全グリーン確認済み）
```bash
cd ~/NEXUTHA-CRM-V2-electron && npx playwright test --reporter=line
```
- テスト後にテストデータ自動削除
- 顧客登録・郵便番号自動入力・見積書作成・設定・バックアップ・CSVインポートをカバー

---

## AIプラグイン基盤（v2.2.0追加）

| レベル | モデル | 容量 | 対象 |
|--------|--------|------|------|
| LEVEL 1 · LITE | Llama-3.2-1B | 約700MB | 古いPCでも動作 |
| LEVEL 2 · STANDARD | Llama-3.2-3B | 約2GB | 8GB RAM以上 |
| LEVEL 3 · PRO | Llama-3.1-8B | 約5GB | 16GB RAM以上 |
| LEVEL 4 · ULTRA | Llama-3.3-70B | 約40GB | M3 Max推奨 |
| LEVEL 5 · CLOUD | OpenAI API | 0GB | 全PC対応・通信必要 |

AIチャット機能：
- 設定画面のAIアシスタントからレベル選択→起動
- 保存承認バナー（保存する/保存しない）
- 顧客選択ポップアップ
- 会話内容をAIが自動要約→顧客メモに保存
- 初回のみネット接続必要（モデルダウンロード）、2回目以降は完全オフライン

関連ファイル：~/NEXUTHA-CRM-V2-electron/ai-chat.html

---

## 現在の状態（2026-04-18）

### 完了済み
- Docker版：17/17テストグリーン・販売可能な品質
- Electron版：v2.2.0 dmgビルド済み・GitHub Releasesに公開済み
- AIプラグイン基盤実装（5段階レベル選択・会話保存・顧客メモ連携）
- 郵便番号→住所自動入力バグ修正済み
- Playwright 8/8グリーン（Electron版）
- nexutha.net DNS設定済み・Stripe/Supabase/Resend接続済み
- ライセンスキー自動発行システム実装済み
- GitHub 2段階認証設定済み
- Apple Developer Program加入済み（アクティベーション待ち）

- PUT /api/documents/{doc_id}がGET /{filename:path}に埋もれていた致命的バグ修正（保存・PDF出力が全く動いていなかった）
- GET /api/documents/{doc_id}の重複定義バグ修正
- アーカイブ機能のd.id変数展開漏れバグ修正
- 書類履歴タブを商談グループ表示に変更（取引APIをフロントに実装）
- 書類削除・複製・領収書化後にタブが維持されるよう修正
- 書類作成ボタンで書類作成画面に直接遷移・顧客自動選択するよう修正

- AIウィンドウをメインウィンドウから独立化（parent削除・サイズ固定）
- 相談ボタンから使い方説明＋AIチャットで相談するボタンを追加
- AIチャットで相談する→モデル選択→即起動の流れを実装
- AIチャット中もモデル変更ボタンを表示

- Apple Developer Programアクティベーション完了（Team ID: 5ZW26ADG2F）
- Developer ID Application証明書作成・インストール完了
- notarytool認証情報登録完了（nexutha-notarization）
- v2.3.0 公証・署名済みdmgビルド・GitHub Releases公開完了

### 2026-04-21 完了
- v2.3.2リリース済み ✅
- お知らせ画面のバージョン表示が`v2.1.0`ハードコードだったのを`CURRENT_VERSION`から動的取得に修正
- `CURRENT_VERSION`が`2.3.1`のままだったのを`2.3.2`に修正
- 「更新を確認」ボタンが押しても無反応だったのを修正（トースト・バナー表示まで繋げた）
- ビルド・署名・公証・ステープル・GitHub Releasesリリース完了

### 2026-04-24 完了（追記）
- GitHubリポジトリをパブリックに変更 ✅（自動アップデートが動作するようになった）
- V1（NEXUTHA-CRM）を完全削除 ✅
- V1の自動起動LaunchAgents削除済み ✅
  - `com.nexutha.crm.plist`（V1自動起動）
  - `com.nexutha.crm.backup.plist`（V1自動バックアップ）
- 顧客データをV2に復元済み ✅（8件）
- バックアップ機能の動作確認済み ✅
- **重要：開発版（npm start）と配布版を同時起動するとポート9876が競合して真っ白になる**

### 2026-04-24 完了
- v2.3.3リリース済み ✅
- 起動時にDevToolsが自動で開く問題を修正（app.isPackaged判定を追加）
- ビルド・署名・公証・ステープル・GitHub Releasesリリース完了
- stripe-webhookのdmgダウンロードURL：v2.3.3に更新済み ✅（ReadyAI対応済み）

### 残タスク（販売前必須）
1. ~~Apple Developer Programのアクティベーション確認~~ 完了✅
2. ~~公証（Notarization）設定~~ 完了✅
3. ~~electron-updater有効化~~ 完了✅（実装済み・publish設定済み）
4. nexutha.netの公開確認
5. テスト購入実行
6. Stripeダッシュボードで商品登録（NEXUTHA CRM ¥1,980）

---

## electron-updaterについて

販売後にバグが出たとき修正を全ユーザーに届ける唯一の手段。
コードは実装済みだが公証が必須なのでApple Developer Program加入が先。
GitHub Releasesに新しいdmgをアップロードするだけで全ユーザーに届く。
起動時に自動チェック→通知→インストール→再起動。

---

## Electronアーキテクチャ

| 項目 | 内容 |
|------|------|
| ポート（配布版） | 9876 |
| ポート（開発版） | 3456 |
| backend起動（開発） | Python直接 |
| backend起動（配布） | PyInstallerバイナリ |
| STATIC_DIR（配布） | Resources/直下 |
| データ保存 | ~/Library/Application Support/NEXUTHA CRM/nexutha.db |
| 開発時キャッシュ | 自動クリア（app.isPackaged判定） |
| DevTools | Cmd+Option+Iで開閉 |

---

## 審判の絶対遵守事項（掟）

1. 「動けばいい」ではなく「売った後にトラブルにならないか」基準
2. AI都合の「後回し」提案禁止
3. 常にPlaywrightの実行結果で品質証明
4. テストを通すためにテストを弄る行為禁止（品質偽装）
5. ソースコードは必ずGitHubにプッシュ
6. 開発用と配布用は絶対に混ぜない
7. テストは必ずポート9999（テスト用DB）で実行すること（本番DB保護）
8. dmgビルド後は必ずContents/Resources/にdataフォルダがないか確認すること
9. 配布用dmgに開発者の個人データが入っていないか必ず確認すること
10. 販売前にApple Developer Program加入・公証・electron-updater実装必須
11. 似た番号のポートは絶対に使わない
12. コードを提示する際は必ず「どのファイルの、何行目あたりを、どう書き換えるか」を明示し、コピペで即実行可能なターミナルコマンドをセットで出すこと
13. CLAUDE_HANDOVER.mdは絶対に削らない。追記のみ。更新後は必ず行数を確認して元の行数より増えていることを確認すること
14. 開発版（npm start）と配布版（/Applications/NEXUTHA CRM.app）を同時起動しない。開発版はポート3456・配布版はポート9876で分離済みだが、混乱を避けるため同時起動しないこと
15. 回答は常に非エンジニアにわかりやすい言葉で説明すること。専門用語を使う場合は必ず日本語で補足すること
16. GitHubリポジトリはパブリック（公開）にしておくこと。プライベートにするとelectron-updaterの自動アップデートが動かなくなる
17. index.htmlにカレンダーHTMLを追加する場合は必ずpage-settingsの直後・scriptタグの直前に挿入すること。git checkoutでindex.htmlを戻すとカレンダーJS・DEVバナー・ライセンススキップ処理が全部消えるので注意
18. CLAUDE_HANDOVER.md更新時は内容の整合性も確認すること。ポート番号・バージョン番号・状態が古いままになっていないか全セクションをチェックし、言われる前に自分で修正すること

---

## window.APP グローバル状態（js/state.js）

```javascript
window.APP = {
  customers: [],
  allDocuments: [],
  company: {},
  wizard: { mode: null, step: 0, data: {} },
  docItems: [],
  docType: "estimate",
  editingId: null,
  editingDocId: null,
  currentIndustryFilter: "all",
  detailCustomerId: null
}
```

---

## よくあるミス（過去に発生した）

- docItems/allDocumentsのwindow.APP移行漏れ
- URLパスへの誤置換
- pdf.jsの読み込みタグ消失
- テストのハードコード
- Docker古いキャッシュのまま確認（--no-cacheを使うこと）
- company未定義（window.APP.companyを使うこと）
- _sys.executableはElectronではContents/MacOS/を指す
- PyInstallerビルド後は必ずnpx electron .で動作確認してからdmgビルドすること
- Electronのコピペは明示的に実装しないと動かない
- reload=TrueはPyInstaller版では使えない
- dmgビルド後にdataフォルダが同梱されていないか確認すること
- tags等の配列フィールドはJSON文字列が何重にもエスケープされている場合がある（whileループでJSON.parseすること）
- pdf.jsのgeneratePDF_html2canvasではcompanyはwindow.APP.companyを使うこと
- APIエンドポイントはポート8083（Docker版）・9876（Electron版）で混同しないこと
- Playwrightのwbtn-skipは「戻る」ボタンと同じクラスなので、テキストで特定すること（.wbtn').filter({ hasText: 'スキップ' })）
- V1（NEXUTHA-CRM）は削除済み。V2（NEXUTHA-CRM-V2-electron）のみが現行
- LaunchAgentsのcom.nexutha.crm.plist・com.nexutha.crm.backup.plistは削除済み（V1残骸）
- 顧客データのバックアップは~/NEXUTHA_DATA_BACKUPに保存済み（8件）
- V1のバックアップ（customers.json等）をV2に復元する場合はAPIに直接POSTする方法を使うこと（アプリのインポート機能はV2形式のみ対応）
- `CURRENT_VERSION`はindex.htmlのJS内に定義されている（6073行目付近）。バージョンアップ時はpackage.json・version.json・index.htmlの3箇所を必ず更新すること
- npm startはキャッシュが残るため、ファイル修正後は必ず`pkill -f "NEXUTHA CRM"`してから再起動すること
- gh release createでタグが既存の場合は`gh release delete vX.X.X --yes`してから再作成すること

---

## GitHub情報

| 項目 | 内容 |
|------|------|
| 組織 | NEXUTHA |
| 2段階認証 | SMS認証・設定済み（2026-04-18） |
| リカバリーコード | ダウンロード済み・安全な場所に保管すること |
| 最新リリース | v2.3.3（2026-04-24公開） |

---

## 販売インフラ

| 項目 | 内容 |
|------|------|
| ドメイン | nexutha.net |
| DNS | Cloudflare |
| 決済 | Stripe |
| DB | Supabase |
| メール | Resend |
| dmg配布 | GitHub Releases |

---

## 開発体制・役割分担

| 担当 | 内容 |
|------|------|
| Claude（このAI） | Electronアプリ本体・FastAPIバックエンド・Supabase Edge Functions・ビルド・リリース |
| ReadyAI | nexutha.netフロントエンド（ページ作成・デザイン・Stripe決済ボタン埋め込み）|

**重要：役割をまたぐ変更の注意点**
- ホームページ（nexutha.net）の変更 → ReadyAIに依頼
- Electronアプリ・Edge Functions・GitHub Releasesの変更 → Claudeに依頼
- Stripe商品登録・Supabaseシークレット設定 → 山下さんが手動でダッシュボード操作

---

## nexutha.net 現在の状態（2026-04-21時点）

| ページ | URL | 状態 |
|--------|-----|------|
| トップ | / | 公開済み ✅ |
| CRM商品ページ | /crm | 公開済み ✅ |
| マニュアル | /crm/manual | 公開済み ✅ |
| 特定商取引法 | /tokusho | 公開済み ✅ |
| プライバシーポリシー | /privacy | 公開済み ✅ |
| 利用規約 | /terms | 公開済み ✅ |

**Stripe・Supabase連携状況**
- Stripe本番モード：sk_live_... 設定済み ✅
- 本番商品ID：prod_UNB0eoHXN9a58t（¥1,980）✅
- stripe-webhook：デプロイ済み ✅
- verify-license：マスターキー対応・デプロイ済み ✅
- create-checkout-session：本番商品ID直接参照方式 ✅
- RESEND_API_KEY：設定済み ✅
- メール送信元：@nexutha.net ✅
- dmgダウンロードリンク：メールにv2.3.3のURLを埋め込み済み ✅（ReadyAI対応済み）

**残課題**
- メール内のdmgダウンロードURL：v2.3.2に更新済み ✅
  → https://github.com/NEXUTHA/nexutha-crm-v2-electron/releases/download/v2.3.2/NEXUTHA.CRM-2.3.2-arm64.dmg
- サイト上のダウンロードリンクもv2.3.2に更新済み ✅（ReadyAI対応済み）

---

*新スレの最初にこのファイルの内容をコピペすればAIが即座に状況を把握できます。*

### 2026-04-27 作業内容
- CRM独自カレンダー機能開発開始
- backend/app.py にカレンダーAPI追加（/api/events GET/POST/PUT/DELETE）
- index.htmlにカレンダーHTML・JS・メニュー追加
- 開発版ポートを3456番に変更（配布版9876と完全分離）
- 開発版に赤いDEVバナー追加（視認性確保）
- dist/フォルダ整理（古いdmg削除・dataフォルダ削除）
- package.jsonのproductNameを"NEXUTHA CRM DEV"に変更
- main.jsのタイトルを"NEXUTHA CRM DEV"に変更
- 開発用ライセンスキースキップ処理追加（NXTH-0001-3C6B-BF0B → true）

### 次回やること（最優先）
- カレンダー画面が表示されないバグを修正
  - カレンダーメニュークリックで「自社情報」「AIアシスタント」が出てしまう
  - 原因：page-calendarのHTMLがメインラッパーの外に出ている
  - 修正手順：index.htmlのpage-calendarの位置を正しい場所に移動
  - 正しい位置：page-settingsの直後・<script>タグの直前
  - 確認コマンド：grep -n 'page-calendar\|page-settings\|^<script>' index.html
  - 修正後にPlaywrightテスト追加・動作確認後にdmgビルド→v2.4.0リリース

### 開発版と配布版の分離（2026-04-27確立）
| 項目 | 配布版 | 開発版 |
|------|--------|--------|
| 起動方法 | ダブルクリック | ターミナルでnpx electron . |
| ポート | 9876 | 3456 |
| 目印 | なし | 赤いDEVバナー（サイドバー上部） |
| データ保存先 | ~/Library/Application Support/NEXUTHA CRM/nexutha.db | ~/NEXUTHA-CRM-V2-electron/backend/data/nexutha.db |
| productName | NEXUTHA CRM | NEXUTHA CRM DEV |

### よくあるミス追記（2026-04-27）
- 開発版と配布版を同時起動しない（ポートが違うので今後は大丈夫）
- ターミナルでCtrl+Cを押すと開発版が終了する
- git checkoutでindex.htmlを戻すと、ライセンススキップ処理・カレンダーJS・DEVバナーが全部消える
- index.htmlを修正したあとはキャッシュが残るのでelectronを再起動すること
- カレンダーHTMLはpage-settingsの直後・scriptタグの直前に入れること
