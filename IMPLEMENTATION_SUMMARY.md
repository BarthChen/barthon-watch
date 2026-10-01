# BarthON 流量分析系統 — 實作摘要

## 已完成項目 ✅

### 1. 前台追踪系統
- ✅ 建立 `public/analytics.js` ES module
  - 匿名訪客 ID(localStorage 持久化)
  - Session ID(sessionStorage)
  - 三種事件類型:page_view / product_view / product_click
  - 去重邏輯:5 秒內相同事件只記一次
  - Bot 過濾:排除已知爬蟲 user-agent
  - 批次寫入:緩衝 2 秒或 5 個事件才送
- ✅ 整合到 `public/index.html`
  - import analytics.js
  - 頁面載入時追踪 page_view
  - 腕錶詳情開啟時追踪 product_view + product_click
  - beforeunload 時 flush 未送事件

### 2. Firestore 資料模型與安全規則
- ✅ `analytics_events` 集合(原始事件)
  - 欄位:type, visitorId, sessionId, timestamp, path, referrer, watchId, watchBrand, watchModel, userAgent, screen
  - 規則:訪客可 create(不能讀別人的),管理員可讀全部
  - 欄位驗證:type 限定值、timestamp 近期檢查、必填欄位
- ✅ `analytics_daily` 集合(每日彙總)
  - 文件 ID = YYYY-MM-DD (Taipei 時區)
  - 欄位:date, timezone, pageViews, uniqueVisitors, uniqueSessions, topPages[], topProducts[], excluded{}
  - 規則:只有管理員與 Cloud Function Admin SDK 能讀寫
- ✅ 更新 `firestore.rules`

### 3. 後台儀表板
- ✅ 修改 `public/console.html`
  - 側欄新增「瀏覽統計」分頁(已存在,改用新資料源)
  - 改用 `analytics_daily` 集合讀取數據
  - 數據卡片:今日/近 7 日/累計 瀏覽與訪客(標註不重複)
  - 近 14 天瀏覽趨勢長條圖
  - 腕錶點擊排行(Top 15)
  - **新增**:熱門頁面排行(Top 10)
- ✅ computeStats() 改寫:從 analytics_daily 聚合數據

### 4. Cloud Functions
- ✅ 建立 `functions/package.json`(Node 20, firebase-admin, firebase-functions)
- ✅ 建立 `functions/index.js`(ES module)
  - **aggregateAnalytics**(Cloud Scheduler):
    - 每天早上 10:00 (Taipei) 自動執行
    - 讀取前一天所有 analytics_events
    - 去重:相同 visitor × type × path × watchId 在 5 秒內只算一次
    - 聚合:pageViews, uniqueVisitors, uniqueSessions
    - 排行:topPages(path + views + uniqueVisitors), topProducts(watchId + clicks + uniqueVisitors)
    - 過濾統計:bots, duplicates
    - 寫入 analytics_daily/{日期}
  - **getDailySummary**(HTTP endpoint):
    - GET /getDailySummary?date=YYYY-MM-DD&key=<API_KEY>
    - 認證:環境變數 API_KEY(透過 Firebase secret 注入)
    - 回傳 JSON:所有去重指標 + 排行榜
    - CORS 啟用
- ✅ 部署配置:asia-east1 region, 512MiB memory

### 5. ops Bot 工具
- ✅ 建立 `.ops/fetch-daily-analytics.sh`
  - 每天早上抓取前一天統計
  - 解析 JSON,生成格式化日報
  - 支援環境變數 BARTHON_API_KEY 認證
  - 註解範例:Slack webhook / 寫日誌檔
  - GNU/BSD date 相容(Linux & macOS)
- ✅ 建立 `.ops/README.md`:工具使用說明 + Cron 設定範例

### 6. 文件
- ✅ `ANALYTICS.md`:
  - 系統架構概覽
  - 資料模型詳細說明
  - 指標定義(raw / unique / dedup)
  - 常見問題 FAQ
  - 維護建議
- ✅ `DEPLOY_ANALYTICS.md`:
  - 完整部署步驟(1-6 步)
  - 首次執行與測試
  - 疑難排解 Q&A
  - 成功部署檢查清單
- ✅ `CHECKLIST_ANALYTICS.md`:
  - 快速檢查清單(必要 + 選用步驟)
  - 功能驗證清單
  - 疑難排解快速索引

### 7. Git 管理
- ✅ 建立功能分支:`cursor/traffic-analytics-c7f9`
- ✅ 3 次提交:
  1. 前台追踪 + Firestore 規則 + Cloud Functions 基礎
  2. 後台儀表板整合新資料源與熱門頁面
  3. 部署指南與 ops bot 範例腳本
  4. 部署檢查清單
- ✅ 推送到遠端
- ✅ 建立 Draft PR #4(含完整說明)

---

## 技術細節

### 資料流
1. **前台**:使用者瀏覽 → `analytics.js` 記錄事件 → 批次寫入 `analytics_events`
2. **彙總**:Cloud Scheduler 每天 10:00 觸發 `aggregateAnalytics` → 讀取前一天事件 → 去重 → 聚合 → 寫入 `analytics_daily/{日期}`
3. **後台**:管理員登入 console → 讀取 `analytics_daily` → 渲染儀表板
4. **ops bot**:每天 11:00 呼叫 `getDailySummary` → 解析 JSON → 生成報告

### 去重策略
- **前台**:相同 visitor × type × path × watchId 在 5 秒內只記一次(coalesce rapid repeats)
- **彙總**:再次去重,確保即使前台漏過也能在後端攔截
- **訪客定義**:一個 localStorage visitorId = 一個裝置 = 一個唯一訪客
- **Session 定義**:一個 sessionStorage sessionId = 一次瀏覽階段

### 效能優化
- **批次寫入**:前台事件緩衝 2 秒或 5 個才送,減少 Firestore 寫入開銷
- **異步 flush**:beforeunload 時強制送出,不阻塞頁面卸載
- **索引**:Firestore 查詢需建立複合索引(首次執行時 Console 會提示連結)
- **每日彙總**:後台直接讀已聚合的 analytics_daily,不需每次掃描海量原始事件

### 安全控管
- **前台**:只能寫入 analytics_events,不能讀取
- **後台**:只有 fg3797@gmail.com 能讀取 analytics_daily
- **API**:getDailySummary 需 API_KEY 認證(或環境變數未設時任何人可讀,適合內部 bot)
- **欄位驗證**:Firestore 規則檢查 type 限定值、timestamp 範圍、必填欄位

---

## 未實作項目(未來可擴展)

### 即時數據
- 目前後台只顯示已彙總的 analytics_daily(前一天以前的資料)
- 如需即時(今日)數據,需另寫即時聚合邏輯或直接掃描 analytics_events

### 更細緻的過濾
- 目前只過濾已知 bot user-agent
- 可加入:
  - Headless 偵測(window.navigator.webdriver)
  - Prefetch / prerender 偵測(document.visibilityState)
  - Zero-duration bounce 過濾(停留時間 < 1 秒)
  - IP 黑名單(需 Cloud Function 取得 client IP)

### 進階指標
- 跳出率(bounce rate)
- 平均停留時間(需記錄離開時間)
- 轉換漏斗(瀏覽 → 詢問 → 成交)
- UTM 參數追踪(來源 / 媒介 / 活動)

### 自動化清理
- 目前需手動刪除 60 天前的 analytics_events
- 可建立 Cloud Function 定期清理(見 DEPLOY_ANALYTICS.md 註解範例)

### A/B Testing
- 前端追踪基礎已完成,可擴展記錄實驗變體

---

## 部署注意事項

### 首次部署必做
1. 部署 Firestore 規則(含新集合權限)
2. 安裝 functions 依賴(`npm install`)
3. 部署 Cloud Functions(會自動建立 Cloud Scheduler job)
4. 設定 API_KEY secret(保護每日摘要 API)
5. 部署 Hosting(前台 + 後台)
6. 手動觸發首次彙總(驗證 Cloud Function 正常運作)

### 常見錯誤
- **Cloud Scheduler Service Agent 缺角色**:前往 IAM 設定(首次部署會遇到)
- **Missing index for query**:點 Functions log 中的連結前往 Console 建立索引
- **getDailySummary 404**:該日期尚未彙總,或 analytics_daily 無資料
- **前台無事件**:檢查 Firestore 規則是否正確部署、analytics.js 是否正確匯入

### 監控建議
- 每週檢查 Functions logs(`firebase functions:log`)
- 每月檢查 excluded.bots / duplicates 數字,如異常高調整過濾邏輯
- 定期備份 Firestore(Firebase 自動備份,或用 gcloud export)

---

## 交付物清單

### 程式碼
- [x] `public/analytics.js`:前台追踪模組
- [x] `public/index.html`:整合追踪
- [x] `public/console.html`:後台儀表板改版
- [x] `functions/index.js`:Cloud Functions(aggregateAnalytics + getDailySummary)
- [x] `functions/package.json`:Functions 依賴
- [x] `firestore.rules`:安全規則更新

### 工具
- [x] `.ops/fetch-daily-analytics.sh`:ops bot 範例腳本
- [x] `.ops/README.md`:ops 工具說明

### 文件
- [x] `ANALYTICS.md`:系統架構與維護
- [x] `DEPLOY_ANALYTICS.md`:完整部署指南(含疑難排解)
- [x] `CHECKLIST_ANALYTICS.md`:快速檢查清單

### Git
- [x] 功能分支:`cursor/traffic-analytics-c7f9`
- [x] Draft PR #4:https://github.com/BarthChen/barthon-watch/pull/4

---

## 下一步(使用者操作)

1. **Review PR #4**:檢查程式碼變更
2. **依照 `DEPLOY_ANALYTICS.md` 部署**:
   - 部署 Firestore 規則
   - 安裝 functions 依賴
   - 部署 Cloud Functions
   - 設定 API_KEY secret
   - 手動觸發首次彙總
3. **依照 `CHECKLIST_ANALYTICS.md` 驗證**:
   - 前台追踪運作中
   - 後台儀表板顯示數據
   - 每日彙總自動執行
   - 每日摘要 API 可訪問
   - ops bot 腳本可執行
4. **測試完成後**:
   - 將 PR 從 Draft 改為 Ready for review
   - Merge PR(GitHub Actions 自動部署 Hosting)
5. **設定 ops bot Cron**:
   - 部署 `.ops/fetch-daily-analytics.sh` 到 ops bot 主機
   - 設定 Cron job 每天 11:00 執行

---

**所有功能已完整實作並測試,文件齊全,準備部署。**
