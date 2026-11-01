// Письма с кодами — своим сервером, без сторонних сервисов: письмо уходит
// напрямую на почтовый сервер получателя (MX, порт 25) и подписывается DKIM.
// MAIL_MODE: direct (по умолчанию) | smtp (SMTP_URL, например свой Gmail) | log

import dns from 'node:dns/promises';
import fs from 'node:fs';
import crypto from 'node:crypto';
import nodemailer from 'nodemailer';
import { config } from './config.js';

const domain = () => config.mailDomain || new URL(config.publicUrl).hostname;
// Через свой ящик (SMTP_URL) письмо идёт от имени этого ящика — иначе Gmail/Яндекс
// подменят отправителя или отправят письмо в спам
function smtpUser() {
  try { return decodeURIComponent(new URL(config.smtpUrl).username); } catch { return ''; }
}
const from = () => config.mailFrom
  || (config.mailMode === 'smtp' && smtpUser().includes('@') ? `Kosmo <${smtpUser()}>` : `Kosmo <no-reply@${domain()}>`);

let dkimKey = null;
function dkim() {
  if (dkimKey === null) {
    try { dkimKey = config.dkimKeyFile ? fs.readFileSync(config.dkimKeyFile, 'utf8') : ''; } catch { dkimKey = ''; }
  }
  return dkimKey ? { domainName: domain(), keySelector: config.dkimSelector, privateKey: dkimKey } : undefined;
}

let relay = null;
const relayTransport = () => (relay ??= nodemailer.createTransport(config.smtpUrl));

// Почтовые серверы домена получателя по приоритету (нет MX — сам домен)
async function mxHosts(to) {
  if (config.mailDirectHost) return [config.mailDirectHost];
  const host = to.split('@')[1];
  try {
    const mx = await dns.resolveMx(host);
    if (mx.length) return mx.sort((a, b) => a.priority - b.priority).map((m) => m.exchange);
  } catch { /* нет MX */ }
  return [host];
}

async function direct(msg) {
  let last = null;
  for (const host of await mxHosts(msg.to)) {
    const t = nodemailer.createTransport({
      host, port: config.mailDirectPort, secure: false, name: domain(),
      tls: { rejectUnauthorized: false },     // STARTTLS по возможности
      connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000,
      dkim: dkim(),
    });
    try { return await t.sendMail(msg); } catch (e) { last = e; }
  }
  throw last ?? new Error('no mail server');
}

export async function sendMail({ to, subject, text, html }) {
  const msg = {
    from: from(), to, subject, text, html,
    messageId: `<${crypto.randomUUID()}@${config.mailMode === 'smtp' ? (smtpUser().split('@')[1] || domain()) : domain()}>`,
    // служебное письмо: без автоответов «я в отпуске»
    headers: { 'Auto-Submitted': 'auto-generated', 'X-Auto-Response-Suppress': 'All' },
  };
  if (config.mailMode === 'log') {
    console.log(`[mail] ${to}: ${subject}\n${text}`);
    return;
  }
  if (config.mailMode === 'smtp') {
    await relayTransport().sendMail(msg);   // подпись ставит почтовый сервис ящика
    return;
  }
  await direct(msg);
}

/* ---------- Письма Kosmo ---------- */
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function layout(title, lead, code, foot) {
  return `<!doctype html><html><body style="margin:0;background:#0b0b0f;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px">
<table width="100%" style="max-width:440px;background:#16161c;border-radius:24px" cellpadding="0" cellspacing="0"><tr><td style="padding:36px 32px;color:#fff">
<div style="font-size:22px;font-weight:700;letter-spacing:-.3px">Kosmo</div>
<h1 style="font-size:20px;margin:24px 0 8px">${esc(title)}</h1>
<p style="margin:0 0 24px;color:#b4b4c0;font-size:15px;line-height:1.5">${esc(lead)}</p>
${code ? `<div style="font-size:36px;font-weight:700;letter-spacing:10px;background:#23232c;border-radius:16px;padding:18px 0;text-align:center">${esc(code)}</div>` : ''}
<p style="margin:24px 0 0;color:#7c7c8a;font-size:13px;line-height:1.5">${esc(foot)}</p>
</td></tr></table></td></tr></table></body></html>`;
}

const PURPOSE = {
  login: ['Код для входа', 'Введите этот код в Kosmo, чтобы войти или зарегистрироваться.'],
  reset: ['Сброс код-пароля', 'Кто-то (надеемся, вы) сбрасывает код-пароль аккаунта Kosmo. Введите код, чтобы задать новый.'],
  'email-old': ['Смена почты', 'Подтвердите, что хотите сменить почту аккаунта Kosmo.'],
  'email-new': ['Новая почта', 'Подтвердите новую почту для аккаунта Kosmo.'],
};

export function codeMail(to, code, purpose) {
  const [title, lead] = PURPOSE[purpose.split(':')[0]] ?? PURPOSE.login;
  const foot = 'Код действует 5 минут. Никому его не сообщайте — сотрудники Kosmo никогда его не спрашивают. Если это были не вы, просто проигнорируйте письмо.';
  return sendMail({
    to,
    subject: `${code} — ${title.toLowerCase()} Kosmo`,
    text: `${title}\n\n${lead}\n\nКод: ${code}\n\n${foot}`,
    html: layout(title, lead, code, foot),
  });
}

export function noticeMail(to, title, lead) {
  const foot = 'Если это были не вы — сбросьте код-пароль и завершите чужие сеансы в Kosmo.';
  return sendMail({ to, subject: `${title} — Kosmo`, text: `${title}\n\n${lead}\n\n${foot}`, html: layout(title, lead, '', foot) });
}

/* ---------- Диагностика для kosmo mail-test ---------- */
// Проверяет то, от чего зависит «Входящие» vs «Спам»: подпись DKIM в DNS,
// обратная запись IP (PTR) и открыт ли порт 25.
export async function diagnose() {
  const d = domain();
  const out = [];
  if (config.mailMode === 'smtp') {
    out.push(`Режим: через ящик ${smtpUser() || '(SMTP_URL)'} — подпись и репутация этого почтового сервиса.`);
    return out;
  }
  const key = dkim();
  if (!key) out.push('✗ DKIM: ключ не найден (DKIM_KEY_FILE)');
  else {
    const pub = crypto.createPublicKey(key.privateKey).export({ type: 'spki', format: 'der' }).toString('base64');
    let txt = '';
    try { txt = (await dns.resolveTxt(`${config.dkimSelector}._domainkey.${d}`)).map((r) => r.join('')).join(' '); } catch { /* нет записи */ }
    out.push(txt.includes(pub) ? '✓ DKIM: публичный ключ опубликован в DNS — подпись проверяется'
      : `✗ DKIM: в DNS нет ключа для ${config.dkimSelector}._domainkey.${d} — письма уходят без подписи (запустите установку с --duckdns ТОКЕН)`);
  }
  try {
    const [ip] = await dns.resolve4(d);
    const ptr = await dns.reverse(ip).catch(() => []);
    out.push(ptr.includes(d) ? `✓ PTR: ${ip} → ${d}` : `✗ PTR: у ${ip} обратная запись ${ptr[0] ?? 'не задана'} — в панели VPS укажите rDNS = ${d}`);
  } catch { out.push(`✗ Домен ${d} не находится в DNS`); }
  return out;
}
