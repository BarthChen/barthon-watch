# BarthON 部署說明

> ⚠️ **完整且最新的部署/規則/架構說明請看根目錄 `CLAUDE.md`。**
> 本檔保留基本部署方式;下方「後台→前台更新流程」的舊版 data.js 匯出做法**已淘汰**(見該段)。

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

## 後台 → 前台更新流程（現行）

腕錶與文案**即時同步**,不需匯出、不需重新部署:

1. 登入 `/console`（後台）
2. 新增/修改腕錶或文案,按儲存/上架
3. 前台 `/` 重新整理就會看到（直接讀 Firestore）

> 🗑️ 舊版「匯出網站資料 → 下載 data.js → 取代檔案 → 重新部署」流程**已移除**
> （data.js 與匯出按鈕都已刪掉,前台改為即時讀 Firestore）。詳見 `CLAUDE.md`。

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
