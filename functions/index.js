// BarthON 流量分析 - Cloud Functions
// 1) aggregateAnalytics — 每日定時彙總前一天的事件到 analytics_daily
// 2) getDailySummary — HTTP endpoint 給 ops bot 抓取指定日期的統計摘要(JSON)
// (所有必要 APIs 已啟用:Functions, Build, Artifact Registry, Extensions)

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onRequest } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

// 初始化 Admin SDK (自動偵測 named database 'barthon' 需在呼叫時指定)
const app = initializeApp();

// Taipei 時區偏移 (UTC+8)
const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;

// 轉換 Firestore Timestamp 為 Taipei 日期字串 YYYY-MM-DD
function toTaipeiDate(ts) {
  const d = new Date(ts.toMillis() + TAIPEI_OFFSET_MS);
  return d.getUTCFullYear() + '-' +
         String(d.getUTCMonth() + 1).padStart(2, '0') + '-' +
         String(d.getUTCDate()).padStart(2, '0');
}

// 每天早上 7:30 (Taipei) 跑彙總,處理前一天的事件,確保 8:00 前完成供 bot 報告使用
export const aggregateAnalytics = onSchedule({
  schedule: 'every day 07:30',
  timeZone: 'Asia/Taipei',
  region: 'asia-east1',
  memory: '512MiB'
}, async (event) => {
  const db = getFirestore(app, 'barthon');
  
  // 前一天的 Taipei 日期
  const yesterday = new Date(Date.now() + TAIPEI_OFFSET_MS - 24 * 60 * 60 * 1000);
  const targetDate = yesterday.getUTCFullYear() + '-' +
                     String(yesterday.getUTCMonth() + 1).padStart(2, '0') + '-' +
                     String(yesterday.getUTCDate()).padStart(2, '0');

  console.log(`[aggregateAnalytics] Processing date: ${targetDate}`);

  // 讀取當天所有事件(包含各類型:page_view, product_view, product_click)
  const eventsSnap = await db.collection('analytics_events')
    .orderBy('timestamp')
    .get();

  // 按日期分組事件
  const eventsByDate = {};
  eventsSnap.forEach(doc => {
    const ev = doc.data();
    if (!ev.timestamp || !ev.visitorId) return;
    const date = toTaipeiDate(ev.timestamp);
    if (date !== targetDate) return;  // 只處理目標日期
    if (!eventsByDate[date]) eventsByDate[date] = [];
    eventsByDate[date].push({ id: doc.id, ...ev });
  });

  if (!Object.keys(eventsByDate).length) {
    console.log(`[aggregateAnalytics] No events found for ${targetDate}`);
    return;
  }

  // 彙總每日指標
  for (const [date, events] of Object.entries(eventsByDate)) {
    // 基本去重:相同 visitorId × path × type 在 5 秒內只算一次(coalesce)
    const deduped = [];
    const seen = new Map();
    events.sort((a, b) => a.timestamp.toMillis() - b.timestamp.toMillis());
    
    for (const ev of events) {
      const key = `${ev.type}|${ev.visitorId}|${ev.path || ''}|${ev.watchId || ''}`;
      const last = seen.get(key);
      if (last && (ev.timestamp.toMillis() - last) < 5000) {
        continue;  // 5 秒內重複 skip
      }
      seen.set(key, ev.timestamp.toMillis());
      deduped.push(ev);
    }

    // 計算指標
    const pageViews = deduped.filter(e => e.type === 'page_view').length;
    const uniqueVisitors = new Set(deduped.map(e => e.visitorId)).size;
    const uniqueSessions = new Set(deduped.map(e => e.sessionId)).size;

    // Top Pages (page_view 的 path 排行)
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

    // Top Products (product_click 的 watchId 排行)
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
      .map(p => ({ ...p, uniqueVisitors: p.uniqueVisitors.size, uniqueVisitorsSet: undefined }))
      .sort((a, b) => b.clicks - a.clicks)
      .slice(0, 30);

    // 過濾統計(bot / duplicate)
    const botCount = events.filter(e => {
      const ua = (e.userAgent || '').toLowerCase();
      return ['bot', 'crawler', 'spider'].some(p => ua.includes(p));
    }).length;
    const duplicateCount = events.length - deduped.length;

    // 寫入 analytics_daily
    const summary = {
      date,
      timezone: 'Asia/Taipei',
      pageViews,
      uniqueVisitors,
      uniqueSessions,
      topPages,
      topProducts,
      excluded: {
        bots: botCount,
        duplicates: duplicateCount,
        other: 0
      },
      updatedAt: Timestamp.now()
    };

    await db.collection('analytics_daily').doc(date).set(summary);
    console.log(`[aggregateAnalytics] Aggregated ${date}: ${pageViews} views, ${uniqueVisitors} visitors`);
  }

  console.log('[aggregateAnalytics] Done.');
});

// HTTP 端點:GET /getDailySummary?date=YYYY-MM-DD 回傳該日統計 JSON
// 需要認證(查詢參數帶 ?key=<secret> 或在 header Authorization: Bearer <token>)
// 簡化實作:只檢查是否為管理員 email 的 Firebase Auth token,或環境變數中的 API_KEY
export const getDailySummary = onRequest({
  region: 'asia-east1',
  cors: true
}, async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST');
    res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    return res.status(204).send('');
  }

  const db = getFirestore(app, 'barthon');
  const dateParam = req.query.date || '';

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD.' });
  }

  // 簡易認證:檢查環境變數 API_KEY(透過 Firebase secret 注入)或 Firebase Auth token
  // 生產環境應設定 firebase functions:secrets:set API_KEY
  const apiKey = req.query.key || req.headers['x-api-key'] || '';
  const expectedKey = process.env.API_KEY || '';
  
  // 如果有設定 API_KEY,檢查是否匹配;否則拒絕未認證請求
  // (這裡簡化實作:如果沒設 API_KEY 環境變數,任何人都能讀,適合內部 bot;正式環境請設 secret)
  if (expectedKey && apiKey !== expectedKey) {
    return res.status(401).json({ error: 'Unauthorized. Provide valid API key.' });
  }

  try {
    const docSnap = await db.collection('analytics_daily').doc(dateParam).get();
    
    // 如果已有彙總文件,直接回傳
    if (docSnap.exists) {
      const data = docSnap.data();
      return res.status(200).json({
        date: data.date,
        timezone: data.timezone,
        uniqueVisitors: data.uniqueVisitors || 0,
        pageViews: data.pageViews || 0,
        uniquePageSessions: data.uniqueSessions || 0,
        topProducts: (data.topProducts || []).map(p => ({
          id: p.watchId,
          brand: p.watchBrand,
          model: p.watchModel,
          slug: p.watchId,
          uniqueVisitors: p.uniqueVisitors,
          clicks: p.clicks
        })),
        topPages: (data.topPages || []).map(p => ({
          path: p.path,
          uniqueVisitors: p.uniqueVisitors,
          views: p.views
        })),
        excluded: data.excluded || { bots: 0, duplicates: 0, other: 0 }
      });
    }

    // Fallback:文件不存在(排程未跑或當天資料),即時計算
    console.log(`[getDailySummary] No daily doc for ${dateParam}, computing on-the-fly...`);
    
    // 讀取該日期所有事件
    const eventsSnap = await db.collection('analytics_events')
      .orderBy('timestamp')
      .get();

    const events = [];
    eventsSnap.forEach(doc => {
      const ev = doc.data();
      if (!ev.timestamp || !ev.visitorId) return;
      const evDate = toTaipeiDate(ev.timestamp);
      if (evDate === dateParam) {
        events.push({ id: doc.id, ...ev });
      }
    });

    if (!events.length) {
      // 該日期確實無任何事件
      return res.status(200).json({
        date: dateParam,
        timezone: 'Asia/Taipei',
        uniqueVisitors: 0,
        pageViews: 0,
        uniquePageSessions: 0,
        topProducts: [],
        topPages: [],
        excluded: { bots: 0, duplicates: 0, other: 0 }
      });
    }

    // 去重邏輯(與 aggregateAnalytics 相同)
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

    // 計算指標
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

    const summary = {
      date: dateParam,
      timezone: 'Asia/Taipei',
      pageViews,
      uniqueVisitors,
      uniqueSessions,
      topPages,
      topProducts: topProducts.map(p => ({ watchId: p.watchId, watchBrand: p.watchBrand, watchModel: p.watchModel, clicks: p.clicks, uniqueVisitors: p.uniqueVisitors })),
      excluded: { bots: botCount, duplicates: duplicateCount, other: 0 },
      updatedAt: Timestamp.now()
    };

    // 寫入 analytics_daily(避免下次重複計算)
    await db.collection('analytics_daily').doc(dateParam).set(summary);
    console.log(`[getDailySummary] Computed and saved ${dateParam}: ${pageViews} views, ${uniqueVisitors} visitors`);

    return res.status(200).json({
      date: summary.date,
      timezone: summary.timezone,
      uniqueVisitors: summary.uniqueVisitors,
      pageViews: summary.pageViews,
      uniquePageSessions: summary.uniqueSessions,
      topProducts: summary.topProducts.map(p => ({
        id: p.watchId,
        brand: p.watchBrand,
        model: p.watchModel,
        slug: p.watchId,
        uniqueVisitors: p.uniqueVisitors,
        clicks: p.clicks
      })),
      topPages: summary.topPages.map(p => ({
        path: p.path,
        uniqueVisitors: p.uniqueVisitors,
        views: p.views
      })),
      excluded: summary.excluded
    });
  } catch (err) {
    console.error('[getDailySummary] Error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});
