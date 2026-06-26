# BarthON 腕錶網站 — Claude Code 專案規則

> 這份檔案會被 Claude Code 自動載入。**動手部署或改規則前先讀「部署」與「Firebase 雷區」兩段**，
> 不要重新摸索方法——踩過的坑都寫在這裡了。

---

## 0. 互動慣例
- **一律用繁體中文回應。**
- 這是純靜態網站,**沒有 build step、沒有 npm**。直接改 `public/` 下的 HTML/JS,push 就上線。
- 改 code 後不需要本機跑任何編譯;要驗證就看實際網站或 GitHub Actions。

---

## 1. 這是什麼
進口腕錶展示 + 詢問網站。前台給客戶看錶、送詢問;後台 console 給店主管理腕錶/詢問/文案。

| 檔案 | 用途 |
|---|---|
| `public/index.html` | 前台(客戶端)。腕錶清單、詳情、詢問表單。即時讀 Firestore。 |
| `public/console.html` | 後台管理。自製 DCLogic 框架(`<x-dc>`/`<sc-if>`/`<sc-for>`)。需登入。 |
| `public/admin.html` | 後台登入頁(Firebase Auth Email/Password)。 |
| `public/firebase-config.js` | **三個 HTML 共用**的 Firebase 設定(ES module)。改設定只改這裡。 |
| `public/support.js` | DCLogic 框架(後台用)。 |
| `firestore.rules` / `storage.rules` | 安全規則。改完 push 會**自動部署**(見第 4 段)。 |
| `firebase.json` | hosting + firestore(`database: barthon`) + storage 設定。 |

> 根目錄的 `BarthON 前台.html`、`BarthON 後台.dc.html` 是設計工具原始檔,**實際上線的是 `public/` 版本**。
> 根目錄的 `部署說明 DEPLOY.md` 部分內容已過時(data.js 匯出流程已移除),以本檔為準。

---

## 2. 關鍵設定值
- Firebase 專案 ID:`barthon-watch`
- **Firestore 是 named database `barthon`(不是 default!)** → 程式碼一律 `getFirestore(app, 'barthon')`
- Storage bucket:`barthon-watch.firebasestorage.app`,圖片路徑前綴 `watches/`(腕錶)、`site/`(主視覺)
- 後台管理員帳號:`fg3797@gmail.com`(安全規則鎖定這個 email 才能寫)
- 網址:`https://barthon-watch.web.app`(主)、`/admin`(登入)、`/console`(後台)
- CI service account:`firebase-adminsdk-fbsvc@barthon-watch.iam.gserviceaccount.com`

---

## 3. 部署 = `git push` 到 `main`
GitHub Actions 自動部署,**不需要任何本機指令或手動步驟**。三個 workflow:

| Workflow | 觸發 | 做什麼 |
|---|---|---|
| `deploy.yml` | push 到 main | 部署 Hosting(`firebase deploy --only hosting`) |
| `deploy-rules.yml` | `*.rules` 變動時 | 部署 Firestore + Storage 規則 |
| `preview.yml` | 開 PR | 建立 PR 預覽網址 |

**規則(不可違反):**
- ❌ **不要把 `deploy.yml` 改回 `FirebaseExtended/action-hosting-deploy@v0` 部署 live。** 它會重複 release 同一版本回 `400 FAILED_PRECONDITION`,造成「網站有更新但 run 紅燈」的假失敗。現在用 `w9jds/firebase-action` 跑 `firebase deploy`,認證靠 `GCP_SA_KEY: ${{ secrets.FIREBASE_SERVICE_ACCOUNT }}`。
- ❌ 不要用 `echo SA_JSON > file` + `GOOGLE_APPLICATION_CREDENTIALS`(新版 firebase-tools 不讀)。
- ✅ 改 code → `git add` → `git commit` → `git push`。要驗證就看 GitHub Actions 綠燈。

---

## 4. 改安全規則
改 `firestore.rules` 或 `storage.rules` → push → `deploy-rules.yml` **自動部署**。

**踩過的雷(別再踩):**
- args 必須是 `deploy --only firestore:rules,storage`。
  ⚠️ **storage 不能寫成 `storage:rules`**——firebase-tools 會把 `rules` 當成 storage 目標名稱而報
  `Could not find rules for the following storage targets: rules`。firestore 才有 `:rules` 子目標。
- CI service account 需要這些 IAM 角色才能部署規則(已設好,別拔):
  `Firebase Admin` + `Service Usage Consumer` + `Firebase Rules Admin`。
  少了會 403(serviceusage / firebasestorage.defaultBucket.get)。
- **手動備援**(CI 壞掉時):Firebase Console → Firestore(資料庫選 **barthon**)/ Storage → 規則分頁 →
  全選貼上 → 發布。貼的時候用剪貼板 `Ctrl+A`→`Delete`→`Ctrl+V`,不要逐字打(編輯器自動縮排會弄亂括號)。

**目前的安全模型:**
- `watches`、`site`:**公開讀取**,只有 `fg3797@gmail.com` 能寫。
- `inquiries`:**訪客可送出(create)** 但有欄位驗證(name/contact/message 必填且限長度、status 必為 `新`);
  只有管理員能讀/改/刪。
- Storage:公開讀,只有管理員能寫,且限圖片、限 10MB。

---

## 5. 資料模型(Firestore,database = `barthon`)
- `watches/{id}` — 一支腕錶。欄位:`brand, name, cat, price, badge, condition, pct, set{box,card,manual,strap}, ref, year, movement, size, material, water, accessories, desc, images[](Storage URL), status('published'|'draft')`。
- `site/copy` — 網站文案單一文件:`heroImg, heroTitle, heroLead, aboutText, lineId, phone, fbUrl, igUrl`。
- `inquiries/{id}` — 客戶詢問:`name, contact, watch, message, date, status('新'|'處理中'|'已成交')`。前台表單寫入,後台讀。

---

## 6. Firebase 雷區(這個專案特有)
1. **Named database**:任何 `getFirestore` 都要帶 `'barthon'`。漏了會「client is offline」。
2. **Firestore 1MB 文件上限**:**圖片絕對不要存 base64 進 Firestore**。一律上傳 Firebase Storage,
   Firestore 只存下載 URL。腕錶圖走 `addImages()`,主視覺走 `uploadHeroImg()`。
3. **刪除要清孤兒圖**:刪腕錶/換主視覺時,連帶用 `deleteImages()` 刪掉 Storage 實體檔。
4. **後台初始化競態**:`console.html` 的 DCLogic 元件可能比 `<head>` 的 Firebase module script 先掛載。
   讀取資料前一定要 `await this._waitForFirebase()`(輪詢 `window.__db` 就緒),否則儀表板會載入 0 筆。
   全域控制代碼:`window.__db` / `window.__fs` / `window.__storage` / `window.__storageFs`。

---

## 7. 常見修改任務
- **改網站文案/主視覺**:後台「網站文案」分頁,或直接改 Firestore `site/copy`。前台 `_applyCopy()` 會套用。
- **新增腕錶欄位**:同時改 `console.html`(表單 + `blank()` 預設 + save) 與 `index.html`(`initFirebase` 的 mapping + 詳情/卡片渲染)。
- **腕錶資料來源**:前台**只**從 Firestore 即時讀(`index.html` 的 `initFirebase`)。沒有 data.js、沒有匯出步驟(舊流程已移除)。`WATCHES` 預設空陣列,Firestore 載入後覆蓋;載入失敗顯示「目前沒有現貨」。
