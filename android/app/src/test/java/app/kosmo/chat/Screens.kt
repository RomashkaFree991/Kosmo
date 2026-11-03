package app.kosmo.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.kosmo.chat.core.Data
import app.kosmo.chat.core.jobj
import app.kosmo.chat.ui.AppState
import app.kosmo.chat.ui.Calls
import app.kosmo.chat.ui.ChatListScreen
import app.kosmo.chat.ui.ChatScreen
import app.kosmo.chat.ui.EditProfileScreen
import app.kosmo.chat.ui.KosmoRoot
import app.kosmo.chat.ui.KosmoTheme
import app.kosmo.chat.ui.LocalMedia
import app.kosmo.chat.ui.PlanetLogo
import app.kosmo.chat.ui.ProfileScreen
import app.kosmo.chat.ui.Screen
import app.kosmo.chat.ui.UserScreen
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.serialization.json.JsonObject
import org.junit.Rule
import org.junit.Test

/** Скриншоты экранов на тестовых данных (без телефона и сети). */
class Screens {
    @get:Rule val paparazzi = Paparazzi(deviceConfig = DeviceConfig.PIXEL_6.copy(softButtons = false), theme = "android:Theme.Material.NoActionBar", maxPercentDifference = 1.0)

    private val now = System.currentTimeMillis()
    private val registry = object : androidx.activity.result.ActivityResultRegistryOwner {
        override val activityResultRegistry = object : androidx.activity.result.ActivityResultRegistry() {
            override fun <I, O> onLaunch(requestCode: Int, contract: androidx.activity.result.contract.ActivityResultContract<I, O>, input: I, options: androidx.core.app.ActivityOptionsCompat?) {}
        }
    }
    private fun msg(id: String, from: String, min: Int, vararg f: Pair<String, Any?>) = JsonObject(jobj("id" to id, "from" to from, "at" to now - min * 60_000L, "kind" to "text") + jobj(*f))

    private fun app(): AppState {
        val a = AppState(paparazzi.context, CoroutineScope(Dispatchers.Unconfined))
        a.token = "test"
        val me = jobj("id" to "me", "name" to "Anna Petrova", "username" to "anna", "publicId" to 7, "email" to "anna@kosmo.app", "bio" to "Space, coffee and Kotlin ☕️", "createdAt" to now - 40L * 86400_000, "avatar" to jobj("color" to null),
            "sessions" to listOf(jobj("id" to "s1", "name" to "Kosmo for Android · Pixel 8", "current" to true, "location" to "Moscow", "lastActive" to now)),
            "messages" to listOf(jobj("id" to "w", "kind" to "welcome", "at" to now - 40L * 86400_000)))
        val boris = jobj("id" to "b", "name" to "Boris", "username" to "boris", "publicId" to 8, "createdAt" to now - 10L * 86400_000, "online" to true)
        val kira = jobj("id" to "k", "name" to "Kira Lebedeva", "publicId" to 9, "createdAt" to now - 3L * 86400_000)
        val dm = jobj("id" to "b_me", "members" to listOf("me", "b"), "read" to jobj("me" to now, "b" to now - 30 * 60_000L), "messages" to listOf(
            msg("1", "b", 300, "text" to "Привет! Как дела с приложением?"),
            msg("2", "me", 290, "text" to "Переписала всё на Kotlin 🚀", "reactions" to jobj("fire" to listOf("b"))),
            msg("3", "b", 120, "kind" to "voice", "media" to "x", "duration" to 14),
            msg("4", "me", 60, "kind" to "sticker", "sticker" to jobj("emoji" to "party", "anim" to "pop", "text" to "GG")),
            msg("5", "b", 40, "kind" to "call", "status" to "ended", "duration" to 194),
            msg("6", "me", 20, "text" to "Созвонимся вечером?", "replyTo" to "1"),
            msg("7", "me", 1, "text" to "Это сообщение ещё отправляется"),
        ))
        val dm2 = jobj("id" to "k_me", "members" to listOf("me", "k"), "read" to jobj("me" to 0), "messages" to listOf(msg("a", "k", 5, "kind" to "photo", "media" to "p", "w" to 800, "h" to 600, "caption" to "Смотри какой закат"), msg("b", "k", 3, "text" to "Ты где?")))
        a.kosmo.data.value = Data(me = "me", accounts = mapOf("me" to me, "b" to boris, "k" to kira), chats = mapOf("b_me" to dm, "k_me" to dm2), pending = setOf("7"), loaded = true)
        return a
    }

    private fun shot(content: @Composable () -> Unit) = paparazzi.snapshot {
        CompositionLocalProvider(LocalMedia provides { "" }, androidx.activity.compose.LocalActivityResultRegistryOwner provides registry) { KosmoTheme(dark = true) { Box(Modifier.background(MaterialTheme.colorScheme.background)) { content() } } }
    }

    @Test fun planet() = shot { Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { PlanetLogo(Modifier.size(280.dp)) } }
    @Test fun chats() { val a = app(); shot { ChatListScreen(a, a.kosmo.data.value) } }
    @Test fun chat() { val a = app(); shot { ChatScreen(a, "b_me", "b") } }
    @Test fun profile() { val a = app(); shot { ProfileScreen(a, a.kosmo.data.value) } }
    @Test fun editProfile() { val a = app(); shot { EditProfileScreen(a) } }
    @Test fun user() { val a = app(); shot { UserScreen(a, "b") } }
    @Test fun tabs() { val a = app(); shot { KosmoRoot(a) } }
    @Test fun call() { val a = app(); a.calls.ui = Calls.Ui("c", "b", video = false, outgoing = true, status = "Calling…"); shot { KosmoRoot(a) } }
    @Test fun login() { val a = app(); a.token = null; shot { KosmoRoot(a) } }
    @Suppress("unused") private fun keep() = Screen.KosmoChat

}
