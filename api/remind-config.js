// 集思室內設計 — 發文提醒設定的讀／寫 API（給 remind-edit.html 編輯頁用）
//   GET                     → 回傳目前設定（內容／星期／時間）＋預設值供參考
//   POST {pw, text, days, time}  → 驗證密碼後儲存設定
//   POST {pw, action:'reset'}    → 還原成預設內容與排程
import { getConfig, setConfig, DEFAULT_CONFIG } from '../lib/store.js';

const EDIT_PASSWORD = process.env.EDIT_PASSWORD; // 編輯頁密碼

export default async function handler(req, res) {
  // GET：讀出目前設定（不需密碼；內容非機密）
  if (req.method === 'GET') {
    try {
      const cfg = await getConfig();
      return res.status(200).json({ ok: true, config: cfg, default: DEFAULT_CONFIG });
    } catch (err) {
      return res.status(500).json({ ok: false, error: String(err) });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'method not allowed' });
  }

  // POST：需密碼
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  body = body || {};

  if (!EDIT_PASSWORD || String(body.pw || '') !== String(EDIT_PASSWORD)) {
    return res.status(403).json({ ok: false, error: '密碼錯誤' });
  }

  try {
    if (body.action === 'reset') {
      await setConfig(DEFAULT_CONFIG);
      return res.status(200).json({ ok: true, config: DEFAULT_CONFIG, reset: true });
    }

    // 清洗輸入
    const text = String(body.text ?? '').trim();
    let days = Array.isArray(body.days) ? body.days.map((n) => parseInt(n, 10)).filter((n) => n >= 1 && n <= 7) : [];
    days = [...new Set(days)].sort((a, b) => a - b);
    const time = /^\d{1,2}:\d{2}$/.test(String(body.time || '')) ? String(body.time) : '';

    if (!text) return res.status(400).json({ ok: false, error: '提醒內容不可空白' });
    if (!days.length) return res.status(400).json({ ok: false, error: '請至少選一個提醒星期' });
    if (!time) return res.status(400).json({ ok: false, error: '時間格式需為 HH:MM' });

    const config = { text, days, time };
    await setConfig(config);
    return res.status(200).json({ ok: true, config });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
}
