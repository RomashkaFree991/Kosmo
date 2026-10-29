// Отправка кода подтверждения. Провайдер выбирается в /etc/kosmo/kosmo.env:
//   smsru    — SMS.ru (номера России и СНГ), SMSRU_API_ID
//   twilio   — Twilio (весь мир), TWILIO_SID / TWILIO_TOKEN / TWILIO_FROM
//   telegram — Telegram Gateway (код приходит в Telegram), TG_GATEWAY_TOKEN
//   tgbot    — свой Telegram-бот (бесплатно), TG_BOT_TOKEN
//   device   — свой телефон с приложением Kosmo SMS (бесплатно, без сторонних сервисов), GATEWAY_KEY
//   phone    — свой Android-телефон с SIM (SMS Gateway for Android), SMSGATE_USER / SMSGATE_PASS
//   log      — без отправки: код пишется в логи сервера (pm2 logs kosmo)

import { config } from './config.js';
import { sendViaGateway } from './gateway.js';
import { sendViaBot } from './tgbot.js';

const text = (code) => `Kosmo: ваш код ${code}. Никому его не сообщайте.`;

async function smsru(phone, code) {
  const url = new URL('https://sms.ru/sms/send');
  url.searchParams.set('api_id', config.smsruApiId);
  url.searchParams.set('to', phone.replace(/\D/g, ''));
  url.searchParams.set('msg', text(code));
  url.searchParams.set('json', '1');
  const r = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  const j = await r.json();
  const s = j.sms?.[phone.replace(/\D/g, '')];
  if (j.status !== 'OK' || s?.status !== 'OK') throw new Error(`sms.ru: ${s?.status_text ?? j.status_text ?? 'error'}`);
}

// Телефон отправляет SMS со своей SIM-карты: сервер шлёт запрос в приложение
// (облачный режим через api.sms-gate.app или напрямую http://телефон:8080/message)
async function phoneGateway(phone, code) {
  const r = await fetch(config.smsgateUrl, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.smsgateUser}:${config.smsgatePass}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ textMessage: { text: text(code) }, phoneNumbers: [phone], ttl: 300 }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!r.ok) throw new Error(`sms gateway: ${r.status} ${(await r.text().catch(() => '')).slice(0, 200)}`);
}

async function twilio(phone, code) {
  const body = new URLSearchParams({ To: phone, From: config.twilioFrom, Body: text(code) });
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${config.twilioSid}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: `Basic ${Buffer.from(`${config.twilioSid}:${config.twilioToken}`).toString('base64')}` },
    body,
    signal: AbortSignal.timeout(10_000),
  });
  if (!r.ok) throw new Error(`twilio: ${(await r.json().catch(() => ({}))).message ?? r.status}`);
}

async function telegram(phone, code) {
  const r = await fetch('https://gatewayapi.telegram.org/sendVerificationMessage', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.telegramGatewayToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone_number: phone, code, ttl: 300 }),
    signal: AbortSignal.timeout(10_000),
  });
  const j = await r.json().catch(() => ({}));
  if (!j.ok) throw new Error(`telegram gateway: ${j.error ?? r.status}`);
}

export async function sendCode(phone, code) {
  switch (config.smsProvider) {
    case 'tgbot': return sendViaBot(phone, text(code));
    case 'device': return sendViaGateway(phone, text(code));
    case 'phone': return phoneGateway(phone, code);
    case 'smsru': return smsru(phone, code);
    case 'twilio': return twilio(phone, code);
    case 'telegram': return telegram(phone, code);
    default:
      console.log(`[code] ${phone}: ${code}`);
      return undefined;
  }
}

export const smsChannel = () => (config.smsProvider === 'tgbot' ? 'tgbot' : config.smsProvider === 'telegram' ? 'telegram' : config.smsProvider === 'log' ? 'log' : 'sms');
