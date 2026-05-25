// /api/flake — gentle, non-public flake report notification
// Body: { reporter, flaker, route, count }
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { reporter, flaker, route, count } = req.body || {};
  const token  = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  // Keep it light — naming-and-shaming kills the vibe. The 3-strike auto-restriction
  // is the real enforcement; this message is just so the group knows.
  let message = `👻 heads up: ${flaker} no-showed the ${route} run.`;
  if (count >= 3) {
    message += `\n(auto-paused from joining new runs for 7 days)`;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        disable_notification: true,
      }),
    });
    if (!response.ok) throw new Error('Telegram rejection');
    res.status(200).json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
}
