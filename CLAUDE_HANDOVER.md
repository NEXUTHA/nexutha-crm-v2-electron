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
| 最新リリース | v2.4.0（2026-06-07公開） |

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

---

### 2026-05-07 作業内容
- 顧客選択ポップアップの自由入力欄（#day-customer-custom-name）のonkeydownをonkeyupに変更
  - event.isComposing が true のとき（日本語IME変換中）は早期リターンするよう修正
  - 日本語入力でEnterを押してもaddCustomDayCustomerが誤発火しなくなった
- #day-customer-custom-name に autocomplete="off" を追加（ブラウザ補完候補を非表示）
- #day-memo-input（textarea）に autocomplete="off" を追加
- Playwrightテスト全13件グリーン確認 ✅

### 次回やること
- カレンダー機能の追加テスト・UI改善（必要に応じて）

---

### 2026-06-07 作業内容
- **CSVインポートページ（page-import）にCSVエクスポートボタンを追加**
  - 「インポート開始」ボタンの直下に「CSVをエクスポート」ボタン（btn-outline）を配置
  - 既存の exportCSV() 関数を呼び出すだけ（新規ロジックなし）
- **index.htmlの機能ボタンの絵文字を全てLucideアイコン（インラインSVG）に置き換え**
  - 対象：📋📄💾🏦🔔🧾🗑🏢📝📥🎉🔄🎨📎🤖👤📂📦🔒♻✉🗄🧮🖌📐🔢🔤📤💬📷✏⚙ と チェック（✓✕）・矢印（←↕↔↺）
  - SVGは既存カレンダーメニューと同じLucide風（viewBox 0 0 24 24・stroke=currentColor・stroke-width 2）で統一
  - 共通CSSクラスを style.css に追加（.ic / .ic-only / .ic-sm / .ic-card / .ic-chk / .ic-mini）
  - トースト通知は showToast() に第3引数 icon を追加し、アイコン部のみ innerHTML・本文は textContent のまま（顧客名混入によるXSSを防止）
  - ウィザード/相談メニューのボタンは addMsg() に icon フィールド対応を追加（ラベルはtextNodeのまま＝XSS安全）。licSvg()/LIC をJS側に定義
  - 期限通知アラート（checkDeadlineNotifications）も {icon, text} 形式に変更しアイコン表示
  - **ドロップダウン<option>の絵文字（📞📧🤝📝）はテキストのみに（option要素はSVG不可のため。アイコン化は別タスク）**
  - **⚠️（DEVバナー・未払い警告・バックアップ注意）は対象外リストのため絵文字のまま温存**
  - **文章中の矢印「→」（顧客名→業種→… やコメント内）は装飾ではなく本文なので変換せず温存**
- Playwrightテスト全13件グリーン確認 ✅（テストは一切改変なし。ラベル文字列は温存したため :has-text セレクタ互換）
- 開発版（ポート3456）で目視確認済み：CSVインポート/顧客/設定/書類作成の各ページでアイコン表示を確認 ✅
- 変更ファイル：index.html・style.css（git checkout厳禁＝掟17）

### 次回やること（追記）
- <option>内アイコン（📞📧🤝📝）のLucide化（select描画のカスタムUI化が必要・別タスク）

---

### 2026-06-07 作業内容（CSVインポート/エクスポートの不具合修正）
- **問題1：page-importの「ファイルを選択」と「インポート開始」が重複（両方ダイアログを開くだけ）だった → 2ステップに整理**
  - input#csv-import-file の onchange から `importCSV()` 自動実行を削除（選択時はファイル名表示のみ）
  - 「インポート開始」ボタンの onclick を `importCSV()` に変更（＝本当に取り込みを開始する役割に）
  - 流れ：ファイルを選択 → ファイル名確認 → インポート開始、の明確な2段階に
- **問題2（重大）：exportは日本語ヘッダー・importはヘッダー無視の列順読みで形式不一致＋カンマ入り値で壊れる潜在バグ → 修正**
  - importCSV を**ヘッダー名で列を対応付ける方式**に変更。日本語・英語どちらのヘッダーも受付（CSV_HEADER_ALIASES：顧客名/name 等）。1つも認識できなければ従来の列順にフォールバック（後方互換）
  - **カンマ・"エスケープ対応の正式なCSV行パーサ parseCSVLine を追加**（メモにカンマが入っても壊れない）
  - exportCSV のクォート処理も強化（カンマ・改行・" を含む値を `"..."`＋`""`で安全に出力）。ヘッダーは日本語のまま・UTF-8 BOM付き（Excel文字化け防止）
  - 画面の説明文・Sample Format 表示を日本語ヘッダーに統一（英語も可と明記）。downloadSample は元々日本語ヘッダーで整合済み
- **開発版（ポート3456）で往復実テスト：全17項目グリーン ✅**
  - ファイル選択だけでは自動インポートされない（問題1）/ 日本語ヘッダーインポート（カンマ入りメモ"VIP, 重要"完全一致）/ 英語ヘッダーインポート / エクスポート出力（BOM＋日本語ヘッダー＋カンマ値クォート）/ export→import 往復一致
  - 既存Playwright 13件もグリーン（回帰なし・テスト改変なし＝掟4）
- 変更ファイル：index.html のみ（git checkout厳禁＝掟17）

---

### 2026-06-07 v2.4.0 リリース（署名・公証・staple・GitHub Releases公開まで完了）✅
**公開済み：** https://github.com/NEXUTHA/nexutha-crm-v2-electron/releases/tag/v2.4.0 （Latest）

#### 重要：開発版/配布版の分離方法を「isPackagedゲート化」に変更（恒久対応）
従来は package.json の productName を "NEXUTHA CRM DEV" に手書き変更して分離していたが、**本番ビルド時にDEV表記・DEVバナー・ライセンス回避キーが混入する危険があった**ため、`app.isPackaged` による自動分岐に変更した。今後は productName 等を手で書き換える必要はない。
- `preload.js`：main.js から `additionalArguments: --nexutha-isdev=<bool>` を受け取り `window.electronAPI.isDev` を公開
- `main.js`：ポート `app.isPackaged ? 9876 : 3456`、ウィンドウtitle `app.isPackaged ? 'NEXUTHA CRM' : 'NEXUTHA CRM DEV'`
- `backend/app.py`：`uvicorn.run(port = 9876 if frozen else 3456)`（配布版はPyInstallerでfrozen→9876）
- `index.html`：DEVバナーは `id="dev-banner"` 既定 `display:none`、load時に `electronAPI.isDev` の時だけ表示／ライセンス回避キー `NXTH-0001-3C6B-BF0B` は `electronAPI.isDev` の時のみ有効（配布版で無効）
- `package.json`：productName を "NEXUTHA CRM"（配布版の正式名）に戻した

#### ポートの確定（掟11/掟14関連・旧記述を訂正）
**配布版=9876 / 開発版=3456** をコードで強制（main.js・app.py 双方）。本ドキュメント内の旧「配布版9876/開発版3456」記述は現状と一致。

#### リリース手順の実績と次回の注意（重要）
1. バージョンは3ファイル更新：`package.json` `version.json` `index.html`(CURRENT_VERSION) ＋ version.json に updates エントリ追加
2. **バックエンドはdist/backendが消えているので必ず再ビルド**：`python3.10 -m PyInstaller backend.spec --clean --noconfirm`（pyenv 3.10.6にPyInstaller 6.19.0）。出力 `dist/backend`（arm64・約37MB）
3. **check-before-build.sh は dev DB(backend/data/nexutha.db>50KB)があると失敗する**。ビルド前に退避（例：`mv ... nexutha.db.prebuild-bak`）、ビルド後に復元すること
4. `npm run build:mac`：署名＋afterSign(scripts/notarize.js)で**.appのみ公証**される（dmgは未公証・未staple）
5. **dmgのstapleには dmg自体の公証が必要**：`xcrun notarytool submit "<dmg>" --keychain-profile nexutha-notarization --wait` → `xcrun stapler staple "<dmg>"`（arm64・x64の2つ）
6. **staple後はdmgのバイトが変わるため `dist/latest-mac.yml` の sha512(base64)とsizeを必ず再計算して修正**（しないと electron-updater のハッシュ検証に失敗し全顧客の自動更新が壊れる）。`openssl dgst -sha512 -binary <dmg> | openssl base64 -A`、size は `stat -f%z`
7. GitHubアセット名は **ドット形式**（例 `NEXUTHA.CRM-2.4.0-arm64.dmg`）。latest-mac.yml の url と完全一致させること（不一致だと更新取得不可）
8. 公開：`gh release create v2.4.0 --target main --title v2.4.0 --notes ... <arm64.dmg> <x64.dmg> latest-mac.yml`

#### 検証実績（本番品質確認）
- 開発版(3456) Playwright 13件グリーン（ゲート化後・回帰なし）
- ビルドした配布版.appを実機起動：フリーズ版バックエンドが9876で起動・本番DBの顧客8件取得・配信フロントが2.4.0・DEVバナー非表示・ライセンス回避キーisDev限定 を確認
- 署名 `spctl -t exec`=Notarized Developer ID accepted、dmg `stapler validate`=worked、notarytool=Accepted×2
- latest-mac.yml の url/size がリリースアセットと一致することを確認

#### 注意（未対応・次回検討）
- **x64(Intel)版dmgのバックエンドはarm64バイナリ**（PyInstallerをarm64機でビルドのため）。Intel実機での動作は未確認。これは従来リリースと同条件。Intelを正式サポートするならx64機（or クロスビルド/Rosetta）でのbackend生成が必要
- `<option>`内アイコン（電話/メール/訪問のドロップダウン）は現状テキストのみ（別タスク）
