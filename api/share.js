import { createClient } from '@supabase/supabase-js';

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
  
  const tripLabel = ({
    walk:  'Walk',
    train: 'Train',
    taxi:  'Taxi',
    drive: 'Drive',
  })[pool.trip_type] || 'Move';

  const departsDate = new Date(pool.departs_at);
  const isTomorrow = departsDate.getDate() !== new Date().getDate();
  const dayStr = isTomorrow ? 'tomorrow' : 'today';

  const message = `${userName} → ${pool.route}\nvia ${tripLabel} at ${pool.time} ${dayStr}`;

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

    const responseData = await response.json();
    const messageId = responseData.result.message_id;

    // Set deletion for 1 hour after the outing departs
    const deleteAt = new Date(departsDate.getTime() + 60 * 60 * 1000).toISOString();

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