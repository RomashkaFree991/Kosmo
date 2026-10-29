// Язык интерфейса: English / Русский. Интерфейс написан по-английски,
// а при русском языке тексты переводятся на лету: словарь точных фраз +
// шаблоны для фраз с числами и именами. Сообщения и посты людей не трогаем.

const KEY = 'kosmo:lang';
export const LANGS = [['en', 'English'], ['ru', 'Русский']];
export const lang = () => { try { return localStorage.getItem(KEY) || 'en'; } catch { return 'en'; } };

const RU = {
  // общее
  'About': 'О приложении', 'About Kosmo': 'О Kosmo', 'About you': 'О себе', 'Accept': 'Принять', 'Account': 'Аккаунт',
  'Active sessions': 'Активные сеансы', 'Add': 'Добавить', 'Add a caption': 'Добавьте подпись', 'Add a caption (optional)': 'Подпись (необязательно)',
  'Add a caption…': 'Добавьте подпись…', 'Add account': 'Добавить аккаунт', 'Add an option': 'Добавить вариант', 'Add at least 2 options': 'Нужно минимум 2 варианта',
  'Add at least one letter': 'Добавьте хотя бы одну букву', 'Add me to groups & channels': 'Добавлять меня в группы и каналы', 'Add members': 'Добавить участников',
  'Add subscribers': 'Добавить подписчиков', 'Added': 'Добавлен', 'Admin': 'Админ', 'Admin rights removed': 'Права админа сняты',
  'After 1 hour away': 'Через 1 час', 'After 1 min away': 'Через 1 минуту', 'After 5 min away': 'Через 5 минут', 'All': 'Все',
  'Allow camera and microphone access to record': 'Разрешите доступ к камере и микрофону', 'Allow microphone access to record': 'Разрешите доступ к микрофону',
  'Allow reactions': 'Разрешить реакции', 'Anonymous poll': 'Анонимный опрос', 'Anonymous voting': 'Анонимное голосование', 'Archive': 'Архив',
  'Archived chats': 'Архив чатов', 'Ask for the 4-digit passcode when Kosmo opens.': 'Спрашивать 4-значный код при открытии Kosmo.',
  'At least 3 characters': 'Минимум 3 символа', 'Attach': 'Прикрепить', 'Attach code': 'Прикрепить код', 'Audio': 'Аудио', 'Author': 'Автор',
  'Auto': 'Авто', 'Auto-delete': 'Автоудаление', 'Auto-delete is off': 'Автоудаление выключено', 'Auto-lock': 'Автоблокировка',
  'Auto-play videos in Feed': 'Автовоспроизведение видео в ленте', 'Avatar color': 'Цвет аватара', 'Avatar letters': 'Буквы аватара',
  'Back': 'Назад', 'Back to Kosmo': 'Назад в Kosmo', 'Back to chats': 'К чатам', 'Background': 'Фон', 'Bio': 'О себе', 'Black': 'Чёрный',
  'Block': 'Заблокировать', 'Blocked': 'Заблокирован', 'Blocked users': 'Заблокированные', 'Call': 'Позвонить', 'Call ended': 'Звонок завершён',
  'Camera scanning isn’t supported here — type the code': 'Сканирование не поддерживается — введите код', 'Cancel': 'Отмена', 'Cancelled call': 'Отменённый звонок',
  'Caption': 'Подпись', 'Change number': 'Сменить номер', 'Change passcode': 'Сменить код-пароль', 'Channel': 'Канал', 'Channel created': 'Канал создан',
  'Channel info': 'О канале', 'Channel name': 'Название канала', 'Channels': 'Каналы', 'Channels and groups': 'Каналы и группы', 'Chat': 'Чат',
  'Chat avatars': 'Аватары в чатах', 'Chat deleted for both of you': 'Чат удалён у обоих', 'Chat deleted for you': 'Чат удалён у вас',
  'Chat options': 'Действия с чатом', 'Chats': 'Чаты', 'Choose a different passcode': 'Выберите другой код', 'Choose country': 'Выберите страну',
  'Choose people': 'Выберите людей', 'Choose who can see your info and contact you. Changes apply instantly.': 'Выберите, кто видит ваши данные и может с вами связаться. Изменения применяются сразу.',
  'Circle': 'Круг', 'Clear cache': 'Очистить кэш', 'Close': 'Закрыть', 'Close search': 'Закрыть поиск', 'Code': 'Код', 'Code copied': 'Код скопирован',
  'Code not found or expired': 'Код не найден или истёк', 'Code sent to': 'Код отправлен на', 'Color': 'Цвет', 'Color from photo': 'Цвет из фото',
  'Comment': 'Комментарий', 'Comments': 'Комментарии', 'Comments are unavailable': 'Комментарии недоступны', 'Comments on my posts': 'Комментарии к моим постам',
  'Compress photos before sending': 'Сжимать фото перед отправкой', 'Continue': 'Продолжить', 'Cool': 'Круто', 'Copied': 'Скопировано', 'Copy': 'Копировать',
  'Correct!': 'Правильно!', 'Could not add this file': 'Не удалось добавить файл', 'Could not copy': 'Не удалось скопировать',
  'Could not read this image': 'Не удалось прочитать изображение', 'Could not read this photo': 'Не удалось прочитать фото', 'Could not send this file': 'Не удалось отправить файл',
  'Create': 'Создать', 'Create a new discussion group': 'Создать группу для обсуждения', 'Create a post': 'Создать пост', 'Create channel': 'Создать канал',
  'Create group': 'Создать группу', 'Create passcode': 'Придумайте код-пароль', 'Created': 'Создан', 'Created the account': 'Создал аккаунт',
  'Data and storage': 'Данные и память', 'Decline': 'Отклонить', 'Declined': 'Отклонён', 'Declined call': 'Отклонённый звонок', 'Delete': 'Удалить',
  'Delete account': 'Удалить аккаунт', 'Delete channel': 'Удалить канал', 'Delete for everyone': 'Удалить у всех', 'Delete for everyone?': 'Удалить у всех?',
  'Delete for me': 'Удалить у меня', 'Delete group': 'Удалить группу', 'Delete my account': 'Удалить мой аккаунт', 'Delete my account if away for': 'Удалить аккаунт, если меня нет',
  'Delete this chat?': 'Удалить этот чат?', 'Delete this message?': 'Удалить сообщение?', 'Delete your account?': 'Удалить аккаунт?', 'Deleted account': 'Удалённый аккаунт',
  'Deleted for everyone': 'Удалено у всех', 'Deleted message': 'Удалённое сообщение', 'Description': 'Описание', 'Description (optional)': 'Описание (необязательно)',
  'Design style': 'Стиль оформления', 'Designs': 'Оформление', 'Device': 'Устройство', 'Device linked': 'Устройство подключено', 'Discussion': 'Обсуждение',
  'Discussion group linked': 'Группа обсуждения подключена', 'Dismiss admin': 'Снять админа', 'Done': 'Готово', 'Dynamic color': 'Динамический цвет',
  'Edit': 'Изменить', 'Edit message': 'Изменение сообщения', 'Edit post': 'Изменить пост', 'Edit profile': 'Редактировать профиль', 'Emoji': 'Эмодзи',
  'End': 'Завершить', 'Enter code': 'Введите код', 'Enter a new passcode': 'Введите новый код', 'Enter passcode': 'Введите код-пароль',
  'Enter the 6-character code': 'Введите 6-значный код', 'Enter your current passcode': 'Введите текущий код', 'Everybody': 'Все', 'Everyone': 'Всем',
  'Explanation (shown after answering)': 'Пояснение (после ответа)', 'Feed': 'Лента', 'File is too large (max 50 MB)': 'Файл слишком большой (макс. 50 МБ)',
  'File not found': 'Файл не найден', 'Files over 50 MB were skipped': 'Файлы больше 50 МБ пропущены', 'Find me by phone number': 'Находить меня по номеру',
  'Folders': 'Папки', 'Forward': 'Переслать', 'Forward to': 'Переслать', 'Get a message about every new sign-in.': 'Сообщение о каждом новом входе.',
  'Group': 'Группа', 'Group created': 'Группа создана', 'Group info': 'О группе', 'Group name': 'Название группы', 'Group unlinked': 'Группа отвязана',
  'Groups': 'Группы', 'Groups and channels': 'Группы и каналы', 'Hidden': 'Скрыт', 'Hidden user': 'Скрытый пользователь', 'Home': 'Главная',
  'ID copied': 'ID скопирован', 'IP address': 'IP-адрес', 'If hidden, people see “last seen recently”.': 'Если скрыто, увидят «был(а) недавно».',
  'If off, you won’t see read receipts from others either.': 'Если выключить, вы тоже не увидите прочтения.', 'In 1 hour': 'Через 1 час', 'In 1 minute': 'Через 1 минуту',
  'In 10 minutes': 'Через 10 минут', 'In-app': 'В приложении', 'Incoming call': 'Входящий звонок', 'Incoming video call': 'Входящий видеозвонок', 'Info': 'Информация',
  'Invitation': 'Приглашение', 'Invite people and start talking.': 'Пригласите людей и начните общение.', 'Join': 'Вступить', 'Join channel': 'Подписаться',
  'Join group': 'Вступить в группу', 'Joined': 'В Kosmo с', 'Language': 'Язык', 'Last seen & online': 'Время захода и онлайн', 'Leave a comment': 'Оставить комментарий',
  'Leave channel': 'Покинуть канал', 'Leave group': 'Покинуть группу', 'Letters': 'Буквы', 'Line busy': 'Линия занята', 'Link': 'Ссылка',
  'Link a device': 'Подключить устройство', 'Link copied': 'Ссылка скопирована', 'Link device': 'Подключить', 'Linked channel': 'Привязанный канал',
  'Location': 'Местоположение', 'Lock now': 'Заблокировать сейчас', 'Log in with QR code': 'Войти по QR-коду', 'Log out': 'Выйти',
  'Login alerts in Kosmo chat': 'Уведомления о входах в чате Kosmo', 'Make admin': 'Сделать админом', 'Mark the correct answer': 'Отметьте правильный ответ',
  'Media': 'Медиа', 'Media viewer': 'Просмотр медиа', 'Members': 'Участники', 'Members can add people': 'Участники могут добавлять людей',
  'Members can send media': 'Участники могут отправлять медиа', 'Message': 'Сообщение', 'Message forwarded': 'Сообщение переслано',
  'Message notifications': 'Уведомления о сообщениях', 'Message pinned': 'Сообщение закреплено', 'Message unpinned': 'Сообщение откреплено', 'Messages': 'Сообщения',
  'Messages from secret chats can’t be forwarded': 'Из секретного чата нельзя пересылать', 'Missed call': 'Пропущенный звонок', 'Moved back to chats': 'Возвращено в чаты',
  'Moved to archive': 'Перенесено в архив', 'Multiple answers': 'Несколько ответов', 'Music': 'Музыка', 'Mute': 'Без звука', 'Name': 'Имя', 'New': 'Новое',
  'New channel': 'Новый канал', 'New chat': 'Новый чат', 'New group': 'Новая группа', 'New login to your account': 'Новый вход в аккаунт',
  'New message': 'Новое сообщение', 'New messages': 'Новые сообщения', 'New number': 'Новый номер', 'New poll': 'Новый опрос', 'New post': 'Новый пост',
  'New story': 'Новая история', 'Next': 'Далее', 'Next result': 'Следующий', 'No access to microphone — listening only': 'Нет доступа к микрофону — только слушаем',
  'No answer': 'Нет ответа', 'No camera access — type the code': 'Нет доступа к камере — введите код', 'No chats in this folder': 'В этой папке нет чатов',
  'No chats to share to yet': 'Пока некуда отправить', 'No chats yet. Find people in Search or create a group.': 'Чатов пока нет. Найдите людей в поиске или создайте группу.',
  'No comments yet — be the first': 'Комментариев нет — будьте первым', 'No messages found': 'Сообщения не найдены', 'No messages yet': 'Сообщений пока нет',
  'No people found': 'Никого не найдено', 'No photos or videos yet': 'Фото и видео пока нет', 'No results': 'Ничего не найдено', 'No views yet': 'Пока нет просмотров',
  'No votes yet': 'Голосов пока нет', 'Nobody': 'Никто', 'Nobody is blocked. Block people from their profile.': 'Никто не заблокирован. Заблокировать можно в профиле человека.',
  'Not linked': 'Не привязана', 'Not set': 'Не задан', 'Not supported in this browser': 'Не поддерживается в этом браузере', 'Nothing found': 'Ничего не найдено',
  'Nothing here yet': 'Здесь пока пусто', 'Notifications': 'Уведомления', 'Notifications work!': 'Уведомления работают!', 'Now an admin': 'Теперь админ',
  'Number changed': 'Номер изменён', 'Off': 'Выкл.', 'Official': 'Официальный', 'official account': 'официальный аккаунт', 'On a keyboard, Shift+Enter adds a new line.': 'На клавиатуре Shift+Enter — новая строка.',
  'On every launch': 'При каждом запуске', 'One correct answer. Tap the circle to mark it.': 'Один правильный ответ. Отметьте его кружком.',
  'Only Kosmo can send messages here': 'Писать сюда может только Kosmo', 'Only a trusted device can link new devices': 'Подключать устройства может только доверенное',
  'Only a trusted device can terminate it': 'Завершить может только доверенное устройство', 'Only admins can post in this channel': 'Публиковать могут только админы',
  'Open': 'Открыть', 'Open channel': 'Открыть канал', 'Open group': 'Открыть группу', 'Open message': 'Открыть сообщение', 'Options': 'Варианты',
  'Or enter the code shown on the other device': 'Или введите код с другого устройства', 'Or pick a date and time': 'Или выберите дату и время', 'Other': 'Другое',
  'Outgoing call': 'Исходящий звонок', 'Owner': 'Владелец', 'Passcode': 'Код-пароль', 'Passcode changed': 'Код-пароль изменён', 'Passcode lock': 'Блокировка кодом',
  'Passcode lock is on': 'Блокировка кодом включена', 'Passcode, trusted devices and login alerts keep Kosmo safe.': 'Код-пароль, доверенные устройства и уведомления о входах защищают Kosmo.',
  'Passcodes don’t match': 'Коды не совпадают', 'Paste or write code': 'Вставьте или напишите код', 'People': 'Люди', 'People can find you in Search by your number.': 'Вас смогут найти в поиске по номеру.',
  'People who already chat with you can still write.': 'Те, с кем уже есть чат, смогут писать.', 'Personal': 'Личные', 'Phone': 'Телефон', 'Phone number': 'Номер телефона',
  'Phone number changed': 'Номер телефона изменён', 'Photo': 'Фото', 'Photo / Video': 'Фото / видео', 'Pick a time in the future': 'Выберите время в будущем', 'Pin': 'Закрепить',
  'Pinned': 'Закреплено', 'Pinned message': 'Закреплённое сообщение', 'Point the camera at the QR code': 'Наведите камеру на QR-код', 'Poll': 'Опрос',
  'Poll or quiz': 'Опрос или викторина', 'Poll stopped': 'Опрос остановлен', 'Post': 'Пост', 'Post deleted': 'Пост удалён', 'Post shared': 'Пост отправлен',
  'Post updated': 'Пост изменён', 'Previous result': 'Предыдущий', 'Privacy': 'Конфиденциальность', 'Private': 'Частный', 'Private chats': 'Личные чаты',
  'Profile': 'Профиль', 'Profile photo': 'Фото профиля', 'Profile updated': 'Профиль обновлён', 'Public poll': 'Публичный опрос', 'Publish': 'Опубликовать',
  'Published': 'Опубликовано', 'Question': 'Вопрос', 'Quiz': 'Викторина', 'Quiz mode': 'Режим викторины', 'Read': 'Прочитано', 'Read receipts': 'Отчёты о прочтении',
  'Record video message': 'Записать кружок', 'Record voice message': 'Записать голосовое', 'Recording…': 'Запись…', 'Remind me': 'Напомнить', 'Reminder': 'Напоминание',
  'Remove': 'Убрать', 'Remove code': 'Убрать код', 'Remove photo': 'Удалить фото', 'Remove trust': 'Убрать доверие', 'Repeat the new passcode': 'Повторите новый код',
  'Reply': 'Ответить', 'Reply sent': 'Ответ отправлен', 'Reply…': 'Ответить…', 'Retract vote': 'Отменить голос', 'Save': 'Сохранить', 'Saved': 'Сохранено',
  'Say hello': 'Поздороваться', 'Schedule message': 'Отправить позже', 'Scheduled messages': 'Отложенные сообщения', 'Search': 'Поиск',
  'Search chats and people': 'Поиск чатов и людей', 'Search country or code': 'Страна или код', 'Search in this chat': 'Поиск в чате', 'Search people': 'Поиск людей',
  'Secret chat': 'Секретный чат', 'Secret chat created': 'Секретный чат создан', 'secret chat': 'секретный чат', 'Security': 'Безопасность', 'Send': 'Отправить',
  'Send code': 'Отправить код', 'Send with Enter': 'Отправка по Enter', 'Send without sound': 'Отправить без звука', 'Sent': 'Отправлено',
  'Session terminated': 'Сеанс завершён', 'Sessions': 'Сеансы', 'Set': 'Готово', 'Settings': 'Настройки', 'Share post': 'Поделиться постом',
  'Shared from Feed': 'Из ленты', 'Shared post': 'Пост из ленты', 'Show message preview': 'Показывать текст сообщения',
  'Show the text of new messages in notifications.': 'Текст новых сообщений в уведомлениях.', 'Sign posts with author name': 'Подписывать посты именем автора',
  'Sign up': 'Зарегистрироваться', 'Someone': 'Кто-то', 'Sounds': 'Звуки', 'Speaker': 'Динамик', 'Start secret chat': 'Начать секретный чат', 'Stickers': 'Стикеры',
  'Stop poll': 'Остановить опрос', 'Stories': 'Истории', 'Story deleted': 'История удалена', 'Story published · visible for 24 hours': 'История опубликована · видна 24 часа',
  'Style': 'Стиль', 'Subscribers': 'Подписчики', 'Tap again to delete for everyone': 'Нажмите ещё раз, чтобы удалить у всех',
  'Tap to record a video message': 'Нажмите, чтобы записать кружок', 'Tap to record a voice message': 'Нажмите, чтобы записать голосовое', 'Terminate': 'Завершить',
  'Terminate all other sessions': 'Завершить все другие сеансы', 'Terminate session': 'Завершить сеанс', 'Test notification': 'Проверить уведомление',
  'Test numbers': 'Тестовые номера', 'The passcode of your account was changed.': 'Код-пароль аккаунта был изменён.', 'This account was deleted': 'Аккаунт удалён',
  'This chat no longer exists': 'Этого чата больше нет', 'This demo': 'Это демо', 'This device': 'Это устройство', 'This is already your number': 'Это и так ваш номер',
  'This is you': 'Это вы', 'This is your post': 'Это ваш пост', 'This message can’t be forwarded': 'Это сообщение нельзя переслать',
  'This number is used by another account': 'Номер занят другим аккаунтом', 'This post was deleted': 'Пост удалён', 'This session was terminated': 'Сеанс завершён',
  'This session was terminated from another device': 'Сеанс завершён с другого устройства', 'This username is taken': 'Это имя занято', 'Thumbnails': 'Миниатюры',
  'Time': 'Время', 'Tomorrow at 9:00': 'Завтра в 9:00', 'Tonight at 21:00': 'Сегодня в 21:00', 'Trust': 'Доверять', 'Trusted': 'Доверенное',
  'Type': 'Тип', 'Type at least 2 letters to search messages': 'Введите хотя бы 2 буквы', 'Unarchive': 'Вернуть из архива', 'Unblock': 'Разблокировать',
  'Unblocked': 'Разблокирован', 'Unknown': 'Неизвестно', 'Unlink group': 'Отвязать группу', 'Unmute': 'Включить звук', 'Unpin': 'Открепить', 'Unpinned': 'Откреплено',
  'Unread': 'Непрочитанные', 'Upload photo': 'Загрузить фото', 'Username': 'Имя пользователя', 'Username copied': 'Имя скопировано', 'Vibrate': 'Вибрация',
  'Video': 'Видео', 'Video call': 'Видеозвонок', 'Video message': 'Видеосообщение', 'Voice call': 'Аудиозвонок', 'Vote': 'Голосовать',
  'Welcome to Kosmo!': 'Добро пожаловать в Kosmo!', 'What’s new': 'Что нового', 'Who can contact me': 'Кто может со мной связаться', 'Who can see': 'Кто видит',
  'With a username anyone can find it in Search.': 'С именем пользователя её найдут в поиске.', 'Write a comment': 'Написать комментарий', 'Write a question': 'Напишите вопрос',
  'Write something or add media': 'Напишите что-нибудь или добавьте медиа', 'Wrong answer': 'Неправильно', 'Wrong passcode': 'Неверный код', 'You': 'Вы',
  'You:': 'Вы:', 'You are already in a call': 'Вы уже разговариваете', 'You have no groups yet': 'У вас пока нет групп', 'You joined': 'Вы вступили', 'You left': 'Вы вышли',
  'Your account is protected': 'Ваш аккаунт защищён', 'Your account was deleted': 'Аккаунт удалён', 'Your data will be removed after this period of inactivity.': 'Данные удалятся после этого срока без входа.',
  'Your groups': 'Ваши группы', 'Your story': 'Ваша история', 'Your profile': 'Ваш профиль', 'username (optional)': 'имя пользователя (необязательно)',
  'Message ': 'Сообщение', 'Calling…': 'Вызов…', 'Connecting…': 'Соединение…', 'Video is off for this call': 'Видео в этом звонке выключено',
  'Video messages are not supported in this browser': 'Кружки не поддерживаются в этом браузере', 'Voice messages are not supported in this browser': 'Голосовые не поддерживаются в этом браузере',
  'What\'s new?': 'Что нового?', "What's new?": 'Что нового?', 'Everyone ': 'Всем', 'Link a device ': 'Подключить устройство', 'Open Kosmo on a device where you are signed in': 'Откройте Kosmo там, где вы уже вошли',
  'Profile → Sessions → Link a device': 'Профиль → Сеансы → Подключить устройство', 'Scan this QR code or type the code above': 'Отсканируйте QR-код или введите код выше',
  'Accounts': 'Аккаунты', 'Edit': 'Изменить', 'Polls': 'Опросы', 'Sticker': 'Стикер', 'Album': 'Альбом', 'Forwarded from': 'Переслано от',
  'online': 'в сети', 'last seen recently': 'был(а) недавно', 'just now': 'только что', 'Hidden ': 'Скрыт', 'hidden': 'скрыто', 'edited': 'изм.',
  'Pin ': 'Закрепить', 'Remind me ': 'Напомнить', 'This device · online': 'Это устройство · в сети', 'Trusted ': 'Доверенное', 'Type a message': 'Сообщение',
  'Kosmo Faces': 'Лица Kosmo', 'Say it': 'Скажи это', 'Deep Space': 'Глубокий космос', 'Hi!': 'Привет!', 'Thanks!': 'Спасибо!', 'Hot!': 'Огонь!', 'Sorry': 'Прости',
  'Miss you': 'Скучаю', 'Let’s go': 'Поехали', 'Nice': 'Класс', 'Wow': 'Ого', 'Searching…': 'Поиск…', 'Chats ': 'Чаты', 'Choose people ': 'Выберите людей',
  'Description ': 'Описание', 'Sign posts': 'Подпись постов', 'Language ': 'Язык', 'Interface language': 'Язык интерфейса', 'Version 0.6 · web': 'Версия 0.6 · веб',
  'Your account has been created. This device was added as a trusted device.': 'Аккаунт создан. Это устройство добавлено как доверенное.',
  'A device signed in to your account. If it wasn\'t you, terminate this session.': 'В аккаунт вошло устройство. Если это были не вы, завершите сеанс.',
  'Login alerts': 'Уведомления о входе', 'Private ': 'Частный', 'Delete chat': 'Удалить чат', 'Leave': 'Выйти', 'Speaker ': 'Динамик',
  'Outgoing video call': 'Исходящий видеозвонок', 'Incoming video call ': 'Входящий видеозвонок', 'Missed video call': 'Пропущенный видеозвонок',
  'Cancelled video call': 'Отменённый видеозвонок', 'Declined video call': 'Отклонённый видеозвонок', 'with caption': 'с подписью',
  'No other active sessions. Each new sign-in will appear here and in the Kosmo chat.': 'Других сеансов нет. Каждый новый вход появится здесь и в чате Kosmo.',
  'This device isn\'t trusted yet. A trusted device can trust it or terminate it.': 'Это устройство ещё не доверенное. Доверенное устройство может подтвердить или завершить его.',
  'Interface language ': 'Язык интерфейса', 'Search messages': 'Поиск сообщений', 'final results': 'итоги', 'multiple answers': 'несколько ответов',
  'Story reply': 'Ответ на историю', 'Video message ': 'Видеосообщение', 'Delete for me ': 'Удалить у меня',
  'You can add people you already chat with. Start a chat first, then add them here.': 'Добавить можно тех, с кем уже есть переписка. Сначала напишите человеку, потом добавьте его здесь.',
  'Phone ': 'Телефон', 'Accept ': 'Принять', 'Voice message': 'Голосовое сообщение', 'Group created ': 'Группа создана', 'Secret chat created ': 'Секретный чат создан',
};

const plural = (n, one, few, many) => {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
};
const ago = (t) => t
  .replace(/^(\d+) min ago$/, (_, n) => `${n} мин назад`)
  .replace(/^(\d+) h ago$/, (_, n) => `${n} ч назад`)
  .replace(/^just now$/, 'только что');

// Фразы с числами и именами
const PATTERNS = [
  [/^(\d+) members?$/, (n) => `${n} ${plural(+n, 'участник', 'участника', 'участников')}`],
  [/^(\d+) subscribers?$/, (n) => `${n} ${plural(+n, 'подписчик', 'подписчика', 'подписчиков')}`],
  [/^(\d+) comments?$/, (n) => `${n} ${plural(+n, 'комментарий', 'комментария', 'комментариев')}`],
  [/^(\d+) votes?$/, (n) => `${n} ${plural(+n, 'голос', 'голоса', 'голосов')}`],
  [/^(\d+) active$/, (n) => `${n} ${plural(+n, 'активный', 'активных', 'активных')}`],
  [/^(\d+) attachments$/, (n) => `${n} ${plural(+n, 'вложение', 'вложения', 'вложений')}`],
  [/^(\d+) scheduled messages?$/, (n) => `${n} ${plural(+n, 'отложенное сообщение', 'отложенных сообщения', 'отложенных сообщений')}`],
  [/^Seen by (\d+)$/, (n) => `Просмотров: ${n}`],
  [/^last seen (.+)$/, (t) => `был(а) ${ago(t)}`],
  [/^(\d+ (?:min|h) ago)$/, (t) => ago(t)],
  [/^Last active (.+)$/, (t) => `Активность: ${ago(t)}`],
  [/^Reply to (.+)$/, (n) => `Ответ: ${n === 'yourself' ? 'себе' : n}`],
  [/^Hi, (.+)$/, (n) => `Привет, ${n}`],
  [/^Welcome to Kosmo, (.+)!$/, (n) => `Добро пожаловать в Kosmo, ${n}!`],
  [/^Send (.+) a message, a photo or a voice note\.$/, (n) => `Отправьте ${n} сообщение, фото или голосовое.`],
  [/^Accounts · (.+)$/, (n) => `Аккаунты · ${n}`],
  [/^Members · (\d+)$/, (n) => `Участники · ${n}`],
  [/^Subscribers · (\d+)$/, (n) => `Подписчики · ${n}`],
  [/^Other sessions(.*)$/, (n) => `Другие сеансы${n}`],
  [/^(Channel|Group) · (.+)$/, (k, n) => `${k === 'Channel' ? 'Канал' : 'Группа'} · ${n.replace(/(\d+) subscribers?/, (_, x) => `${x} ${plural(+x, 'подписчик', 'подписчика', 'подписчиков')}`).replace(/(\d+) members?/, (_, x) => `${x} ${plural(+x, 'участник', 'участника', 'участников')}`)}`],
  [/^(\d+) of (\d+)$/, (a, b) => `${a} из ${b}`],
  [/^Scheduled for (.+)$/, (t) => `Запланировано на ${t}`],
  [/^I'll remind you (.+)$/, (t) => `Напомню ${t}`],
  [/^Reminder: (.+)$/, (t) => `Напоминание: ${t}`],
  [/^Switched to (.+)$/, (n) => `Аккаунт: ${n}`],
  [/^You blocked (.+)$/, (n) => `Вы заблокировали ${n}`],
  [/^You can't message (.+)$/, (n) => `Нельзя написать ${n}`],
  [/^(.+) doesn't accept new messages$/, (n) => `${n} не принимает новые сообщения`],
  [/^New messages will disappear after (.+)$/, (t) => `Новые сообщения исчезнут через ${ttlRu(t)}`],
  [/^auto-delete (.+)$/, (t) => `автоудаление ${ttlRu(t)}`],
  [/^(.*) · auto-delete (.+)$/, (a, t) => `${translate(a) ?? a} · автоудаление ${ttlRu(t)}`],
  [/^Maximum (\d+) accounts$/, (n) => `Максимум ${n} аккаунтов`],
  [/^Up to (\d+) attachments at once$/, (n) => `Не больше ${n} вложений за раз`],
  [/^(\d+) (?:people )?added$/, (n) => `Добавлено: ${n}`],
  [/^Delete for me and (.+)$/, (n) => `Удалить у меня и у ${n}`],
  [/^Leave this (channel|group)\?$/, (k) => `Покинуть ${k === 'channel' ? 'канал' : 'группу'}?`],
  [/^Delete (channel|group) for everyone$/, (k) => `Удалить ${k === 'channel' ? 'канал' : 'группу'} у всех`],
  [/^Leave (channel|group)$/, (k) => `Покинуть ${k === 'channel' ? 'канал' : 'группу'}`],
  [/^(.+) added (.+) to the (channel|group)$/, (a, b, k) => `${a === 'You' ? 'Вы добавили' : `${a} добавил(а)`} ${b === 'you' ? 'вас' : b} в ${k === 'channel' ? 'канал' : 'группу'}`],
  [/^(Album|Video message|Sticker|Code|Photo|Video) · (.+)$/, (k, r) => `${translate(k) ?? k} · ${r}`],
  [/^(Anonymous poll|Public poll|Quiz)( · .+)?$/, (k, rest = '') => `${translate(k) ?? k}${rest.replace('multiple answers', 'несколько ответов').replace('final results', 'итоги')}`],
  [/^(\d+)%$/, (n) => `${n}%`],
  [/^(Poll|Quiz): (.+)$/, (k, q) => `${k === 'Poll' ? 'Опрос' : 'Викторина'}: ${q}`],
  [/^Code: (.+)$/, (c) => `Код: ${c}`],
  [/^Version (.+) · web$/, (v) => `Версия ${v} · веб`],
  [/^Last seen (.+)$/, (t) => `Был(а) ${ago(t)}`],
];
const TTL_RU = { '1 min': '1 мин', '1 hour': '1 час', '1 day': '1 день', '1 week': '1 неделю', Off: 'выкл.' };
const ttlRu = (t) => TTL_RU[t] ?? t;
Object.assign(RU, { '1 min': '1 мин', '1 hour': '1 час', '1 day': '1 день', '1 week': '1 неделя', '1 month': '1 месяц', '3 months': '3 месяца', '6 months': '6 месяцев', '1 year': '1 год' });

function translate(text) {
  if (RU[text] !== undefined) return RU[text];
  for (const [re, fn] of PATTERNS) {
    const m = text.match(re);
    if (m) return fn(...m.slice(1));
  }
  return null;
}

/* ---------------------------------------------------------------------------
   Перевод DOM: текстовые узлы и атрибуты; содержимое людей пропускаем
   --------------------------------------------------------------------------- */
const SKIP = '.b-text, .post-text, .comment-text, .b-caption, .v-caption, .sv-caption, .msg-value, .pill-title, .chat-name, .profile-name, .member-name, .post-who b, .comment-name, .b-sender, .b-post-text, .country-name, code, pre, textarea, input, script, style, .tile-value, .bio-name, .poll-q, .poll-label, .row-text b, [data-no-i18n]';
const ATTRS = ['placeholder', 'aria-label', 'title'];
const orig = new WeakMap();   // узел → исходный английский текст

function fixText(node, ru) {
  const raw = node.nodeValue;
  const trimmed = raw.trim();
  if (!trimmed) return;
  if (ru) {
    if (node.parentElement?.closest(SKIP)) return;
    const t = translate(trimmed);
    if (t == null || t === trimmed) return;
    orig.set(node, raw);
    node.nodeValue = raw.replace(trimmed, t);
  } else if (orig.has(node)) {
    node.nodeValue = orig.get(node);
    orig.delete(node);
  }
}

function fixAttrs(el, ru) {
  for (const a of ATTRS) {
    const v = el.getAttribute(a);
    if (v == null) continue;
    const key = `data-en-${a}`;
    if (ru) {
      // код мог поставить новый английский текст — тогда он и есть исходный
      const stored = el.getAttribute(key);
      const base = stored && translate(stored) === v ? stored : v;
      const t = translate(base);
      if (t != null && v !== t) { el.setAttribute(key, base); el.setAttribute(a, t); }
    } else if (el.hasAttribute(key)) {
      el.setAttribute(a, el.getAttribute(key));
      el.removeAttribute(key);
    }
  }
}

function walk(root, ru) {
  if (root.nodeType === 3) { fixText(root, ru); return; }
  if (root.nodeType !== 1) return;
  fixAttrs(root, ru);
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let n = tw.nextNode();
  while (n) {
    if (n.nodeType === 3) fixText(n, ru);
    else fixAttrs(n, ru);
    n = tw.nextNode();
  }
}

let observer = null;
export function applyLang(next = lang()) {
  const ru = next === 'ru';
  document.documentElement.lang = ru ? 'ru' : 'en';
  observer?.disconnect();
  walk(document.body, ru);
  if (!ru) { observer = null; return; }
  observer = new MutationObserver((list) => {
    observer.disconnect();
    for (const m of list) {
      if (m.type === 'characterData') fixText(m.target, true);
      else if (m.type === 'attributes') fixAttrs(m.target, true);
      else m.addedNodes.forEach((n) => walk(n, true));
    }
    observer.observe(document.body, OPTS);
  });
  observer.observe(document.body, OPTS);
}
const OPTS = { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS };

export function setLang(next) {
  try { localStorage.setItem(KEY, next); } catch { /* приватный режим */ }
  applyLang(next);
}

// Для мест, где текст собирается в коде (например, toast) — то же самое
export const t = (text) => (lang() === 'ru' ? translate(text) ?? text : text);
