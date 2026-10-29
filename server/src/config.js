// Настройки из переменных окружения (/etc/kosmo/kosmo.env на сервере)
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const env = process.env;

export const config = {
  port: Number(env.PORT ?? 3000),
  host: env.HOST ?? '127.0.0.1',
  dataDir: env.DATA_DIR ?? path.join(root, 'data'),
  webDir: env.WEB_DIR ?? path.join(root, 'web'),
  publicUrl: env.PUBLIC_URL ?? 'http://localhost:3000',
  // SMS: tgbot | device | phone | smsru | twilio | telegram | log
  smsProvider: (env.SMS_PROVIDER ?? 'log').toLowerCase(),
  smsruApiId: env.SMSRU_API_ID ?? '',
  twilioSid: env.TWILIO_SID ?? '',
  twilioToken: env.TWILIO_TOKEN ?? '',
  twilioFrom: env.TWILIO_FROM ?? '',
  telegramGatewayToken: env.TG_GATEWAY_TOKEN ?? '',
  // свой Telegram-бот (@BotFather): коды приходят в Telegram, бесплатно
  tgBotToken: env.TG_BOT_TOKEN ?? '',
  tgApi: env.TG_API ?? 'https://api.telegram.org',
  // свой SMS-шлюз: телефон с приложением Kosmo SMS подключается с этим ключом
  gatewayKey: env.GATEWAY_KEY ?? '',
  // сторонний вариант: приложение SMS Gateway for Android (sms-gate.app)
  smsgateUrl: env.SMSGATE_URL || 'https://api.sms-gate.app/3rdparty/v1/message',
  smsgateUser: env.SMSGATE_USER ?? '',
  smsgatePass: env.SMSGATE_PASS ?? '',
  // номера +000… для тестов: код всегда 000000
  testNumbers: (env.TEST_NUMBERS ?? '1') === '1',
  // звонки: STUN Google + свой TURN (coturn) с общим секретом
  turnHost: env.TURN_HOST ?? '',
  turnSecret: env.TURN_SECRET ?? '',
  maxUpload: Number(env.MAX_UPLOAD_MB ?? 50) * 1024 * 1024,
  // через nginx: настоящий IP клиента в X-Forwarded-For
  trustProxy: (env.TRUST_PROXY ?? '1') === '1',
};
