# BarthON 流量分析 — 部署指南

> 這份文件說明如何從零部署流量分析系統,包含 Firestore 規則、Cloud Functions 與前端追踪。

---

## 前置需求

- Firebase CLI 已安裝並登入:`firebase login`
- 已初始化 Firebase 專案:`firebase use barthon-watch`
- Node.js 20+ (Cloud Functions 需要)

---

## 部署步驟

### 1. 部署 Firestore 安全規則

```bash
# 部署新的規則(含 analytics_events / analytics_daily 集合權限)
firebase deploy --only firestore:rules
```

**預期結果**:
- `analytics_events`:訪客可 create(不能讀別人的),管理員可讀全部
- `analytics_daily`:只有管理員與 Cloud Function 能讀寫

**驗證**:Firebase Console → Firestore → 規則分頁,看到 `analytics_events` / `analytics_daily` 的 match 區塊

---

### 2. 安裝 Cloud Functions 依賴

```bash
cd functions
npm install
cd ..
```

**預期結果**:`functions/node_modules/` 出現,包含 `firebase-admin` 與 `firebase-functions`

---

### 3. 部署 Cloud Functions

#### 3.1 部署排程函式(每日彙總)

```bash
firebase deploy --only functions:aggregateAnalytics
```

**預期結果**:
- Cloud Scheduler 自動建立排程:`every day 02:00` (Taipei 時間早上 10:00)
- 函式部署到 `asia-east1` region

**驗證**:
- Firebase Console → Functions → `aggregateAnalytics` 函式存在
- Google Cloud Console → Cloud Scheduler → 看到 `firebase-schedule-aggregateAnalytics-asia-east1` job

**初次部署可能遇到的錯誤**:
```
Error: Cloud Scheduler Service Agent missing roles
```
**解決方式**:
1. 前往 [Google Cloud Console IAM](https://console.cloud.google.com/iam-admin/iam?project=barthon-watch)
2. 找到 `service-<project-number>@gcp-sa-cloudscheduler.iam.gserviceaccount.com`
3. 點「編輯」,新增角色 `Cloud Scheduler Service Agent`
4. 儲存後重新部署

#### 3.2 部署 HTTP 端點(每日摘要 API)

```bash
firebase deploy --only functions:getDailySummary
```

**預期結果**:
- HTTP 端點:`https://asia-east1-barthon-watch.cloudfunctions.net/getDailySummary`
- 可接受 GET 請求,需帶 `?date=YYYY-MM-DD&key=<API_KEY>` 參數

**測試**:
```bash
# 先不帶 key 測試(應回傳 401 或空資料,取決於是否設定 API_KEY secret)
curl "https://asia-east1-barthon-watch.cloudfunctions.net/getDailySummary?date=2026-10-01"
```

---

### 4. 設定 API Key Secret(選用但建議)

為保護每日摘要 API,設定 secret key:

```bash
firebase functions:secrets:set API_KEY
```

輸入一個強隨機字串,例如:
```bash
# 在終端機生成 32 字元隨機 key
openssl rand -hex 32
```

**設定後需重新部署**:
```bash
firebase deploy --only functions:getDailySummary
```

**測試帶 key 的請求**:
```bash
curl "https://asia-east1-barthon-watch.cloudfunctions.net/getDailySummary?date=2026-10-01&key=YOUR_SECRET_KEY"
```

---

### 5. 部署前台與後台(Hosting)

```bash
# 本地測試(選用)
firebase serve --only hosting

# 正式部署
firebase deploy --only hosting
```

**預期結果**:
- 前台:`https://barthon-watch.web.app/` — 載入後開始記錄 `page_view` 事件
- 後台:`https://barthon-watch.web.app/console` → 側欄「瀏覽統計」顯示儀表板

**驗證前台追踪**:
1. 開啟前台任一頁面
2. F12 開發者工具 → Network → 看到對 Firestore 的 `POST` 請求(寫入 `analytics_events`)
3. Firebase Console → Firestore → `analytics_events` 集合出現新事件文件

---

## 首次執行與測試

### 手動觸發第一次彙總

Cloud Scheduler 首次執行要等到明天早上 10:00,如需立即測試彙總,可手動觸發:

#### 方法 1:在 Cloud Console 手動執行

1. 前往 [Cloud Scheduler](https://console.cloud.google.com/cloudscheduler?project=barthon-watch)
2. 找到 `firebase-schedule-aggregateAnalytics-asia-east1` job
3. 點「強制執行」

#### 方法 2:用 gcloud CLI 觸發

```bash
gcloud scheduler jobs run firebase-schedule-aggregateAnalytics-asia-east1 \
  --location=asia-east1 \
  --project=barthon-watch
```

#### 驗證彙總結果

1. Firebase Console → Firestore → `analytics_daily` 集合
2. 應出現前一天日期的文件(如 `2026-09-30`)
3. 文件內容包含 `pageViews`, `uniqueVisitors`, `topProducts`, `topPages` 等欄位

---

## 日常維護

### 檢查 Cloud Functions 日誌

```bash
# 檢視 aggregateAnalytics 最近 20 筆日誌
firebase functions:log --only aggregateAnalytics --limit 20
```

**常見日誌**:
- `[aggregateAnalytics] Processing date: 2026-10-01` — 正在處理該日期
- `[aggregateAnalytics] Aggregated 2026-10-01: 123 views, 45 visitors` — 成功彙總
- `[aggregateAnalytics] No events found for 2026-10-01` — 當天無事件(正常,如首日)

### 監控錯誤

Firebase Console → Functions → 選擇函式 → 日誌分頁 → 篩選「錯誤」

**常見錯誤與解決**:
| 錯誤訊息 | 原因 | 解決方式 |
|---|---|---|
| `Missing index for query` | Firestore 查詢需要複合索引 | 點日誌中的連結前往 Console 建立索引 |
| `Permission denied` | Service account 權限不足 | 確認 Cloud Scheduler Service Agent 角色已設定 |
| `Function timeout` | 事件量太大,5 分鐘內處理不完 | 增加 `memory` / `timeout` 設定(functions/index.js 的 onSchedule 參數) |

### 清理舊事件(建議每月執行)

`analytics_events` 會持續累積,每月手動刪除 60 天前的事件:

```bash
# 使用 Firebase Console 或寫 Cloud Function 定期刪除
# 範例:保留 60 天,刪除更早的事件(需另寫函式或手動操作)
```

**自動清理函式範例**(選用,加到 `functions/index.js`):
```js
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

export const cleanOldEvents = onSchedule({
  schedule: 'every month 00:00',
  timeZone: 'Asia/Taipei',
  region: 'asia-east1'
}, async () => {
  const db = getFirestore(app, 'barthon');
  const cutoff = Timestamp.fromMillis(Date.now() - 60 * 24 * 60 * 60 * 1000); // 60 天前
  const old = await db.collection('analytics_events').where('timestamp', '<', cutoff).limit(500).get();
  const batch = db.batch();
  old.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
  console.log(`Deleted ${old.size} old events`);
});
```

---

## ops Bot 取用每日摘要

### 端點

```
GET https://asia-east1-barthon-watch.cloudfunctions.net/getDailySummary
```

### 參數

| 參數 | 必填 | 說明 | 範例 |
|---|---|---|---|
| `date` | 是 | 目標日期 (Taipei 時區) | `2026-10-01` |
| `key` | 是 (如設定 API_KEY) | 認證 key | 環境變數 `API_KEY` 的值 |

### 回應格式

```json
{
  "date": "2026-10-01",
  "timezone": "Asia/Taipei",
  "uniqueVisitors": 45,
  "pageViews": 123,
  "uniquePageSessions": 38,
  "topProducts": [
    {
      "id": "w1727812345678",
      "brand": "Rolex",
      "model": "Submariner Date 116610LN",
      "slug": "w1727812345678",
      "uniqueVisitors": 12,
      "clicks": 15
    }
  ],
  "topPages": [
    { "path": "/", "uniqueVisitors": 40, "views": 80 },
    { "path": "#w1727812345678", "uniqueVisitors": 8, "views": 10 }
  ],
  "excluded": { "bots": 5, "duplicates": 20, "other": 0 }
}
```

### ops Bot 範例腳本

```bash
#!/bin/bash
# fetch-barthon-analytics.sh — 每天早上 11:00 抓前一天的統計

API_KEY="YOUR_SECRET_KEY"
YESTERDAY=$(date -d "yesterday" +%Y-%m-%d)
ENDPOINT="https://asia-east1-barthon-watch.cloudfunctions.net/getDailySummary"

curl -s "${ENDPOINT}?date=${YESTERDAY}&key=${API_KEY}" | jq .
```

**Cron 設定**(在 ops bot 主機):
```cron
0 11 * * * /path/to/fetch-barthon-analytics.sh >> /var/log/barthon-analytics.log 2>&1
```

---

## 疑難排解

### Q: 前台載入後沒有寫入 `analytics_events`?

**檢查項目**:
1. F12 Console 有無 JS 錯誤?
2. Network 分頁是否有對 Firestore 的請求?
3. Firestore 規則是否正確部署?(訪客能 create `analytics_events`)
4. `public/analytics.js` 是否正確匯入到 `index.html`?

### Q: 後台「瀏覽統計」顯示 0?

**原因**:
- `analytics_daily` 尚未有資料(第一次彙總要等明天早上 10:00)
- 或手動觸發 `aggregateAnalytics` 失敗

**解決**:手動觸發彙總(見上方「首次執行與測試」),檢查 Functions 日誌

### Q: `getDailySummary` 回傳 404?

**原因**:該日期尚未彙總,或 `analytics_daily/{日期}` 文件不存在

**解決**:
1. 確認該日期有前台流量
2. 手動觸發 `aggregateAnalytics`
3. 或查詢前一天的日期

### Q: Cloud Scheduler 沒有自動執行?

**檢查**:
1. Cloud Console → Cloud Scheduler → job 狀態是否 `Enabled`
2. 「上次執行」欄位是否有更新?
3. 點進 job → 「檢視」→ 歷史記錄看有無失敗

**常見問題**:App Engine 未啟用 → 前往 Cloud Console 啟用 App Engine(選 asia-east1 region)

---

## 成功部署檢查清單

- [ ] Firestore 規則已部署,`analytics_events` / `analytics_daily` match 區塊存在
- [ ] Cloud Functions `aggregateAnalytics` 已部署,Cloud Scheduler job 存在且 Enabled
- [ ] Cloud Functions `getDailySummary` 已部署,可用瀏覽器/curl 訪問
- [ ] API_KEY secret 已設定(或決定暫不設定,允許內部無認證訪問)
- [ ] Hosting 已部署,前台載入後 Firestore `analytics_events` 有新事件
- [ ] 手動觸發一次 `aggregateAnalytics`,`analytics_daily` 出現前一天的文件
- [ ] 後台 `/console` → 「瀏覽統計」顯示數據(卡片 + 圖表 + 排行榜)

---

## 授權與支援

系統由 BarthON 團隊內部維護。技術問題請參考 `ANALYTICS.md` 或聯繫管理員。
