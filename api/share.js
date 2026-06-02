export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { pool, chatId, threadId } = req.body || {};
  if (!pool) return res.status(400).json({ error: 'Missing pool' });
  if (!chatId) return res.status(400).json({ error: 'Missing routing data' });

  const token       = process.env.TELEGRAM_BOT_TOKEN;
  const botUsername = process.env.TELEGRAM_BOT_USERNAME;
  const appShort    = process.env.TELEGRAM_APP_SHORTNAME;

  const userName = pool.creator_name || pool.driver || 'Someone';
  const message = `${userName} → ${pool.route}\nLet's join!`;

  const deepLink = (botUsername && appShort)
    ? `https://t.me/${botUsername}/${appShort}?startapp=pool_${pool.id}`
    : null;

  const reply_markup = deepLink
    ? { inline_keyboard: [[{ text: '🚀 Join in MUV', url: deepLink }]] }
    : undefined;

  const payload = {
    chat_id: chatId,
    text: message,
    reply_markup,
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