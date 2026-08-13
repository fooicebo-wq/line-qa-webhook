// 集思室內設計 — 發文提醒設定儲存（Vercel Blob）
// 讀取：公開 store，直接 fetch 網址（免金鑰）。
// 寫入：需 BLOB_READ_WRITE_TOKEN（存 Vercel 環境變數）。
import { put } from '@vercel/blob';

const TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const BASE = 'https://grkv7jhwjenfyzsh.public.blob.vercel-storage.com';
const CONFIG_PATH = 'remind-config.json';
const STATE_PATH = 'remind-state.json';

// 預設提醒內容與排程（使用者沒自訂前就用這個）
export const DEFAULT_TEXT =
`📸 發文提醒｜集思小編上工囉！

今天是發文日～挑幾張最近的案場美照，用一鍵發文系統發一篇吧！
👉 https://one-click-post-fooice-s-projects.vercel.app

🔍 順手看 SEO：客戶都搜什麼字找到你（把熱門字用進標題，排名更好）
👉 https://search.google.com/search-console

穩定發文 = FB / IG 演算法更愛你 + 部落格 SEO 持續累積 💪`;

// days：1=週一 … 7=週日；time："HH:MM"（台北時間）
export const DEFAULT_CONFIG = { text: DEFAULT_TEXT, days: [1, 4], time: '12:30' };

async function readJson(pathname, fallback) {
  try {
    // 加時間戳＋no-store，避免讀到 CDN 舊快取
    const r = await fetch(`${BASE}/${pathname}?t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return fallback;
    return await r.json();
  } catch {
    return fallback;
  }
}

async function writeJson(pathname, obj) {
  await put(pathname, JSON.stringify(obj), {
    access: 'public',
    token: TOKEN,
    allowOverwrite: true,
    addRandomSuffix: false,
    contentType: 'application/json; charset=utf-8',
    cacheControlMaxAge: 0,
  });
}

export async function getConfig() {
  const c = await readJson(CONFIG_PATH, null);
  // 合併預設，缺欄位時補齊
  return { ...DEFAULT_CONFIG, ...(c || {}) };
}
export const setConfig = (c) => writeJson(CONFIG_PATH, c);

export const getState = () => readJson(STATE_PATH, { lastSent: '' });
export const setState = (s) => writeJson(STATE_PATH, s);
