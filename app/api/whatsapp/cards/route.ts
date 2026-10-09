import { database, getSessionUser, safeJson } from "../../../lib/auth";
import { decodeCard } from "../../../whatsapp/share/route";

export async function POST(request: Request) {
  const account = await getSessionUser(request);
  if (!account) return Response.json({error: "請先登入"}, {status: 401});
  const input = await safeJson(request);
  const payload = typeof input.card === "string" ? input.card : "";
  let card: ReturnType<typeof decodeCard>;
  try {
    card = decodeCard(payload, request.url);
  } catch (error) {
    return Response.json({error: error instanceof Error ? error.message : "卡片資料無效"}, {status: 400});
  }
  const db = database();
  const id = crypto.randomUUID().replace(/-/g, "");
  const eventId = crypto.randomUUID();
  const now = Math.floor(Date.now() / 1000);
  // Both writes commit together; the conditional insert shares LINE's quota.
  const results = await db.batch([
    db.prepare(`
      INSERT INTO generation_events (id, user_id, template, access_type, status, plan, created_at)
      SELECT ?, ?, ?, ?, 'allowed', ?, ?
      WHERE ? = 1 OR (
        SELECT COUNT(*) FROM generation_events
        WHERE user_id = ? AND access_type = 'free' AND status = 'allowed'
      ) < 3
    `).bind(eventId, account.id, `whatsapp-${card.templateId || "basic"}`,
      account.vip ? "vip" : "free", account.plan, now, account.vip ? 1 : 0, account.id),
    db.prepare(`
      INSERT INTO whatsapp_cards (id, payload, created_at)
      SELECT ?, ?, ? WHERE EXISTS (SELECT 1 FROM generation_events WHERE id = ?)
    `).bind(id, payload, now, eventId),
  ]);
  if (Number(results[0].meta?.changes || 0) === 0) {
    return Response.json({error: "3 次免費生成額度已用完，LINE 與 WhatsApp 共用額度，請開通 VIP", remaining: 0}, {status: 403});
  }
  const usage = await db.prepare(`SELECT COUNT(*) AS count FROM generation_events
    WHERE user_id = ? AND access_type = 'free' AND status = 'allowed'`)
    .bind(account.id).first<{count: number}>();
  const remaining = account.vip ? null : Math.max(0, 3 - Number(usage?.count || 0));
  const origin = ["localhost", "127.0.0.1"].includes(new URL(request.url).hostname)
    ? new URL(request.url).origin : "https://linkasmnd.it.com";
  return Response.json({url: `${origin}/c/${id}`, remaining, unlimited: account.vip}, {status: 201});
}
