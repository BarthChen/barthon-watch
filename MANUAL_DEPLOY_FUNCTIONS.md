# Cloud Functions 部署狀態報告

## ⚠️ 部署狀態:需要手動完成

### 問題說明

Cloud Agent 環境無法直接部署 Cloud Functions,原因:
1. **GitHub Actions workflow_dispatch 觸發失敗**:HTTP 403 權限不足
2. **Firebase CLI 需要認證**:Cloud Agent VM 無 Firebase login 或 service account credentials
3. **Secrets 無法存取**:Cloud Agent 無法讀取 GitHub repository secrets

### ✅ 已完成準備
- ✅ Functions 程式碼已 merge 到 main
- ✅ `functions/package.json` 已就緒
- ✅ Functions 依賴已測試安裝(npm install 成功)
- ✅ Firestore 規則已部署(支援 analytics_events / analytics_daily)
- ✅ Hosting 已部署(前台追踪已啟用)

---

## 🚀 手動部署步驟(必須執行)

### 前置需求
- Firebase CLI 已安裝並登入:`firebase login`
- gcloud CLI 已安裝並認證
- 專案權限:barthon-watch

### 完整部署流程

#### 1. 切換到 main 分支並拉取最新程式碼
```bash
cd /path/to/barthon-watch
git checkout main
git pull
```

#### 2. 設定 Firebase 專案
```bash
firebase use barthon-watch
```

#### 3. 安裝 Functions 依賴
```bash
cd functions
npm install
cd ..
```

#### 4. 生成並設定 API_KEY secret
```bash
# 生成 32 字元隨機 key
API_KEY=$(openssl rand -hex 32)
echo "API_KEY: $API_KEY"

# 儲存到環境變數(後續測試用)
export BARTHON_API_KEY="$API_KEY"

# 設定 Firebase Functions secret
firebase functions:secrets:set API_KEY --project barthon-watch
# 執行後會提示輸入 secret 值,貼上上方生成的 API_KEY
```

**⚠️ 重要**:請將生成的 API_KEY 安全保存,不要提交到 Git。

#### 5. 部署 Cloud Functions
```bash
firebase deploy --only functions --project barthon-watch
```

**預期輸出**:
```
✔ functions: Loaded functions definitions from source: aggregateAnalytics, getDailySummary.
✔ functions[aggregateAnalytics(asia-east1)]: Successful create operation.
✔ functions[getDailySummary(asia-east1)]: Successful create operation.

✔ Deploy complete!

Functions:
  aggregateAnalytics(asia-east1)
    Cloud Scheduler trigger: every day 07:30 (Asia/Taipei)
  getDailySummary(asia-east1)
    https://asia-east1-barthon-watch.cloudfunctions.net/getDailySummary
```

**首次部署可能遇到的錯誤**:

##### 錯誤 1:Cloud Scheduler Service Agent 角色缺失
```
Error: Cloud Scheduler Service Agent doesn't have permission to invoke function
```

**解決方式**:
1. 前往 [IAM Console](https://console.cloud.google.com/iam-admin/iam?project=barthon-watch)
2. 找到 `service-<project-number>@gcp-sa-cloudscheduler.iam.gserviceaccount.com`
3. 點「編輯」,新增角色:
   - `Cloud Scheduler Service Agent`
   - `Cloud Functions Invoker`
4. 儲存後重新部署

##### 錯誤 2:API 未啟用
```
Error: Cloud Functions API has not been used in project xxx before or it is disabled
```

**解決方式**:
1. 點擊錯誤訊息中的連結前往 Cloud Console 啟用 API
2. 或執行:`gcloud services enable cloudfunctions.googleapis.com cloudscheduler.googleapis.com --project=barthon-watch`

---

## ✅ 部署後驗證(必須執行)

### 1. 檢查 Cloud Scheduler
```bash
gcloud scheduler jobs describe firebase-schedule-aggregateAnalytics-asia-east1 \
  --location=asia-east1 \
  --project=barthon-watch
```

**驗證項目**:
- `schedule: every day 07:30`
- `timeZone: Asia/Taipei`
- `state: ENABLED`

### 2. 列出已部署的 Functions
```bash
firebase functions:list --project barthon-watch
```

**預期輸出**:
```
┌────────────────────┬──────────────┬─────────────────────────────────────────────────────────┐
│ Function           │ Region       │ Trigger                                                 │
├────────────────────┼──────────────┼─────────────────────────────────────────────────────────┤
│ aggregateAnalytics │ asia-east1   │ Cloud Scheduler                                         │
│ getDailySummary    │ asia-east1   │ HTTP Trigger                                            │
└────────────────────┴──────────────┴─────────────────────────────────────────────────────────┘
```

### 3. 測試 getDailySummary API(含 Fallback)
```bash
# 測試昨天的日期(Linux)
YESTERDAY=$(date -d "yesterday" +%Y-%m-%d)

# 測試昨天的日期(macOS)
YESTERDAY=$(date -v-1d +%Y-%m-%d)

# 呼叫 API(使用先前生成的 API_KEY)
curl -s "https://asia-east1-barthon-watch.cloudfunctions.net/getDailySummary?date=$YESTERDAY&key=$BARTHON_API_KEY" | jq .
```

**預期回應**:HTTP 200 + JSON
```json
{
  "date": "2026-09-30",
  "timezone": "Asia/Taipei",
  "uniqueVisitors": 0,
  "pageViews": 0,
  "uniquePageSessions": 0,
  "topProducts": [],
  "topPages": [],
  "excluded": {
    "bots": 0,
    "duplicates": 0,
    "other": 0
  }
}
```

**✅ 成功標準**:
- HTTP 狀態碼:200
- JSON 包含所有欄位:`date`, `timezone`, `uniqueVisitors`, `pageViews`, `topProducts`, `topPages`, `excluded`
- 如當天無流量,數值為 0(正常)

### 4. 手動觸發首次彙總(選用,測試用)
```bash
gcloud scheduler jobs run firebase-schedule-aggregateAnalytics-asia-east1 \
  --location=asia-east1 \
  --project=barthon-watch
```

**檢查執行結果**:
```bash
# 檢查 Functions logs
firebase functions:log --only aggregateAnalytics --limit 20

# 檢查 Firestore
# Firebase Console → Firestore → analytics_daily 集合
# 應出現前一天日期的文件
```

---

## 📝 部署完成後設定

### 1. 設定 ops bot 環境變數
```bash
# 在 ops bot 主機上設定
export BARTHON_API_KEY="<剛才生成的 API_KEY>"

# 或寫入 ~/.bashrc / ~/.zshrc
echo 'export BARTHON_API_KEY="<API_KEY>"' >> ~/.bashrc
```

### 2. 部署 ops bot 腳本
```bash
# 複製腳本到 ops bot 主機
scp .ops/fetch-daily-analytics.sh user@ops-bot:/path/to/scripts/

# 設定執行權限
ssh user@ops-bot 'chmod +x /path/to/scripts/fetch-daily-analytics.sh'
```

### 3. 設定 Cron(每天 8:00 執行)
```bash
# 編輯 crontab
crontab -e

# 加入以下行
0 8 * * * export BARTHON_API_KEY="<API_KEY>" && /path/to/scripts/fetch-daily-analytics.sh >> /var/log/barthon-analytics.log 2>&1
```

### 4. 測試 ops bot 腳本
```bash
# 手動執行
export BARTHON_API_KEY="<API_KEY>"
/path/to/scripts/fetch-daily-analytics.sh

# 預期輸出:格式化的日報
```

---

## 🔐 安全注意事項

### API_KEY 管理
- ✅ **已設定**:Firebase Functions secret(環境變數注入)
- ❌ **不要**:提交到 Git
- ❌ **不要**:寫入 PR 描述或公開文件
- ✅ **只在**:ops bot 環境變數 + 你的安全筆記

### 分發流程
1. 部署時生成 API_KEY
2. 設定到 Firebase Functions secret
3. **安全傳遞給 BarthON流量 bot 管理者**(不透過 GitHub/公開渠道)
4. ops bot 設定環境變數

---

## 📊 部署狀態總結

| 項目 | 狀態 | 說明 |
|---|---|---|
| Hosting | ✅ Live | 前台追踪已啟用 |
| Firestore Rules | ✅ Live | analytics_events / analytics_daily 權限已設定 |
| Functions 程式碼 | ✅ Ready | 已 merge 到 main |
| Functions 部署 | ⚠️ **待手動** | 需執行上述步驟 |
| API_KEY Secret | ⚠️ **待設定** | 需執行步驟 4 |
| Scheduler 驗證 | ⚠️ **待確認** | 需執行驗證步驟 1 |
| API 測試 | ⚠️ **待執行** | 需執行驗證步驟 3 |
| ops bot 設定 | ⚠️ **待完成** | 需執行部署完成後設定 |

---

## 📞 支援

如部署過程遇到問題,請參考:
- **詳細指南**:`DEPLOY_ANALYTICS.md`
- **疑難排解**:`DEPLOY_ANALYTICS.md` → 疑難排解 Q&A
- **檢查清單**:`CHECKLIST_ANALYTICS.md`

---

**部署準備已完成,等待手動執行上述步驟即可完整啟用流量分析系統!**
