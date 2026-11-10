// Коды через своего Telegram-бота: бесплатно, бот создаётся за минуту в @BotFather.
// Человек один раз делится номером кнопкой в боте (Telegram сам подтверждает,
// что номер его), дальше коды Kosmo приходят ему в этот чат.

import { config } from './config.js';
import { sql } from './db.js';

sql.exec('CREATE TABLE IF NOT EXISTS tg_links (phone TEXT PRIMARY KEY, chat_id INTEGER NOT NULL, linked_at INTEGER NOT NULL)');

const waiting = new Map();   // номер → код, который ждёт привязки чата
export let botName = '';

const plusDigits = (p) => `+${String(p).replace(/\D/g, '')}`;

async function call(method, body = {}, timeout = 15_000) {
  const r = await fetch(`${config.tgApi}/bot${config.tgBotToken}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeout),
  });
  const j = await r.json().catch(() => ({}));
  if (!j.ok) throw new Error(`telegram: ${j.description ?? r.status}`);
  return j.result;
}

export async function sendViaBot(phone, text) {
  const row = sql.prepare('SELECT chat_id FROM tg_links WHERE phone = ?').get(phone);
  if (row) {
    try {
      await call('sendMessage', { chat_id: row.chat_id, text });
      return { bot: botName, linked: true };
    } catch (e) {
      // бота заблокировали или удалили чат — попросим привязать заново
      if (!/blocked|not found|deactivated/i.test(e.message)) throw e;
      sql.prepare('DELETE FROM tg_links WHERE phone = ?').run(phone);
    }
  }
  if (!botName) throw new Error('telegram bot is not ready');
  waiting.set(phone, { text, expires: Date.now() + 5 * 60_000 });
  return { bot: botName, linked: false };
}

const askContact = (chatId) => call('sendMessage', {
  chat_id: chatId,
  text: 'Это бот входа в Kosmo. Нажмите кнопку ниже, чтобы подтвердить свой номер, — коды входа будут приходить сюда.',
  reply_markup: { keyboard: [[{ text: '📱 Поделиться номером', request_contact: true }]], resize_keyboard: true, one_time_keyboard: true },
});

async function onMessage(m) {
  if (m.chat?.type !== 'private') return;
  if (!m.contact) return askContact(m.chat.id);
  // номер должен быть свой, а не пересланный чужой контакт
  if (m.contact.user_id !== m.from.id) return askContact(m.chat.id);
  const phone = plusDigits(m.contact.phone_number);
  sql.prepare('INSERT OR REPLACE INTO tg_links (phone, chat_id, linked_at) VALUES (?, ?, ?)').run(phone, m.chat.id, Date.now());
  await call('sendMessage', {
    chat_id: m.chat.id,
    text: `Номер ${phone} подтверждён ✅\nКоды входа Kosmo будут приходить в этот чат.`,
    reply_markup: { remove_keyboard: true },
  });
  const w = waiting.get(phone);
  waiting.delete(phone);
  if (w && w.expires > Date.now()) await call('sendMessage', { chat_id: m.chat.id, text: w.text });
}

// Long polling: вебхук и открытые порты не нужны
export async function startBot() {
  if (!config.tgBotToken) { console.error('[tgbot] TG_BOT_TOKEN is empty'); return; }
  let offset = 0;
  for (;;) {
    try {
      if (!botName) {
        botName = (await call('getMe')).username;
        await call('deleteWebhook');
        console.log(`[tgbot] @${botName} is running`);
      }
      const updates = await call('getUpdates', { offset, timeout: 50, allowed_updates: ['message'] }, 65_000);
      for (const u of updates) {
        offset = u.update_id + 1;
        if (u.message) await onMessage(u.message).catch((e) => console.error('[tgbot]', e.message));
      }
      const now = Date.now();
      for (const [k, w] of waiting) if (w.expires < now) waiting.delete(k);
    } catch (e) {
      console.error('[tgbot]', e.message);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}
