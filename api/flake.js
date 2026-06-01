export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { reporter, flaker, route, count, chatId, threadId } = req.body || {};
  if (!chatId) return res.status(400).json({ error: 'Missing routing data' });

  const token = process.env.TELEGRAM_BOT_TOKEN;

  let message = `👻 heads up: ${flaker} no-showed the ${route} run.`;
  if (count >= 3) {
    message += `\n(auto-paused from joining new runs for 7 days)`;
  }

  const payload = {
    chat_id: chatId,
    text: message,
    disable_notification: true,
  };
  if (threadId) payload.message_thread_id = Number(threadId);

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error('Telegram rejection');
    res.status(200).json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
}