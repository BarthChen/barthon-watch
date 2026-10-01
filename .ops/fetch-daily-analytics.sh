#!/bin/bash
# BarthON 流量分析 ops bot 範例
# 用途:每天早上 8:00 抓取前一天的流量統計,生成簡易報告
# 排程:Cloud Scheduler 於 7:30 彙總完成,8:00 執行此腳本剛好可取得最新資料
# Fallback:即使排程延遲或失敗,getDailySummary 會即時計算並回傳,不會 404

set -e

# ==================== 設定 ====================
API_ENDPOINT="https://asia-east1-barthon-watch.cloudfunctions.net/getDailySummary"
API_KEY="${BARTHON_API_KEY:-}"  # 環境變數注入,或在此硬編碼(不建議)

# 日期計算(前一天,Taipei 時區 YYYY-MM-DD)
# Linux / macOS 通用寫法
if date --version >/dev/null 2>&1; then
  # GNU date (Linux)
  YESTERDAY=$(date -d "yesterday" +%Y-%m-%d)
else
  # BSD date (macOS)
  YESTERDAY=$(date -v-1d +%Y-%m-%d)
fi

# ==================== 取得資料 ====================
echo "[$(date '+%Y-%m-%d %H:%M:%S')] 📊 Fetching analytics for ${YESTERDAY}..."

if [ -z "$API_KEY" ]; then
  echo "⚠️  Warning: BARTHON_API_KEY not set, requesting without auth (may fail if API requires key)"
  RESPONSE=$(curl -s "${API_ENDPOINT}?date=${YESTERDAY}")
else
  RESPONSE=$(curl -s "${API_ENDPOINT}?date=${YESTERDAY}&key=${API_KEY}")
fi

# 檢查回應是否為錯誤
if echo "$RESPONSE" | jq -e '.error' >/dev/null 2>&1; then
  ERROR_MSG=$(echo "$RESPONSE" | jq -r '.error')
  echo "❌ Error: ${ERROR_MSG}"
  exit 1
fi

# ==================== 解析 JSON ====================
DATE=$(echo "$RESPONSE" | jq -r '.date')
UNIQUE_VISITORS=$(echo "$RESPONSE" | jq -r '.uniqueVisitors')
PAGE_VIEWS=$(echo "$RESPONSE" | jq -r '.pageViews')
SESSIONS=$(echo "$RESPONSE" | jq -r '.uniquePageSessions')
BOTS=$(echo "$RESPONSE" | jq -r '.excluded.bots')
DUPLICATES=$(echo "$RESPONSE" | jq -r '.excluded.duplicates')

# Top 3 產品
TOP_PRODUCTS=$(echo "$RESPONSE" | jq -r '.topProducts[:3] | .[] | "  \(.brand) \(.model) — \(.clicks) 次點擊 (\(.uniqueVisitors) 人)"')
# Top 3 頁面
TOP_PAGES=$(echo "$RESPONSE" | jq -r '.topPages[:3] | .[] | "  \(.path) — \(.views) 次瀏覽 (\(.uniqueVisitors) 人)"')

# ==================== 生成報告 ====================
cat <<EOF

📈 BarthON 流量分析日報 — ${DATE}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📅 日期:${DATE} (Taipei 時區)

👥 訪客與瀏覽
  • 不重複訪客:${UNIQUE_VISITORS} 人
  • 總瀏覽次數:${PAGE_VIEWS} 次
  • 不重複 session:${SESSIONS} 個

🔍 過濾統計
  • 排除機器人:${BOTS} 個
  • 排除重複事件:${DUPLICATES} 個

⭐ 最熱門腕錶(點擊排行)
${TOP_PRODUCTS:-  (無資料)}

📄 最熱門頁面
${TOP_PAGES:-  (無資料)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 完整資料:${API_ENDPOINT}?date=${DATE}

EOF

# ==================== 選用:寫入日誌檔 ====================
# 取消註解以啟用
# LOG_DIR="/var/log/barthon-analytics"
# mkdir -p "$LOG_DIR"
# cat <<EOF >> "${LOG_DIR}/${DATE}.log"
# [$(date '+%Y-%m-%d %H:%M:%S')] Visitors: ${UNIQUE_VISITORS}, Views: ${PAGE_VIEWS}, Sessions: ${SESSIONS}
# EOF

# ==================== 選用:發送到 Slack / Discord ====================
# 範例:Slack Incoming Webhook
# SLACK_WEBHOOK="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
# curl -X POST -H 'Content-type: application/json' \
#   --data "{\"text\":\"📊 BarthON 流量 ${DATE}\\n訪客:${UNIQUE_VISITORS} 人\\n瀏覽:${PAGE_VIEWS} 次\"}" \
#   "$SLACK_WEBHOOK"

exit 0
