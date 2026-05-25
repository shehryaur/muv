// /api/status — creator status updates ("leaving in 5", "downstairs", etc.)
// Body: { user, route, status }   status ∈ 'leaving_soon' | 'waiting_downstairs' | 'departed'
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user, route, status } = req.body || {};
  const token  = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  const map = {
    leaving_soon:       `⏳ ${user}: leaving in ~5 for ${route}. last call`,
    waiting_downstairs: `📍 ${user}: downstairs / at the spot for ${route}. come now`,
    departed:           `🏃 ${user} just left for ${route}. catch up if you can`,
    open:               `↩️ ${user} reopened the ${route} run`,
  };
  const message = map[status] || `${user}: status update on ${route}`;

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message }),
    });
    if (!response.ok) throw new Error('Telegram rejection');
    res.status(200).json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
}
