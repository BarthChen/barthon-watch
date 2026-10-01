# BarthON 流量分析系統

> 第一方網站流量追踪 + 後台儀表板 + 機器可讀每日摘要

---

## 架構概覽

### 1. 前台追踪 (`public/analytics.js` + `public/index.html`)
- **匿名訪客 ID**:localStorage 持久化,一個裝置 = 一個唯一訪客
- **Session ID**:sessionStorage,同一瀏覽階段共用
- **事件類型**:
  - `page_view`:頁面瀏覽(記錄 path / referrer)
  - `product_view`:腕錶詳情開啟(記錄 watchId / brand / model)
  - `product_click`:從列表點進詳情(同上)
- **去重邏輯**:
  - 相同 visitorId × type × path × watchId 在 5 秒內只記錄一次(coalesce rapid repeats)
  - 排除已知 bot / crawler user-agent
- **批次寫入**:事件緩衝 2 秒或累積 5 個才一起寫入 Firestore,減少網路開銷

### 2. 資料模型

#### `analytics_events` 集合(原始事件)
每個事件一個文件,欄位:
```js
{
  type: 'page_view' | 'product_view' | 'product_click',
  visitorId: 'v_<timestamp>_<random>',
  sessionId: 's_<timestamp>_<random>',
  timestamp: Timestamp,
  path: '/...',
  referrer: 'https://...',
  watchId: 'w...',  // product_* 專用
  watchBrand: '...',
  watchModel: '...',
  userAgent: '...',
  screen: '1920x1080'
}
```

#### `analytics_daily` 集合(每日彙總)
一天一個文件,文件 ID = `YYYY-MM-DD` (Taipei 時區):
```js
{
  date: '2026-10-02',
  timezone: 'Asia/Taipei',
  pageViews: 123,           // 總瀏覽次數(去重後)
  uniqueVisitors: 45,       // 不重複訪客數
  uniqueSessions: 38,       // 不重複 session 數
  topPages: [
    { path: '/', views: 80, uniqueVisitors: 40 },
    { path: '#w123', views: 10, uniqueVisitors: 8 }
  ],
  topProducts: [
    { watchId: 'w123', watchBrand: 'Rolex', watchModel: 'Sub', clicks: 15, uniqueVisitors: 12 }
  ],
  excluded: { bots: 5, duplicates: 20, other: 0 },
  updatedAt: Timestamp
}
```

### 3. 後台儀表板 (`public/console.html`)
- **路徑**:`https://barthon-watch.web.app/console` → 側邊欄「瀏覽統計」
- **顯示內容**:
  - 今日 / 近 7 日 / 累計 瀏覽與訪客數(卡片)
  - 近 14 天瀏覽趨勢(長條圖)
  - 腕錶點擊排行榜(Top 15)
- **資料來源**:`analytics_daily` 集合(每日彙總後的乾淨數據)

### 4. 每日彙總 (`functions/index.js`)
#### `aggregateAnalytics` (Cloud Scheduler)
- **觸發**:每天早上 07:30 (Taipei 時間)
- **處理**:讀取前一天(Taipei 日期)的所有 `analytics_events`,去重、聚合,寫入 `analytics_daily/{日期}`
- **部署**:`firebase deploy --only functions:aggregateAnalytics`

#### `getDailySummary` (HTTP Function)
- **端點**:`https://asia-east1-barthon-watch.cloudfunctions.net/getDailySummary?date=YYYY-MM-DD`
- **認證**:查詢參數 `?key=<API_KEY>` 或 header `X-API-Key: <key>`(透過 Firebase secret `API_KEY` 注入)
- **Fallback**:如 `analytics_daily/{日期}` 不存在,即時計算該日期的 `analytics_events`(相同去重規則),寫入文件後回傳
- **回應 JSON**:
```json
{
  "date": "2026-10-01",
  "timezone": "Asia/Taipei",
  "uniqueVisitors": 45,
  "pageViews": 123,
  "uniquePageSessions": 38,
  "topProducts": [
    {"id":"w123","brand":"Rolex","model":"Submariner","slug":"w123","uniqueVisitors":12,"clicks":15}
  ],
  "topPages": [
    {"path":"/","uniqueVisitors":40,"views":80}
  ],
  "excluded": {"bots":5,"duplicates":20,"other":0}
}
```
- **ops bot 使用範例**:
```bash
curl "https://asia-east1-barthon-watch.cloudfunctions.net/getDailySummary?date=2026-10-01&key=YOUR_SECRET_KEY"
```

### 5. 安全規則 (`firestore.rules`)
- `analytics_events`:訪客只能 create(不能讀別人的),管理員可讀全部
- `analytics_daily`:只有管理員(或 Cloud Function Admin SDK)能讀寫
- 事件欄位驗證:type 限定值、timestamp 不能過早/過晚、必填欄位檢查

---

## 部署流程

### 首次部署(完整)
```bash
# 1. 部署 Firestore 規則
firebase deploy --only firestore:rules

# 2. 安裝 functions 依賴
cd functions && npm install && cd ..

# 3. 部署 Cloud Functions(含 scheduler 與 HTTP endpoint)
firebase deploy --only functions

# 4. 設定 API_KEY secret(給 getDailySummary 認證用)
firebase functions:secrets:set API_KEY
# 輸入你的 secret key(建議用 pwgen 或 openssl rand -hex 32 生成)

# 5. 部署前台與後台(hosting)
firebase deploy --only hosting
```

### 日常更新(只改前台/後台)
```bash
git add public/
git commit -m "更新流量追踪邏輯"
git push  # GitHub Actions 自動部署 hosting
```

### 更新 Cloud Functions
```bash
cd functions
# 修改 index.js
cd ..
firebase deploy --only functions
```

---

## 常見問題

### Q: 為什麼要分 `analytics_events` 與 `analytics_daily`?
A: 原始事件保留完整記錄供日後稽核/重算;每日彙總減少前台讀取開銷,儀表板直接讀已去重的乾淨數據。排程每天 07:30 執行,確保 08:00 前完成供 bot 報告使用。

### Q: 如何查看即時(未彙總)的今日數據?
A: `getDailySummary` API 已內建 fallback:如 `analytics_daily` 文件不存在,會即時計算 `analytics_events`(相同去重規則),寫入文件後回傳。後台儀表板目前只顯示已彙總的數據。

### Q: `aggregateAnalytics` 跑失敗怎麼辦?
A: 檢查 Firebase Console → Functions 的 logs;常見原因:
- Firestore 索引未建立(需在 console 點連結建立)
- Cloud Scheduler 權限不足(需在 IAM 給予 `Cloud Scheduler Service Agent` 角色)

### Q: ops bot 呼叫 `getDailySummary` 回傳 401 Unauthorized?
A: 確認已設定 `API_KEY` secret 且在請求中正確帶入:
```bash
firebase functions:secrets:set API_KEY
# 然後 re-deploy functions
firebase deploy --only functions:getDailySummary
```

### Q: 前台追踪會拖慢網站嗎?
A: 不會。事件批次緩衝寫入(2 秒或 5 個事件才送一次),且 Firestore 寫入是非同步,不阻塞 UI 渲染。

### Q: 無痕模式 / 封鎖 localStorage 的訪客怎麼算?
A: 會用臨時 ID(`v_temp_<timestamp>`),同裝置每次開無痕視為新訪客(這是預期行為,無法跨 session 追踪)。

---

## 指標定義

| 指標 | 定義 | 去重規則 |
|---|---|---|
| **Raw pageviews** | 所有 `page_view` 事件 | 無(但前端已 coalesce 5 秒內重複) |
| **Unique visitors (day)** | 當天出現過的不重複 `visitorId` 數量 | 一個裝置 = 一個 visitorId |
| **Unique page sessions** | 當天不重複 `sessionId` 數量 | 一次瀏覽階段 = 一個 sessionId |
| **Unique product interest** | 當天不重複 visitor × watchId 配對數 | 同一訪客點同一支錶多次只算一次 |

後台與每日報告**優先顯示 unique/去重數據**,raw 數據為次要參考。

---

## 維護建議

- **事件清理**:`analytics_events` 會持續累積;建議每月用 Cloud Function 刪除 60 天前的舊事件(保留 `analytics_daily` 彙總即可)
- **異常檢測**:定期檢查 `excluded.bots` 與 `duplicates` 數字;如異常高可調整過濾邏輯
- **備份**:Firebase 自動備份 Firestore;如需匯出可用 `gcloud firestore export`

---

## 授權與隱私

- 本分析系統**不使用第三方追踪**(無 Google Analytics / Meta Pixel)
- 匿名訪客 ID 僅用於去重統計,不記錄 IP / 真實身份
- 符合 GDPR / CCPA 最小必要原則(可在隱私政策中說明)
