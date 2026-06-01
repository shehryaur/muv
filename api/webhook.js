export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const update = req.body;
  console.log('Received update:', JSON.stringify(update, null, 2));

  if (update.message && update.message.text) {
    const messageText = update.message.text.trim().toLowerCase();
    
    if (messageText === 'muv') {
      const chatId = update.message.chat.id;
      const threadId = update.message.message_thread_id;
      const botToken = process.env.TELEGRAM_BOT_TOKEN;

      const safeChatId = String(chatId).replace('-', 'm');
      
      let startAppString = `c_${safeChatId}`;
      if (threadId) {
        startAppString += `_t_${threadId}`;
      }

      const appUrl = `https://t.me/muv_together_bot/muv?startapp=${startAppString}`;

      const payload = {
        chat_id: chatId,
        text: "🚀 Pull up to the current outings.",
        reply_markup: {
          inline_keyboard: [[
            { text: "👉 Open MUV", url: appUrl }
          ]]
        }
      };

      if (threadId) {
        payload.message_thread_id = threadId;
      }

      console.log('Sending payload:', JSON.stringify(payload, null, 2));

      try {
        const telegramResponse = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const responseData = await telegramResponse.json();
        console.log('Telegram API response:', JSON.stringify(responseData, null, 2));
        
      } catch (error) {
        console.error('Fetch error:', error);
      }
    } else {
      console.log('Message was not "muv". Received:', messageText);
    }
  }

  res.status(200).send('OK');
}