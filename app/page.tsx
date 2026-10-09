"use client";

import { ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { WA_TEMPLATES, landingMarkup } from "./lib/whatsapp-templates";

type FontSize = "xxs" | "xs" | "sm" | "md" | "lg" | "xl" | "xxl" | "3xl" | "4xl" | "5xl";
type ButtonStyle = "primary" | "secondary" | "link";
type ImageSourceMode = "upload" | "url";

type CardButton = {
  id: string;
  text: string;
  link: string;
  color: string;
  style: ButtonStyle;
};

type CardConfig = {
  id: string;
  image: string;
  imageBackgroundColor?: string;
  link: string;
  title: string;
  description: string;
  backgroundColor: string;
  titleColor: string;
  descriptionColor: string;
  buttons: CardButton[];
};

type BuilderSettings = {
  altText: string;
  ratio: string;
  titleSize: FontSize;
  descriptionSize: FontSize;
  buttonHeight: "sm" | "md";
  chatName: string;
  liffId: string;
};

type BuilderState = {
  version: 1;
  settings: BuilderSettings;
  cards: CardConfig[];
};

type Account = {
  displayName: string;
  role: "user" | "admin";
  plan: "free" | "monthly" | "annual" | "lifetime";
  vip: boolean;
  freeGenerationsUsed: number;
  freeGenerationsRemaining: number | null;
};

type FavoriteSummary = {
  id: string;
  name: string;
  previewImage: string | null;
  createdAt: number;
  updatedAt: number;
};

const STORAGE_KEY = "line-card-lab:v5";
const FONT_SIZES: FontSize[] = ["xxs", "xs", "sm", "md", "lg", "xl", "xxl", "3xl", "4xl", "5xl"];
const COMPAT_SHARE_PAGE = "https://liff.line.me/1654437282-A1Bj7p4a/share-json5gzip.html";
const COMPAT_TEMPLATE = "https://taichunmin.idv.tw/liff-businesscard/cards/line-carousel-1.txt";

const CATALOG_TEMPLATES = [
  { form: "custom-line-carousel", name: "多頁訊息 1", preview: "/templates/custom-line-carousel.webp", description: "來自 LINE 的樣板，最多 12 張卡片，很適合用來製作廣告傳單。" },
  { form: "chatgpt-1", name: "ChatGPT 問與答", preview: "/templates/chatgpt-1.webp", description: "讓你在 LINE 中模擬 ChatGPT 的問答畫面，上面有開啟自訂連結及再次分享的按鈕。" },
  { form: "json5", name: "JSON5", preview: "/templates/json5.webp", description: "提供給有程式背景的開發者使用，可以使用 JSON5 API 來當作樣板的資料來源。" },
  { form: "psprint-592", name: "Corporate Buzz", preview: "/templates/psprint-592.webp", description: "來自 PsPrint 的樣板，上面有連結可以開啟，很適合用來製作個人名片。" },
  { form: "google-sheet", name: "Google Sheet", preview: "/templates/google-sheet.webp", description: "從 Google Sheet 讀取名片資料來產生名片。" },
  { form: "csv", name: "CSV", preview: "/templates/csv.webp", description: "從 CSV 讀取名片資料來產生名片。" },
  { form: "facebook-post-link-1", name: "Facebook Post Link", preview: "/templates/facebook-post-link-1.webp", description: "讓你在 LINE 中模擬 Facebook 分享連結，並且還可再次分享。" },
  { form: "psprint-3949", name: "Right Align", preview: "/templates/psprint-3949.webp", description: "來自 PsPrint 的樣板，上面有連結可以開啟，很適合用來製作個人名片。" },
  { form: "acnh-passport-1", name: "動物森友會護照", preview: "/templates/acnh-passport-1.webp", description: "《集合啦！動物森友會》的護照。" },
  { form: "acnh-postcard-1", name: "動物森友會心意卡", preview: "/templates/acnh-postcard-1.webp", description: "來自《集合啦！動物森友會》的心意卡。" },
  { form: "chatbot-tw-1", name: "Chatbot 臺灣開發者", preview: "/templates/chatbot-tw-1.webp", description: "Chatbot Developers Taiwan 的名片。" },
] as const;

const LEGACY_SECOND_BUTTON: CardButton = {
  id: "strategy-work",
  text: "檢視服務與案例",
  link: "https://example.com/work",
  color: "#167a47",
  style: "link",
};

const DEFAULT_CARD: CardConfig = {
  id: "brand-strategy",
  image: "https://i.imgur.com/yBjZFmf.png",
  link: "",
  title: "Arm Chair, White",
  description: "售價：USD $49.99",
  backgroundColor: "#ffffff",
  titleColor: "#111815",
  descriptionColor: "#69716d",
  buttons: [
    {
      id: "strategy-book",
      text: "Add to Cart",
      link: "www.google.com",
      color: "#06c755",
      style: "primary",
    },
  ],
};

const LEGACY_SECOND_CARD: CardConfig = {
  id: "web-experience",
  image: "https://images.unsplash.com/photo-1559028012-481c04fa702d?auto=format&fit=crop&w=1200&q=85",
  link: "https://example.com/web",
  title: "讓網頁成為品牌最好用的名片",
  description: "兼顧敘事、轉換與速度，打造一套真正能長期使用的數位體驗。",
  backgroundColor: "#efffe8",
  titleColor: "#102117",
  descriptionColor: "#516057",
  buttons: [
    {
      id: "web-plan",
      text: "檢視網頁方案",
      link: "https://example.com/web-plan",
      color: "#102117",
      style: "primary",
    },
  ],
};

const DEFAULT_STATE: BuilderState = {
  version: 1,
  settings: {
    altText: "",
    ratio: "20:13",
    titleSize: "xl",
    descriptionSize: "sm",
    buttonHeight: "sm",
    chatName: "官網邀請",
    liffId: "",
  },
  cards: [DEFAULT_CARD],
};

function migrateLegacyDefault(state: BuilderState) {
  const legacyCards = [
    { ...DEFAULT_CARD, buttons: [...DEFAULT_CARD.buttons, LEGACY_SECOND_BUTTON] },
    LEGACY_SECOND_CARD,
  ];
  return JSON.stringify(state.cards) === JSON.stringify(legacyCards)
    ? { ...state, cards: [DEFAULT_CARD] }
    : state;
}

function newId(prefix: string) {
  const suffix = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${suffix}`;
}

function safeUri(uri: string) {
  const value = uri.trim();
  if (/^https?:\/\//i.test(value)) return value;
  if (/^(?:www\.)?[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?(?::\d+)?(?:[/?#].*)?$/i.test(value)) return `https://${value}`;
  return "https://line.me";
}

function imageEdgeColor(image: HTMLImageElement) {
  const sampleSize = 32;
  const canvas = document.createElement("canvas");
  canvas.width = sampleSize;
  canvas.height = sampleSize;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return "";
  context.drawImage(image, 0, 0, sampleSize, sampleSize);
  const pixels = context.getImageData(0, 0, sampleSize, sampleSize).data;
  let red = 0;
  let green = 0;
  let blue = 0;
  let count = 0;
  for (let index = 0; index < sampleSize; index += 2) {
    for (const offset of [index, (sampleSize - 1) * sampleSize + index, index * sampleSize, index * sampleSize + sampleSize - 1]) {
      const pixel = offset * 4;
      if (pixels[pixel + 3] < 128) continue;
      red += pixels[pixel];
      green += pixels[pixel + 1];
      blue += pixels[pixel + 2];
      count += 1;
    }
  }
  if (!count) return "";
  const hex = (value: number) => Math.round(value / count).toString(16).padStart(2, "0");
  return `#${hex(red)}${hex(green)}${hex(blue)}`;
}

async function prepareImage(file: File) {
  const bitmap = await createImageBitmap(file);
  const maxSide = 1024;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("瀏覽器無法處理這張圖片");
  }
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
  if (!blob) throw new Error("圖片處理失敗");
  return blob;
}

function toCompatibilityVcard(state: BuilderState) {
  return {
    altText: state.settings.altText,
    btnHeight: state.settings.buttonHeight,
    descSize: state.settings.descriptionSize,
    ratio: state.settings.ratio,
    titleSize: state.settings.titleSize,
    cards: state.cards.map((card) => ({
      bgColor: card.backgroundColor,
      desc: card.description,
      descColor: card.descriptionColor,
      image: card.image,
      link: safeUri(card.buttons[0]?.link || ""),
      title: card.title,
      titleColor: card.titleColor,
      btns: card.buttons.map((button) => ({
        color: button.color,
        link: safeUri(button.link),
        style: button.style,
        text: button.text,
      })),
    })),
  };
}

function sortForStableJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortForStableJson);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => [key, sortForStableJson(item)]),
  );
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 32768) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 32768));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function textToBase64Url(value: string) {
  return bytesToBase64Url(new TextEncoder().encode(value));
}

async function createCompatibilityLink(state: BuilderState) {
  if (!("CompressionStream" in window)) throw new Error("目前瀏覽器不支援連結壓縮");
  const payload = JSON.stringify(sortForStableJson(toCompatibilityVcard(state)));
  const compressed = new Blob([payload])
    .stream()
    .pipeThrough(new CompressionStream("deflate"));
  const bytes = new Uint8Array(await new Response(compressed).arrayBuffer());
  const url = new URL(COMPAT_SHARE_PAGE);
  url.searchParams.set("template", textToBase64Url(COMPAT_TEMPLATE));
  url.searchParams.set("json5gzip", bytesToBase64Url(bytes));
  return url.href;
}

function normalizeImported(raw: unknown): BuilderState {
  if (!raw || typeof raw !== "object") throw new Error("檔案內容不是有效物件");
  const input = raw as Record<string, unknown>;

  if (input.settings && Array.isArray(input.cards)) {
    const imported = input as unknown as BuilderState;
    if (!imported.cards.length) throw new Error("至少需要一張卡片");
    return { ...imported, version: 1 };
  }

  const json5 = (input.json5 || input) as Record<string, unknown>;
  if (!Array.isArray(json5.cards)) throw new Error("沒有找到可匯入的卡片設定");

  const cards = (json5.cards as Array<Record<string, unknown>>).map((card, cardIndex) => ({
    id: newId(`import-card-${cardIndex + 1}`),
    image: String(card.image || ""),
    link: String(card.link || "https://line.me"),
    title: String(card.title || "未命名卡片"),
    description: String(card.desc || card.description || ""),
    backgroundColor: String(card.bgColor || card.backgroundColor || "#ffffff"),
    titleColor: String(card.titleColor || "#111815"),
    descriptionColor: String(card.descColor || card.descriptionColor || "#69716d"),
    buttons: (Array.isArray(card.btns) ? card.btns : Array.isArray(card.buttons) ? card.buttons : [])
      .map((button, buttonIndex) => {
        const item = button as Record<string, unknown>;
        return {
          id: newId(`import-button-${buttonIndex + 1}`),
          text: String(item.text || item.label || "檢視詳情"),
          link: String(item.link || item.uri || "https://line.me"),
          color: String(item.color || "#06c755"),
          style: (["primary", "secondary", "link"].includes(String(item.style))
            ? String(item.style)
            : "primary") as ButtonStyle,
        };
      }),
  }));

  return {
    version: 1,
    settings: {
      ...DEFAULT_STATE.settings,
      altText: String(json5.altText || DEFAULT_STATE.settings.altText),
      ratio: String(json5.ratio || DEFAULT_STATE.settings.ratio),
      titleSize: String(json5.titleSize || DEFAULT_STATE.settings.titleSize) as FontSize,
      descriptionSize: String(json5.descSize || json5.descriptionSize || DEFAULT_STATE.settings.descriptionSize) as FontSize,
      buttonHeight: String(json5.btnHeight || json5.buttonHeight || "sm") as "sm" | "md",
    },
    cards,
  };
}

function AccountActions({ account }: { account: Account | null | undefined }) {
  return (
    <div className="topbar-actions">
      {account?.role === "admin" && <a href="/admin">後台</a>}
      <a className={account?.vip ? "account-link vip" : "account-link"} href="/account">
        {account === undefined ? "帳戶" : account ? (account.vip ? "VIP 帳戶" : `普通會員 · ${account.freeGenerationsRemaining ?? 0} 次`) : "登入 / 註冊"}
      </a>
    </div>
  );
}

function TemplateCatalog({ onOpenLineCarousel, account }: { onOpenLineCarousel: () => void; account: Account | null | undefined }) {
  const [activeCategory, setActiveCategory] = useState<"line" | "whatsapp">("line");
  const [loginTarget, setLoginTarget] = useState("");
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("category") === "whatsapp") setActiveCategory("whatsapp");
  }, []);
  const selectCategory = (category: "line" | "whatsapp") => {
    setActiveCategory(category);
    window.history.replaceState({}, "", category === "whatsapp" ? "/?category=whatsapp" : "/");
  };
  const promptLogin = (target: string) => {
    setLoginTarget(target);
    window.setTimeout(() => setLoginTarget(""), 3200);
  };

  return (
    <main className="site-shell catalog-shell" id="top">
      <header className="topbar catalog-topbar">
        <a className="brand" href="#top" aria-label="社交卡片生成器首頁">
          <span className="brand-mark brand-mark-unified" aria-hidden="true" />
          <span>社交卡片生成器</span>
        </a>
        <AccountActions account={account} />
      </header>
      <nav className="category-tabs" aria-label="卡片平台分類" role="tablist">
        <button className={activeCategory === "line" ? "active" : ""} id="category-line" type="button" role="tab" aria-controls="line-category-panel" aria-selected={activeCategory === "line"} onClick={() => selectCategory("line")}>
          <span className="category-dot line-dot" aria-hidden="true" />LINE 卡片
        </button>
        <button className={activeCategory === "whatsapp" ? "active" : ""} id="category-whatsapp" type="button" role="tab" aria-controls="whatsapp-category-panel" aria-selected={activeCategory === "whatsapp"} onClick={() => selectCategory("whatsapp")}>
          <span className="category-dot whatsapp-dot" aria-hidden="true" />WhatsApp 卡片
        </button>
      </nav>
      {activeCategory === "line" ? (
        <section className="catalog-page" id="line-category-panel" role="tabpanel" aria-labelledby="category-line">
          <div className="catalog-heading">
            <span>LINE FLEX MESSAGE</span>
            <h1 id="catalog-title">LINE 卡片樣板列表</h1>
            <p>選擇一款 LINE 卡片樣板，進入它自己的名片編輯表單。</p>
          </div>
          <div className="template-grid">
            {CATALOG_TEMPLATES.map((template, index) => (
              <article className="template-card" key={template.form}>
                <div className="template-preview"><img src={template.preview} alt={`${template.name} 樣板預覽`} loading={index < 3 ? "eager" : "lazy"} decoding="async" fetchPriority={index === 0 ? "high" : "auto"} /></div>
                <div className="template-card-body">
                  <h2>{template.name}</h2>
                  <p>{template.description}</p>
                  {template.form === "custom-line-carousel" ? (
                    <button type="button" onClick={() => account ? onOpenLineCarousel() : promptLogin("/?template=custom-line-carousel")}>▣&nbsp; 點擊建立名片</button>
                  ) : account ? (
                    <a href={`/original/${template.form}`}>▣&nbsp; 點擊建立名片</a>
                  ) : (
                    <button type="button" onClick={() => promptLogin(`/original/${template.form}`)}>▣&nbsp; 點擊建立名片</button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : (
        <section className="catalog-page" id="whatsapp-category-panel" role="tabpanel" aria-labelledby="category-whatsapp">
          <div className="catalog-heading whatsapp-heading">
            <span>WHATSAPP SHARE CARDS</span>
            <h1 id="whatsapp-catalog-title">WhatsApp 卡片生成</h1>
            <p>建立可公開開啟的卡片連結，透過 WhatsApp 分享時由平台讀取真實網頁預覽。</p>
          </div>
          <div className="whatsapp-template-grid">
            {WA_TEMPLATES.filter(t => t.id !== "basic").map(template => {
              const preview = landingMarkup({templateId:template.id,title:template.name,description:template.pageDescription,imageUrl:"",groupUrl:"https://chat.whatsapp.com/example",siteUrl:"https://example.com"},"https://wa.me/8613800138000")!;
              return <article key={template.id} className="template-card whatsapp-template-card">
              <div className="whatsapp-catalog-preview" data-template={template.id}><iframe title={`${template.name}实际样式预览`} loading="lazy" sandbox="" tabIndex={-1} srcDoc={`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${preview.css}body{overflow:hidden}a{pointer-events:none}</style></head><body>${preview.body}</body></html>`} /></div>
              <div className="template-card-body"><span className="whatsapp-free-label">与 LINE 共用 3 次免费额度</span><h2>{template.name}</h2><p>{template.heading}。支持独立分享图片、背景图、私聊、群聊及官网按钮。</p><a className="whatsapp-create-link" href={`/whatsapp?template=${template.id}`}>使用这个模板</a></div>
            </article>;})}
            <article className="template-card whatsapp-template-card">
              <div className="whatsapp-catalog-preview"><iframe title="通用图文卡片样式预览" loading="lazy" sandbox="" tabIndex={-1} srcDoc={'<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;background:#f4f7f3;color:#17231b;font-family:system-ui,sans-serif;padding:24px 16px}.card{border:1px solid #e5ebe5;border-radius:22px;background:white;overflow:hidden}.image{height:200px;background:#eaf1e9;display:grid;place-items:center;color:#647068}.content{padding:26px}small{color:#128c48;letter-spacing:.13em}h1{font-size:30px;margin:14px 0}p{color:#647068;line-height:1.7}.buttons{display:flex;gap:10px;margin-top:24px}.buttons span{flex:1;padding:14px 8px;border:1px solid #e5ebe5;border-radius:12px;font-size:13px;text-align:center;font-weight:700}.buttons span:first-child{background:#25d366}</style></head><body><article class="card"><div class="image">分享图片</div><div class="content"><small>WHATSAPP SHARE CARD</small><h1>你的品牌或服务</h1><p>介绍品牌、服务与联系方式。点击按钮即可在 WhatsApp 联系你。</p><div class="buttons"><span>在 WhatsApp 联络</span><span>分享到 WhatsApp</span></div></div></article></body></html>'} /></div>
              <div className="template-card-body">
                <span className="whatsapp-free-label">與 LINE 共用 3 次免費額度</span>
                <h2>WhatsApp 聯絡分享卡</h2>
                <p>設定標題、介紹、圖片與 WhatsApp 電話。生成公開卡片頁，分享時使用 WhatsApp 原生連結預覽。</p>
                <a className="whatsapp-create-link" href="/whatsapp">建立 WhatsApp 卡片</a>
              </div>
            </article>
          </div>
        </section>
      )}
      <div className={`login-entry-prompt ${loginTarget ? "show" : ""}`} role="status" aria-live="polite">
        <span>請先登入</span>
        {loginTarget && <a href={`/account?returnTo=${encodeURIComponent(loginTarget)}`}>登入 / 註冊</a>}
      </div>
    </main>
  );
}

export default function Home() {
  const [builder, setBuilder] = useState<BuilderState>(DEFAULT_STATE);
  const [showEditor, setShowEditor] = useState(false);
  const [activeCardId, setActiveCardId] = useState(DEFAULT_STATE.cards[0].id);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [compatibilityLink, setCompatibilityLink] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageSourceMode, setImageSourceMode] = useState<ImageSourceMode>("url");
  const [account, setAccount] = useState<Account | null | undefined>(undefined);
  const [favorites, setFavorites] = useState<FavoriteSummary[]>([]);
  const [favoritesOpen, setFavoritesOpen] = useState(false);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [savingFavorite, setSavingFavorite] = useState(false);
  const [generatingCard, setGeneratingCard] = useState(false);
  const [activeFavoriteId, setActiveFavoriteId] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshFavorites = useCallback(async () => {
    setFavoritesLoading(true);
    try {
      const response = await fetch("/api/favorites", { cache: "no-store" });
      const data = await response.json() as { favorites?: FavoriteSummary[] };
      if (response.ok) setFavorites(data.favorites || []);
    } finally {
      setFavoritesLoading(false);
    }
  }, []);

  useEffect(() => {
    const syncView = () => setShowEditor(new URLSearchParams(window.location.search).get("template") === "custom-line-carousel");
    syncView();
    window.addEventListener("popstate", syncView);
    return () => window.removeEventListener("popstate", syncView);
  }, []);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((response) => response.json())
      .then((data: { user?: Account | null }) => setAccount(data.user || null))
      .catch(() => setAccount(null));
  }, []);

  useEffect(() => {
    if (account !== null || new URLSearchParams(window.location.search).get("template") !== "custom-line-carousel") return;
    window.location.replace("/account?returnTo=%2F%3Ftemplate%3Dcustom-line-carousel");
  }, [account]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const normalized = migrateLegacyDefault(normalizeImported(JSON.parse(saved)));
        normalized.settings.chatName = normalized.settings.chatName || "官網邀請";
        // eslint-disable-next-line react-hooks/set-state-in-effect -- restore the local draft after mount
        setBuilder(normalized);
        setActiveCardId(normalized.cards[0].id);
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem(STORAGE_KEY, JSON.stringify(builder));
  }, [builder, loaded]);

  useEffect(() => {
    let current = true;
    createCompatibilityLink(builder)
      .then((link) => { if (current) setCompatibilityLink(link); })
      .catch(() => { if (current) setCompatibilityLink(""); });
    return () => { current = false; };
  }, [builder]);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const activeIndex = Math.max(0, builder.cards.findIndex((card) => card.id === activeCardId));
  const activeCard = builder.cards[activeIndex] || builder.cards[0];

  const notify = (message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2800);
  };

  const generateCard = async () => {
    if (!account || generatingCard) return;
    if (!compatibilityLink) {
      notify("卡片連結尚未準備完成");
      return;
    }
    if (!account.vip && (account.freeGenerationsRemaining ?? 0) <= 0) {
      notify("3 次免費額度已用完，請開通 VIP");
      window.setTimeout(() => { window.location.assign("/account?returnTo=%2F%3Ftemplate%3Dcustom-line-carousel"); }, 900);
      return;
    }

    const popup = window.open("about:blank", "_blank");
    if (popup) popup.opener = null;
    setGeneratingCard(true);
    try {
      const response = await fetch("/api/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template: "custom-line-carousel" }),
      });
      const data = await response.json() as { error?: string; used?: number; remaining?: number | null; unlimited?: boolean };
      if (!response.ok) throw new Error(data.error || "生成失敗");

      if (!data.unlimited) {
        setAccount((current) => current ? {
          ...current,
          freeGenerationsUsed: Number(data.used || current.freeGenerationsUsed + 1),
          freeGenerationsRemaining: Number(data.remaining ?? 0),
        } : current);
      }
      if (popup) popup.location.replace(compatibilityLink);
      else window.location.assign(compatibilityLink);
      notify(data.unlimited ? "正在開啟 LINE 分享" : `已生成，剩餘 ${data.remaining ?? 0} 次免費額度`);
    } catch (generationError) {
      popup?.close();
      notify(generationError instanceof Error ? generationError.message : "生成失敗");
    } finally {
      setGeneratingCard(false);
    }
  };

  const saveFavorite = async (asNew = false) => {
    setSavingFavorite(true);
    try {
      const favoriteId = asNew ? null : activeFavoriteId;
      const response = await fetch(favoriteId ? `/api/favorites/${favoriteId}` : "/api/favorites", {
        method: favoriteId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: builder.cards[0]?.title || "未命名卡片", state: builder }),
      });
      const data = await response.json() as { favorite?: FavoriteSummary; error?: string };
      if (!response.ok || !data.favorite) throw new Error(data.error || "收藏失敗");
      setActiveFavoriteId(data.favorite.id);
      await refreshFavorites();
      notify(favoriteId ? "收藏已更新" : "卡片已收藏");
    } catch (error) {
      notify(error instanceof Error ? error.message : "收藏失敗");
    } finally {
      setSavingFavorite(false);
    }
  };

  const loadFavorite = async (favoriteId: string) => {
    try {
      const response = await fetch(`/api/favorites/${favoriteId}`, { cache: "no-store" });
      const data = await response.json() as { favorite?: { state?: unknown }; error?: string };
      if (!response.ok || !data.favorite?.state) throw new Error(data.error || "讀取收藏失敗");
      const restored = normalizeImported(data.favorite.state);
      setBuilder(restored);
      setActiveCardId(restored.cards[0].id);
      setActiveFavoriteId(favoriteId);
      setFavoritesOpen(false);
      notify("已恢復收藏，可繼續編輯");
    } catch (error) {
      notify(error instanceof Error ? error.message : "讀取收藏失敗");
    }
  };

  const deleteFavorite = async (favorite: FavoriteSummary) => {
    if (!window.confirm(`確定刪除收藏“${favorite.name}”嗎？`)) return;
    try {
      const response = await fetch(`/api/favorites/${favorite.id}`, { method: "DELETE" });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "刪除失敗");
      if (activeFavoriteId === favorite.id) setActiveFavoriteId(null);
      setFavorites((current) => current.filter((item) => item.id !== favorite.id));
      notify("收藏已刪除");
    } catch (error) {
      notify(error instanceof Error ? error.message : "刪除失敗");
    }
  };

  const updateSettings = <K extends keyof BuilderSettings>(key: K, value: BuilderSettings[K]) => {
    setBuilder((current) => ({
      ...current,
      settings: { ...current.settings, [key]: value },
    }));
  };

  const updateCard = <K extends keyof CardConfig>(key: K, value: CardConfig[K]) => {
    setBuilder((current) => ({
      ...current,
      cards: current.cards.map((card) => card.id === activeCard.id ? { ...card, [key]: value } : card),
    }));
  };

  const updateButton = <K extends keyof CardButton>(buttonId: string, key: K, value: CardButton[K]) => {
    updateCard("buttons", activeCard.buttons.map((button) => button.id === buttonId ? { ...button, [key]: value } : button));
  };

  const uploadImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return notify("請選擇圖片檔案");
    if (file.size > 10 * 1024 * 1024) return notify("圖片不能超過 10MB");

    setUploadingImage(true);
    try {
      const image = await prepareImage(file);
      const formData = new FormData();
      formData.append("file", image, "card-image.jpg");
      const response = await fetch("/api/images", { method: "POST", body: formData });
      const result = await response.json() as { url?: string; error?: string };
      if (!response.ok || !result.url) throw new Error(result.error || "圖片上傳失敗");
      updateCard("imageBackgroundColor", "");
      updateCard("image", result.url);
      notify("圖片已上傳");
    } catch (error) {
      notify(error instanceof Error ? error.message : "圖片上傳失敗");
    } finally {
      setUploadingImage(false);
    }
  };

  const addCard = () => {
    const card: CardConfig = {
      id: newId("card"),
      image: "",
      link: "",
      title: "",
      description: "",
      backgroundColor: "#ffffff",
      titleColor: "#111815",
      descriptionColor: "#69716d",
      buttons: [{
        id: newId("button"),
        text: "",
        link: "",
        color: "#06c755",
        style: "primary",
      }],
    };
    setBuilder((current) => ({ ...current, cards: [...current.cards, card] }));
    setActiveCardId(card.id);
  };

  const moveCard = (direction: -1 | 1) => {
    const nextIndex = activeIndex + direction;
    if (nextIndex < 0 || nextIndex >= builder.cards.length) return;
    setBuilder((current) => {
      const cards = [...current.cards];
      [cards[activeIndex], cards[nextIndex]] = [cards[nextIndex], cards[activeIndex]];
      return { ...current, cards };
    });
  };

  const removeCard = () => {
    if (builder.cards.length === 1) return notify("至少保留一張卡片");
    if (!window.confirm(`確定刪除第 ${activeIndex + 1} 張卡片嗎？`)) return;
    const nextCards = builder.cards.filter((card) => card.id !== activeCard.id);
    setBuilder((current) => ({ ...current, cards: nextCards }));
    setActiveCardId(nextCards[Math.min(activeIndex, nextCards.length - 1)].id);
  };

  const addButton = () => {
    updateCard("buttons", [...activeCard.buttons, {
      id: newId("button"),
      text: "",
      link: "",
      color: "#06c755",
      style: "primary",
    }]);
  };

  const removeButton = (buttonId: string) => {
    updateCard("buttons", activeCard.buttons.filter((button) => button.id !== buttonId));
  };

  const moveButton = (buttonId: string, direction: -1 | 1) => {
    const buttonIndex = activeCard.buttons.findIndex((button) => button.id === buttonId);
    const nextIndex = buttonIndex + direction;
    if (buttonIndex < 0 || nextIndex < 0 || nextIndex >= activeCard.buttons.length) return;
    const buttons = [...activeCard.buttons];
    [buttons[buttonIndex], buttons[nextIndex]] = [buttons[nextIndex], buttons[buttonIndex]];
    updateCard("buttons", buttons);
  };

  const buttonPreviewStyle = (button: CardButton) => {
    if (button.style === "primary") return { background: button.color, color: "#ffffff", borderColor: button.color };
    if (button.style === "secondary") return { background: button.color, color: "#111815", borderColor: button.color };
    return { background: "transparent", color: button.color, borderColor: "transparent" };
  };

  const openLineCarousel = () => {
    window.history.pushState({}, "", "?template=custom-line-carousel");
    setShowEditor(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const openCatalog = () => {
    window.history.pushState({}, "", window.location.pathname);
    setShowEditor(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (!showEditor || !account) return <TemplateCatalog onOpenLineCarousel={openLineCarousel} account={account} />;

  return (
    <main className="site-shell" id="top">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="LINE 卡片生成器首頁">
          <span className="brand-mark" aria-hidden="true" />
          <span>LINE 卡片生成器</span>
        </a>
        <AccountActions account={account} />
      </header>

      <div className="editor-return-row">
        <button className="catalog-back" type="button" onClick={openCatalog}>← 返回樣板列表</button>
        <div className="favorite-actions">
          <button className="favorite-save" type="button" disabled={savingFavorite} onClick={() => saveFavorite(false)}>{savingFavorite ? "儲存中…" : activeFavoriteId ? "✓ 更新收藏" : "♡ 收藏卡片"}</button>
          {activeFavoriteId && <button type="button" disabled={savingFavorite} onClick={() => saveFavorite(true)}>＋ 另存為新收藏</button>}
          <button type="button" aria-expanded={favoritesOpen} onClick={() => {
            const nextOpen = !favoritesOpen;
            setFavoritesOpen(nextOpen);
            if (nextOpen && account && !favorites.length) void refreshFavorites();
          }}>我的收藏 {favorites.length ? `(${favorites.length})` : ""}</button>
        </div>
      </div>

      {favoritesOpen && (
        <section className="favorites-panel" aria-label="我的卡片收藏">
          <div className="favorites-heading"><div><small>SAVED CARDS</small><h2>我的收藏</h2></div><button type="button" aria-label="關閉我的收藏" onClick={() => setFavoritesOpen(false)}>×</button></div>
          {favoritesLoading ? <p className="favorites-empty">正在讀取收藏…</p> : favorites.length ? (
            <div className="favorites-grid">
              {favorites.map((favorite) => (
                <article className={favorite.id === activeFavoriteId ? "favorite-item active" : "favorite-item"} key={favorite.id}>
                  <div className="favorite-thumb">{favorite.previewImage ? <img src={favorite.previewImage} alt="" /> : <span>LINE</span>}</div>
                  <div className="favorite-meta"><strong>{favorite.name}</strong><span>{new Date(favorite.updatedAt * 1000).toLocaleDateString("zh-TW")} 更新</span></div>
                  <div className="favorite-item-actions"><button type="button" onClick={() => loadFavorite(favorite.id)}>繼續編輯</button><button className="favorite-delete" type="button" onClick={() => deleteFavorite(favorite)}>刪除</button></div>
                </article>
              ))}
            </div>
          ) : <p className="favorites-empty">還沒有收藏。編輯完成後點擊「收藏卡片」即可儲存。</p>}
        </section>
      )}

      <section className="workspace" aria-label="卡片編輯工作區">
        <div className="editor-panel">
          <div className="panel-heading">
            <div><span className="step">01</span><h2>編輯卡片</h2></div>
          </div>

          <div className="card-tabs" aria-label="卡片列表">
            {builder.cards.map((card, index) => (
              <button
                key={card.id}
                type="button"
                className={card.id === activeCard.id ? "active" : ""}
                aria-pressed={card.id === activeCard.id}
                onClick={() => setActiveCardId(card.id)}
              >{String(index + 1).padStart(2, "0")}</button>
            ))}
            <button className="add-tab" type="button" onClick={addCard} aria-label="新增卡片">＋</button>
          </div>

          <section className="editor-section compact-section">
            <button className="section-toggle" type="button" aria-expanded={settingsOpen} onClick={() => setSettingsOpen((open) => !open)}>
              <span><small>GLOBAL</small> 全域設定</span><b>{settingsOpen ? "−" : "+"}</b>
            </button>
            {settingsOpen && (
              <div className="section-content settings-grid">
                <label htmlFor="ratio"><span>圖片比例</span><input id="ratio" value={builder.settings.ratio} onChange={(event) => updateSettings("ratio", event.target.value)} placeholder="20:13" /></label>
                <label htmlFor="chat-name"><span>預覽聊天名稱</span><input id="chat-name" value={builder.settings.chatName} onChange={(event) => updateSettings("chatName", event.target.value)} /></label>
                <label htmlFor="title-size"><span>標題字號</span><select id="title-size" value={builder.settings.titleSize} onChange={(event) => updateSettings("titleSize", event.target.value as FontSize)}>{FONT_SIZES.map((size) => <option key={size}>{size}</option>)}</select></label>
                <label htmlFor="desc-size"><span>說明字號</span><select id="desc-size" value={builder.settings.descriptionSize} onChange={(event) => updateSettings("descriptionSize", event.target.value as FontSize)}>{FONT_SIZES.map((size) => <option key={size}>{size}</option>)}</select></label>
                <label htmlFor="button-height"><span>按鈕高度</span><select id="button-height" value={builder.settings.buttonHeight} onChange={(event) => updateSettings("buttonHeight", event.target.value as "sm" | "md")}><option value="sm">sm</option><option value="md">md</option></select></label>
              </div>
            )}
          </section>

          <section className="editor-section">
            <div className="card-toolbar">
              <div><small>CARD {String(activeIndex + 1).padStart(2, "0")}</small><strong>{activeCard.title || "未命名卡片"}</strong></div>
              <div className="icon-actions">
                <button type="button" onClick={() => moveCard(-1)} disabled={activeIndex === 0} aria-label="卡片前移">←</button>
                <button type="button" onClick={() => moveCard(1)} disabled={activeIndex === builder.cards.length - 1} aria-label="卡片後移">→</button>
                <button className="danger" type="button" onClick={removeCard} aria-label="刪除卡片">×</button>
              </div>
            </div>

            <div className="section-content form-stack">
              <label htmlFor="card-title"><span>主標題</span><input id="card-title" value={activeCard.title} onChange={(event) => updateCard("title", event.target.value)} /></label>
              <label htmlFor="card-description"><span>說明文字</span><textarea id="card-description" rows={3} value={activeCard.description} onChange={(event) => updateCard("description", event.target.value)} /></label>
              <div className="image-upload-field">
                <span className="field-label">卡片圖片</span>
                <input ref={imageInputRef} className="image-file-input" id="card-image" type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadImage} />
                <div className="image-source-options" role="radiogroup" aria-label="圖片輸入方式">
                  <label><input type="radio" name="image-source" value="upload" checked={imageSourceMode === "upload"} onChange={() => setImageSourceMode("upload")} /><span>上傳圖片</span></label>
                  <label><input type="radio" name="image-source" value="url" checked={imageSourceMode === "url"} onChange={() => setImageSourceMode("url")} /><span>輸入連結</span></label>
                </div>
                {imageSourceMode === "upload" ? (
                  <div className="image-upload-control">
                    <div className="image-upload-thumb">
                      {activeCard.image ? <img key={activeCard.image} src={activeCard.image} alt="目前卡片圖片" /> : <span>暫無圖片</span>}
                    </div>
                    <div className="image-upload-actions">
                      <button type="button" onClick={() => imageInputRef.current?.click()} disabled={uploadingImage}>{uploadingImage ? "上傳中…" : activeCard.image ? "更換圖片" : "選擇圖片"}</button>
                      {activeCard.image && <button className="remove-image" type="button" onClick={() => updateCard("image", "")} disabled={uploadingImage}>移除</button>}
                      <small>支援 JPG、PNG、WebP，最大 10MB</small>
                    </div>
                  </div>
                ) : (
                  <label className="image-url-input" htmlFor="card-image-url">
                    <span>圖片連結（HTTPS）</span>
                    <input id="card-image-url" type="url" value={activeCard.image} onChange={(event) => {
                      updateCard("imageBackgroundColor", "");
                      updateCard("image", event.target.value);
                    }} placeholder="https://..." />
                  </label>
                )}
              </div>
              <div className="color-grid">
                {([
                  ["backgroundColor", "卡片底色"],
                  ["titleColor", "標題顏色"],
                  ["descriptionColor", "說明顏色"],
                ] as Array<["backgroundColor" | "titleColor" | "descriptionColor", string]>).map(([key, label]) => (
                  <label key={key} htmlFor={`color-${key}`}><span>{label}</span><span className="color-control"><input id={`color-${key}`} type="color" value={activeCard[key]} onChange={(event) => updateCard(key, event.target.value)} /><code>{activeCard[key]}</code></span></label>
                ))}
              </div>
            </div>
          </section>

          <section className="editor-section">
            <div className="subsection-heading"><div><small>ACTIONS</small><h3>卡片按鈕</h3></div><button type="button" onClick={addButton}>＋ 新增按鈕</button></div>
            <div className="button-list">
              {activeCard.buttons.length === 0 && <p className="empty-note">這張卡片還沒有按鈕。</p>}
              {activeCard.buttons.map((button, index) => (
                <div className="button-editor" key={button.id}>
                  <div className="button-editor-head">
                    <span>按鈕 {index + 1}</span>
                    <div>
                      <button type="button" onClick={() => moveButton(button.id, -1)} disabled={index === 0}>上移</button>
                      <button type="button" onClick={() => moveButton(button.id, 1)} disabled={index === activeCard.buttons.length - 1}>下移</button>
                      <button className="delete-button" type="button" onClick={() => removeButton(button.id)}>刪除</button>
                    </div>
                  </div>
                  <label htmlFor={`button-text-${button.id}`}><span>按鈕文字</span><input id={`button-text-${button.id}`} value={button.text} onChange={(event) => updateButton(button.id, "text", event.target.value)} /></label>
                  <label htmlFor={`button-link-${button.id}`}><span>目標網址</span><input id={`button-link-${button.id}`} value={button.link} onChange={(event) => updateButton(button.id, "link", event.target.value)} /></label>
                  <div className="button-options">
                    <label htmlFor={`button-style-${button.id}`}><span>樣式</span><select id={`button-style-${button.id}`} value={button.style} onChange={(event) => updateButton(button.id, "style", event.target.value as ButtonStyle)}><option value="primary">主按鈕</option><option value="secondary">次按鈕</option><option value="link">文字連結</option></select></label>
                    <label htmlFor={`button-color-${button.id}`}><span>顏色</span><span className="color-control"><input id={`button-color-${button.id}`} type="color" value={button.color} onChange={(event) => updateButton(button.id, "color", event.target.value)} /><code>{button.color}</code></span></label>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="editor-section compact-section">
            <button
              className={`create-card-action ${!compatibilityLink ? "disabled" : ""}`}
              type="button"
              disabled={!compatibilityLink || generatingCard}
              onClick={generateCard}
            >
              <span><small>LINE</small>{generatingCard ? "正在生成…" : account.vip ? "分享卡片" : (account.freeGenerationsRemaining ?? 0) > 0 ? `免費生成 · 剩餘 ${account.freeGenerationsRemaining} 次` : "免費額度已用完 · 開通 VIP"}</span><b>↗</b>
            </button>
          </section>

        </div>

        <aside className="preview-panel">
          <div className="preview-sticky">
            <div className="panel-heading inverse">
              <div><span className="step">02</span><h2>LINE 即時預覽</h2></div>
              <span className="card-count">輸入即更新 · {activeIndex + 1} / {builder.cards.length}</span>
            </div>

            <div className="phone-stage">
              <div className="preview-orbit orbit-one" /><div className="preview-orbit orbit-two" />
              <div className="phone">
                <div className="phone-notch" />
                <div className="phone-header"><span>‹</span><b>{builder.settings.chatName || "LINE"}</b><span>⋯</span></div>
                <div className="chat-time">今天 10:24</div>
                <article className="line-card" style={{ background: activeCard.backgroundColor }}>
                  <div className="card-visual" style={{ aspectRatio: builder.settings.ratio.replace(":", " / "), backgroundColor: activeCard.imageBackgroundColor || activeCard.backgroundColor }}>
                    {activeCard.image && <>
                      <img className="visual-backdrop" key={`${activeCard.image}-backdrop`} src={activeCard.image} alt="" aria-hidden="true" onError={(event) => { event.currentTarget.style.display = "none"; }} />
                      <img className="visual-main" key={activeCard.image} src={activeCard.image} alt="" onLoad={(event) => {
                        event.currentTarget.style.display = "block";
                        try {
                          const color = imageEdgeColor(event.currentTarget);
                          if (color && color !== activeCard.imageBackgroundColor) updateCard("imageBackgroundColor", color);
                        } catch {
                          // Some external sample images don't allow canvas sampling.
                        }
                      }} onError={(event) => { event.currentTarget.style.display = "none"; }} />
                    </>}
                    <div className="visual-fallback"><small>{String(activeIndex + 1).padStart(2, "0")}</small></div>
                  </div>
                  <div className="card-body">
                    <h3 style={{ color: activeCard.titleColor }}>{activeCard.title}</h3>
                    <p style={{ color: activeCard.descriptionColor }}>{activeCard.description}</p>
                    <div className="preview-buttons">
                      {activeCard.buttons.map((button) => <button key={button.id} type="button" style={buttonPreviewStyle(button)}>{button.text}</button>)}
                    </div>
                  </div>
                </article>
                <div className="pager-dots" aria-label="選擇預覽卡片">
                  {builder.cards.map((card) => <button key={card.id} type="button" className={card.id === activeCard.id ? "active" : ""} onClick={() => setActiveCardId(card.id)} aria-label={`預覽第 ${builder.cards.indexOf(card) + 1} 張卡片`} />)}
                </div>
              </div>
            </div>
          </div>
        </aside>
      </section>

      <div className={`toast ${toast ? "show" : ""}`} role="status">{toast}</div>
    </main>
  );
}

