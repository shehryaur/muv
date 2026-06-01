export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user, active, chatId, threadId } = req.body;
  if (!chatId) return res.status(400).json({ error: 'Missing routing data' });

  const token = process.env.TELEGRAM_BOT_TOKEN;

  const onLines = [
    `📍 ${user} is in the lobby - pull up if you're going anywhere`,
    `📍 ${user} downstairs, ready to roll. someone come grab them`,
    `📍 ${user}: in lobby, will join literally any outing rn`,
  ];
  const offLines = [
    `${user} bounced from the lobby.`,
    `${user} headed back up.`,
    `${user} is no longer in lobby.`,
  ];

  const message = active
    ? onLines[Math.floor(Math.random() * onLines.length)]
    : offLines[Math.floor(Math.random() * offLines.length)];

  const payload = {
    chat_id: chatId,
    text: message,
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