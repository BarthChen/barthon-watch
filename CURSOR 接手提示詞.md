# 交接給 Claude Code / Cursor 的提示詞

> 把下面整段貼給 Claude Code 或 Cursor，它會幫你完成所有設定。

---

你是一位資深 Firebase + DevOps 工程師。我有一個靜態網站「BarthON 鐘錶」，已在本機設計完成，現在要請你幫我：

## 任務一：首次設定 CI/CD（只做一次）

1. **安裝工具**（如果還沒裝）：
   ```bash
   npm install -g firebase-tools
   firebase login
   ```

2. **建立 Firebase 專案**（如果還沒有）：
   到 https://console.firebase.google.com → 新增專案，把專案 ID 填進 `.firebaserc`：
   ```json
   { "projects": { "default": "barthon-watch" } }
   ```

3. **產生 Service Account 金鑰**（給 GitHub Actions 用）：
   ```bash
   firebase init hosting:github
   ```
   照指示輸入 GitHub repo，它會自動：
   - 在 GitHub repo 設定 `FIREBASE_SERVICE_ACCOUNT` secret
   - 設定 `FIREBASE_PROJECT_ID` secret
   - 更新 `.github/workflows/deploy.yml`

4. **把專案推上 GitHub**：
   ```bash
   git init
   git add .
   git commit -m "init: BarthON 網站"
   git remote add origin https://github.com/你的帳號/你的repo.git
   git push -u origin main
   ```

完成後，每次 push 到 main 就自動部署 🚀

---

## 任務二：日常更新流程（每次改設計後）

我在設計工具（designcompanion.app）改好設計後會下載新版本，你要：

```bash
# 1. 把新檔案複製進來（或直接覆蓋）
# 2. 提交並推送
git add .
git commit -m "update: 更新網站設計"
git push
# → GitHub Actions 自動部署，約 1 分鐘上線
```

---

## 任務三：緊急直接部署（不透過 GitHub）

```bash
bash deploy.sh
```

---

## 專案結構

```
.github/workflows/
  deploy.yml     ← push to main 自動部署
  preview.yml    ← PR 自動產生預覽網址
firebase.json    ← Hosting 設定
.firebaserc      ← 填入你的 Firebase 專案 ID
public/
  index.html     ← 網站本體
  data.js        ← 腕錶資料（從後台匯出）
deploy.sh        ← 一鍵手動部署腳本
```

---

## 設計系統（勿更動樣式）

- 字型：`Noto Sans TC` / `Noto Serif TC` / `Cormorant Garamond`
- 背景：`#0b0b0d` ～ `#111114`
- 面板：`#15151a` / `#1b1b21`
- 金色重點：`#c8a667` / `#e3c98c`
- 主文字：`#f1ece2`
- 不要更動 `public/index.html` 的視覺與版面

---

## 注意事項

- 圖片以 base64 存在 `data.js` 裡，不需要另外處理圖檔
- 客戶詢問訊息不會出現在 `data.js`（保護隱私）
- 如需升級為 Firestore 雲端後台，請參考舊版 CURSOR 接手提示詞的「目標」段落
