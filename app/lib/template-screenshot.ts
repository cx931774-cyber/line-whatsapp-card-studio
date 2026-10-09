import { landingMarkup, type LandingFields } from "./whatsapp-templates";

type ScreenshotWindow = Window & {html2canvas?: (element: HTMLElement, options: Record<string, unknown>) => Promise<HTMLCanvasElement>};
let library: Promise<void> | undefined;
function loadLibrary() {
  return library ||= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "/vendor/html2canvas/html2canvas.min.js";
    script.onload = () => resolve();
    script.onerror = () => { library = undefined; reject(new Error("截图组件加载失败，请重试")); };
    document.head.appendChild(script);
  });
}

export async function screenshotTemplate(card: LandingFields & {title:string;description:string;imageUrl:string;phone:string}) {
  await loadLibrary();
  let background = card.backgroundUrl;
  if (background) {
    const response = await fetch(background, {signal:AbortSignal.timeout(15000),mode:"cors"});
    if (!response.ok) throw new Error("背景图无法读取，请上传背景图后重试");
    const blob = await response.blob();
    if (!blob.type.startsWith("image/") || blob.size > 10 * 1024 * 1024) throw new Error("背景图格式或大小不符合要求");
    background = await new Promise<string>((resolve,reject) => {
      const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(blob);
    });
  }
  const landing = landingMarkup({...card,backgroundUrl:background}, `https://wa.me/${card.phone}`);
  if (!landing) throw new Error("该模板不支持截图");
  const frame = document.createElement("iframe");
  frame.setAttribute("sandbox","allow-same-origin");
  frame.style.cssText="position:fixed;left:-10000px;top:0;width:480px;height:720px;border:0;pointer-events:none";
  const ready = new Promise<void>((resolve,reject)=> {frame.onload=()=>resolve();frame.onerror=()=>reject(new Error("模板加载失败"));});
  frame.srcdoc=`<!doctype html><html><head><meta charset="utf-8"><style>${landing.css}*{animation:none!important;transition:none!important}body{overflow:visible}</style></head><body>${landing.body}</body></html>`;
  document.body.appendChild(frame);
  try {
    await ready;
    const doc=frame.contentDocument!;
    await doc.fonts.ready;
    const target=doc.querySelector<HTMLElement>(".card,.glass") || doc.body;
    const rect=target.getBoundingClientRect();
    // Let the browser lay out text instead of html2canvas approximating font baselines.
    const canvas=await (window as ScreenshotWindow).html2canvas!(target,{foreignObjectRendering:true,backgroundColor:card.templateId==="6"?"#ffffff":"#1a0510",scale:Math.min(2,1200/Math.max(rect.width,rect.height)),useCORS:true,logging:false,windowWidth:480,windowHeight:720});
    let blob:Blob|null=null;
    for(const quality of [.88,.72,.56,.4]) {
      blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,"image/jpeg",quality));
      if(blob && blob.size<=300*1024)break;
    }
    if(!blob || blob.size>300*1024)throw new Error("截图处理失败，请简化背景图片后重试");
    return {blob,width:canvas.width,height:canvas.height};
  } finally {frame.remove();}
}
