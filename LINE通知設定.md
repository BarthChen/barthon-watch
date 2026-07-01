# 網站新詢問 → LINE 通知　設定指南

> 有人在網站送出詢問,就自動把內容傳到你的 LINE。
> 架構:Firestore 有新 `inquiries` 文件 → Cloud Function `notifyInquiry` → LINE 官方帳號 Messaging API 推播。
> 程式碼都在 `functions/`,已寫好。以下是**只有你能做**的設定,照順序做一次即可。

---

## ⚠️ 前提
- **LINE Notify 已於 2025/3 停止服務**,所以改用 LINE 官方帳號的 Messaging API。
- Cloud Functions 需要 Firebase **Blaze(用量計費)方案**。你這種通知量幾乎 $0,可設預算上限保險。

---

## 步驟

### 1. 開通 Firebase Blaze 方案
Firebase Console → 左下「⚙ → 用量與帳單 / Usage and billing」→ 升級為 **Blaze**。
建議同時設「預算提醒」(例如每月 US$1)以防意外。

### 2. 建立官方帳號的 Messaging API,取得三把鑰匙
1. 到 **LINE Developers Console** https://developers.line.biz/ 用你的 LINE 登入。
2. 建立(或選)一個 Provider → 建立 **Messaging API channel**(或把現有官方帳號啟用 Messaging API)。
3. 記下:
   - **Channel access token(long-lived)** — 在「Messaging API」分頁最下方按 Issue 取得。
   - **Channel secret** — 在「Basic settings」分頁。
4. LINE Official Account Manager(官方帳號後台)→ 設定 → 回應設定 → 開啟 **Webhook**。

### 3. 自訂一個「通關密語」
自己想一組只有你知道的字串,例如 `barthon-通知-8891`。
用途:之後你在 LINE 傳這組字給官方帳號,就會把「你這個 LINE 帳號」綁定為通知接收者。
(這樣公開官方帳號的客人就算亂傳訊息,也不會誤訂閱、看到別人的詢問。)

### 4. 把三把鑰匙設成 Firebase Secret
需要你本機裝好 Node.js + Firebase CLI(`npm i -g firebase-tools`、`firebase login`),然後在專案資料夾執行:
```bash
firebase functions:secrets:set LINE_CHANNEL_ACCESS_TOKEN   # 貼上步驟2的 access token
firebase functions:secrets:set LINE_CHANNEL_SECRET         # 貼上步驟2的 channel secret
firebase functions:secrets:set LINE_BIND_SECRET            # 貼上步驟3的通關密語
```
> 不想裝 CLI 的話,也可在 Google Cloud Console → Secret Manager 手動建立同名密鑰,
> 但要另外授權函式執行的服務帳號讀取,較容易漏——**建議用上面 CLI 一次設好**。

### 5. 部署函式
完成步驟 1〜4 後,到 **GitHub → Actions → Deploy Functions → Run workflow** 手動觸發部署。
(或直接跟我說「LINE 設定好了」,我幫你觸發,並可改成日後 push 自動部署。)

第一次部署 Cloud Functions,CI 服務帳號需要較多權限。若該 workflow 紅燈報 403/權限不足,
到 **GCP IAM** 幫 `firebase-adminsdk-fbsvc@barthon-watch.iam.gserviceaccount.com` 補角色:
- 省事做法:直接給 **`Editor`** 一個角色(涵蓋全部)。
- 或最小集合:`Cloud Functions Admin`、`Cloud Run Admin`、`Artifact Registry Admin`、
  `Cloud Build Editor`、`Service Account User`、`Secret Manager Secret Accessor`、`Eventarc Admin`。

> 也可以第一次改用本機 `firebase deploy --only functions`(你是 Owner,會自動開通所需 API),之後交給 CI。

### 6. 設定 LINE Webhook 網址
部署成功後,函式網址長這樣(實際可在 Firebase Console → Functions 或 CI log 看到):
```
https://asia-east1-barthon-watch.cloudfunctions.net/lineWebhook
```
貼到 **LINE Developers → Messaging API → Webhook URL**,按 **Verify**,並確認 **Use webhook** 已開。

### 7. 綁定你的 LINE
1. 用你的手機 LINE 把這個官方帳號加為好友。
2. 傳你在步驟3設的**通關密語**給它。
3. 收到「✅ 已開啟 BarthON 新詢問通知」就完成。
   - 日後要停止:傳「停止通知」。
   - 想多人接收(例如店員):請他們也加好友並傳一次通關密語即可。

### 8. 測試
到網站 https://barthon-watch.web.app 送一則測試詢問 → 你的 LINE 應該立刻收到內容,
後台「詢問」分頁也照常看得到。

---

## 收到的訊息長這樣
```
🔔 BarthON 新詢問

👤 姓名：王小明
📞 聯絡：0912-345-678
⌚ 錶款：Rolex Datejust 36
💬 內容：
請問這支還在嗎?可以約週末面交驗錶嗎?

🕒 2026-07-01
→ 後台查看：https://barthon-watch.web.app/console
```

## 備註
- 前台網頁**不用改**,是後端偵測 Firestore 新增就通知。
- LINE 免費方案每月推播訊息有上限(視方案),小店用量綽綽有餘。
- 接收者名單存在 Firestore `config/line`(前端禁止讀寫,只有函式能存取)。
- 要調整通知文字格式,改 `functions/index.js` 的 `notifyInquiry` 再 push 即可。
