import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { user, route, status, chatId, threadId } = req.body || {};
  if (!chatId) return res.status(400).json({ error: 'Missing routing data' });

  const token = process.env.TELEGRAM_BOT_TOKEN;

  const map = {
    leaving_soon:       `⏳ ${user}: leaving in ~5 for ${route}. last call`,
    waiting_downstairs: `📍 ${user}: downstairs / at the spot for ${route}. come now`,
    departed:           `🏃 ${user} just left for ${route}. catch up if you can`,
    open:               `↩️ ${user} reopened the ${route} run`,
  };
  const message = map[status] || `${user}: status update on ${route}`;

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

    const responseData = await response.json();
    const messageId = responseData.result.message_id;

    const deleteAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    await supabase.from('auto_delete').insert({
      chat_id: String(chatId),
      message_id: messageId,
      delete_at: deleteAt
    });

    res.status(200).json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
}