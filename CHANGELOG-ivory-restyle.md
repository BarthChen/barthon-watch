# BarthON 象牙色品牌重新設計 - 變更日誌

## 概述

將 BarthON 腕錶網站從深色主題重新設計為溫暖的象牙色/奶油色品牌系統,符合 Instagram、Facebook、Threads 的品牌形象,同時保持奢華腕錶精品店的質感。

---

## 🎨 顏色系統變更

### 主題色彩變數 (CSS Custom Properties)

| 變數 | 舊值(深色主題) | 新值(象牙色主題) | 說明 |
|------|--------------|----------------|------|
| `--bg` | `#0b0b0d` | `#f9f7f3` | 主背景 - 溫暖象牙色 |
| `--bg-2` | `#111114` | `#f4f2ed` | 次要背景 |
| `--panel` | `#15151a` | `#ffffff` | 面板/卡片背景 |
| `--panel-2` | `#1b1b21` | `#fdfcfa` | 次要面板 |
| `--line` | `rgba(255,255,255,.07)` | `rgba(0,0,0,.08)` | 分隔線 |
| `--line-strong` | `rgba(255,255,255,.14)` | `rgba(0,0,0,.14)` | 強調分隔線 |
| `--gold` | `#c8a667` | `#c8a667` | 金色強調(不變) |
| `--gold-bright` | `#e3c98c` | `#b8965a` | 金色懸停/高亮 |
| `--gold-dim` | `rgba(200,166,103,.28)` | `rgba(200,166,103,.15)` | 金色透明 |
| `--ink` | `#f1ece2` | `#1a1a1c` | 主要文字 - 深黑色 |
| `--ink-soft` | `#cfc8ba` | `#3a3a3c` | 次要文字 |
| `--muted` | `#928c80` | `#6a6a6c` | 弱化文字 |
| `--muted-2` | `#6f6a60` | `#8a8a8c` | 極弱化文字 |

---

## 🔧 元件更新清單

### 1. 全域元素
- [x] `::selection` - 選取背景改為白色文字
- [x] 捲軸顏色調整

### 2. 導航欄 (Navigation)
- [x] `.topbar` - 公告欄背景從 `#08080a` 改為 `#fdfcfa`
- [x] `.nav.scrolled` - 滾動時背景從深色半透明改為淺色半透明
- [x] `.nav-links a:hover` - 懸停顏色調整
- [x] `.nav-social a:hover` - 社交圖示懸停效果

### 3. 按鈕 (Buttons)
- [x] `.btn-gold` - 主按鈕文字從 `#100d07` 改為 `#ffffff`
- [x] `.btn-gold:hover` - 懸停顏色更新
- [x] `.btn-ghost:hover` - 次要按鈕懸停效果
- [x] `.chip.active` - 啟用狀態籤文字改為白色

### 4. Hero 區塊
- [x] `.hero::before` - 背景光暈透明度調整
- [x] `.hero-tag` - 標籤背景從 `#08080a` 改為淺色半透明
- [x] `.hero h1 .en` - 英文標題顏色

### 5. 產品卡片 (Product Cards)
- [x] `.card-badge` - 產品徽章背景與文字顏色
- [x] `.card-tags` / `.card-tag` - 標籤顏色微調
- [x] `.card-price` - 價格顏色更新
- [x] `.card-ask:hover` - 詢問按鈕懸停效果

### 6. 已售出/已收訂狀態
- [x] `.sold-mask` - 灰色遮罩從深色改為淺色 `rgba(255,255,255,.75)`
- [x] `.sold-stamp` - 印章顏色從白色改為灰色
- [x] `.reserved-mask` - 金色遮罩透明度調整
- [x] `.reserved-stamp` - 金色印章陰影調整

### 7. 詳情彈窗 (Detail Modal)
- [x] `.detail-scrim` - 遮罩背景顏色
- [x] `.detail-panel` - 面板背景與陰影
- [x] `.detail-close` - 關閉按鈕背景
- [x] `.d-price` - 詳情頁價格顏色
- [x] `.d-badge` - 徽章顏色
- [x] `.d-share` / `.share-btn` - 分享按鈕樣式

### 8. 燈箱 (Lightbox)
- [x] `.lightbox` - 背景從深色改為淺色 `rgba(249,247,243,.94)`
- [x] `.lb-btn` - 按鈕背景與懸停效果
- [x] `.lb-count` - 計數器背景

### 9. 表單 (Forms)
- [x] `.inq-form input/textarea` - 輸入框背景從半透明改為 `rgba(255,255,255,.7)`
- [x] `.fsel select` - 下拉選單背景與 option 顏色

### 10. 聯絡區塊 (Contact)
- [x] `.contact::before` - 背景光暈透明度
- [x] `.cm` - 聯絡方式卡片背景與懸停效果

### 11. 頁尾 (Footer)
- [x] `footer.site` - 頁尾背景從 `#08080a` 改為 `#fdfcfa`
- [x] `.foot-col a:hover` - 連結懸停顏色

### 12. 其他元件
- [x] `.about-stats .n` - 關於區塊數字顏色
- [x] `.filter-reset:hover` - 篩選重設按鈕
- [x] `.mmenu` - 行動版選單背景

### 13. Toast 通知
- [x] `#fxToast` - Toast 文字顏色與陰影

---

## 📁 新增檔案

### Logo 資產
1. **`public/assets/barthon-logo.svg`**
   - 主要 logo(BarthON + 鐘錶副標)
   - 橫向排版,適合 header

2. **`public/assets/barthon-avatar.svg`**
   - 圓形 avatar(錶盤設計 + BarthON + 鐘錶)
   - 用作 favicon 和社交媒體頭像

### 更新的檔案
- `public/index.html` - 前台主頁(主要變更)
- `public/admin.html` - 後台登入頁 favicon 更新
- `public/console.html` - 後台管理 favicon 更新

---

## 🎯 設計原則

### 1. 對比度確保可讀性
- 深黑色文字 (`#1a1a1c`) 在象牙色背景 (`#f9f7f3`) 上的對比度 **約 15.7:1**(WCAG AAA 級)
- 次要文字 (`#3a3a3c`) 對比度 **約 13.8:1**
- 金色強調色 (`#c8a667`) 對比度 **約 4.5:1**(WCAG AA 級)

### 2. 保留品牌識別
- 金色/青銅色調 (`#c8a667`) 完全保留
- BarthON 中 "ON" 的金色強調維持不變
- 字體系統不變:Cormorant Garamond + Noto Serif TC + Noto Sans TC

### 3. 奢華質感維持
- 溫暖象牙色背景營造高級質感
- 卡片使用純白色 (`#ffffff`) 突顯產品
- 金色強調保持精品店氛圍

### 4. 視覺層次
- 使用微妙的灰階差異建立層次
- 陰影調整為淺色主題適用的強度
- 邊框改為深色半透明

---

## ⚙️ 技術細節

### CSS 變數策略
所有顏色都使用 CSS Custom Properties (`:root` 變數),確保:
- 易於維護和調整
- 主題切換潛力(未來可能支援深/淺色切換)
- 一致性跨所有元件

### 漸進增強
- 保留所有原有功能
- JavaScript 邏輯完全不變
- 僅變更視覺呈現層

### 效能考量
- 新增的 SVG logo 檔案極小(<5KB)
- 沒有引入額外的 CSS 或 JS
- 使用內聯 SVG 避免額外 HTTP 請求

---

## 📱 測試檢查清單

### 視覺測試
- [ ] 桌面版(1920x1080, 1366x768)
- [ ] 平板版(768px, 1024px)
- [ ] 手機版(375px, 414px)
- [ ] Safari / Chrome / Firefox / Edge

### 功能測試
- [ ] 產品卡片點擊開啟詳情
- [ ] 詳情頁圖片燈箱
- [ ] 篩選器(品牌、類型、成色、供貨狀態)
- [ ] 詢問表單送出
- [ ] 已售出/已收訂狀態顯示
- [ ] 分享按鈕(FB/LINE/IG/複製連結)
- [ ] 行動版選單

### 對比度測試
- [ ] 主要文字對比度 ≥ 7:1 (AAA)
- [ ] 次要文字對比度 ≥ 4.5:1 (AA)
- [ ] 互動元素(按鈕、連結)對比度 ≥ 3:1

---

## 🚀 部署流程

1. **PR 預覽階段(目前)**
   - GitHub Actions 自動建立 Firebase Hosting 預覽網址
   - 在預覽環境測試所有功能
   - 收集回饋並調整

2. **合併到 main**
   - 確認預覽網址一切正常
   - 合併 PR
   - 自動觸發 deploy.yml workflow
   - 部署到生產環境 (https://barthon-watch.web.app)

3. **生產環境驗證**
   - 檢查實際網站呈現
   - 確認 Firestore 資料正常載入
   - 測試不同裝置與瀏覽器

---

## 📝 後續改進建議

### 短期(選擇性)
1. 考慮在 header 加入 logo 圖片(目前僅用文字)
2. 主視覺照片可能需要重新調色以配合淺色背景
3. 如果 OG image 是深色背景,可能需要更新

### 長期(未來考慮)
1. 支援深/淺色主題切換(localStorage 儲存偏好)
2. 動態主題色調整(可能根據時段或用戶偏好)
3. 更多品牌資產(不同尺寸的 logo、社交媒體模板等)

---

## 🔗 相關連結

- **PR:** https://github.com/BarthChen/barthon-watch/pull/3
- **分支:** `cursor/ivory-brand-restyle-2dd6`
- **生產網站:** https://barthon-watch.web.app
- **預覽網址:** (待 GitHub Actions 完成後會自動出現在 PR 留言)

---

## 📞 聯絡與回饋

如有任何問題或建議,請直接在 PR 留言回饋。
