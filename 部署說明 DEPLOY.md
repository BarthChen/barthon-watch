# BarthON 部署說明

## 兩種部署方式

### 方式 A：GitHub 自動部署（推薦）
設定一次，之後推 git 就自動上線。

```
設計工具改好設計
    ↓ 下載專案
本機 git push
    ↓ GitHub Actions 自動觸發
Firebase Hosting 更新（約 1 分鐘）
```

**第一次設定：**
```bash
npm install -g firebase-tools
firebase login
firebase init hosting:github   # 照指示填 GitHub repo，自動設定好 CI/CD
git push -u origin main
```

**之後每次：**
```bash
git add . && git commit -m "update" && git push
```

---

### 方式 B：手動一鍵部署
```bash
bash deploy.sh
```

---

## 前置動作：填入你的 Firebase 專案 ID

開啟 `.firebaserc`，把 `"你的-firebase-專案-id"` 換成你的真實 ID：
```json
{
  "projects": {
    "default": "barthon-watch"
  }
}
```

> Firebase 專案 ID 在 console.firebase.google.com → 專案設定 → 一般資訊

---

## 後台 → 前台更新流程

1. 開啟 **BarthON 後台.dc.html**（設計工具內）
2. 新增/修改腕錶，按「上架」
3. 切到「前台預覽」→ 按「**匯出網站資料**」→ 下載 `data.js`
4. 把 `data.js` 放進 `public/` 資料夾取代舊的
5. 執行 `git push` 或 `bash deploy.sh`

---

## PR 預覽網址

每次開 Pull Request，GitHub Actions 會自動留言一個臨時預覽網址：
```
https://barthon-watch--pr123-xxxxx.web.app
```
可以在手機/平板先確認效果，沒問題再合併到 main 正式上線。

---

## 網域設定（可選）

Firebase Console → Hosting → 新增自訂網域 → 填入 `barthon.com`（或你的網域）→ 依指示設定 DNS。
