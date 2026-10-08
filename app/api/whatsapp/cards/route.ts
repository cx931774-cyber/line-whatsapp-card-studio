import { database, safeJson } from "../../../lib/auth";
import { decodeCard } from "../../../whatsapp/share/route";

export async function POST(request: Request) {
  const input = await safeJson(request);
  const payload = typeof input.card === "string" ? input.card : "";
  try {
    decodeCard(payload, request.url);
  } catch (error) {
    return Response.json({error: error instanceof Error ? error.message : "卡片資料無效"}, {status: 400});
  }
  const id = crypto.randomUUID().replace(/-/g, "");
  await database().prepare("INSERT INTO whatsapp_cards (id, payload, created_at) VALUES (?, ?, ?)")
    .bind(id, payload, Math.floor(Date.now() / 1000)).run();
  const origin = ["localhost", "127.0.0.1"].includes(new URL(request.url).hostname)
    ? new URL(request.url).origin : "https://linkasmnd.it.com";
  return Response.json({url: `${origin}/c/${id}`}, {status: 201});
}
