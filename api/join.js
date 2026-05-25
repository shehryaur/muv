// /api/join — quick notification when someone joins a pool
// Body: { user, route, time }
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user, route, time } = req.body || {};
  const token  = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  const lines = [
    `✅ ${user} jumped on the ${route} run (${time})`,
    `✅ ${user} is in — ${route} @ ${time}`,
    `✅ ${user} pulled up for ${route} at ${time}`,
  ];
  const message = lines[Math.floor(Math.random() * lines.length)];

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        disable_notification: true, // joins shouldn't ping everyone
      }),
    });
    if (!response.ok) throw new Error('Telegram rejection');
    res.status(200).json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
}
