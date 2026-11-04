package app.kosmo.chat.ui

import app.kosmo.chat.core.Data
import app.kosmo.chat.core.arr
import app.kosmo.chat.core.bool
import app.kosmo.chat.core.num
import app.kosmo.chat.core.obj
import app.kosmo.chat.core.objects
import app.kosmo.chat.core.str
import app.kosmo.chat.core.strings
import kotlinx.serialization.json.JsonObject
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale

// Чтение документов Kosmo для экранов: названия, превью, время

const val KOSMO_CHAT = "kosmo"

val EMOJI = mapOf(
    "heart" to "❤️", "like" to "👍", "fire" to "🔥", "laugh" to "😂", "love" to "😍", "wow" to "😮",
    "cry" to "😢", "cool" to "😎", "party" to "🎉", "rocket" to "🚀", "star" to "⭐", "planet" to "🪐",
)
val REACTIONS = listOf("heart", "like", "fire", "laugh", "wow", "cry", "party", "rocket")
fun emojiChar(id: String?) = id?.let { EMOJI[it] ?: it.takeIf { s -> s.isNotEmpty() && s.length <= 16 } } ?: ""

fun isRoom(c: JsonObject?) = c?.str("type") == "group" || c?.str("type") == "channel"
fun isChannel(c: JsonObject?) = c?.str("type") == "channel"
fun isSaved(c: JsonObject?) = c?.bool("saved") == true

fun Data.otherOf(c: JsonObject): JsonObject? {
    val me = me ?: return null
    val id = c.strings("members").firstOrNull { it != me } ?: return null
    return accounts[id]
}

fun Data.chatTitle(c: JsonObject): String = when {
    isSaved(c) -> "Saved Messages"
    isRoom(c) -> c.str("name") ?: "Group"
    else -> otherOf(c)?.str("name") ?: "Deleted account"
}

fun firstName(name: String?) = name?.trim()?.split(Regex("\\s+"))?.firstOrNull().orEmpty()

fun initials(name: String?): String {
    val parts = name.orEmpty().trim().split(Regex("\\s+")).filter { it.isNotEmpty() }
    return ((parts.getOrNull(0)?.take(1) ?: "") + (parts.getOrNull(1)?.take(1) ?: "")).uppercase()
}

/** Цвет аватарки по имени — тот же FNV-1a, что avatarStyle() на сайте. */
fun avatarIndex(seed: String): Int {
    var h = 2166136261L.toInt()
    var i = 0
    while (i < seed.length) {
        val cp = seed.codePointAt(i)
        h = (h xor cp) * 16777619
        i += Character.charCount(cp)
    }
    h = h xor (h ushr 15)
    h *= 2246822507L.toInt()
    h = h xor (h ushr 13)
    return ((h.toLong() and 0xFFFFFFFFL) % AvatarColors.size).toInt()
}

fun fmtDur(s: Number?): String {
    val v = (s?.toDouble() ?: 0.0).toLong()
    return "${v / 60}:${(v % 60).toString().padStart(2, '0')}"
}

private val hm = SimpleDateFormat("HH:mm", Locale.getDefault())
private val dm = SimpleDateFormat("d MMM", Locale.getDefault())
private val dmy = SimpleDateFormat("d MMM yyyy", Locale.getDefault())
fun timeOf(at: Long?) = at?.let { hm.format(Date(it)) } ?: ""
fun listTime(at: Long?): String {
    at ?: return ""
    val now = Calendar.getInstance()
    val c = Calendar.getInstance().apply { timeInMillis = at }
    return when {
        now.get(Calendar.YEAR) == c.get(Calendar.YEAR) && now.get(Calendar.DAY_OF_YEAR) == c.get(Calendar.DAY_OF_YEAR) -> hm.format(Date(at))
        now.get(Calendar.YEAR) == c.get(Calendar.YEAR) -> dm.format(Date(at))
        else -> dmy.format(Date(at))
    }
}
fun dayLabel(at: Long): String {
    val now = Calendar.getInstance()
    val c = Calendar.getInstance().apply { timeInMillis = at }
    val sameYear = now.get(Calendar.YEAR) == c.get(Calendar.YEAR)
    val diff = now.get(Calendar.DAY_OF_YEAR) - c.get(Calendar.DAY_OF_YEAR)
    return when {
        sameYear && diff == 0 -> "Today"
        sameYear && diff == 1 -> "Yesterday"
        sameYear -> dm.format(Date(at))
        else -> dmy.format(Date(at))
    }
}
fun sameDay(a: Long, b: Long): Boolean {
    val x = Calendar.getInstance().apply { timeInMillis = a }
    val y = Calendar.getInstance().apply { timeInMillis = b }
    return x.get(Calendar.YEAR) == y.get(Calendar.YEAR) && x.get(Calendar.DAY_OF_YEAR) == y.get(Calendar.DAY_OF_YEAR)
}

fun Data.previewText(m: JsonObject?): String {
    m ?: return ""
    val text = m.str("text")
    val caption = m.str("caption")
    if (text?.startsWith("e1:") == true || caption?.startsWith("e1:") == true) return "Message unavailable"
    val cap = caption?.takeIf { it.isNotBlank() }?.let { " · $it" } ?: ""
    return when (m.str("kind")) {
        "photo" -> if (m.bool("viewOnce")) (if (m.bool("viewed")) "Photo viewed" else "Photo") else "Photo$cap"
        "video" -> "Video$cap"
        "voice" -> "Voice message · ${fmtDur(m.num("duration"))}"
        "audio" -> m.str("name") ?: "Music"
        "code" -> "Code · ${m.str("lang")}$cap"
        "emoji" -> emojiChar(m.str("emoji")).ifEmpty { "Emoji" }
        "post" -> "Shared post"
        "album" -> "Album · ${m.arr("items").size}$cap"
        "round" -> "Video message · ${fmtDur(m.num("duration"))}"
        "sticker" -> "Sticker" + (m.obj("sticker")?.str("text")?.takeIf { it.isNotEmpty() }?.let { " · $it" } ?: "")
        "poll" -> (if (m.obj("poll")?.bool("quiz") == true) "Quiz: " else "Poll: ") + (m.obj("poll")?.str("question") ?: "")
        "invite" -> "Invitation"
        "call" -> (if (m.bool("video")) "Video call" else "Call") + (m.num("duration")?.takeIf { it > 0 }?.let { " · ${fmtDur(it)}" } ?: "")
        "todo" -> "Checklist: " + (m.obj("todo")?.str("title") ?: "")
        "location" -> "Location"
        "join" -> {
            val who = accounts[m.str("from")]?.str("name") ?: "Someone"
            m.str("by")?.let { "${accounts[it]?.str("name") ?: "Someone"} added $who" } ?: "$who joined the group"
        }
        else -> text.orEmpty()
    }
}

/** Сообщения чата, которые видит этот человек (без комментариев к постам и истёкших). */
fun Data.visibleMessages(c: JsonObject): List<JsonObject> {
    val me = me
    val now = System.currentTimeMillis()
    val cleared = user?.obj("chatPrefs")?.obj(c.str("id") ?: "")?.num("clearedAt") ?: 0
    return c.arr("messages").objects().filter { m ->
        (m.num("at") ?: 0) > cleared && m.str("threadOf") == null && (me == null || me !in m.strings("hiddenFor")) &&
            (m.num("expiresAt")?.let { it > now } ?: true)
    }
}

fun Data.unread(c: JsonObject): Int {
    val me = me ?: return 0
    val read = c.obj("read")?.num(me) ?: 0
    return visibleMessages(c).count { it.str("from") != me && (it.num("at") ?: 0) > read && it.str("kind") != "join" }
}

fun Data.pref(id: String?): JsonObject? = id?.let { user?.obj("chatPrefs")?.obj(it) }

fun Data.muted(c: JsonObject): Boolean {
    val p = pref(c.str("id")) ?: return false
    val until = p.num("mutedUntil")
    return p.bool("muted") || (until != null && until > System.currentTimeMillis())
}

/** Мои чаты, свежие сверху; закреплённые выше; архив — отдельно. */
fun Data.chatList(archived: Boolean = false): List<JsonObject> {
    val me = me ?: return emptyList()
    return chats.values
        .filter { me in it.strings("members") && (pref(it.str("id"))?.bool("archived") == true) == archived }
        .filter { it.str("id")?.startsWith("secret_") != true || visibleMessages(it).isNotEmpty() }
        .filter { visibleMessages(it).isNotEmpty() || isRoom(it) || isSaved(it) }
        .sortedWith(compareByDescending<JsonObject> { pref(it.str("id"))?.bool("pinned") == true }
            .thenByDescending { visibleMessages(it).lastOrNull()?.num("at") ?: it.num("createdAt") ?: 0 })
}

data class KosmoNote(val title: String, val text: String, val at: Long, val rows: List<Pair<String, String>>)

/** Служебные сообщения Kosmo: приветствие, новые входы, смена почты… */
fun Data.kosmoNotes(): List<KosmoNote> {
    val u = user ?: return emptyList()
    val first = firstName(u.str("name"))
    return u.arr("messages").objects().map { m ->
        val (title, text) = when (m.str("kind")) {
            "welcome" -> "Welcome to Kosmo, $first!" to "Your account has been created. This device was added as a trusted device."
            "login" -> "New login to your account" to "A device signed in to your account. If it wasn’t you, terminate this session."
            "passcode" -> "Passcode changed" to "The passcode of your account was changed."
            "reminder" -> "Reminder" to (m.str("text") ?: "")
            "reset" -> "Passcode reset" to "The passcode was reset with a code from your email. All other sessions were signed out."
            "email" -> "Email changed" to "Your email was changed from ${m.str("from")} to ${m.str("to")}."
            else -> "Kosmo" to (m.str("text") ?: "")
        }
        val rows = listOfNotNull(m.str("device")?.let { "Device" to it }, m.str("ip")?.let { "IP address" to it }, m.str("location")?.let { "Location" to it })
        KosmoNote(title, text, m.num("at") ?: 0, rows)
    }.sortedBy { it.at }
}

/** Непрочитанные сообщения Kosmo (как kosmoUnread() на сайте). */
fun Data.kosmoUnread(): Int {
    val u = user ?: return 0
    val cur = u.arr("sessions").objects().firstOrNull { it.bool("current") }
    val readAt = pref(KOSMO_CHAT)?.num("readAt") ?: ((cur?.num("createdAt") ?: 0) - 1)
    return u.arr("messages").objects().count { (it.num("at") ?: 0) > readAt }
}
