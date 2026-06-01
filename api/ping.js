export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user, chatId, threadId } = req.body;
  if (!chatId) return res.status(400).json({ error: 'Missing routing data' });

  const token = process.env.TELEGRAM_BOT_TOKEN;

  const lines = [
    `yo — ${user} is bored. anyone wanna move?`,
    `${user}: stir crazy 😩 who's down to go somewhere?`,
    `${user} needs out of the room. anyone? 👀`,
    `${user} is restless… coffee/conbini/anywhere?`,
    `pulling up SOS from ${user} — who's free rn?`,
  ];
  const message = lines[Math.floor(Math.random() * lines.length)];

  const payload = {
    chat_id: chatId,
    text: message,
    disable_notification: false,
  };
  if (threadId) payload.message_thread_id = threadId;

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