package app.kosmo.chat.ui

import android.content.Context
import android.os.Build
import androidx.compose.runtime.compositionLocalOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import app.kosmo.chat.BuildConfig
import app.kosmo.chat.core.Api
import app.kosmo.chat.core.Auth
import app.kosmo.chat.core.Data
import app.kosmo.chat.core.JSON
import app.kosmo.chat.core.Kosmo
import app.kosmo.chat.core.KosmoEvent
import app.kosmo.chat.core.SessionInfo
import app.kosmo.chat.core.jobj
import app.kosmo.chat.core.obj
import app.kosmo.chat.core.bool
import app.kosmo.chat.core.num
import app.kosmo.chat.core.strings
import app.kosmo.chat.core.with
import app.kosmo.chat.core.without
import app.kosmo.chat.core.str
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.FlowPreview
import kotlinx.coroutines.flow.debounce
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import java.io.File

val LocalMedia = compositionLocalOf<(String) -> String> { { id -> "${BuildConfig.KOSMO_URL}/media/$id" } }

/** Экраны поверх вкладок (свой стек: «Назад» снимает верхний). */
sealed interface Screen {
    data class Chat(val id: String, val other: String? = null, val focus: String? = null) : Screen
    data class User(val id: String) : Screen
    data object EditProfile : Screen
    data object ChangeEmail : Screen
    data class Photo(val media: String) : Screen
    data class Video(val media: String) : Screen
    data object KosmoChat : Screen
    data object Sessions : Screen
    data class Settings(val page: String) : Screen
    data class NewRoom(val type: String) : Screen
    data class RoomInfo(val id: String) : Screen
    data object Archive : Screen
    data class Post(val id: String) : Screen
    data object NewPost : Screen
    data class Stories(val author: String) : Screen
    data class Forward(val chatId: String? = null, val msgId: String? = null, val postId: String? = null) : Screen
    data object Round : Screen
}

enum class Tab { Chats, Feed, Search, Profile }

/** Состояние приложения: сеанс, синхронизация, навигация. */
const val MAX_ACCOUNTS = 5

class AppState(private val ctx: Context, val scope: CoroutineScope) {
    private val prefs = ctx.getSharedPreferences("kosmo", Context.MODE_PRIVATE)
    var token by mutableStateOf(prefs.getString("token", null))
        internal set
    val api = Api(BuildConfig.KOSMO_URL) { token }
    val kosmo = Kosmo(api, scope) { token }
    val auth = Auth(api, "Kosmo for Android · ${Build.MANUFACTURER.replaceFirstChar { it.uppercase() }} ${Build.MODEL}")
    val stack = mutableStateListOf<Screen>()
    var tab by mutableStateOf(Tab.Chats)
    var toast by mutableStateOf<String?>(null)
    var openChatId by mutableStateOf<String?>(null)
    var locked by mutableStateOf(false)
    var roundResult by mutableStateOf<Pair<File, Double>?>(null)
    var lastNavForward by mutableStateOf(true)
        private set
    private val cache = File(ctx.filesDir, "snapshot.json")
    val calls = Calls(ctx, this, scope)
    val notifier = Notifier(ctx, this, scope)

    init {
        Design.init(ctx)
        I18n.init(ctx)
        Voice.init(ctx)
        // быстрый старт без сети: последний снимок с диска
        if (token != null) runCatching {
            val j = JSON.parseToJsonElement(cache.readText()) as JsonObject
            kosmo.data.value = Data(
                me = j.str("me"),
                accounts = j.obj("accounts")?.mapValues { it.value as JsonObject } ?: emptyMap(),
                chats = j.obj("chats")?.mapValues { it.value as JsonObject } ?: emptyMap(),
                feed = (j["feed"] as? JsonArray)?.mapNotNull { it as? JsonObject } ?: emptyList(),
                loaded = true,
            )
        }
        scope.launch {
            kosmo.events.collect { e ->
                when (e) {
                    is KosmoEvent.Error -> toast = e.message
                    KosmoEvent.SessionEnded -> signOut(local = true)
                    else -> {}
                }
            }
        }
        @OptIn(FlowPreview::class)
        scope.launch {
            kosmo.data.debounce(1500).collect { d ->
                if (d.loaded && d.me != null) withContext(Dispatchers.IO) {
                    runCatching { cache.writeText(jobj("me" to d.me, "accounts" to d.accounts, "chats" to d.chats, "feed" to d.feed.take(50)).toString()) }
                }
            }
        }
        if (token != null) start()
        locked = token != null && kosmo.data.value.user?.obj("security")?.bool("lock") == true
    }

    private fun start() {
        scope.launch {
            try { kosmo.load() } catch (e: app.kosmo.chat.core.ApiException) {
                if (e.status == 401) { signOut(local = true); return@launch }
            }
            kosmo.connect()
        }
    }

    fun signedIn(s: SessionInfo) {
        prefs.edit().putString("token", s.token).putString("uid", s.uid).apply()
        token = s.token
        tab = Tab.Chats
        stack.clear()
        start()
        rememberAccount(s.uid, s.token)
    }

    /* ---------- Несколько аккаунтов (до 5), как accounts.js на сайте ---------- */
    var accounts by mutableStateOf(readAccounts())
        private set
    private fun readAccounts(): List<JsonObject> = runCatching {
        (JSON.parseToJsonElement(prefs.getString("accounts", "[]") ?: "[]") as JsonArray).mapNotNull { it as? JsonObject }.filter { it.str("token") != null }
    }.getOrDefault(emptyList())
    private fun writeAccounts(list: List<JsonObject>) { accounts = list.take(MAX_ACCOUNTS); prefs.edit().putString("accounts", JsonArray(accounts).toString()).apply() }
    private fun rememberAccount(uid: String, tok: String) = writeAccounts(listOf(jobj("uid" to uid, "token" to tok)) + accounts.filter { it.str("uid") != uid })

    init {
        // имя и почта для строки аккаунта — после загрузки своего профиля
        scope.launch {
            kosmo.data.collect { d ->
                val u = d.user ?: return@collect
                val cur = accounts.firstOrNull { it.str("uid") == d.me } ?: token?.let { jobj("uid" to d.me, "token" to it) } ?: return@collect
                val next = cur.with("name" to u.str("name"), "email" to u.str("email"), "avatar" to u.obj("avatar"))
                val list = listOf(next) + accounts.filter { it.str("uid") != d.me }
                if (list != accounts) writeAccounts(list)
            }
        }
    }

    fun switchAccount(uid: String) {
        val t = accounts.firstOrNull { it.str("uid") == uid } ?: return
        kosmo.disconnect()
        kosmo.data.value = Data()
        cache.delete()
        prefs.edit().putString("token", t.str("token")).putString("uid", uid).apply()
        token = t.str("token")
        stack.clear()
        tab = Tab.Chats
        locked = false
        scope.launch {
            try { kosmo.load(); kosmo.connect() } catch (e: app.kosmo.chat.core.ApiException) {
                if (e.status == 401) { writeAccounts(accounts.filter { it.str("uid") != uid }); toast = "This session was terminated"; signOut(local = true) }
            }
        }
    }

    /** «Add account»: на экран входа, не выходя из остальных. */
    fun addAccount() {
        if (accounts.size >= MAX_ACCOUNTS) { toast = "Maximum $MAX_ACCOUNTS accounts"; return }
        kosmo.disconnect()
        kosmo.data.value = Data()
        cache.delete()
        prefs.edit().remove("token").remove("uid").apply()
        token = null
        stack.clear()
    }

    /** «Не беспокоить»: время окончания или 0. */
    fun dndUntil(): Long = (kosmo.data.value.user?.obj("settings")?.num("dnd") ?: 0L).takeIf { it > System.currentTimeMillis() } ?: 0L

    fun signOut(local: Boolean = false) {
        val wasToken = token
        val meUid = kosmo.data.value.me
        kosmo.disconnect()
        kosmo.data.value = Data()
        if (!local && wasToken != null) scope.launch { auth.logout(wasToken) }
        prefs.edit().remove("token").remove("uid").apply()
        cache.delete()
        locked = false
        token = null
        stack.clear()
        // выход из одного аккаунта — переключение на следующий, если он есть
        writeAccounts(accounts.filter { it.str("token") != wasToken && it.str("uid") != meUid })
        val other = accounts.firstOrNull()
        if (other != null) { switchAccount(other.str("uid")!!); return }
        KosmoService.stop(ctx)
    }

    fun push(s: Screen) { lastNavForward = true; stack.add(s) }
    fun pop(): Boolean { if (stack.isEmpty()) return false; lastNavForward = false; stack.removeAt(stack.lastIndex); return true }

    /** Настройка чата у себя (chatPrefs): закреп, звук, архив, очистка, обои… */
    fun setPref(chatId: String, key: String, value: Any?) {
        val u = kosmo.data.value.user ?: return
        val all = u.obj("chatPrefs") ?: JsonObject(emptyMap())
        val cur = all.obj(chatId) ?: JsonObject(emptyMap())
        val next = if (value == null) cur.without(key) else cur.with(key to value)
        kosmo.updateMe(jobj("chatPrefs" to JsonObject(all + (chatId to next))))
    }

    fun setPrivacy(key: String, value: Any?) {
        val u = kosmo.data.value.user ?: return
        val p = u.obj("privacy") ?: JsonObject(emptyMap())
        kosmo.updateMe(jobj("privacy" to (if (value == null) p.without(key) else p.with(key to value))))
    }

    fun setSecurity(key: String, value: Any?) {
        val u = kosmo.data.value.user ?: return
        val p = u.obj("security") ?: JsonObject(emptyMap())
        kosmo.updateMe(jobj("security" to (if (value == null) p.without(key) else p.with(key to value))))
    }

    fun setSetting(path: String, value: Any?) {
        val u = kosmo.data.value.user ?: return
        val s = u.obj("settings") ?: JsonObject(emptyMap())
        val next = if ("." in path) {
            val (a, b) = path.split(".", limit = 2)
            val sub = s.obj(a) ?: JsonObject(emptyMap())
            s.with(a to (if (value == null) sub.without(b) else sub.with(b to value)))
        } else if (value == null) s.without(path) else s.with(path to value)
        kosmo.updateMe(jobj("settings" to next))
    }

    /** Удалить чат (личный — у обоих), выйти из группы/канала или удалить свою. */
    fun deleteChat(id: String) {
        val d = kosmo.data.value
        val c = d.chats[id] ?: return
        val me = d.me ?: return
        if (isRoom(c) && c.str("owner") != me) {
            kosmo.commit(jobj("col" to "chats", "id" to id, "op" to "put", "set" to jobj("members" to (c.strings("members") - me))))
        } else kosmo.commit(jobj("col" to "chats", "id" to id, "op" to "del"))
        stack.removeAll { it is Screen.Chat && it.id == id }
    }

    // код-пароль на вход в приложение (Security → Passcode lock)
    private var awayAt = 0L
    fun onStop() { awayAt = System.currentTimeMillis() }
    fun onStart() {
        val sec = kosmo.data.value.user?.obj("security") ?: return
        if (!sec.bool("lock") || token == null) return
        val after = (sec.num("autoLock") ?: 0) * 60_000
        if (awayAt == 0L || System.currentTimeMillis() - awayAt >= after) locked = true
    }

    fun openChat(id: String, other: String? = null) {
        stack.removeAll { it is Screen.Chat }
        push(Screen.Chat(id, other))
    }

    fun startCall(userId: String, video: Boolean) { calls.start(userId, video) }

    fun openDm(userId: String) {
        val me = kosmo.data.value.me ?: return
        if (userId == me) { openChat("saved_$me"); return }
        openChat(kosmo.dmId(me, userId), userId)
    }
}
