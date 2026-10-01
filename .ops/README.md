# ops Bot 工具

此目錄包含 BarthON 運營自動化腳本。

## `fetch-daily-analytics.sh`

每日流量分析報告生成器。

### 使用方式

```bash
# 手動執行
export BARTHON_API_KEY="your-secret-key"
./.ops/fetch-daily-analytics.sh
```

### Cron 設定範例

```cron
# 每天早上 8:00 執行(Taipei 時間,Scheduler 7:30 彙總完成後)
0 8 * * * export BARTHON_API_KEY="your-key" && /path/to/barthon-watch/.ops/fetch-daily-analytics.sh >> /var/log/barthon-daily.log 2>&1
```

### 輸出範例

```
📈 BarthON 流量分析日報 — 2026-10-01
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📅 日期:2026-10-01 (Taipei 時區)

👥 訪客與瀏覽
  • 不重複訪客:45 人
  • 總瀏覽次數:123 次
  • 不重複 session:38 個

🔍 過濾統計
  • 排除機器人:5 個
  • 排除重複事件:20 個

⭐ 最熱門腕錶(點擊排行)
  Rolex Submariner — 15 次點擊 (12 人)
  Tudor Black Bay — 8 次點擊 (6 人)

📄 最熱門頁面
  / — 80 次瀏覽 (40 人)
  #w123 — 10 次瀏覽 (8 人)
```

### 整合通知渠道

腳本底部有註解範例,可取消註解以啟用:
- 寫入日誌檔
- 發送 Slack / Discord webhook
- 寄送 Email(需搭配 `sendmail` 或 `mailx`)

### 依賴

- `curl`:HTTP 請求
- `jq`:JSON 解析
- `date`:日期計算(GNU 或 BSD)
