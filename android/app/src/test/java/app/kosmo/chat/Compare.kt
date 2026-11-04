package app.kosmo.chat

import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.kosmo.chat.core.Data
import app.kosmo.chat.core.JSON
import app.kosmo.chat.core.arr
import app.kosmo.chat.core.obj
import app.kosmo.chat.core.objects
import app.kosmo.chat.core.str
import app.kosmo.chat.ui.AppState
import app.kosmo.chat.ui.Design
import app.kosmo.chat.ui.KosmoRoot
import app.kosmo.chat.ui.KosmoTheme
import app.kosmo.chat.ui.LocalMedia
import app.kosmo.chat.ui.Screen
import app.kosmo.chat.ui.Tab
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.serialization.json.JsonObject
import org.junit.Rule
import org.junit.Test

/** Те же данные, что на сайте (fixture.json — снимок /api/sync), тот же размер экрана. */
class Compare {
    @get:Rule val paparazzi = Paparazzi(deviceConfig = DeviceConfig.PIXEL_6.copy(softButtons = false, screenHeight = 2400), theme = "android:Theme.Material.NoActionBar", maxPercentDifference = 1.0)
    private val registry = object : androidx.activity.result.ActivityResultRegistryOwner {
        override val activityResultRegistry = object : androidx.activity.result.ActivityResultRegistry() {
            override fun <I, O> onLaunch(requestCode: Int, contract: androidx.activity.result.contract.ActivityResultContract<I, O>, input: I, options: androidx.core.app.ActivityOptionsCompat?) {}
        }
    }
    private val photo = java.io.File(System.getProperty("user.dir")!!, "src/test/resources/photo.jpg").absolutePath

    private fun app(): AppState {
        val snap = JSON.parseToJsonElement(javaClass.classLoader!!.getResource("fixture.json")!!.readText()) as JsonObject
        val a = AppState(paparazzi.context, CoroutineScope(Dispatchers.Unconfined))
        a.token = "test"
        a.kosmo.data.value = Data(
            me = snap.str("me"),
            accounts = snap.obj("accounts")!!.mapValues { it.value as JsonObject },
            chats = snap.obj("chats")!!.mapValues { it.value as JsonObject },
            feed = snap.arr("feed").objects(), stories = snap.arr("stories").objects(), loaded = true,
        )
        a.kosmo.online.value = true
        return a
    }

    private fun shot(name: String, setup: (AppState) -> Unit = {}) {
        for (glass in listOf(true, false)) {
            val a = app(); setup(a)
            Design.glass = glass
            paparazzi.snapshot(name = (if (glass) "glass_" else "material_") + name) { Wrap(a) }
        }
    }

    @Composable private fun Wrap(a: AppState) = CompositionLocalProvider(LocalMedia provides { photo }, androidx.activity.compose.LocalActivityResultRegistryOwner provides registry) { KosmoTheme(dark = true) { KosmoRoot(a) } }

    private fun dm(a: AppState) = a.kosmo.data.value.chats.keys.first { !it.startsWith("group") && a.kosmo.data.value.chats[it]!!.arr("messages").size > 5 }

    @Test fun chats() = shot("chats")
    @Test fun chat() = shot("chat") { it.push(Screen.Chat(dm(it))) }
    @Test fun feed() = shot("feed") { it.tab = Tab.Feed }
    @Test fun search() = shot("search") { it.tab = Tab.Search }
    @Test fun profile() = shot("profile") { it.tab = Tab.Profile }
    @Test fun privacy() = shot("privacy") { it.push(Screen.Settings("privacy")) }
    @Test fun security() = shot("security") { it.push(Screen.Settings("security")) }
    @Test fun notifications() = shot("notifications") { it.push(Screen.Settings("notifications")) }
    @Test fun storage() = shot("storage") { it.push(Screen.Settings("storage")) }
    @Test fun designs() = shot("designs") { it.push(Screen.Settings("designs")) }
    @Test fun edit() = shot("edit") { it.push(Screen.EditProfile) }
    @Test fun user() = shot("user") { s -> s.push(Screen.User(s.kosmo.data.value.accounts.values.first { it.str("name") == "Boris" }.str("id")!!)) }

    /** Вход и регистрация: шаги как на сайте (без заставки). */
    private fun auth(step: String) {
        for (glass in listOf(true, false)) {
            val a = AppState(paparazzi.context, CoroutineScope(Dispatchers.Unconfined))
            Design.glass = glass
            paparazzi.snapshot(name = (if (glass) "glass_" else "material_") + "auth_" + step) {
                CompositionLocalProvider(androidx.activity.compose.LocalActivityResultRegistryOwner provides registry) { KosmoTheme(dark = true) { app.kosmo.chat.ui.AuthScreen(a, preview = step) } }
            }
        }
    }
    @Test fun mono() { try { shot("mono") { Design.colorStyle = "mono" } } finally { Design.colorStyle = "tonal" } }
    @Test fun chatPlus() = pop("plus")
    @Test fun chatEmoji() = pop("emoji")
    private fun pop(what: String) {
        for (glass in listOf(true, false)) {
            val a = app(); Design.glass = glass
            val id = dm(a)
            paparazzi.snapshot(name = (if (glass) "glass_" else "material_") + "chat_" + what) {
                CompositionLocalProvider(LocalMedia provides { photo }, androidx.activity.compose.LocalActivityResultRegistryOwner provides registry) {
                    KosmoTheme(dark = true) { app.kosmo.chat.ui.ChatScreen(a, id, null, null, initialPop = what) }
                }
            }
        }
    }
    @Test fun authEmail() = auth("email")
    @Test fun authCode() = auth("code")
    @Test fun authPass() = auth("newpass")
    @Test fun authName() = auth("name")
}
