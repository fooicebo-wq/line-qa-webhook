// 集思室內設計 — 主動推播提醒（推給老闆本人，例如「該發文了」）
// 兩種模式：
//   ?key=RW  &mode=scheduled  → 由 GitHub Actions 每 30 分呼叫，程式自己判斷「今天、到點了、還沒發過」才推播
//   ?key=RW                   → 立即強制推播（手動測試用），可加 &text= 覆蓋內容
import { getConfig, getState, setState } from '../lib/store.js';

const LINE_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const REMIND_KEY = process.env.REMIND_KEY;       // 保護端點
const BOSS_USER_ID = process.env.BOSS_USER_ID;   // 老闆本人的 LINE userId

const WINDOW_MIN = 180; // 到點後 3 小時內都可補發（防 GitHub 排程延遲/漏跑）

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

// 取得台北時間：日期字串、星期(1=一..7=日)、當日分鐘數
function taipeiNow() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit',
    weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t)?.value;
  const wd = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
  const hour = parseInt(get('hour'), 10) % 24;   // 午夜可能回 24，取模歸零
  const minute = parseInt(get('minute'), 10);
  return {
    dateStr: `${get('year')}-${get('month')}-${get('day')}`,
    weekday: wd[get('weekday')],
    minutes: hour * 60 + minute,
  };
}

export default async function handler(req, res) {
  const url = new URL(req.url, 'https://x');
  const qKey = (req.query?.key ?? url.searchParams.get('key') ?? '').trim();
  const envKey = (REMIND_KEY ?? '').trim();
  const mode = req.query?.mode ?? url.searchParams.get('mode');

  if (!envKey || qKey !== envKey) {
    return res.status(403).json({ error: 'forbidden' });
  }
  if (!LINE_TOKEN || !BOSS_USER_ID) {
    return res.status(500).json({ error: 'missing LINE_CHANNEL_ACCESS_TOKEN or BOSS_USER_ID' });
  }

  try {
    const cfg = await getConfig();

    // ── 排程模式：自己判斷該不該發 ──
    if (mode === 'scheduled') {
      const st = await getState();
      const now = taipeiNow();
      const [h, m] = String(cfg.time || '12:30').split(':').map((x) => parseInt(x, 10));
      const schedMin = (h || 0) * 60 + (m || 0);
      const isDay = Array.isArray(cfg.days) && cfg.days.includes(now.weekday);
      const inWindow = now.minutes >= schedMin && now.minutes < schedMin + WINDOW_MIN;
      const notSentToday = st.lastSent !== now.dateStr;

      if (!(isDay && inWindow && notSentToday)) {
        return res.status(200).json({
          ok: true, sent: false, reason: 'not-scheduled-now',
          now, schedule: { days: cfg.days, time: cfg.time }, lastSent: st.lastSent,
        });
      }
      const r = await pushToLine(BOSS_USER_ID, [{ type: 'text', text: cfg.text }]);
      const body = await r.text();
      if (r.ok) await setState({ lastSent: now.dateStr, lastSentAt: new Date().toISOString() });
      return res.status(r.ok ? 200 : 502).json({ ok: r.ok, sent: r.ok, line_status: r.status, line_body: body });
    }

    // ── 手動模式：立即強制推播（可用 ?text= 覆蓋）──
    const text = (req.query?.text && String(req.query.text)) || cfg.text;
    const r = await pushToLine(BOSS_USER_ID, [{ type: 'text', text }]);
    const body = await r.text();
    return res.status(r.ok ? 200 : 502).json({ ok: r.ok, sent: r.ok, line_status: r.status, line_body: body });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}
