# v2.5.2 再カット手順書

**作成**: 2026-07-20 / **状態**: 実行前
**なぜ再カットか**: 既存のドラフト v2.5.2（`ba64b3b` 時点）には**公開ブロッカーが2件残っている**ため。作り直す。

---

## 1. 現状と目標

| | 現在のドラフト v2.5.2 | 再カット後 |
|---|---|---|
| タグの指す commit | `ba64b3b` | 新HEAD（L-01・N-01 修正後） |
| 白画面（W-01） | ✅ 修正済 | ✅ |
| CIドラフト化（B-01） | ✅ 修正済 | ✅ |
| **ライセンス（L-01）** | ❌ **Supabase依存のまま＝誰も起動できない** | ✅ オフライン署名検証 |
| **CDN依存（N-01）** | ❌ **オフラインで全損** | ✅ ローカル同梱 |

**現在のドラフトは公開しても使えません。** 必ず削除してから作り直します。

---

## 2. 事前確認（実行前に必ず）

```
cd ~/NEXUTHA-CRM-V2-electron
git status --short                      # 空であること
git log --oneline -1                    # 再カット対象のHEADを確認
node -p "require('./package.json').version"   # 2.5.2 であること（CIのタグ一致検証を通すため）
gh release view v2.5.2 --json isDraft --jq .isDraft   # true であること（公開されていない）
```

⚠️ `isDraft` が `false`（＝公開済み）だった場合は、**この手順を実行せず即報告**。顧客への配信が始まっている可能性があるため、先に `latest-mac.yml` の削除が必要。

---

## 3. 旧ドラフトとタグの削除

**順序が重要**：リリース（ドラフト）を先に消し、次にタグを消す。逆にするとドラフトが宙に浮く。

```
# ① 旧ドラフトリリースを削除（ドラフトなので顧客影響ゼロ）
gh release delete v2.5.2 --yes

# ② リモートのタグを削除
git push --delete origin v2.5.2

# ③ ローカルのタグを削除
git tag -d v2.5.2
```

確認：
```
gh release list --limit 3          # v2.5.2 が消え、v2.5.1 Latest だけになる
git ls-remote --tags origin | grep v2.5.2 || echo "リモートタグ削除OK"
git tag | grep v2.5.2 || echo "ローカルタグ削除OK"
```

---

## 4. 修正のマージと再タグ

修正は `feat/repair-2026-07` ブランチにある。`main` に取り込む。

```
# ① mainへ切り替え
git checkout main

# ② 修正ブランチを取り込む（早送りマージ）
git merge --ff-only feat/repair-2026-07

# ③ アプリ実体に想定外の変更が無いか確認
git log --oneline ba64b3b..HEAD
git diff --stat ba64b3b..HEAD

# ④ mainをpush（トリガーは tags のみなのでCIは発火しない）
git push origin main

# ⑤ CI発火ゼロを実測
gh run list --limit 2

# ⑥ 新HEADにタグを打つ
git tag -a v2.5.2 -m "v2.5.2: 白画面修正 + ライセンスのオフライン化 + CDN依存の排除"
git push origin v2.5.2
```

⚠️ `--ff-only` が失敗する場合は `main` が進んでいる。**その場でマージせず報告すること。**

---

## 5. CI完走の確認

タグpushで `release.yml` が起動する（約5〜6分。公証待ちを含む）。

```
gh run list --limit 1
gh run view <run-id> --json status,conclusion
```

完走後、**ドラフトであることを必ず確認**：

```
gh release view v2.5.2 --json isDraft,assets --jq '"isDraft=\(.isDraft) assets=\([.assets[].name]|join(", "))"'
gh release list --limit 3
```

**顧客から見えないことの実証**（未認証でのアクセス）：
```
curl -s -o /dev/null -w "latest-mac.yml HTTP=%{http_code}\n" \
  "https://github.com/NEXUTHA/nexutha-crm-v2-electron/releases/download/v2.5.2/latest-mac.yml"
curl -s "https://api.github.com/repos/NEXUTHA/nexutha-crm-v2-electron/releases/latest" | grep '"tag_name"'
```
期待：`HTTP=404` かつ `tag_name: v2.5.1`

> 🔴 **万一 `isDraft=false`（公開されていた）場合は、確認を待たず即座に**
> `gh release delete v2.5.2 --yes` → タグ削除 → 停止・報告（事前承認済み）

---

## 6. 機械確認（6項目）

ドラフト成果物を取得して確認する。**前回の5項目に「同梱ライブラリの実在」を追加**。

```
gh release download v2.5.2 --dir ~/NEXUTHA_SCRATCH/verify252 --clobber
```

| # | 確認 | 期待 |
|---|---|---|
| 1 | `spctl -a -vvv <app>` | `accepted / Notarized Developer ID` |
| 2 | `xcrun stapler validate <app>` | `The validate action worked!` |
| 3 | `Contents/Resources/backend` | **ディレクトリ**（onedir の証明） |
| 4 | `lipo -archs .../backend/backend` | `arm64` |
| 5 | sha512 / size | `latest-mac.yml` と完全一致 |
| 6 | **`Contents/Resources/vendor/` に4ファイル実在** | dexie / jspdf / autotable / html2canvas |
| 7 | **`app.asar` に `license-verify.js` が含まれる** | 含まれる（無いと起動不能） |
| 8 | **`Contents/Resources/revoked.json` が実在** | 実在 |

---

## 7. 実機検証（5基準）

テストアカウント `nexuthatest` で実施。手順書は `/Users/Shared/nexutha-verify/検証手順書.md`。

| # | 基準 | 台帳 |
|---|---|---|
| 1 | コールド初回起動でスプラッシュが出る（白画面でない） | W-01 |
| 2 | **新方式キーで認証を通過する** | **L-01** |
| 3 | 顧客登録 → 見積作成 → PDF出力まで完走 | — |
| 4 | **ネットワーク遮断状態で起動・認証・PDFまで動く** | **L-01/N-01** |
| 5 | AIチャットを開いてもクラッシュ・白画面にならない | B-02（確認のみ） |

---

## 8. 公開（山下さんのGO後のみ）

```
gh release edit v2.5.2 --draft=false
```

**この操作でのみ顧客に配信されます。GOが出るまで実行しません。**

公開直後に自動更新を実測：
- テストアカウントに v2.5.1 を入れて起動 → 更新検知 → 再起動 → 2.5.2 になること
- `~/Library/Logs/NEXUTHA CRM/main.log` に `checking-for-update` → `update-available` → `update-downloaded` が並ぶこと

---

## 9. 中止・ロールバック

| 状況 | 手順 |
|---|---|
| ドラフトのまま中止 | `gh release delete v2.5.2 --yes` → タグ削除（顧客影響ゼロ） |
| CI途中で中止 | `gh run cancel <run-id>` |
| **公開後に問題発覚** | ① `gh release delete-asset v2.5.2 latest-mac.yml --yes` ← **自動更新を止めるのはこれ** ② `gh release edit v2.5.2 --draft=true` ③ 必要なら v2.5.1 を Latest に戻す |
| 最終手段 | VAULT に全履歴を保全済み（`~/NEXUTHA_VAULT_2026-07-20/git/`） |

⚠️ **公開後のロールバックは不完全**。既に更新を取得した顧客は戻せない。だからこそドラフト検証を挟む。

---

## 10. チェックリスト

- [ ] 2. 事前確認（`isDraft=true` を含む）
- [ ] 3. 旧ドラフト・タグの削除
- [ ] 4. main へマージ → push → CI発火ゼロを実測 → 再タグ
- [ ] 5. CI完走 → **ドラフトであることと顧客不可視を実証**
- [ ] 6. 機械確認 8項目
- [ ] 7. 実機検証 5基準（山下さんが実施）
- [ ] 8. 結果報告 → **山下さんのGO**
- [ ] 9. `--draft=false` で公開
- [ ] 10. 自動更新の実測 → 報告
- [ ] 11. 購入者へ連絡（**新方式のライセンスキーを添付**）
