package app.kosmo.chat.ui

import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import app.kosmo.chat.core.JSON
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

/**
 * Язык интерфейса: English / Русский — как на сайте. Интерфейс написан
 * по-английски, при русском фразы переводятся по тому же словарю, что
 * web/js/i18n.js (assets/ru.json) + шаблоны для фраз с числами и именами.
 */
object I18n {
    var lang by mutableStateOf("en")
    private var ru: Map<String, String> = emptyMap()

    fun init(ctx: Context) {
        val prefs = ctx.getSharedPreferences("kosmo", Context.MODE_PRIVATE)
        lang = prefs.getString("lang", null) ?: if (java.util.Locale.getDefault().language == "ru") "ru" else "en"
        ru = runCatching {
            (JSON.parseToJsonElement(ctx.assets.open("ru.json").bufferedReader().readText()) as JsonObject)
                .mapValues { (it.value as JsonPrimitive).content }
        }.getOrDefault(emptyMap()) + EXTRA
    }

    fun set(ctx: Context, l: String) {
        lang = l
        ctx.getSharedPreferences("kosmo", Context.MODE_PRIVATE).edit().putString("lang", l).apply()
    }

    private fun plural(n: Long, one: String, few: String, many: String): String {
        val m10 = n % 10; val m100 = n % 100
        return if (m10 == 1L && m100 != 11L) one else if (m10 in 2..4 && (m100 < 12 || m100 > 14)) few else many
    }
    private fun ago(t: String) = t.replace(Regex("^(\\d+) min ago$"), "$1 мин назад").replace(Regex("^(\\d+) h ago$"), "$1 ч назад").replace("just now", "только что")

    private val patterns: List<Pair<Regex, (List<String>) -> String>> = listOf(
        Regex("^(\\d+) members?$") to { g -> "${g[0]} ${plural(g[0].toLong(), "участник", "участника", "участников")}" },
        Regex("^(\\d+) subscribers?$") to { g -> "${g[0]} ${plural(g[0].toLong(), "подписчик", "подписчика", "подписчиков")}" },
        Regex("^(\\d+) comments?$") to { g -> "${g[0]} ${plural(g[0].toLong(), "комментарий", "комментария", "комментариев")}" },
        Regex("^(\\d+) votes?$") to { g -> "${g[0]} ${plural(g[0].toLong(), "голос", "голоса", "голосов")}" },
        Regex("^(\\d+) active$") to { g -> "${g[0]} ${plural(g[0].toLong(), "активный", "активных", "активных")}" },
        Regex("^(\\d+) tracks$") to { g -> "${g[0]} ${plural(g[0].toLong(), "трек", "трека", "треков")}" },
        Regex("^last seen (.+)$") to { g -> "был(а) ${ago(tr(g[0]))}" },
        Regex("^last seen at (.+)$") to { g -> "был(а) в ${g[0]}" },
        Regex("^(\\d+ (?:min|h) ago)$") to { g -> ago(g[0]) },
        Regex("^Welcome to Kosmo, (.+)!$") to { g -> "Добро пожаловать в Kosmo, ${g[0]}!" },
        Regex("^(.+) joined the group$") to { g -> "${g[0]} вступил(а) в группу" },
        Regex("^(.+) added (.+)$") to { g -> "${g[0]} добавил(а) ${g[1]}" },
        Regex("^(.+) is typing…$") to { g -> "${g[0]} печатает…" },
        Regex("^Your email was changed from (.+) to (.+)\\.$") to { g -> "Почта изменена с ${g[0]} на ${g[1]}." },
        Regex("^(Poll|Quiz): (.+)$") to { g -> "${if (g[0] == "Poll") "Опрос" else "Викторина"}: ${g[1]}" },
        Regex("^(Album|Video message|Sticker|Code|Photo|Video|Voice message) · (.+)$") to { g -> "${tr(g[0])} · ${g[1]}" },
        Regex("^(Channel|Group) · (.+)$") to { g -> "${tr(g[0])} · ${tr(g[1])}" },
        Regex("^(\\d+) of (\\d+)$") to { g -> "${g[0]} из ${g[1]}" },
        Regex("^@(.+) is available$") to { g -> "@${g[0]} свободно" },
        Regex("^@(.+) is taken$") to { g -> "@${g[0]} занято" },
        Regex("^(\\d+)% · uploading$") to { g -> "${g[0]}% · загрузка" },
        Regex("^(\\d+) members · (.+)$") to { g -> "${tr(g[0] + " members")} · ${g[1]}" },
    )

    fun tr(s: String): String {
        if (lang != "ru" || s.isEmpty()) return s
        ru[s]?.let { return it }
        for ((re, fn) in patterns) re.matchEntire(s)?.let { return fn(it.groupValues.drop(1)) }
        return s
    }

    // фразы, которых нет на сайте (только в приложении)
    private val EXTRA = mapOf(
        "Today" to "Сегодня", "Yesterday" to "Вчера", "online" to "в сети", "last seen recently" to "был(а) недавно",
        "notes for yourself" to "заметки для себя", "Connecting…" to "Соединение…", "Recording…" to "Запись…",
        "Open on the site to see it in full" to "Откройте на сайте, чтобы увидеть полностью", "Uploading…" to "Загрузка…",
        "Drag to move, pinch to zoom" to "Двигайте пальцем, масштаб — щипком", "Kosmo for Android" to "Kosmo для Android",
        "This device" to "Это устройство", "End" to "Завершить", "Nobody found" to "Никого не нашли",
        "Find people to chat with" to "Найдите собеседников", "Type a name, @username or ID" to "Введите имя, @username или ID",
        "What’s new?" to "Что нового?", "No posts yet — be the first" to "Постов пока нет — будьте первым",
        "Say hi" to "Поздоровайтесь", "Discard" to "Не сохранять", "Save changes?" to "Сохранить изменения?",
        "You changed your profile. Save it before leaving?" to "Вы изменили профиль. Сохранить перед выходом?",
        "Your username will be removed" to "Ваш username будет удалён", "This is your username" to "Это ваш username",
        "Could not check now — will check when saving" to "Не удалось проверить — проверим при сохранении",
        "Checking…" to "Проверяем…", "Add banner" to "Добавить баннер", "Change banner" to "Сменить баннер",
        "Remove photo" to "Убрать фото", "Remove banner" to "Убрать баннер", "Profile updated" to "Профиль обновлён",
        "Only admins can post in this channel" to "Писать в канал могут только админы", "You can’t write here" to "Здесь нельзя писать",
        "Message unavailable" to "Сообщение недоступно", "Photo viewed" to "Фото просмотрено", "You viewed the photo" to "Вы посмотрели фото",
        "Copied" to "Скопировано", "Username copied" to "Username скопирован", "ID copied" to "ID скопирован",
        "Wait until the upload finishes" to "Дождитесь окончания загрузки", "Couldn’t connect" to "Не удалось соединиться",
        "Reconnecting…" to "Переподключение…", "Calling…" to "Вызов…", "Incoming call" to "Входящий звонок",
        "Incoming video call" to "Входящий видеозвонок", "Speaker" to "Динамик", "Mute" to "Без звука", "Unmute" to "Включить звук",
        "Accept" to "Принять", "Line busy" to "Линия занята", "No answer" to "Нет ответа",
        "Unread" to "Непрочитанные", "Personal" to "Личные", "Groups" to "Группы", "Search messages" to "Поиск сообщений",
        "Mark as read" to "Прочитано", "Unpin" to "Открепить", "Pin" to "Закрепить", "Unarchive" to "Вернуть из архива",
        "Unmute notifications" to "Включить уведомления", "Mute notifications" to "Выключить уведомления",
        "Choose language" to "Язык", "Pick a photo" to "Выберите фото", "Send" to "Отправить",
    )
}

/** Перевод фразы интерфейса на выбранный язык. */
fun tr(s: String) = I18n.tr(s)
