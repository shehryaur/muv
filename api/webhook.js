export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const update = req.body;

  if (update.message && update.message.text) {
    const messageText = update.message.text.trim().toLowerCase();
    
    if (messageText === 'muv') {
      const chatId = update.message.chat.id;
      const botToken = process.env.TELEGRAM_BOT_TOKEN;
      const appUrl = process.env.VITE_APP_URL; 

      const payload = {
        chat_id: chatId,
        text: "🚀 Pull up to the current outings.",
        reply_markup: {
          inline_keyboard: [[
            { text: "👉 Open MUV", web_app: { url: appUrl } }
          ]]
        }
      };

      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }
  }

  res.status(200).send('OK');
}