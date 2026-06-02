import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // Use GET request so external cron services can ping it easily
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Missing Supabase credentials' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Find all messages where the delete_at time has passed
  const now = new Date().toISOString();
  const { data: messages, error } = await supabase
    .from('auto_delete')
    .select('*')
    .lte('delete_at', now);

  if (error) {
    console.error('Database error:', error);
    return res.status(500).json({ error: error.message });
  }

  if (!messages || messages.length === 0) {
    return res.status(200).json({ success: true, deleted: 0 });
  }

  let deletedCount = 0;

  for (const msg of messages) {
    try {
      const response = await fetch(`https://api.telegram.org/bot${token}/deleteMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: msg.chat_id,
          message_id: msg.message_id
        }),
      });

      // If successful or if Telegram says message is already deleted (400 error)
      // we remove it from our database to prevent infinite loops.
      if (response.ok || response.status === 400) {
        await supabase.from('auto_delete').delete().eq('id', msg.id);
        deletedCount++;
      }
    } catch (err) {
      console.error(`Failed to delete message ${msg.message_id}`, err);
    }
  }

  res.status(200).json({ success: true, deleted: deletedCount });
}