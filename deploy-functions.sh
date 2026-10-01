#!/bin/bash
# BarthON 流量分析 - Cloud Functions 部署腳本
# 此腳本需在有 Firebase CLI 認證的環境執行(本地或 CI)

set -e

echo "========================================"
echo "BarthON Cloud Functions 部署"
echo "========================================"
echo ""

# 1. 確認專案
echo "📋 Step 1: 設定 Firebase 專案"
firebase use barthon-watch
echo "✅ 專案: barthon-watch"
echo ""

# 2. 安裝依賴
echo "📦 Step 2: 安裝 Functions 依賴"
cd functions
npm install
cd ..
echo "✅ 依賴已安裝"
echo ""

# 3. 生成 API Key
echo "🔐 Step 3: 生成並設定 API_KEY secret"
API_KEY=$(openssl rand -hex 32)
echo "生成的 API_KEY: $API_KEY"
echo ""
echo "執行以下指令設定 secret:"
echo "firebase functions:secrets:set API_KEY"
echo "(執行後貼上上方的 API_KEY)"
echo ""
read -p "按 Enter 繼續(請先手動執行上述指令)..."
echo ""

# 4. 部署 Functions
echo "🚀 Step 4: 部署 Cloud Functions"
firebase deploy --only functions --project barthon-watch
echo "✅ Functions 已部署"
echo ""

# 5. 驗證 Scheduler
echo "📅 Step 5: 驗證 Cloud Scheduler"
gcloud scheduler jobs describe firebase-schedule-aggregateAnalytics-asia-east1 \
  --location=asia-east1 \
  --project=barthon-watch \
  --format="table(name,schedule,timeZone,state)"
echo ""

# 6. 測試 API
echo "🧪 Step 6: 測試 getDailySummary API"
YESTERDAY=$(date -d "yesterday" +%Y-%m-%d 2>/dev/null || date -v-1d +%Y-%m-%d)
echo "測試日期: $YESTERDAY"
echo ""
echo "執行以下指令測試 API:"
echo "curl \"https://asia-east1-barthon-watch.cloudfunctions.net/getDailySummary?date=$YESTERDAY&key=$API_KEY\""
echo ""
echo "預期: HTTP 200 + JSON 包含 date, uniqueVisitors, pageViews, topProducts, topPages"
echo ""

echo "========================================"
echo "✅ 部署完成!"
echo "========================================"
echo ""
echo "⚠️ 重要: 請將以下資訊安全保存"
echo "API_KEY: $API_KEY"
echo ""
echo "下一步:"
echo "1. 手動觸發首次彙總: gcloud scheduler jobs run firebase-schedule-aggregateAnalytics-asia-east1 --location=asia-east1 --project=barthon-watch"
echo "2. 設定 ops bot BARTHON_API_KEY 環境變數"
echo "3. 設定 Cron: 0 8 * * * /path/to/.ops/fetch-daily-analytics.sh"
