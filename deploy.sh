#!/bin/bash
# ─────────────────────────────────────────────
#  BarthON 一鍵部署腳本
#  用法：bash deploy.sh
# ─────────────────────────────────────────────

set -e  # 任何錯誤立刻停止

echo ""
echo "🕐  BarthON 部署工具"
echo "────────────────────"

# 1. 確認 firebase-tools 已安裝
if ! command -v firebase &> /dev/null; then
  echo "⚠️  尚未安裝 firebase-tools，正在安裝..."
  npm install -g firebase-tools
fi

# 2. 確認已登入
echo "🔑  確認 Firebase 登入狀態..."
firebase login --no-localhost 2>/dev/null || firebase login

# 3. 部署
echo ""
echo "🚀  正在部署到 Firebase Hosting..."
firebase deploy --only hosting

echo ""
echo "✅  部署完成！"
echo "🌐  網站網址請到 Firebase Console 查看，或看上方輸出的 Hosting URL"
echo ""
