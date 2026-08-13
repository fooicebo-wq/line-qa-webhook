// 集思室內設計 — 主動推播提醒（推給老闆本人，例如「該發文了」）
// 由雲端排程定時 GET 觸發：/api/remind?key=你的密鑰
// 金鑰與推播對象都放 Vercel 環境變數，不寫在公開原始碼裡。

const LINE_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const REMIND_KEY = process.env.REMIND_KEY;      // 保護端點，避免被亂觸發
const BOSS_USER_ID = process.env.BOSS_USER_ID;  // 老闆本人的 LINE userId

// 預設的發文提醒內容（可用 ?text= 覆蓋，方便日後做其他提醒）
const REMIND_TEXT =
`📸 發文提醒｜集思小編上工囉！

今天是發文日～挑幾張最近的案場美照，用一鍵發文系統發一篇吧！
👉 https://one-click-post-fooice-s-projects.vercel.app

🔍 順手看 SEO：客戶都搜什麼字找到你（把熱門字用進標題，排名更好）
👉 https://search.google.com/search-console

穩定發文 = FB / IG 演算法更愛你 + 部落格 SEO 持續累積 💪
（每週一、四中午提醒你；不想收到再跟 AI 說一聲就能關）`;

async function pushToLine(to, messages) {
  return fetch('https://api.line.me/v2/bot/message/push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LINE_TOKEN}`,
    },
    body: JSON.stringify({ to, messages }),
  });
}

export default async function handler(req, res) {
  // 穩健取得 query 參數（避免 req.query 未解析的情況）
  const url = new URL(req.url, 'https://x');
  const qKey = (req.query?.key ?? url.searchParams.get('key') ?? '').trim();
  const envKey = (REMIND_KEY ?? '').trim();

  // 需帶正確密鑰才放行，避免端點被亂打
  if (!envKey || qKey !== envKey) {
    return res.status(403).json({ error: 'forbidden' });
  }
  if (!LINE_TOKEN || !BOSS_USER_ID) {
    return res.status(500).json({ error: 'missing LINE_CHANNEL_ACCESS_TOKEN or BOSS_USER_ID' });
  }

  const text = (req.query?.text && String(req.query.text)) || REMIND_TEXT;
  try {
    const r = await pushToLine(BOSS_USER_ID, [{ type: 'text', text }]);
    const body = await r.text();
    return res.status(r.ok ? 200 : 502).json({ ok: r.ok, line_status: r.status, line_body: body });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}
