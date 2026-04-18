#!/bin/bash
set -e

echo "======================================"
echo "  NEXUTHA CRM ビルド前チェック"
echo "======================================"

ERRORS=0

# --- チェック1: backend/data/ に nexutha.db が存在しないか ---
DB_DEV="$HOME/NEXUTHA-CRM-V2-electron/backend/data/nexutha.db"
if [ -f "$DB_DEV" ]; then
  SIZE=$(wc -c < "$DB_DEV")
  # 50KB以上 = 個人データが入っている可能性
  if [ "$SIZE" -gt 51200 ]; then
    echo "❌ [危険] backend/data/nexutha.db が ${SIZE} バイト存在します。"
    echo "   個人データが混入するリスクがあります。"
    echo "   削除してからビルドしてください:"
    echo "   rm ~/NEXUTHA-CRM-V2-electron/backend/data/nexutha.db"
    ERRORS=$((ERRORS + 1))
  else
    echo "✅ backend/data/nexutha.db は存在しますが初期サイズ（${SIZE}バイト）のため問題なし"
  fi
else
  echo "✅ backend/data/nexutha.db は存在しません（安全）"
fi

# --- チェック2: dist/ に古いdmgが残っていないか ---
DMG_COUNT=$(find ~/NEXUTHA-CRM-V2-electron/dist -name "*.dmg" 2>/dev/null | wc -l | tr -d ' ')
if [ "$DMG_COUNT" -gt 0 ]; then
  echo "⚠️  dist/ に古いdmgが ${DMG_COUNT} 個残っています（上書きされますが念のため確認を）"
  find ~/NEXUTHA-CRM-V2-electron/dist -name "*.dmg" 2>/dev/null
else
  echo "✅ dist/ に古いdmgなし"
fi

# --- チェック3: dataフォルダがResourcesに含まれる設定になっていないか ---
EXTRA_RESOURCES=$(grep -A 30 '"extraResources"' ~/NEXUTHA-CRM-V2-electron/package.json 2>/dev/null || echo "")
if echo "$EXTRA_RESOURCES" | grep -q '"data"'; then
  echo "❌ [危険] package.json の extraResources に 'data' が含まれています。"
  echo "   個人DBがdmgに同梱されます。今すぐ削除してください。"
  ERRORS=$((ERRORS + 1))
else
  echo "✅ package.json の extraResources に 'data' フォルダなし（安全）"
fi

echo "======================================"
if [ "$ERRORS" -gt 0 ]; then
  echo "❌ チェック失敗: ${ERRORS}件の問題があります。ビルドを中止します。"
  echo "======================================"
  exit 1
else
  echo "✅ 全チェック通過。ビルドを開始します。"
  echo "======================================"
fi
