#!/usr/bin/env bash
# Kosmo: установка на VPS одной командой (Ubuntu 22.04+/Debian 12+).
#   curl -fsSL https://raw.githubusercontent.com/RomashkaFree991/Kosmo/ccr-c8594e95-6dq4vq/deploy/install.sh | sudo bash -s -- kosmochat.duckdns.org you@mail.com
# Ставит Node 22, pm2, nginx, сертификат Let's Encrypt, coturn (звонки),
# сервер Kosmo с базой SQLite в /var/lib/kosmo. Повторный запуск обновляет код,
# настройки и база сохраняются.
set -euo pipefail

DOMAIN="${1:-${DOMAIN:-}}"
EMAIL="${2:-${EMAIL:-}}"
REPO="${REPO:-https://github.com/RomashkaFree991/Kosmo.git}"
BRANCH="${BRANCH:-ccr-c8594e95-6dq4vq}"
APP_DIR=/opt/kosmo
DATA_DIR=/var/lib/kosmo
ENV_DIR=/etc/kosmo
ENV_FILE="$ENV_DIR/kosmo.env"
PORT=3000

say()  { printf '\n\033[1;35m▸ %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m! %s\033[0m\n' "$*"; }
die()  { printf '\033[1;31m✗ %s\033[0m\n' "$*" >&2; exit 1; }
ask()  { # ask "Вопрос" default → ответ (из терминала, даже при curl | bash)
  local a=""
  if [ -r /dev/tty ]; then read -r -p "$1 " a </dev/tty || true; fi
  printf '%s' "${a:-$2}"
}

[ "$(id -u)" = 0 ] || die "Запустите от root: … | sudo bash -s -- домен email"
if [ -z "$DOMAIN" ] && [ -f "$ENV_FILE" ]; then DOMAIN="$(sed -n 's/^DOMAIN=//p' "$ENV_FILE")"; fi
[ -n "$DOMAIN" ] || DOMAIN="$(ask 'Домен (например kosmochat.duckdns.org):' '')"
[ -n "$DOMAIN" ] || die "Не указан домен"
command -v apt-get >/dev/null || die "Нужен Ubuntu или Debian (apt)"
export DEBIAN_FRONTEND=noninteractive

say "Пакеты: nginx, certbot, coturn, git"
apt-get update -qq
apt-get install -y -qq curl ca-certificates git nginx certbot python3-certbot-nginx coturn openssl >/dev/null

say "Node.js 22"
if ! command -v node >/dev/null || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
node -e 'const [a,b]=process.versions.node.split(".").map(Number); process.exit(a>22||(a===22&&b>=13)?0:1)' \
  || { apt-get install -y -qq --only-upgrade nodejs >/dev/null; }
command -v pm2 >/dev/null || npm install -g pm2 --silent >/dev/null
echo "node $(node -v), pm2 $(pm2 -v)"

say "Код Kosmo → $APP_DIR (ветка $BRANCH)"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" fetch -q --depth 1 origin "$BRANCH"
  git -C "$APP_DIR" reset -q --hard FETCH_HEAD
else
  rm -rf "$APP_DIR"
  git clone -q --depth 1 --branch "$BRANCH" "$REPO" "$APP_DIR"
fi
(cd "$APP_DIR/server" && npm install --omit=dev --no-audit --no-fund --silent)
mkdir -p "$DATA_DIR" && chmod 700 "$DATA_DIR"

# ---------- Настройки (SMS и прочее) ----------
sms_setup() {
  echo
  echo "Как отправлять коды подтверждения?"
  echo "  0) Свой телефон  — Android с SIM шлёт SMS сам (приложение SMS Gateway for Android)"
  echo "  1) SMS.ru        — SMS на номера РФ/СНГ (нужен api_id из sms.ru)"
  echo "  2) Telegram      — код приходит в Telegram (Telegram Gateway, gateway.telegram.org)"
  echo "  3) Twilio        — SMS по всему миру (Account SID, Auth Token, номер отправителя)"
  echo "  4) Пока без SMS  — код пишется в лог: pm2 logs kosmo"
  local c; c="$(ask 'Выбор [0-4, Enter = 4]:' 4)"
  SMS_PROVIDER=log; SMSRU_API_ID=""; TG_GATEWAY_TOKEN=""; TWILIO_SID=""; TWILIO_TOKEN=""; TWILIO_FROM=""
  SMSGATE_URL=""; SMSGATE_USER=""; SMSGATE_PASS=""
  case "$c" in
    0) SMS_PROVIDER=phone
       echo "  В приложении включите Cloud server и скопируйте Username и Password с главного экрана."
       SMSGATE_USER="$(ask 'Username:' '')"; SMSGATE_PASS="$(ask 'Password:' '')"
       SMSGATE_URL="$(ask 'Адрес API [Enter = облако api.sms-gate.app]:' '')" ;;
    1) SMS_PROVIDER=smsru;    SMSRU_API_ID="$(ask 'SMS.ru api_id:' '')" ;;
    2) SMS_PROVIDER=telegram; TG_GATEWAY_TOKEN="$(ask 'Telegram Gateway token:' '')" ;;
    3) SMS_PROVIDER=twilio;   TWILIO_SID="$(ask 'Twilio Account SID:' '')"; TWILIO_TOKEN="$(ask 'Twilio Auth Token:' '')"; TWILIO_FROM="$(ask 'Номер отправителя (+1…):' '')" ;;
  esac
  if [ "$SMS_PROVIDER" != log ] && [ -z "$SMSRU_API_ID$TG_GATEWAY_TOKEN$TWILIO_TOKEN$SMSGATE_PASS" ]; then
    warn "Ключ не введён — коды пока будут в логе"; SMS_PROVIDER=log
  fi
}

write_env() {
  mkdir -p "$ENV_DIR"
  umask 077
  cat > "$ENV_FILE" <<CONF
# Kosmo — настройки сервера. После правки: pm2 restart kosmo --update-env
DOMAIN=$DOMAIN
PORT=$PORT
HOST=127.0.0.1
DATA_DIR=$DATA_DIR
WEB_DIR=$APP_DIR/web
PUBLIC_URL=https://$DOMAIN
TRUST_PROXY=1
MAX_UPLOAD_MB=50
# SMS: phone | smsru | telegram | twilio | log
SMS_PROVIDER=$SMS_PROVIDER
SMSRU_API_ID=$SMSRU_API_ID
TG_GATEWAY_TOKEN=$TG_GATEWAY_TOKEN
TWILIO_SID=$TWILIO_SID
TWILIO_TOKEN=$TWILIO_TOKEN
TWILIO_FROM=$TWILIO_FROM
# свой телефон (SMS Gateway for Android); пустой адрес = облако api.sms-gate.app
SMSGATE_URL=$SMSGATE_URL
SMSGATE_USER=$SMSGATE_USER
SMSGATE_PASS=$SMSGATE_PASS
# номера +000… входят с кодом 000000 (для проверки); 0 — выключить
TEST_NUMBERS=$TEST_NUMBERS
# звонки: свой TURN (coturn)
TURN_HOST=$DOMAIN
TURN_SECRET=$TURN_SECRET
CONF
  umask 022
}

if [ -f "$ENV_FILE" ] && [ "${KOSMO_SMS_SETUP:-0}" != 1 ]; then
  say "Настройки уже есть: $ENV_FILE (сохраняю)"
  set -a; . "$ENV_FILE"; set +a
  sed -i "s/^DOMAIN=.*/DOMAIN=$DOMAIN/; s/^TURN_HOST=.*/TURN_HOST=$DOMAIN/; s#^PUBLIC_URL=.*#PUBLIC_URL=https://$DOMAIN#" "$ENV_FILE"
else
  [ -f "$ENV_FILE" ] && { set -a; . "$ENV_FILE"; set +a; }
  if [ -n "${SMS_PROVIDER:-}" ] && [ "${KOSMO_SMS_SETUP:-0}" != 1 ]; then
    : # провайдер передан переменными окружения
  else
    sms_setup
  fi
  SMSRU_API_ID="${SMSRU_API_ID:-}"; TG_GATEWAY_TOKEN="${TG_GATEWAY_TOKEN:-}"
  TWILIO_SID="${TWILIO_SID:-}"; TWILIO_TOKEN="${TWILIO_TOKEN:-}"; TWILIO_FROM="${TWILIO_FROM:-}"
  SMSGATE_URL="${SMSGATE_URL:-}"; SMSGATE_USER="${SMSGATE_USER:-}"; SMSGATE_PASS="${SMSGATE_PASS:-}"
  TEST_NUMBERS="${TEST_NUMBERS:-1}"
  TURN_SECRET="${TURN_SECRET:-$(openssl rand -hex 24)}"
  write_env
fi
set -a; . "$ENV_FILE"; set +a

# ---------- nginx ----------
say "nginx для $DOMAIN"
mkdir -p /var/www/letsencrypt
SITE=/etc/nginx/sites-available/kosmo
cat > /etc/nginx/conf.d/kosmo-upgrade.conf <<'NGX'
map $http_upgrade $kosmo_connection { default upgrade; '' close; }
NGX
LOCATIONS=$(cat <<NGX
    client_max_body_size 60m;
    location /.well-known/acme-challenge/ { root /var/www/letsencrypt; }
    location /ws {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \$kosmo_connection;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 1h;
        proxy_send_timeout 1h;
    }
    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_request_buffering off;
    }
NGX
)
CERT=/etc/letsencrypt/live/$DOMAIN/fullchain.pem
write_site() {
  if [ -f "$CERT" ]; then
    cat > "$SITE" <<NGX
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;
    location /.well-known/acme-challenge/ { root /var/www/letsencrypt; }
    location / { return 301 https://\$host\$request_uri; }
}
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
    server_name $DOMAIN;
    ssl_certificate $CERT;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    add_header Strict-Transport-Security "max-age=31536000" always;
$LOCATIONS
}
NGX
  else
    cat > "$SITE" <<NGX
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN;
$LOCATIONS
}
NGX
  fi
  ln -sf "$SITE" /etc/nginx/sites-enabled/kosmo
  rm -f /etc/nginx/sites-enabled/default
  # старые nginx не знают «http2 on»
  if ! nginx -t >/dev/null 2>&1; then
    sed -i 's/^    http2 on;$//; s/listen 443 ssl;/listen 443 ssl http2;/; s/listen \[::\]:443 ssl;/listen [::]:443 ssl http2;/' "$SITE"
  fi
  nginx -t
  systemctl enable -q nginx
  systemctl reload nginx || systemctl restart nginx
}

# ---------- Брандмауэр ----------
if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
  say "ufw: открываю 22, 80, 443, 3478, 49160-49200/udp"
  ufw allow 22/tcp >/dev/null; ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null
  ufw allow 3478 >/dev/null; ufw allow 49160:49200/udp >/dev/null
fi

write_site

# ---------- Сертификат ----------
if [ ! -f "$CERT" ]; then
  say "Сертификат Let's Encrypt для $DOMAIN"
  MYIP="$(curl -fsS4 --max-time 8 https://api.ipify.org || true)"
  DNSIP="$(getent ahostsv4 "$DOMAIN" | awk 'NR==1{print $1}' || true)"
  if [ -n "$MYIP" ] && [ -n "$DNSIP" ] && [ "$MYIP" != "$DNSIP" ]; then
    warn "$DOMAIN указывает на $DNSIP, а у этого сервера IP $MYIP — проверьте DNS (duckdns)"
  fi
  if [ -n "$EMAIL" ]; then EM=(--email "$EMAIL"); else EM=(--register-unsafely-without-email); fi
  if certbot certonly --webroot -w /var/www/letsencrypt -d "$DOMAIN" "${EM[@]}" --agree-tos --non-interactive --keep-until-expiring; then
    write_site
  else
    warn "Сертификат не выдан — сайт пока по http://$DOMAIN. Проверьте DNS и порт 80, затем запустите команду ещё раз."
  fi
fi
# продление: certbot.timer + перезагрузка nginx после продления
mkdir -p /etc/letsencrypt/renewal-hooks/deploy
printf '#!/bin/sh\nsystemctl reload nginx\n' > /etc/letsencrypt/renewal-hooks/deploy/kosmo-nginx.sh
chmod +x /etc/letsencrypt/renewal-hooks/deploy/kosmo-nginx.sh
systemctl enable -q --now certbot.timer 2>/dev/null || true

# ---------- coturn (звонки через NAT) ----------
say "coturn (TURN для звонков)"
PUBIP="$(curl -fsS4 --max-time 8 https://api.ipify.org || hostname -I | awk '{print $1}')"
PRIVIP="$(hostname -I | awk '{print $1}')"
EXT="$PUBIP"; [ -n "$PRIVIP" ] && [ "$PRIVIP" != "$PUBIP" ] && EXT="$PUBIP/$PRIVIP"
cat > /etc/turnserver.conf <<TURN
listening-port=3478
fingerprint
use-auth-secret
static-auth-secret=$TURN_SECRET
realm=$DOMAIN
external-ip=$EXT
min-port=49160
max-port=49200
no-cli
no-tls
no-dtls
no-multicast-peers
denied-peer-ip=10.0.0.0-10.255.255.255
denied-peer-ip=172.16.0.0-172.31.255.255
denied-peer-ip=192.168.0.0-192.168.255.255
denied-peer-ip=127.0.0.0-127.255.255.255
total-quota=100
stale-nonce=600
log-file=syslog
TURN
[ -f /etc/default/coturn ] && sed -i 's/^#\?TURNSERVER_ENABLED=.*/TURNSERVER_ENABLED=1/' /etc/default/coturn
systemctl enable -q coturn
systemctl restart coturn || warn "coturn не запустился — звонки будут работать только без NAT"

# ---------- pm2 ----------
say "Сервер Kosmo через pm2"
if pm2 describe kosmo >/dev/null 2>&1; then pm2 delete kosmo >/dev/null; fi
pm2 start "$APP_DIR/deploy/ecosystem.config.cjs" >/dev/null
pm2 save >/dev/null
pm2 startup systemd -u root --hp /root >/dev/null 2>&1 || true
systemctl enable -q pm2-root 2>/dev/null || true

# ---------- Команда kosmo ----------
cat > /usr/local/bin/kosmo <<KOS
#!/usr/bin/env bash
# kosmo update | sms | logs | restart | status
case "\${1:-}" in
  update)  exec bash $APP_DIR/deploy/install.sh "$DOMAIN" "$EMAIL" ;;
  sms)     KOSMO_SMS_SETUP=1 exec bash $APP_DIR/deploy/install.sh "$DOMAIN" "$EMAIL" ;;
  logs)    exec pm2 logs kosmo ;;
  restart) exec pm2 restart kosmo --update-env ;;
  status)  pm2 status kosmo; curl -fsS http://127.0.0.1:$PORT/api/config; echo ;;
  *) echo "kosmo update   — обновить код с GitHub (база и настройки сохранятся)"
     echo "kosmo sms      — настроить отправку кодов (SMS.ru / Telegram / Twilio)"
     echo "kosmo logs     — логи сервера (здесь коды, если SMS не настроены)"
     echo "kosmo restart  — перезапустить сервер"
     echo "kosmo status   — состояние" ;;
esac
KOS
chmod +x /usr/local/bin/kosmo

# ---------- Проверка ----------
ok=0
for _ in $(seq 1 20); do
  if curl -fsS "http://127.0.0.1:$PORT/api/config" >/dev/null 2>&1; then ok=1; break; fi
  sleep 1
done
[ "$ok" = 1 ] || { pm2 logs kosmo --lines 30 --nostream || true; die "Сервер не отвечает — логи выше"; }

URL="http://$DOMAIN"; [ -f "$CERT" ] && URL="https://$DOMAIN"
printf '\n\033[1;32m✓ Kosmo работает: %s\033[0m\n' "$URL"
echo "  База данных: $DATA_DIR/kosmo.db (SQLite)    Файлы: $DATA_DIR/media"
echo "  Коды входа: $SMS_PROVIDER$( [ "$SMS_PROVIDER" = log ] && echo ' — смотрите в «kosmo logs»; подключить SMS: kosmo sms')"
echo "  Обновить код: kosmo update   ·   Помощь: kosmo"
