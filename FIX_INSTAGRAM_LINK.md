# Instagram 連結修正說明

## 問題摘要

網站的 Instagram 連結指向錯誤的帳號。

- **錯誤 URL:** `https://instagram.com/barthon`
- **正確 URL:** `https://www.instagram.com/barthonwatch/`
- **正確帳號:** @barthonwatch

## 修正內容

### 已完成的程式碼修正

1. **`public/console.html`** - 更新後台管理系統的預設 Instagram URL
   - 修改 `DEFC.igUrl` 從 `https://instagram.com/barthon` 改為 `https://www.instagram.com/barthonwatch/`
   - 這確保未來新建立的 `site/copy` 文件會使用正確的 URL

2. **`public/fix-instagram.html`** - 新增專用修正工具頁面
   - 提供簡單的 UI 介面來更新 Firestore 資料
   - 可直接查看當前 URL 並更新為正確值
   - 無需登入後台管理系統

## 部署後必要操作

⚠️ **重要：合併 PR 並部署後,管理員必須執行以下任一方法來更新 Firestore 資料**

### 方法一：使用修正工具(最簡單)

1. 前往 https://barthon-watch.web.app/fix-instagram.html
2. 頁面會顯示目前的 Instagram URL
3. 確認「新的 Instagram URL」欄位為 `https://www.instagram.com/barthonwatch/`
4. 點擊「更新 Instagram 連結」按鈕
5. 等待成功訊息顯示
6. 重新整理前台首頁 https://barthon-watch.web.app 驗證

### 方法二：透過後台管理

1. 前往 https://barthon-watch.web.app/admin 登入
2. 登入後會自動跳轉到 https://barthon-watch.web.app/console
3. 點擊左側選單「網站文案」分頁
4. 找到「Instagram 連結」欄位
5. 將值更新為 `https://www.instagram.com/barthonwatch/`
6. 點擊「儲存變更」按鈕
7. 重新整理前台首頁驗證

### 方法三：直接編輯 Firestore(需要權限)

1. 前往 Firebase Console: https://console.firebase.google.com/project/barthon-watch
2. 左側選單選擇「Firestore Database」
3. 確認資料庫為 `barthon` (不是 default)
4. 導覽至 `site` collection → `copy` document
5. 編輯 `igUrl` 欄位
6. 將值改為 `https://www.instagram.com/barthonwatch/`
7. 儲存變更
8. 重新整理前台首頁驗證

## 影響範圍

修正後,以下位置的 Instagram 連結都會指向正確的 @barthonwatch 帳號：

### 前台首頁 (`public/index.html`)

1. **導覽列** (第 466 行)
   - Instagram 圖示連結

2. **行動版選單** (第 482 行)  
   - Instagram 連結

3. **聯絡區** (第 617 行)
   - 「Instagram 私訊 DM」按鈕

4. **頁尾** (第 658 行)
   - 「聯絡」區塊中的 Instagram 連結

5. **腕錶詳情彈窗** (第 973 行)
   - Instagram 分享按鈕 (複製連結功能)

### 技術實作細節

所有 Instagram 連結都透過以下機制動態載入：

```javascript
// index.html 第 690 行
const map = {
  "fb-marketplace": c.fbUrl,
  "messenger": c.fbUrl, 
  "instagram": c.igUrl  // ← 從 Firestore site/copy.igUrl 載入
};
```

`c.igUrl` 的值來自 Firestore `site/copy` 文件,因此更新 Firestore 後,前台所有位置會自動使用新 URL。

## 驗證步驟

部署並更新 Firestore 後,請測試以下項目：

- [ ] 前台首頁導覽列的 Instagram 圖示 → 點擊應開啟 https://www.instagram.com/barthonwatch/
- [ ] 聯絡區「Instagram 私訊 DM」按鈕 → 應開啟正確帳號
- [ ] 頁尾「Instagram」連結 → 應開啟正確帳號  
- [ ] 行動版選單的 Instagram 連結 → 應開啟正確帳號
- [ ] 開啟瀏覽器開發者工具 Console,確認無錯誤訊息
- [ ] 測試手機版介面的所有 Instagram 連結

## 相關檔案

- `public/console.html` - 後台管理系統 (已更新預設值)
- `public/index.html` - 前台首頁 (無需修改,動態載入)
- `public/fix-instagram.html` - 修正工具頁面 (新增)
- `public/firebase-config.js` - Firebase 設定 (無需修改)

## Pull Request

- PR #13: https://github.com/BarthChen/barthon-watch/pull/13
- 分支: `cursor/fix-instagram-link-2371`

## 注意事項

1. **不要合併後就以為完成了** - 必須執行上述三種方法之一來更新 Firestore 資料
2. **修正工具頁面只能在部署後使用** - 本地無法測試,需要實際部署到 Firebase Hosting
3. **資料更新後立即生效** - 無需重新部署,刷新頁面即可看到變更
4. **建議保留 fix-instagram.html** - 未來如需修改社群連結時可重複使用

## 常見問題

### Q: 為什麼不直接在程式碼中修正 URL?

A: Instagram URL 儲存在 Firestore 資料庫中,方便管理員從後台修改,無需重新部署。程式碼修正只是更新預設值,實際運作的值來自資料庫。

### Q: 如果忘記更新 Firestore 會怎樣?

A: 網站仍會使用舊的錯誤 URL。程式碼修正不會影響已存在的資料庫資料。

### Q: 可以只用後台管理來修正嗎?

A: 可以,方法二就是透過後台。但建議兩個都做：
1. 合併此 PR (更新程式碼預設值)
2. 用任一方法更新 Firestore (修正實際資料)

### Q: fix-instagram.html 需要驗證身份嗎?

A: 不需要。此頁面使用前台的 Firebase 設定,但有 Firestore Security Rules 保護。只有已登入的管理員帳號 (fg3797@gmail.com) 才能寫入資料。

## 技術背景

### 為什麼使用 Firestore 儲存社群連結?

這是此專案的設計決策,讓店主可以從後台管理介面即時更新社群連結、文案等內容,無需：
- 修改程式碼
- 重新部署網站
- 具備技術背景

### 資料流程

```
Firestore site/copy.igUrl
    ↓
index.html initFirebase() 載入
    ↓
_applyCopy(c) 函數套用
    ↓  
所有 data-link="instagram" 元素更新 href
```

## 聯絡資訊

如有問題,請聯絡專案維護者或查看：
- CLAUDE.md - 專案規則說明
- 部署說明 DEPLOY.md - 部署流程
- Firebase Console - 資料庫管理
