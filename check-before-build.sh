#!/bin/bash
set -e

# プロジェクトルートをこのスクリプト自身の場所から特定する。
# ローカル（$HOME/NEXUTHA-CRM-V2-electron）でもCI（/Users/runner/work/...）でも
# 同じガードが動くようにするため。挙動はローカルでは従来と完全に同一。
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "======================================"
echo "  NEXUTHA CRM ビルド前チェック"
echo "======================================"
echo "  対象: $PROJECT_ROOT"

ERRORS=0

# --- チェック1: backend/data/ に nexutha.db が存在しないか ---
DB_DEV="$PROJECT_ROOT/backend/data/nexutha.db"
if [ -f "$DB_DEV" ]; then
  SIZE=$(wc -c < "$DB_DEV")
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

# --- チェック2: プロジェクト全体に想定外のDBファイルがないか ---
DB_STRAY=$(find "$PROJECT_ROOT" -name "*.db" -o -name "*.sqlite" 2>/dev/null | grep -v "node_modules" | grep -v "dist" || true)
if [ -n "$DB_STRAY" ]; then
  echo "❌ [危険] 想定外の場所にDBファイルが存在します:"
  echo "$DB_STRAY"
  ERRORS=$((ERRORS + 1))
else
  echo "✅ 想定外のDBファイルなし（安全）"
fi

# --- チェック3: dist/ に古いdmgが残っていないか ---
DMG_COUNT=$(find "$PROJECT_ROOT/dist" -name "*.dmg" 2>/dev/null | wc -l | tr -d ' ')
if [ "$DMG_COUNT" -gt 0 ]; then
  echo "⚠️  dist/ に古いdmgが ${DMG_COUNT} 個残っています（上書きされますが念のため確認を）"
  find "$PROJECT_ROOT/dist" -name "*.dmg" 2>/dev/null
else
  echo "✅ dist/ に古いdmgなし"
fi

# --- チェック4: dataフォルダがResourcesに含まれる設定になっていないか ---
EXTRA_RESOURCES=$(grep -A 30 '"extraResources"' "$PROJECT_ROOT/package.json" 2>/dev/null || echo "")
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
