import { database } from "../../lib/auth";
import { landingMarkup, WA_TEMPLATES, type LandingFields } from "../../lib/whatsapp-templates";

type ShareCard = LandingFields & {
  title: string;
  description: string;
  imageUrl: string;
  phone: string;
  message: string;
  imageWidth?: number;
  imageHeight?: number;
};

function escapeHtml(value: string) {
  const escaped: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return value.replace(/[&<>"']/g, (character) => escaped[character] || character);
}

export function decodeCard(value: string, pageRequestUrl: string): ShareCard {
  if (!value || value.length > 12000 || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error("卡片連結格式不正確，請重新生成分享連結。");
  }

  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  const raw = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
  if (raw.version !== 1) throw new Error("卡片連結版本不支援，請返回生成器重新建立。");
  const title = typeof raw.title === "string" ? raw.title.trim().slice(0, 80) : "";
  const description = typeof raw.description === "string" ? raw.description.trim().slice(0, 240) : "";
  const phone = typeof raw.phone === "string" ? raw.phone.replace(/\D/g, "") : "";
  const message = typeof raw.message === "string" ? raw.message.trim().slice(0, 250) : "您好，我想了解更多資訊。";
  if (!title || !description || (raw.showChat !== false && (phone.length < 7 || phone.length > 15))) {
    throw new Error("卡片資料不完整，請返回生成器重新建立。");
  }

  if (typeof raw.imageUrl !== "string" || raw.imageUrl.length > 2000) {
    throw new Error("卡片圖片網址無效，請返回生成器重新建立。");
  }
  let image: URL;
  try {
    image = new URL(raw.imageUrl);
  } catch {
    throw new Error("卡片圖片網址無效，請返回生成器重新建立。");
  }
  const page = new URL(pageRequestUrl);
  const localImageAllowed = ["localhost", "127.0.0.1"].includes(page.hostname)
    && image.protocol === "http:"
    && image.host === page.host;
  if ((image.protocol !== "https:" && !localImageAllowed) || image.username || image.password) {
    throw new Error("卡片圖片必須是公開的 HTTPS 圖片網址。");
  }

  const fields: LandingFields = {};
  for (const key of ["showChat", "showGroup", "showSite"] as const) if (typeof raw[key] === "boolean") fields[key] = raw[key];
  if (fields.showGroup && !raw.groupUrl) throw new Error("已勾選群聊按鈕，請填寫群聊連結");
  if (fields.showSite && !raw.siteUrl) throw new Error("已勾選官網按鈕，請填寫官網連結");
  for (const key of ["heading", "pageDescription", "badge", "features", "siteName", "chatLabel", "groupLabel", "siteLabel", "accentText", "ticketLabel", "ticketType", "ticketTime"] as const) {
    if (typeof raw[key] === "string") fields[key] = raw[key].slice(0, key === "features" ? 1000 : 240);
  }
  fields.templateId = WA_TEMPLATES.some(t => t.id === raw.templateId) ? String(raw.templateId) : "basic";
  for (const key of ["backgroundUrl", "groupUrl", "siteUrl"] as const) {
    if (!raw[key]) continue;
    const value = new URL(String(raw[key]));
    if (value.protocol !== "https:" || value.username || value.password || value.href.length > 2000) throw new Error("背景、群聊與官網必須使用有效的 HTTPS 網址");
    if (key === "groupUrl" && value.hostname !== "chat.whatsapp.com") throw new Error("群聊網址必須來自 chat.whatsapp.com");
    fields[key] = value.href;
  }
  const dimensions = Number.isInteger(raw.imageWidth) && Number.isInteger(raw.imageHeight) && Number(raw.imageWidth)>0 && Number(raw.imageHeight)>0 && Number(raw.imageWidth)<=2400 && Number(raw.imageHeight)<=2400 ? {imageWidth:Number(raw.imageWidth),imageHeight:Number(raw.imageHeight)} : {};
  return { ...fields, ...dimensions, title, description, imageUrl: image.href, phone, message };
}

function htmlResponse(content: string, status = 200) {
  return new Response(content, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Cross-Origin-Resource-Policy": "cross-origin",
      "Cache-Control": "public, max-age=60, s-maxage=300",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    },
  });
}

export function OPTIONS() {
  return new Response(null, {status:204,headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET, HEAD, OPTIONS","Access-Control-Allow-Headers":"Range","Access-Control-Max-Age":"86400"}});
}

function errorPage(message: string, status: number) {
  const safeMessage = escapeHtml(message);
  return htmlResponse(`<!doctype html>
<html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>卡片連結無效</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f2f3ee;color:#142019;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}.box{width:min(440px,calc(100% - 40px));border:1px solid #d7ded7;border-radius:20px;background:#fff;padding:28px;box-shadow:0 20px 60px #17251b12}h1{font-size:22px;margin:0 0 10px}p{color:#58635c;line-height:1.7;margin:0 0 22px}a{display:inline-block;border-radius:999px;background:#25d366;color:#073b1b;text-decoration:none;font-weight:750;padding:12px 18px}</style></head>
<body><main class="box"><h1>無法開啟這張卡片</h1><p>${safeMessage}</p><a href="/?category=whatsapp">返回卡片分類</a></main></body></html>`, status);
}

export async function GET(request: Request) {
  let card: ShareCard;
  try {
    const url = new URL(request.url);
    const id = url.pathname.startsWith("/c/") ? url.pathname.split("/")[2] : "";
    let payload = url.searchParams.get("card") || "";
    if (id) {
      if (!/^[a-f0-9]{32}$/.test(id)) return errorPage("卡片不存在", 404);
      const row = await database().prepare("SELECT payload FROM whatsapp_cards WHERE id = ?").bind(id).first<{payload: string}>();
      if (!row) return errorPage("卡片不存在", 404);
      payload = row.payload;
    }
    card = decodeCard(payload, request.url);
  } catch (error) {
    const message = error instanceof Error ? error.message : "卡片連結格式不正確，請重新生成分享連結。";
    return errorPage(message, 400);
  }

  const pageUrl = new URL(request.url).href;
  const title = escapeHtml(card.title);
  const description = escapeHtml(card.description);
  const image = new URL(card.imageUrl);
  const probe = new URL(request.url).searchParams.get("probe") || "";
  if (/^[a-f0-9]{16}$/.test(probe) && image.pathname.startsWith("/api/images/") && ["linkasmnd.it.com", "line-card-lab.cx931774.workers.dev"].includes(image.hostname)) image.searchParams.set("probe",probe);
  const imageUrl = escapeHtml(image.href);
  const imageMetadata = card.imageWidth ? `<meta property="og:image:type" content="image/jpeg"><meta property="og:image:width" content="${card.imageWidth}"><meta property="og:image:height" content="${card.imageHeight}">` : "";
  const contactUrl = `https://wa.me/${card.phone}?text=${encodeURIComponent(card.message)}`;
  const shareUrl = `https://wa.me/?text=${encodeURIComponent(pageUrl)}`;
  const landing = landingMarkup(card, contactUrl);
  if (landing) return htmlResponse(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title><meta name="description" content="${description}"><link rel="canonical" href="${escapeHtml(pageUrl)}"><meta property="og:type" content="website"><meta property="og:url" content="${escapeHtml(pageUrl)}"><meta property="og:site_name" content="${escapeHtml(card.siteName || "WhatsApp 卡片")}"><meta property="og:title" content="${title}"><meta property="og:description" content="${description}"><meta property="og:image" content="${imageUrl}"><meta property="og:image:secure_url" content="${imageUrl}"><meta property="og:image:alt" content="${title}">${imageMetadata}<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${title}"><meta name="twitter:description" content="${description}"><meta name="twitter:image" content="${imageUrl}"><style>${landing.css}</style></head><body>${landing.body}</body></html>`);

  return htmlResponse(`<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${description}">
  <link rel="canonical" href="${escapeHtml(pageUrl)}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${escapeHtml(pageUrl)}">
  <meta property="og:site_name" content="WhatsApp 卡片">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${imageUrl}">
  <meta property="og:image:secure_url" content="${imageUrl}">
  <meta property="og:image:alt" content="${title}">
  ${imageMetadata}
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${imageUrl}">
  <title>${title}｜WhatsApp 卡片</title>
  <style>
    :root{color-scheme:light;--ink:#17231b;--muted:#647068;--green:#25d366;--line:#e5ebe5;--paper:#f4f7f3}
    *{box-sizing:border-box}body{margin:0;min-height:100vh;background:var(--paper);color:var(--ink);font-family:system-ui,-apple-system,"Segoe UI","Noto Sans TC",sans-serif}
    .top{height:62px;display:flex;align-items:center;justify-content:space-between;padding:0 max(20px,calc((100% - 920px)/2));background:#fff;border-bottom:1px solid var(--line)}.brand{display:flex;align-items:center;gap:10px;color:var(--ink);font-size:14px;font-weight:800;text-decoration:none}.mark{display:grid;place-items:center;width:34px;height:34px;border-radius:50%;background:var(--green);color:#06411f;font-size:10px;font-weight:900}.top a:last-child{color:var(--muted);font-size:12px;text-decoration:none}
    main{width:min(100% - 32px,520px);margin:48px auto 64px}.card{overflow:hidden;border:1px solid var(--line);border-radius:22px;background:#fff;box-shadow:0 24px 70px #14231a12}.hero{display:block;width:100%;max-height:460px;aspect-ratio:1.91/1;object-fit:cover;background:#eaf1e9}.content{padding:26px}.eyebrow{margin:0 0 10px;color:#128c48;font-size:10px;font-weight:850;letter-spacing:.13em}.content h1{margin:0 0 12px;font-size:clamp(24px,6vw,34px);letter-spacing:-.04em;line-height:1.15;overflow-wrap:anywhere}.content p{margin:0;color:var(--muted);font-size:15px;line-height:1.7;overflow-wrap:anywhere}.actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:24px}.actions a{display:flex;justify-content:center;align-items:center;min-height:48px;padding:11px 14px;border:1px solid var(--line);border-radius:12px;color:var(--ink);text-decoration:none;text-align:center;font-size:13px;font-weight:800}.actions .contact{border-color:var(--green);background:var(--green);color:#063d1b}.foot{margin:18px 0 0;color:#7b857e;font-size:11px;line-height:1.65;text-align:center}
    @media(max-width:500px){.top{height:58px}.top a:last-child{font-size:11px}main{margin:24px auto 40px}.content{padding:21px}.actions{grid-template-columns:1fr}}
  </style>
</head>
<body>
  <header class="top"><a class="brand" href="/?category=whatsapp"><span class="mark">WA</span><span>WhatsApp 卡片</span></a><a href="/?category=whatsapp">卡片分類</a></header>
  <main><article class="card"><img class="hero" src="${imageUrl}" alt="${title}" fetchpriority="high"><div class="content"><p class="eyebrow">WHATSAPP SHARE CARD</p><h1>${title}</h1><p>${description}</p><div class="actions"><a class="contact" href="${escapeHtml(contactUrl)}" target="_blank" rel="noopener noreferrer">在 WhatsApp 聯絡</a><a href="${escapeHtml(shareUrl)}" target="_blank" rel="noopener noreferrer">分享到 WhatsApp</a></div></div></article><p class="foot">這是一張公開分享卡片。透過 WhatsApp 傳送連結時，預覽由本頁的 Open Graph 資料產生。</p></main>
</body></html>`);
}


