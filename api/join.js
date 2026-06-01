export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user, route, time, chatId, threadId } = req.body || {};
  if (!chatId) return res.status(400).json({ error: 'Missing routing data' });

  const token = process.env.TELEGRAM_BOT_TOKEN;

  const lines = [
    `✅ ${user} jumped on the ${route} run (${time})`,
    `✅ ${user} is in - ${route} @ ${time}`,
    `✅ ${user} pulled up for ${route} at ${time}`,
  ];
  const message = lines[Math.floor(Math.random() * lines.length)];

  const payload = {
    chat_id: chatId,
    text: message,
    disable_notification: true,
  };
  
  if (threadId) {
    payload.message_thread_id = Number(threadId);
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      const errText = await response.text();
      console.error('TELEGRAM API ERROR:', errText);
      throw new Error('Telegram rejection');
    }
    res.status(200).json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
}