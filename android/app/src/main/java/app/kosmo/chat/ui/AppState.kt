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
    data class Chat(val id: String, val other: String? = null) : Screen
    data class User(val id: String) : Screen
    data object EditProfile : Screen
    data class Photo(val media: String) : Screen
    data class Video(val media: String) : Screen
    data object KosmoChat : Screen
    data object Sessions : Screen
}

enum class Tab { Chats, Feed, Search, Profile }

/** Состояние приложения: сеанс, синхронизация, навигация. */
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
    private val cache = File(ctx.filesDir, "snapshot.json")
    val calls = Calls(ctx, this, scope)

    init {
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
    }

    fun signOut(local: Boolean = false) {
        val wasToken = token
        scope.launch {
            if (!local && wasToken != null) auth.logout()
            kosmo.disconnect()
            kosmo.data.value = Data()
        }
        prefs.edit().remove("token").remove("uid").apply()
        cache.delete()
        token = null
        stack.clear()
    }

    fun push(s: Screen) { stack.add(s) }
    fun pop(): Boolean { if (stack.isEmpty()) return false; stack.removeAt(stack.lastIndex); return true }

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
