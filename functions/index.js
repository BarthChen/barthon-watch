// BarthON 詢問單 → LINE 官方帳號推播通知
//
// 兩支函式:
//   notifyInquiry — Firestore inquiries 有新文件時,推播到所有已綁定的 LINE 帳號
//   lineWebhook   — LINE Webhook,用「通關密語」把某個 LINE 帳號綁定為接收者
//                   (避免公開官方帳號的客人誤訂閱、看到別人的詢問內容)
//
// 密鑰用 Firebase Secret(存在 Secret Manager,不寫進程式碼):
//   LINE_CHANNEL_ACCESS_TOKEN / LINE_CHANNEL_SECRET / LINE_BIND_SECRET
//
// 注意:Firestore 是 named database 'barthon',trigger 與 Admin SDK 都要指定。

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const crypto = require("crypto");

initializeApp();
const db = getFirestore("barthon"); // named database,不可漏

const LINE_TOKEN  = defineSecret("LINE_CHANNEL_ACCESS_TOKEN");
const LINE_SECRET = defineSecret("LINE_CHANNEL_SECRET");
const BIND_SECRET = defineSecret("LINE_BIND_SECRET");

const REGION = "asia-east1"; // 就近台灣

async function linePush(token, to, text) {
  const res = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
    body: JSON.stringify({ to, messages: [{ type: "text", text }] }),
  });
  if (!res.ok) console.error("LINE push 失敗", res.status, await res.text());
}

async function lineReply(token, replyToken, text) {
  const res = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
    body: JSON.stringify({ replyToken, messages: [{ type: "text", text }] }),
  });
  if (!res.ok) console.error("LINE reply 失敗", res.status, await res.text());
}

// ── 新詢問 → 推播到所有已綁定的 LINE 帳號 ──────────────────────────
exports.notifyInquiry = onDocumentCreated(
  { document: "inquiries/{id}", database: "barthon", region: REGION, secrets: [LINE_TOKEN] },
  async (event) => {
    const d = event.data && event.data.data();
    if (!d) return;

    const cfg = await db.doc("config/line").get();
    const recipients = (cfg.exists && cfg.data().recipients) || [];
    if (!recipients.length) { console.warn("尚未有綁定的 LINE 接收者,略過通知"); return; }

    const text =
      "🔔 BarthON 新詢問\n\n" +
      "👤 姓名：" + (d.name || "—") + "\n" +
      "📞 聯絡：" + (d.contact || "—") + "\n" +
      "⌚ 錶款：" + (d.watch || "—") + "\n" +
      "💬 內容：\n" + (d.message || "—") + "\n\n" +
      "🕒 " + (d.date || "") + "\n" +
      "→ 後台查看：https://barthon-watch.web.app/console";

    const token = LINE_TOKEN.value();
    await Promise.all(recipients.map((to) => linePush(token, to, text)));
  }
);

// ── LINE Webhook:用通關密語綁定/解除接收者 ─────────────────────────
exports.lineWebhook = onRequest(
  { region: REGION, secrets: [LINE_TOKEN, LINE_SECRET, BIND_SECRET] },
  async (req, res) => {
    // 驗證 LINE 簽章,擋掉偽造請求
    const signature = req.get("x-line-signature") || "";
    const expected = crypto.createHmac("sha256", LINE_SECRET.value())
      .update(req.rawBody).digest("base64");
    if (signature !== expected) { res.status(403).send("bad signature"); return; }

    const token = LINE_TOKEN.value();
    const pass = (BIND_SECRET.value() || "").trim();
    const events = (req.body && req.body.events) || [];

    for (const ev of events) {
      if (ev.type !== "message" || !ev.message || ev.message.type !== "text") continue;
      const txt = (ev.message.text || "").trim();
      const uid = ev.source && ev.source.userId;
      if (!uid) continue;
      const ref = db.doc("config/line");

      if (pass && txt === pass) {
        await ref.set({ recipients: FieldValue.arrayUnion(uid) }, { merge: true });
        await lineReply(token, ev.replyToken,
          "✅ 已開啟 BarthON 新詢問通知(此帳號)。\n日後有人在網站送出詢問,內容就會傳到這裡。\n\n要停止請輸入:停止通知");
      } else if (txt === "停止通知") {
        await ref.set({ recipients: FieldValue.arrayRemove(uid) }, { merge: true });
        await lineReply(token, ev.replyToken, "已停止接收詢問通知。");
      }
      // 其餘訊息不回應,交給 LINE 官方帳號的自動回覆處理,避免干擾客人詢問
    }
    res.status(200).send("ok");
  }
);
