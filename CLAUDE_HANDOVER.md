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
| 最新リリース | v2.4.1（2026-06-07公開／v2.4.0は不具合のため削除） |

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

---

### 2026-06-07 緊急修正 v2.4.1（v2.4.0は配布版が壊れており削除→修正版を再公開）✅
**公開済み：** https://github.com/NEXUTHA/nexutha-crm-v2-electron/releases/tag/v2.4.1 （Latest）

#### 何が起きたか（重大インシデント・再発防止のため必読）
v2.4.0で配布版のポートを9876に分離した際、**`index.html` の `API_BASE` が `'http://localhost:3456/api'` に固定**のままだった。配布版はページもbackendも9876なのに、画面の全データ通信（顧客・書類・自社情報・ライセンス・バックアップ・カレンダー約40箇所）が**3456へアクセスして全失敗**。＝配布版が実質使えない状態でリリースしてしまった。
- **原因**：ポート分離（main.js / app.py）を変えたのに API_BASE を直さなかった。さらに私の実機確認が「backendに直接curl」だけで、**画面（レンダラー）の実fetchを見ていなかった**ため見逃した。
- **検知をすり抜けた理由**：開発版は全部3456で一致するため Playwright も私のcurlも通ってしまった。

#### 修正内容
- `index.html`：`const API_BASE = location.origin + '/api';`（**ページ配信元と同一originに自動追従**。開発版3456・配布版9876どちらでも自分のbackendに接続）
- バージョン 2.4.1（package.json / version.json / index.html CURRENT_VERSION）

#### 対応順序（実施済み）
1. **まず壊れたv2.4.0を即削除して自動配信を停止**（`gh release delete v2.4.0 --cleanup-tag --yes`／リリース・リモートタグ消失を確認）
2. API_BASE修正 → 開発版Playwright13件グリーン＋**画面に顧客データ表示を目視確認**
3. v2.4.1へ版上げ → 前回手順でビルド/署名/公証/staple/latest-mac.yml再計算/dev DB復元
4. **配布版.appをPlaywrightのexecutablePathで起動し、レンダラーに顧客8件が表示されること・DEVバナー非表示・API_BASE=9876追従をスクリーンショットで目視確認**（curlで済ませない）
5. v2.4.1公開（アセット名＝latest-mac.yml url一致を確認）

#### 教訓（次回必ず守る）
- **ポートやAPI接続先を変えたら `index.html` の `API_BASE` も必ず確認**（現在は location.origin 追従なので原則触らなくてよい）
- **リリース前の実機確認は必ず「画面（レンダラー）が実データを表示するところ」まで**。backendへの直接curlだけでは配布版の不具合を見逃す。配布版.appは `electron.launch({ executablePath: 'dist/mac-arm64/NEXUTHA CRM.app/Contents/MacOS/NEXUTHA CRM' })` でPlaywright起動すれば画面の評価・撮影ができる
- 問題が出たら**まず配信停止（リリース削除）してから**落ち着いて直す

---

### 2026-06-07 重大インシデント：Service Worker残骸による全購入者の画面崩れ（v2.4.2で解決）✅
**公開済み：** https://github.com/NEXUTHA/nexutha-crm-v2-electron/releases/tag/v2.4.2 （Latest）

#### 経緯（必読・同じ轍を踏まないため）
v2.4.0公開→API_BASEが3456固定で配布版全滅→削除→v2.4.1で修正→公開したが購入者から「画面が崩れて使えない・ライセンスキーを求められる」と連絡→v2.4.1削除→原因調査→v2.4.2で真因解決。1日で公開・撤回を3回繰り返した。

#### 真因（確定）
購入者のElectronプロファイルに**過去バージョンで登録された古いService Worker(sw.js)が残存**し、それが全fetch（CSS/JS/API）を横取りして net::ERR_FAILED させていた。結果：画面崩れ＋データ/ライセンス取得失敗＋固定文字「オンライン動作中」だけ表示。
- 購入者の開発者ツールで `sw.js:11 Failed to fetch` が全リソースに対して出ていたのが決定的証拠。
- **開発機では古いSWが残っていなかったため、何度起動しても再現しなかった**。これが原因特定を遅らせた最大の罠。

#### 真因でなかったもの（調査で否定済み・参考）
- file://起動説（main.jsはhttp://localhost:9876でloadURLのみ、file://にならない）
- Docker依存説（Dockerは先週削除済みだが、Docker無しでも正常動作する）
- 素のapp.py手動起動説（購入者は買い切りアプリをダブルクリック起動するだけ）
- backend起動失敗説（配布版backendは9876で正常起動・CSS/API正常配信を確認）
- ファイル欠落説（style.css/js全て配布物に同梱されている）

#### 修正内容（三重対策・index.html と sw.js）
1. `<head>`先頭で、既存Service Workerを全unregister＋全キャッシュ削除＋制御中なら一度だけ再読込（古い残骸を起動直後に除去）
2. SW新規登録を停止（`register('sw.js')`削除＝今後SWを使わない＝再発防止）
3. sw.js自体を自己解除型に（activateで自分をunregister・fetch横取りしない＝万一の保険）
4. 併せて：自動更新zip追加（package.json mac.targetにzip）でelectron-updaterが実際に機能するように。Intelはarm64専用に割り切り（x64除外）。

#### 今後の鉄則（今回の教訓・絶対に守る）
- **リリース前検証は「購入者と同じ条件」で行う**。開発機で動く≠購入者で動く。特に「古い状態から更新したユーザー」「まっさらな環境」を再現して検証する。今回のSW残骸はまさに開発機で再現せず見逃した。
- **原因を手元で再現できるまで本番公開しない**。今回v2.4.0/4.1/4.2で3回見切り発車し、うち2回が外れた。再現→修正→再現環境で修正確認、の順を守る。
- **購入者に技術的負担をかけない**（開発者ツールを開かせる/バージョン確認させる等は本来NG）。開発側で再現・特定する。
- **Service Worker/PWAを変更・廃止する時は、必ず旧SWの掃除処理を入れる**。SWはオリジン単位でブラウザ/Electronに居座り、後から悪さをする。
- リリース前確認は画面（レンダラー）が実データを表示するところまで目視。curlやPlaywright(executablePath)だけでは購入者の通常起動の問題を見逃す。

---

## 2026-06-07 リリース完全自動化パイプライン（GitHub Actions）構築 🚀

### これは何か
これまで毎回手作業でやっていた「ビルド→署名→公証→staple→latest-mac.yml生成→GitHubリリース公開」を**全自動化**した。
今後のリリースは **`package.json`と`version.json`のバージョンを上げてコミット → `git tag vX.X.X && git push origin vX.X.X`** を実行するだけ。
残りは GitHub Actions（macOS arm64ランナー）が全部やる。

### 今後のリリース手順（これだけ）
```bash
# 1) package.json の "version" と version.json の "version" を新バージョンに更新（例 2.4.6）
# 2) コミットして main に push
git add package.json version.json
git commit -m "release: v2.4.6"
git push origin main
# 3) タグを打って push（←これが自動パイプラインのトリガー）
git tag v2.4.6
git push origin v2.4.6
```
あとは GitHub の Actions タブで進行を見るだけ。緑になれば、署名・公証・staple済みのdmg/zipと
正しい latest-mac.yml が付いた Release が自動で公開され、購入者のアプリが自動更新で取得できる。

⚠️ タグのバージョンと package.json のバージョンが一致していないとパイプラインは即停止する（事故防止ガード）。

### パイプラインの仕組み（.github/workflows/release.yml）
トリガー: `v*.*.*` 形式のタグ push。ランナー: `macos-14`（Apple Silicon/arm64）。
ステップ順:
1. コード取得
2. **バージョン整合性チェック**（タグ==package.json でなければ停止）
3. Node.js 20 / Python 3.10 セットアップ
4. Python依存 + PyInstaller 導入
5. `python -m PyInstaller backend.spec` で backend を単一実行ファイル化（→ dist/backend）
6. `npm ci`
7. `npm run build:mac -- --publish never`
   = check-before-build.sh（DB混入ガード）→ electron-builder --mac で署名 → afterSign(notarize.js)で**.appを公証**
   （`--publish never`でelectron-builderの自動公開を禁止。staple前の古いハッシュymlが公開される事故を防ぐ）
8. 生成物を**ドット形式**にリネーム（`NEXUTHA.CRM-x.x.x-arm64.dmg` / `...-arm64-mac.zip`）
9. **dmgを公証**（notarytool submit --wait）
10. **dmgをstaple**（→ここでdmgのバイトが変わる）+ stapler validate
11. **★staple後の★dmg/zipから sha512(base64)とsizeを計算し、latest-mac.yml をゼロから生成**
    （electron-builderが出すymlは staple前ハッシュなので絶対に使わない。順序: staple→ハッシュ→yml を厳守）
12. ymlのurl/sizeと実ファイルの完全一致を最終検証
13. `gh release create vX.X.X` で dmg / zip / latest-mac.yml を添付して公開

### 過去の事故を防ぐためにパイプラインが守っていること（掟の実装）
- latest-mac.yml のハッシュは**必ずstaple後**に計算（手作業で何度も事故った点／lesson 1,2,3）
- ファイル名はドット形式で統一し、yml内url・実ファイル名・GitHubアセット名を完全一致（lesson 4）
- check-before-build.sh のDB混入ガードはCIでもそのまま実行（lesson 5／掟8）
- electron-builderの自動公開を禁止し、ymlを自前生成することでハッシュ不一致を構造的に排除

### 必要な GitHub Secrets（5つ）
| Secret名 | 中身 |
|---|---|
| `MAC_CERTS` | Developer ID Application 証明書(.p12)をbase64化した文字列 |
| `MAC_CERTS_PASSWORD` | .p12書き出し時に設定したパスワード |
| `APPLE_ID` | Apple Developer のメールアドレス |
| `APPLE_APP_SPECIFIC_PASSWORD` | appleid.apple.com で発行したApp用パスワード（公証用） |
| `APPLE_TEAM_ID` | `5ZW26ADG2F` |

`GITHUB_TOKEN` はActionsが自動発行するので登録不要。
Secretの登録は `gh secret set <名前>` で行う（リポジトリ: NEXUTHA/nexutha-crm-v2-electron）。

### ローカル手作業フローとの関係
- `scripts/notarize.js` は環境変数(APPLE_ID等)があればCI方式、無ければ従来のキーチェーンプロファイル
  `nexutha-notarization` を使う。**ローカルの手作業フローは一切変わっていない**（緊急時は従来通り手で出せる）。
- `check-before-build.sh` はスクリプト自身の場所基準に変更（ローカルでの挙動は従来と同一・ガードも維持）。
- `backend.spec` を Git 管理下に追加（CIでPyInstallerが使うため）。

### 再リリース（同じバージョンをやり直す）時の注意
同名タグ/リリースが既にあると `gh release create` は失敗する。やり直す場合は
`gh release delete vX.X.X --cleanup-tag --yes`（リリースとリモートタグを削除）してから打ち直す。
※これは破壊的操作なので手動で慎重に。

---

## 2026-06-07 自動更新「適用されない」問題の根本修正（v2.4.6）🔧

### 症状（購入者環境で発生）
検知○・ダウンロード○なのに「再起動して適用」しても古い版のまま入れ替わらない。ログも残らない。

### 真因（3つ）
1. **App Translocation（主因）**：隔離属性(com.apple.quarantine)が残ったままのアプリはmacOSが
   読み取り専用のランダムパス(`/private/var/folders/.../AppTranslocation/...`)で実行する。
   electron-updater(Squirrel.Mac)は実行中バンドルを置換しようとするが読み取り専用で書けず**無言で失敗**。
   再起動しても/Applications本体は隔離付きのまま→また隔離実行→永遠に古いまま。
   ※「所有者・書込権限あり」は/Applications本体の話で、実際に動いているのは別の読み取り専用コピー。
2. **quitAndInstallの呼び方**：macOS既知のレース/quit阻害対処をしていなかった。
3. **electron-log未導入**：configがconsoleのみ＝配布版でログがどこにも残らず原因追跡不能だった。

### 修正（main.js）
- electron-log導入。`~/Library/Logs/NEXUTHA CRM/main.log` に全更新イベントを記録。
- quitAndInstallをdevelar公式パターンに：
  `setImmediate(() => { app.removeAllListeners('window-all-closed'); pythonProcess.kill(); BrowserWindow.getAllWindows().forEach(w=>w.close()); autoUpdater.quitAndInstall(false); })`
- 起動時・手動チェック時に `process.execPath.includes('/AppTranslocation/')` でtranslocationを検知し、
  該当時は自動更新を試みず正しい再インストール手順を案内する。

### 実機実証（推測でなく実測）
2.4.6を/Applicationsに正規インストール(隔離なし)→2.4.7をリリース→2.4.6起動→2.4.7検知→DL→
「今すぐ再起動」→`quitAndInstall を実行`→**version=2.4.7で自動再起動**→/Applications実体が2.4.7に。
署名=Notarized Developer ID accepted、非translocationを確認。main.logに全工程が残ることも確認。

### ★既存ユーザー（壊れた版を使用中）への重要事項★
**自動更新の「適用」を実行するのは更新元(今入っている版)のコード。** 2.4.5以前の壊れた版/隔離状態の
ユーザーは、修正版を自動更新で受け取れない場合がある。その場合は**一度だけ手動再インストール**が必要：
`お客様向け_自動更新が効かない時の再インストール手順.md` を参照（最新dmgをFinderで/Applicationsに
ドラッグ置換、またはターミナルで `xattr -dr com.apple.quarantine "/Applications/NEXUTHA CRM.app"`）。
これで隔離が解け、以降は自動更新が正常動作する。

### 今後の鉄則
- 配布版の不具合調査は、まず `~/Library/Logs/NEXUTHA CRM/main.log` を見る（electron-logで残るようになった）。
- macOS自動更新は「正規の/Applicationsインストール＋隔離無し」が前提。dmgはFinderドラッグでインストールさせる。
- 自動更新の検証は「更新元に修正版を入れて、次版へ実際に入れ替わるか」まで実機で確認する。
