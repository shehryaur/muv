// /api/share — push a clean preview card of a pool into the TG group chat
//
// Body: { pool: { id, route, time, emoji, trip_type, available_seats, capacity,
//                 creator_name, is_courier, description, payment_link, cost_total } }
//
// Sends a nicely formatted message + a "Join in MUV" inline button that
// deep-links back into your Mini App.
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { pool } = req.body || {};
  if (!pool) return res.status(400).json({ error: 'Missing pool' });

  const token       = process.env.TELEGRAM_BOT_TOKEN;
  const chatId      = process.env.TELEGRAM_CHAT_ID;
  // Set this to your bot's @username and Mini App short name in Vercel env
  const botUsername = process.env.TELEGRAM_BOT_USERNAME;     // e.g. "muv_bot"
  const appShort    = process.env.TELEGRAM_APP_SHORTNAME;    // e.g. "muv"

  const tripLabel = ({
    walk:  '🚶 Walk',
    train: '🚆 Train',
    taxi:  '🚕 Taxi split',
    drive: '🚗 Drive',
  })[pool.trip_type] || '📍 Move';

  const seatsLeft = pool.available_seats ?? 0;
  const cap       = pool.capacity ?? 4;

  const lines = [
    `${pool.emoji || '📍'} *New ${pool.is_courier ? 'courier run' : 'outing'}*`,
    ``,
    `*${pool.route}*`,
    `${tripLabel}  •  🕒 ${pool.time}`,
    `Seats: ${cap - seatsLeft}/${cap}  •  by ${pool.creator_name || pool.driver || 'someone'}`,
  ];
  if (pool.description)  lines.push(`_${pool.description}_`);
  if (pool.is_courier && pool.courier_items) lines.push(`📦 ${pool.courier_items}`);
  if (pool.cost_total)   lines.push(`💴 ~¥${pool.cost_total} total${pool.payment_link ? ` • split: ${pool.payment_link}` : ''}`);

  const message = lines.join('\n');

  const deepLink = (botUsername && appShort)
    ? `https://t.me/${botUsername}/${appShort}?startapp=pool_${pool.id}`
    : null;

  const reply_markup = deepLink
    ? { inline_keyboard: [[{ text: '🚀 Join in MUV', url: deepLink }]] }
    : undefined;

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id:    chatId,
        text:       message,
        parse_mode: 'Markdown',
        reply_markup,
      }),
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error('Telegram rejection: ' + errText);
    }
    res.status(200).json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
}
