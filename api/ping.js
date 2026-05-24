export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user } = req.body;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const message = `😤 ${user} is restless. Who wants to go somewhere?`;

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message }),
    });

    if (!response.ok) {
      throw new Error('Telegram rejection');
    }

    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
}