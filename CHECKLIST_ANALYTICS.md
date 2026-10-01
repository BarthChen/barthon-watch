# 流量分析部署檢查清單

快速確認系統是否正確部署。

## 必要步驟

- [ ] **Firestore 規則已部署**
  ```bash
  firebase deploy --only firestore:rules
  ```
  驗證:Firebase Console → Firestore → 規則,看到 `analytics_events` / `analytics_daily`

- [ ] **Cloud Functions 已安裝依賴**
  ```bash
  cd functions && npm install && cd ..
  ```
  驗證:`functions/node_modules/` 存在

- [ ] **aggregateAnalytics 函式已部署**
  ```bash
  firebase deploy --only functions:aggregateAnalytics
  ```
  驗證:Firebase Console → Functions → 看到函式

- [ ] **getDailySummary 函式已部署**
  ```bash
  firebase deploy --only functions:getDailySummary
  ```
  驗證:curl 端點回傳 JSON(可能 404 但不是 502/503)

- [ ] **Hosting 已部署**(前台 + 後台)
  ```bash
  firebase deploy --only hosting
  ```
  或 merge PR 讓 GitHub Actions 自動部署

## 選用但建議

- [ ] **API_KEY secret 已設定**
  ```bash
  firebase functions:secrets:set API_KEY
  # 輸入隨機 key,例如:openssl rand -hex 32
  firebase deploy --only functions:getDailySummary
  ```

- [ ] **手動觸發首次彙總**
  ```bash
  gcloud scheduler jobs run firebase-schedule-aggregateAnalytics-asia-east1 \
    --location=asia-east1 --project=barthon-watch
  ```
  驗證:Firestore `analytics_daily` 出現前一天文件

## 功能驗證

### ✅ 前台追踪運作中
1. 開啟 https://barthon-watch.web.app/
2. F12 → Console 無 JS 錯誤
3. F12 → Network → 看到對 Firestore 的 POST 請求
4. Firebase Console → Firestore → `analytics_events` 有新文件

### ✅ 後台儀表板顯示數據
1. 登入 https://barthon-watch.web.app/console
2. 側欄點「瀏覽統計」
3. 看到卡片(今日瀏覽/訪客/近 7 日/累計)
4. 看到圖表(近 14 天長條)
5. 看到排行榜(腕錶點擊 / 熱門頁面)

### ✅ 每日彙總自動執行
1. Cloud Console → Cloud Scheduler
2. 看到 `firebase-schedule-aggregateAnalytics-asia-east1` job
3. 狀態:Enabled
4. 排程:`every day 02:00`
5. 「上次執行」有時間戳(或手動觸發一次)

### ✅ 每日摘要 API 可訪問
```bash
# 替換 YOUR_API_KEY(如有設定 secret)
curl "https://asia-east1-barthon-watch.cloudfunctions.net/getDailySummary?date=2026-10-01&key=YOUR_API_KEY"
```
應回傳 JSON(包含 `date`, `uniqueVisitors`, `pageViews`, `topProducts`, `topPages`)

### ✅ ops bot 腳本可執行
```bash
export BARTHON_API_KEY="your-secret-key"
./.ops/fetch-daily-analytics.sh
```
應輸出格式化的日報

---

## 疑難排解快速索引

| 問題 | 檢查 | 解決 |
|---|---|---|
| 前台無事件寫入 | F12 Console / Network | 檢查 Firestore 規則、`analytics.js` 匯入 |
| 後台顯示 0 | `analytics_daily` 是否有資料 | 手動觸發彙總 |
| Scheduler 不執行 | Cloud Scheduler job 狀態 | 檢查 App Engine 是否啟用 |
| getDailySummary 404 | 該日期是否已彙總 | 查詢前一天或手動觸發 |
| Functions 部署失敗 | 錯誤訊息:Service Agent | IAM 設定 Cloud Scheduler Service Agent 角色 |

詳細疑難排解見 `DEPLOY_ANALYTICS.md`。

---

**部署完成後請勾選所有項目,確保系統運作正常。**
