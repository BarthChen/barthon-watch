// BarthON 流量分析 — 前台匿名追踪
// 記錄 page_view 與 product_click 到 Firestore analytics_events

export class Analytics {
  constructor(db, fsModule) {
    this.db = db;
    this.fs = fsModule;
    this.visitorId = this._getOrCreateVisitorId();
    this.sessionId = this._getSessionId();
    this.lastPath = null;
    this.lastEventTime = 0;
    this.eventQueue = [];
    this.flushTimer = null;
  }

  // 持久化訪客 ID (localStorage),一個裝置 = 一個訪客
  _getOrCreateVisitorId() {
    const KEY = 'barthon_visitor_id';
    try {
      let id = localStorage.getItem(KEY);
      if (!id) {
        id = 'v_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11);
        localStorage.setItem(KEY, id);
      }
      return id;
    } catch (e) {
      // localStorage 不可用(無痕模式或封鎖),用臨時 ID
      return 'v_temp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
    }
  }

  // Session ID:同瀏覽階段內共用,關閉分頁後重新產生
  _getSessionId() {
    const KEY = 'barthon_session_id';
    try {
      let id = sessionStorage.getItem(KEY);
      if (!id) {
        id = 's_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
        sessionStorage.setItem(KEY, id);
      }
      return id;
    } catch (e) {
      return 's_temp_' + Date.now();
    }
  }

  // 判斷是否為機器人 / 爬蟲
  _isBot() {
    if (!navigator || !navigator.userAgent) return true;
    const ua = navigator.userAgent.toLowerCase();
    const botPatterns = [
      'bot', 'crawler', 'spider', 'scraper', 'curl', 'wget', 'python',
      'java', 'http', 'scrapy', 'headless', 'phantom', 'selenium',
      'prerender', 'lighthouse', 'pagespeed', 'gtmetrix', 'pingdom'
    ];
    return botPatterns.some(p => ua.includes(p));
  }

  // 防重複:相同路徑/類型在短時間內只記一次(coalesce rapid repeats)
  _isDuplicate(type, path, watchId, windowMs = 5000) {
    const now = Date.now();
    const key = `${type}|${path || ''}|${watchId || ''}`;
    const last = this._lastSeen || {};
    if (last.key === key && (now - last.time) < windowMs) {
      return true;
    }
    this._lastSeen = { key, time: now };
    return false;
  }

  // 批次緩衝寫入:收集事件,每 2 秒或累積 5 個才一起寫
  _enqueue(event) {
    this.eventQueue.push(event);
    clearTimeout(this.flushTimer);
    if (this.eventQueue.length >= 5) {
      this._flush();
    } else {
      this.flushTimer = setTimeout(() => this._flush(), 2000);
    }
  }

  async _flush() {
    if (!this.eventQueue.length) return;
    const batch = this.eventQueue.splice(0, 10); // 最多一次送 10 個
    try {
      await Promise.all(batch.map(ev => this.fs.addDoc(this.fs.collection(this.db, 'analytics_events'), ev)));
    } catch (err) {
      console.warn('[Analytics] flush failed:', err);
    }
  }

  // 記錄 page_view
  trackPageView(path) {
    if (this._isBot()) return;
    if (this._isDuplicate('page_view', path, null, 3000)) return;

    const event = {
      type: 'page_view',
      visitorId: this.visitorId,
      sessionId: this.sessionId,
      timestamp: this.fs.Timestamp.now(),
      path: path || location.pathname,
      referrer: document.referrer || '',
      userAgent: navigator.userAgent.slice(0, 200),
      screen: `${screen.width}x${screen.height}`
    };
    this._enqueue(event);
  }

  // 記錄 product_view (腕錶詳情開啟)
  trackProductView(watchId, watchBrand, watchModel) {
    if (this._isBot()) return;
    if (this._isDuplicate('product_view', null, watchId, 2000)) return;

    const event = {
      type: 'product_view',
      visitorId: this.visitorId,
      sessionId: this.sessionId,
      timestamp: this.fs.Timestamp.now(),
      path: location.pathname,
      watchId: watchId || '',
      watchBrand: watchBrand || '',
      watchModel: watchModel || '',
      userAgent: navigator.userAgent.slice(0, 200)
    };
    this._enqueue(event);
  }

  // 記錄 product_click (從列表點進詳情)
  trackProductClick(watchId, watchBrand, watchModel) {
    if (this._isBot()) return;
    // click 不做過濾,每次點擊都算

    const event = {
      type: 'product_click',
      visitorId: this.visitorId,
      sessionId: this.sessionId,
      timestamp: this.fs.Timestamp.now(),
      path: location.pathname,
      watchId: watchId || '',
      watchBrand: watchBrand || '',
      watchModel: watchModel || '',
      userAgent: navigator.userAgent.slice(0, 200)
    };
    this._enqueue(event);
  }

  // 離開頁面前強制 flush
  flush() {
    return this._flush();
  }
}
