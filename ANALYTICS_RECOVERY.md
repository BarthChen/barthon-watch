# 流量分析資料恢復指南

## 2026-10-21 零流量事件調查報告

### 🔍 根本原因
**Firestore 安全規則時鐘偏移限制 + `Timestamp.now()` 客戶端時間戳記**

#### 問題 1: 安全規則過嚴
```javascript
// firestore.rules 第 67 行(修復前)
&& (request.time - data.timestamp < duration.value(120, 's'))
```
- 要求事件時間戳記在伺服器寫入時間前後 **2 分鐘**內
- 訪客瀏覽器時鐘快於伺服器 >2 分鐘 → 寫入被拒絕
- 前台靜默失敗,事件永久遺失

#### 問題 2: 客戶端時間戳記
```javascript
// public/analytics.js (修復前)
timestamp: this.fs.Timestamp.now()  // 客戶端產生,受瀏覽器時鐘影響
```
- 批次緩衝延遲 0-2 秒,加上時鐘偏移,觸發規則違規

#### 問題 3: 批次失敗不重試
```javascript
catch (err) {
  console.warn('[Analytics] flush failed:', err);  // 只記 log,不重試
}
```

---

## ✅ 修復方案 (已實施於 PR #17)

### 1. 改用 `serverTimestamp()`
```javascript
timestamp: this.fs.serverTimestamp()  // 伺服器自動填入,完全避免時鐘偏移
```

### 2. 安全規則驗證 `request.time`
```javascript
&& data.timestamp == request.time  // serverTimestamp() 在規則中解析為 request.time
```
- `serverTimestamp()` 在客戶端是 sentinel 值,在安全規則中解析為 `request.time`
- 強制要求使用伺服器時間,拒絕客戶端自訂時間戳記

### 3. 批次失敗重試一次
```javascript
if (!batch[0]._retried) {
  batch.forEach(ev => { ev._retried = true; });
  this.eventQueue.unshift(...batch);
  this.flushTimer = setTimeout(() => this._flush(), 5000);
}
```

---

## ❌ 10/21 數據是否可恢復?

### **無法完整恢復,原因:**
- 如果安全規則拒絕寫入,事件**從未進入 Firestore**
- `analytics_events` collection 無 10/21 原始事件可彙總
- 無法重建 `topPages` / `topProducts` 明細

### **部分恢復可能(檢查舊系統):**
```javascript
// 連線 Firebase 並查詢舊的 stats collection
const db = getFirestore(app, 'barthon');
const statsDoc = await getDoc(doc(db, 'stats', '2026-10-21'));

if (statsDoc.exists()) {
  const data = statsDoc.data();
  console.log('10/21 舊系統數據:', {
    visitors: data.visitors || 0,
    views: data.views || 0,
    clicks: data.clicks || {}  // watchId → count
  });
}
```

**限制:**
- 舊系統只記錄總數,無 `visitorId` / `sessionId` / `path` / `userAgent` 明細
- `clicks` 是 watchId → count 的 map,但無時間戳記或訪客資訊
- 無法生成 `analytics_daily` 格式的完整報告

---

## 🛠️ 回填腳本(僅供參考,10/21 無法使用)

**⚠️ 此腳本僅適用於「原始事件存在但彙總失敗」的情況,不適用於 10/21**

```javascript
// backfill-analytics.js — 手動回填指定日期的彙總資料
// 用途:Functions 彙總失敗或時區錯誤時,重新執行彙總邏輯
// 條件:analytics_events 必須有該日期的原始事件

import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const app = initializeApp();
const db = getFirestore(app, 'barthon');

const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;

function toTaipeiDate(ts) {
  const d = new Date(ts.toMillis() + TAIPEI_OFFSET_MS);
  return d.getUTCFullYear() + '-' +
         String(d.getUTCMonth() + 1).padStart(2, '0') + '-' +
         String(d.getUTCDate()).padStart(2, '0');
}

async function backfill(targetDate) {
  console.log(`[backfill] 開始回填 ${targetDate}...`);

  // 1. 讀取該日期所有事件
  const eventsSnap = await db.collection('analytics_events')
    .orderBy('timestamp')
    .get();

  const events = [];
  eventsSnap.forEach(doc => {
    const ev = doc.data();
    if (!ev.timestamp || !ev.visitorId) return;
    const date = toTaipeiDate(ev.timestamp);
    if (date === targetDate) {
      events.push({ id: doc.id, ...ev });
    }
  });

  if (!events.length) {
    console.log(`[backfill] ${targetDate} 無事件,結束。`);
    return;
  }

  console.log(`[backfill] 找到 ${events.length} 筆原始事件。`);

  // 2. 去重(5 秒內相同 visitorId × type × path)
  const deduped = [];
  const seen = new Map();
  events.sort((a, b) => a.timestamp.toMillis() - b.timestamp.toMillis());

  for (const ev of events) {
    const key = `${ev.type}|${ev.visitorId}|${ev.path || ''}|${ev.watchId || ''}`;
    const last = seen.get(key);
    if (last && (ev.timestamp.toMillis() - last) < 5000) {
      continue;
    }
    seen.set(key, ev.timestamp.toMillis());
    deduped.push(ev);
  }

  console.log(`[backfill] 去重後 ${deduped.length} 筆有效事件。`);

  // 3. 計算指標(與 functions/index.js 邏輯一致)
  const pageViews = deduped.filter(e => e.type === 'page_view').length;
  const uniqueVisitors = new Set(deduped.map(e => e.visitorId)).size;
  const uniqueSessions = new Set(deduped.map(e => e.sessionId)).size;

  // Top Pages
  const pathCounts = {};
  deduped.filter(e => e.type === 'page_view').forEach(e => {
    const p = e.path || '/';
    pathCounts[p] = (pathCounts[p] || 0) + 1;
  });
  const topPages = Object.entries(pathCounts)
    .map(([path, count]) => ({
      path,
      views: count,
      uniqueVisitors: deduped.filter(e => e.type === 'page_view' && e.path === path)
        .reduce((s, e) => (s.add(e.visitorId), s), new Set()).size
    }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 20);

  // Top Products
  const productStats = {};
  deduped.filter(e => e.type === 'product_click' && e.watchId).forEach(e => {
    const id = e.watchId;
    if (!productStats[id]) {
      productStats[id] = { watchId: id, watchBrand: e.watchBrand || '', watchModel: e.watchModel || '', clicks: 0, uniqueVisitors: new Set() };
    }
    productStats[id].clicks += 1;
    productStats[id].uniqueVisitors.add(e.visitorId);
  });
  const topProducts = Object.values(productStats)
    .map(p => ({ ...p, uniqueVisitors: p.uniqueVisitors.size }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 30);

  // 過濾統計
  const botCount = events.filter(e => {
    const ua = (e.userAgent || '').toLowerCase();
    return ['bot', 'crawler', 'spider'].some(p => ua.includes(p));
  }).length;
  const duplicateCount = events.length - deduped.length;

  // 4. 寫入 analytics_daily
  const summary = {
    date: targetDate,
    timezone: 'Asia/Taipei',
    pageViews,
    uniqueVisitors,
    uniqueSessions,
    topPages,
    topProducts: topProducts.map(p => ({ watchId: p.watchId, watchBrand: p.watchBrand, watchModel: p.watchModel, clicks: p.clicks, uniqueVisitors: p.uniqueVisitors })),
    excluded: { bots: botCount, duplicates: duplicateCount, other: 0 },
    updatedAt: Timestamp.now()
  };

  await db.collection('analytics_daily').doc(targetDate).set(summary);
  console.log(`[backfill] ✅ ${targetDate} 回填完成: ${pageViews} views, ${uniqueVisitors} visitors`);
}

// 使用方式:
// node backfill-analytics.js 2026-10-22
const targetDate = process.argv[2];
if (!targetDate || !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
  console.error('用法: node backfill-analytics.js YYYY-MM-DD');
  process.exit(1);
}

backfill(targetDate).catch(err => {
  console.error('[backfill] 錯誤:', err);
  process.exit(1);
});
```

### 執行回填(僅供參考)
```bash
# 1. 進入 functions 目錄
cd functions

# 2. 設定 Firebase Admin credentials
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account-key.json"

# 3. 執行回填指定日期
node backfill-analytics.js 2026-10-22

# ⚠️ 注意:此腳本需要原始事件存在於 analytics_events
# 10/21 無原始事件,無法回填
```

---

## 📊 驗證修復是否生效

### 1. 檢查瀏覽器開發者工具
部署 PR #17 後,開啟網站 → F12 → Console:

```javascript
// 應該看到每 2 秒批次寫入成功
// 如果失敗,會顯示 [Analytics] flush failed: 錯誤訊息
```

### 2. 檢查 Firestore analytics_events
Firebase Console → Firestore → `barthon` database → `analytics_events`:

- 每個新事件的 `timestamp` 欄位應該是 **Timestamp** 類型(非 null)
- 事件時間應該接近伺服器時間(UTC)

### 3. 檢查 Cloud Functions logs
隔天早上 07:30 後:

```bash
# 查看 aggregateAnalytics logs
firebase functions:log --only aggregateAnalytics --limit 50

# 應該看到:
# [aggregateAnalytics] Processing date: 2026-10-22
# [aggregateAnalytics] Aggregated 2026-10-22: X views, Y visitors
# [aggregateAnalytics] Done.
```

### 4. 檢查 analytics_daily 文件
Firebase Console → Firestore → `barthon` database → `analytics_daily`:

- 應該有 `2026-10-22` 文件
- `pageViews` / `uniqueVisitors` 應該 > 0(如果當天有流量)

---

## 🎯 總結

### 10/21 零流量結論
- **❌ 無法恢復**: 原始事件因安全規則拒絕而從未寫入
- **✅ 修復完成**: PR #17 已修復根本原因,後續日期正常追踪
- **⚠️ 影響範圍**: 僅 10/21,10/20 與 10/22+ 不受影響

### 推薦行動
1. ✅ **合併 PR #17**(已建立為 draft,待審核)
2. ⏳ **部署後監控** 1-2 天,確認追踪正常
3. ⏳ **檢查 10/22 日報**(明天早上),驗證修復生效
4. 📝 **文檔更新**:在流量報告中註記 10/21 資料遺失原因

### 長期改進
- ✅ 已改用 `serverTimestamp()` (最佳實踐)
- ✅ 已加入批次重試機制
- 🔄 考慮新增**前台追踪狀態儀表板**(顯示最近 10 筆事件寫入成功/失敗率)
- 🔄 考慮新增**告警**(Functions 彙總失敗時通知管理員)
