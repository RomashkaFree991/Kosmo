# Kosmo на своём сервере

Одна команда на чистом VPS (Ubuntu 22.04+ / Debian 12+, от root). DNS домена уже должен указывать на IP сервера:

```bash
curl -fsSL https://raw.githubusercontent.com/RomashkaFree991/Kosmo/ccr-c8594e95-6dq4vq/deploy/install.sh | sudo bash -s -- kosmochat.duckdns.org you@mail.com
```

Что ставится и настраивается:
- **Node.js 22** и сервер Kosmo (`/opt/kosmo/server`) под **pm2**, автозапуск после перезагрузки.
- **SQLite**-база: `/var/lib/kosmo/kosmo.db`, файлы (фото, видео, голосовые): `/var/lib/kosmo/media`.
- **nginx** (прокси на 127.0.0.1:3000, WebSocket `/ws`, загрузки до 60 МБ).
- Сертификат **Let's Encrypt** (certbot) с автопродлением, редирект на https.
- **coturn**: TURN для звонков через NAT, временные пароли с общим секретом.
- Порты в ufw (если включён): 80, 443, 3478, 49160–49200/udp.

Повторный запуск команды (или `kosmo update`) обновляет код. База и настройки остаются.

## Коды по SMS
Данные можно передать прямо в команде установки, тогда скрипт ничего не спрашивает:

```bash
curl -fsSL https://raw.githubusercontent.com/RomashkaFree991/Kosmo/ccr-c8594e95-6dq4vq/deploy/install.sh | sudo bash -s -- kosmochat.duckdns.org you@mail.com --tgbot ТОКЕН_БОТА
```

Другие варианты: `--device` (свой Android-телефон, приложение Kosmo SMS), `--phone USER PASS` (sms-gate.app), `--smsru API_ID`, `--telegram TOKEN`, `--twilio SID TOKEN FROM`, `--no-sms`.

Во время установки скрипт спрашивает, как отправлять коды. Поменять позже можно командой `kosmo sms`.

| Вариант | Где взять ключ | Настройка |
|---|---|---|
| **Telegram-бот** (бесплатно) | @BotFather → /newbot → токен. Человек при первом входе жмёт в боте «Поделиться номером», дальше коды приходят туда | `SMS_PROVIDER=tgbot`, `TG_BOT_TOKEN` |
| **Свой телефон — Kosmo SMS** (бесплатно, без сторонних сервисов) | Android с SIM: открыть `https://ваш-домен/kosmo-sms.apk`, установить, ввести домен и ключ из `kosmo sms-key` | `SMS_PROVIDER=device`, `GATEWAY_KEY` |
| SMS Gateway for Android | приложение sms-gate.app, Cloud server, Username/Password | `SMS_PROVIDER=phone`, `SMSGATE_USER`, `SMSGATE_PASS` |
| SMS.ru (РФ/СНГ) | sms.ru → «Программистам» → api_id; пополнить баланс | `SMS_PROVIDER=smsru`, `SMSRU_API_ID` |
| Telegram Gateway | gateway.telegram.org → токен; код приходит в Telegram | `SMS_PROVIDER=telegram`, `TG_GATEWAY_TOKEN` |
| Twilio (весь мир) | twilio.com → Account SID, Auth Token, номер | `SMS_PROVIDER=twilio`, `TWILIO_SID`, `TWILIO_TOKEN`, `TWILIO_FROM` |
| Без SMS | — | `SMS_PROVIDER=log`, коды в `kosmo logs` |

Номера `+000…` (страна «Test numbers») всегда входят с кодом `000000` и SMS не тратят. Отключить их: `TEST_NUMBERS=0` в `/etc/kosmo/kosmo.env`, затем `kosmo restart`.

## Команды
```
kosmo update    обновить код с GitHub
kosmo sms       настроить отправку кодов
kosmo sms-key   ключ и ссылка на приложение Kosmo SMS
kosmo logs      логи сервера
kosmo restart   перезапуск
kosmo status    состояние
```

Резервная копия: `sqlite3 /var/lib/kosmo/kosmo.db ".backup /root/kosmo-backup.db"` и папка `/var/lib/kosmo/media`.

## Локально
```bash
cd server && npm install && node src/index.js   # http://localhost:3000, коды в консоли
```
