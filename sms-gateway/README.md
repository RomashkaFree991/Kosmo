# Kosmo SMS — свой SMS-шлюз

Android-приложение: телефон с SIM-картой подключается к вашему серверу Kosmo (`wss://домен/ws/gateway`) и отправляет коды входа со своей SIM. Без сторонних сервисов, платите только по тарифу SIM.

- Готовый APK раздаёт сам сервер: `https://ваш-домен/kosmo-sms.apk` (копия — `web/kosmo-sms.apk`).
- Ключ шлюза на сервере: `kosmo sms-key`. В `/etc/kosmo/kosmo.env` нужно `SMS_PROVIDER=device`.
- Работает в фоне (уведомление «Kosmo SMS»), сам включается после перезагрузки. Разрешите работу без ограничений батареи.

Сборка: `./gradlew assembleRelease` (нужен Android SDK, `sdk.dir` в `local.properties`), затем скопировать `app/build/outputs/apk/release/app-release.apk` в `web/kosmo-sms.apk`.
Подпись: задайте `KOSMO_KEYSTORE` (путь к .keystore, alias `kosmo`) и `KOSMO_KEYSTORE_PASSWORD`; без них APK подписывается отладочным ключом. Ключ в репозиторий не кладётся.
