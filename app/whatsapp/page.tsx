"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { WA_TEMPLATES, landingMarkup, type LandingFields } from "../lib/whatsapp-templates";

type WhatsAppCard = LandingFields & {
  title: string;
  description: string;
  imageUrl: string;
  phone: string;
  message: string;
  imageWidth?: number;
  imageHeight?: number;
};

const INITIAL_CARD: WhatsAppCard = {
  title: "",
  description: "",
  imageUrl: "",
  phone: "",
  message: "您好，我想了解更多資訊。",
  showChat: true,
  showGroup: false,
  showSite: false,
};

function encodeCard(value: WhatsAppCard) {
  const bytes = new TextEncoder().encode(JSON.stringify({ version: 1, ...value }));
  let binary = "";
  for (let index = 0; index < bytes.length; index += 32768) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 32768));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function prepareUpload(file: File, shareImage = false) {
  const bitmap = await createImageBitmap(file);
  const maxSide = 1200;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = shareImage ? 1200 : Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = shareImage ? 630 : Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("瀏覽器無法處理這張圖片");
  }
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  if (shareImage) {
    const ratio = Math.min(canvas.width / bitmap.width, canvas.height / bitmap.height);
    const width = Math.round(bitmap.width * ratio), height = Math.round(bitmap.height * ratio);
    context.drawImage(bitmap, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
  } else context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  let blob: Blob | null = null;
  for (const quality of [0.86,0.72,0.58,0.44]) {
    blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve,"image/jpeg",quality));
    if (!shareImage || (blob && blob.size <= 300 * 1024)) break;
  }
  if (!blob) throw new Error("圖片處理失敗");
  if (shareImage && blob.size > 300 * 1024) throw new Error("圖片細節過多，請選擇較簡單的分享圖片");
  return blob;
}

export default function WhatsAppCardBuilder() {
  const [card, setCard] = useState<WhatsAppCard>(INITIAL_CARD);
  const [shareUrl, setShareUrl] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  useEffect(() => {
    const template = WA_TEMPLATES.find(t => t.id === new URLSearchParams(window.location.search).get("template"));
    if (template) setCard(current => ({...current,templateId:template.id,heading:template.heading,pageDescription:template.pageDescription,badge:template.badge,features:template.features,chatLabel:template.chatLabel,groupLabel:template.groupLabel}));
  }, []);

  const updateCard = <K extends keyof WhatsAppCard>(key: K, value: WhatsAppCard[K]) => {
    setCard((current) => ({ ...current, [key]: value }));
    setShareUrl("");
    setCopied(false);
    setNotice("");
  };

  const uploadImage = async (event: ChangeEvent<HTMLInputElement>, target: "imageUrl" | "backgroundUrl" = "imageUrl") => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("請選擇圖片檔案");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("圖片不能超過 10MB");
      return;
    }

    setUploading(true);
    setError("");
    try {
      const image = await prepareUpload(file, target === "imageUrl");
      const formData = new FormData();
      formData.append("file", image, "whatsapp-card.jpg");
      const response = await fetch("/api/images", { method: "POST", body: formData });
      const result = await response.json() as { url?: string; error?: string };
      if (!response.ok || !result.url) throw new Error(result.error || "圖片上傳失敗");
      updateCard(target, result.url);
      setNotice("圖片已上傳");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "圖片上傳失敗");
    } finally {
      setUploading(false);
    }
  };

  const generateCard = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");

    const title = card.title.trim();
    const description = card.description.trim();
    const imageUrl = card.imageUrl.trim();
    const phone = card.phone.replace(/\D/g, "");
    if (!title) return setError("請填寫卡片標題");
    if (!description) return setError("請填寫卡片介紹");
    if (!imageUrl) return setError("請上傳圖片，或填入可公開存取的 HTTPS 圖片網址");
    if (card.showChat !== false && (phone.length < 7 || phone.length > 15)) return setError("請填寫含國碼的 WhatsApp 電話號碼，例如 886912345678");
    if (card.showGroup && !card.groupUrl?.trim()) return setError("请填写已勾选按钮的 WhatsApp 群聊链接");
    if (card.showSite && !card.siteUrl?.trim()) return setError("请填写已勾选按钮的官方网站链接");

    let parsedImage: URL;
    try {
      parsedImage = new URL(imageUrl);
    } catch {
      return setError("圖片網址格式不正確");
    }
    const localImageAllowed = ["localhost", "127.0.0.1"].includes(window.location.hostname)
      && parsedImage.protocol === "http:"
      && parsedImage.host === window.location.host;
    if (parsedImage.protocol !== "https:" && !localImageAllowed) return setError("圖片網址必須使用 HTTPS，WhatsApp 才能讀取分享預覽");

    if (generating) return;
    setGenerating(true);
    setShareUrl("");
    try {
      const imageResponse = await fetch(parsedImage.href, {mode: "cors", signal: AbortSignal.timeout(15000)});
      if (!imageResponse.ok) throw new Error("圖片網址無法讀取，請改用有效圖片網址或上傳圖片");
      const imageBlob = await imageResponse.blob();
      if (!imageBlob.type.startsWith("image/") || imageBlob.size > 10 * 1024 * 1024) throw new Error("圖片網址必須直接提供 10MB 以內的圖片");
      const normalized = await prepareUpload(new File([imageBlob], "source-image", {type:imageBlob.type}), true);
      const imageForm = new FormData();
      imageForm.append("file", normalized, "whatsapp-preview.jpg");
      const uploadResponse = await fetch("/api/images", {method:"POST",body:imageForm});
      const upload = await uploadResponse.json() as {url?:string;error?:string};
      if (!uploadResponse.ok || !upload.url) throw new Error(upload.error || "分享圖片儲存失敗");
      const hostedImage = new URL(upload.url);
      if (!["localhost","127.0.0.1"].includes(window.location.hostname)) hostedImage.host = "linkasmnd.it.com";
      const payload = encodeCard({ ...card, title, description, imageUrl: hostedImage.href, phone, imageWidth:1200, imageHeight:630,
        groupUrl:card.showGroup ? card.groupUrl : undefined,
        siteUrl:card.showSite ? card.siteUrl : undefined,
      });
      const response = await fetch("/api/whatsapp/cards", {
        method: "POST", headers: {"Content-Type": "application/json"},
        body: JSON.stringify({card: payload}),
      });
      const result = await response.json() as {url?: string; error?: string};
      if (!response.ok || !result.url) throw new Error(result.error || "卡片儲存失敗");
      setShareUrl(result.url);
      setCopied(false);
      setNotice("卡片已儲存。貼到 WhatsApp 後，請等圖片預覽出現再傳送。");
    } catch (error) {
      setError(error instanceof TypeError ? "圖片網站不允許瀏覽器讀取。請下載原圖後上傳，再生成卡片。" : error instanceof Error ? error.message : "卡片儲存失敗");
    } finally {
      setGenerating(false);
    }
  };

  const copyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setNotice("卡片連結已複製");
    } catch {
      setError("無法自動複製，請手動複製上方連結");
    }
  };

  const whatsappShareUrl = shareUrl
    ? `https://wa.me/?text=${encodeURIComponent(shareUrl)}`
    : "";

  return (
    <main className="site-shell whatsapp-shell">
      <header className="topbar whatsapp-topbar">
        <a className="brand" href="/?category=whatsapp" aria-label="返回卡片分類">
          <span className="brand-mark whatsapp-brand-mark" aria-hidden="true">WA</span>
          <span>WhatsApp 卡片生成</span>
        </a>
        <a className="whatsapp-back-link" href="/?category=whatsapp">返回卡片分類</a>
      </header>

      <div className="whatsapp-builder-page">
        <div className="whatsapp-builder-heading">
          <span className="whatsapp-eyebrow">FREE · PUBLIC SHARE LINK</span>
          <h1>建立 WhatsApp 分享卡</h1>
          <p>完成資料後會建立公開卡片頁。分享到 WhatsApp 時，WhatsApp 會從該頁讀取標題、介紹與圖片，產生實際連結預覽。</p>
        </div>

        <div className="whatsapp-builder-layout">
          <form className="whatsapp-form-panel" onSubmit={generateCard}>
            <label><span>选择模板（5 种）</span><select value={card.templateId || "basic"} onChange={event => {
              const template = WA_TEMPLATES.find(t => t.id === event.target.value)!;
              setCard(current => ({...current, templateId: template.id, heading: template.heading, pageDescription: template.pageDescription, badge: template.badge, features: template.features, chatLabel: template.chatLabel, groupLabel: template.groupLabel}));
              setShareUrl(""); setCopied(false);
            }}>{WA_TEMPLATES.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
            {card.templateId && card.templateId !== "basic" && <>
              <fieldset className="whatsapp-button-choices"><legend>显示按钮（默认仅联系）</legend>
                {(["showChat", "showGroup", "showSite"] as const).map((key,index) => <label key={key} style={{display:"flex",alignItems:"center",gap:10}}><input type="checkbox" style={{width:"auto"}} checked={Boolean(card[key])} onChange={e => updateCard(key,e.target.checked)} /><span>{["联系按钮","群聊按钮","官网按钮"][index]}</span></label>)}
              </fieldset>
              <label><span>网页标题</span><input value={card.heading || ""} maxLength={240} onChange={e => updateCard("heading", e.target.value)} /></label>
              <label><span>网页介绍</span><textarea value={card.pageDescription || ""} maxLength={240} onChange={e => updateCard("pageDescription", e.target.value)} /></label>
              {["3", "4", "5"].includes(card.templateId) && <label><span>标签文字</span><input value={card.badge || ""} maxLength={80} onChange={e => updateCard("badge", e.target.value)} /></label>}
              {card.templateId === "4" && <label><span>强调文字</span><input value={card.accentText ?? "名额有限"} maxLength={80} onChange={e => updateCard("accentText", e.target.value)} /></label>}
              {["3", "5"].includes(card.templateId) && <label><span>特色列表（每行一项）</span><textarea value={card.features || ""} maxLength={1000} onChange={e => updateCard("features", e.target.value)} /></label>}
              <label><span>网页背景图（独立于分享图片）</span><input type="url" value={card.backgroundUrl || ""} onChange={e => updateCard("backgroundUrl", e.target.value)} placeholder="https://…" /></label>
              <label><span>上传背景图</span><input type="file" accept="image/*" disabled={uploading} onChange={e => uploadImage(e,"backgroundUrl")} /></label>
              {card.showGroup && <label><span>WhatsApp 群聊链接</span><input type="url" value={card.groupUrl || ""} onChange={e => updateCard("groupUrl", e.target.value)} placeholder="https://chat.whatsapp.com/…" required /></label>}
              {card.showSite && <label><span>官方网站</span><input type="url" value={card.siteUrl || ""} onChange={e => updateCard("siteUrl", e.target.value)} placeholder="https://…" required /></label>}
              <label><span>站点名称</span><input value={card.siteName || ""} maxLength={80} onChange={e => updateCard("siteName", e.target.value)} /></label>
              {(["chatLabel", "groupLabel", "siteLabel"] as const).map((key,index) => card[(["showChat", "showGroup", "showSite"] as const)[index]] && <label key={key}><span>{["私聊按钮文字","群聊按钮文字","官网按钮文字"][index]}</span><input value={card[key] || ""} maxLength={80} onChange={e => updateCard(key,e.target.value)} /></label>)}
              <small className="whatsapp-field-hint">勾选后显示对应按钮。群聊和官网按钮需填写目标链接后才能生成；取消勾选会隐藏按钮。</small>
            </>}
            <label>
              <span>卡片標題</span>
              <input value={card.title} maxLength={80} required placeholder="例如：林小姐｜手作甜點" onChange={(event) => updateCard("title", event.target.value)} />
            </label>
            <label>
              <span>卡片介紹</span>
              <textarea value={card.description} maxLength={240} required rows={4} placeholder="簡單介紹品牌、服務或這張卡片的內容" onChange={(event) => updateCard("description", event.target.value)} />
              <small className="whatsapp-field-hint">最多 240 字</small>
            </label>
            {card.showChat !== false && <label>
              <span>WhatsApp 電話（含國碼）</span>
              <input type="tel" inputMode="tel" value={card.phone} maxLength={24} required={card.showChat !== false} placeholder="例如：886912345678" onChange={(event) => updateCard("phone", event.target.value)} />
              <small className="whatsapp-field-hint">收件人可從公開卡片直接開啟與你的 WhatsApp 對話。</small>
            </label>}
<label>
              <span>分享圖片</span>
              <input type="url" value={card.imageUrl} maxLength={2000} placeholder="https://example.com/card-image.jpg" onChange={(event) => updateCard("imageUrl", event.target.value)} />
              <small className="whatsapp-field-hint">使用公開 HTTPS 圖片網址，或上傳圖片。圖片會作為 WhatsApp 連結預覽。</small>
            </label>
            <label className={`whatsapp-upload-control ${uploading ? "disabled" : ""}`}>
              <input type="file" accept="image/*" disabled={uploading} onChange={uploadImage} />
              <span aria-hidden="true">＋</span>
              <strong>{uploading ? "圖片上傳中…" : "上傳圖片"}</strong>
              <small>上傳後會填入圖片網址</small>
            </label>

            {error && <p className="whatsapp-message error" role="alert">{error}</p>}
            {notice && <p className="whatsapp-message success" role="status">{notice}</p>}

            <button className="whatsapp-generate-button" type="submit" disabled={uploading || generating}>{generating ? "正在儲存卡片…" : "免費生成分享卡"}</button>
            <p className="whatsapp-privacy-note">分享卡網址包含你填寫的公開資料；請勿放入密碼或私密資訊。免費生成，不扣 LINE 額度，也不需要付款。本機 localhost 連結只供預覽；分享給他人需使用已部署的 HTTPS 網域。</p>
          </form>

          <aside className="whatsapp-preview-panel" aria-label="卡片內容預覽">
            <div className="whatsapp-preview-heading">
              <div><small>PREVIEW</small><h2>卡片內容預覽</h2></div>
              <span>公開分享頁</span>
            </div>
            {card.templateId && card.templateId !== "basic" && (() => {
              const preview = landingMarkup(card, `https://wa.me/${card.phone.replace(/\D/g, "")}`, true);
              return preview ? <iframe title="模板落地页预览" sandbox="" style={{width:"100%",height:650,border:0,borderRadius:16}} srcDoc={`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${preview.css}</style></head><body>${preview.body}</body></html>`} /> : null;
            })()}
            {(!card.templateId || card.templateId === "basic") && <article className="whatsapp-live-card">
              {card.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={card.imageUrl} alt="卡片圖片預覽" />
              ) : (
                <div className="whatsapp-image-placeholder"><span>加入圖片</span></div>
              )}
              <div className="whatsapp-live-card-body">
                <small>WHATSAPP CARD</small>
                <h3>{card.title || "卡片標題"}</h3>
                <p>{card.description || "卡片介紹會顯示在這裡。"}</p>
                {(!card.templateId || card.templateId === "basic") && <span className="whatsapp-contact-preview">在 WhatsApp 聯絡</span>}
              </div>
            </article>}

            {shareUrl ? (
              <div className="whatsapp-result-panel">
                <label>
                  <span>已生成的公開連結</span>
                  <input readOnly value={shareUrl} onFocus={(event) => event.currentTarget.select()} />
                </label>
                <div className="whatsapp-result-actions">
                  <button type="button" onClick={copyLink}>{copied ? "已複製" : "複製連結"}</button>
                  <a href={shareUrl} target="_blank" rel="noreferrer">預覽卡片頁</a>
                  <a className="whatsapp-share-action" href={whatsappShareUrl} target="_blank" rel="noreferrer">分享到 WhatsApp</a>
                </div>
              </div>
            ) : (
              <p className="whatsapp-preview-note">生成後可複製公開連結，或直接開啟 WhatsApp 分享。收件人開啟卡片後，可按鈕聯絡你。</p>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}

