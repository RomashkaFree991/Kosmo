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

## Вход по почте
Коды входа, сброса код-пароля и смены почты приходят на почту. Отправляет их **сам сервер**, без сторонних сервисов: письмо уходит прямо на почтовый сервер получателя (порт 25) и подписывается ключом DKIM.

```bash
curl -fsSL https://raw.githubusercontent.com/RomashkaFree991/Kosmo/ccr-c8594e95-6dq4vq/deploy/install.sh | sudo bash -s -- kosmochat.duckdns.org you@mail.com --duckdns ТОКЕН_DUCKDNS
```

- `--duckdns ТОКЕН` записывает публичный ключ DKIM в TXT-запись домена DuckDNS (токен — вверху страницы duckdns.org). С подписью Gmail и Яндекс реже отправляют письма в «Спам».
- Если хостинг закрыл исходящий порт 25 (установщик это проверяет), письма напрямую не уйдут. Тогда либо попросите поддержку открыть порт, либо отправляйте через свой ящик: `--smtp 'smtps://you%40gmail.com:ПАРОЛЬ_ПРИЛОЖЕНИЯ@smtp.gmail.com'`.
- Совет: в панели VPS задайте обратную запись (rDNS/PTR) для IP сервера = ваш домен.
- Проверка: `kosmo mail-test ваш@адрес`.
- `--test` — адреса `…@kosmo.test` входят с кодом `000000` (только для проверки).

Забыли код-пароль: на экране код-пароля «Forgot passcode?» → код на почту → новый код-пароль. Все остальные сеансы завершаются, на почту приходит уведомление.

Номера телефонов пока не используются; отправка SMS-кодов сохранена в коде на будущее (`kosmo sms`).

## Команды
```
kosmo update    обновить код с GitHub
kosmo mail-test адрес   пробное письмо с кодом
kosmo sms       настроить SMS (на будущее)
kosmo sms-key   ключ и ссылка на приложение Kosmo SMS
kosmo logs      логи сервера
kosmo restart   перезапуск
kosmo status    состояние
```

## Шифрование на сервере
Переписка, посты и истории хранятся в базе зашифрованными (AES-256-GCM), файлы в `/var/lib/kosmo/media` — тоже (AES-256-CTR). Ключ — `/var/lib/kosmo/data.key`, создаётся сам при первом запуске. Устройствам ничего настраивать не нужно.

Резервная копия: `sqlite3 /var/lib/kosmo/kosmo.db ".backup /root/kosmo-backup.db"`, папка `/var/lib/kosmo/media` **и файл `/var/lib/kosmo/data.key`** — без ключа копия не читается.

## Локально
```bash
cd server && npm install && node src/index.js   # http://localhost:3000, коды в консоли
```
