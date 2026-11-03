package app.kosmo.chat

import android.Manifest
import android.content.Intent
import android.graphics.Color
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.LaunchedEffect
import androidx.lifecycle.lifecycleScope
import app.kosmo.chat.ui.AppState
import app.kosmo.chat.ui.Design
import app.kosmo.chat.ui.KosmoRoot
import app.kosmo.chat.ui.KosmoService
import app.kosmo.chat.ui.KosmoTheme
import app.kosmo.chat.ui.LocalLook
import kotlinx.coroutines.MainScope

/** Kosmo для Android — нативный клиент на Kotlin и Jetpack Compose. */
class MainActivity : ComponentActivity() {
    private val askNotify = registerForActivityResult(ActivityResultContracts.RequestPermission()) {}

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge(SystemBarStyle.dark(Color.TRANSPARENT), SystemBarStyle.dark(Color.TRANSPARENT))
        super.onCreate(savedInstanceState)
        val app = state(this)
        setContent {
            KosmoTheme {
                val look = LocalLook.current
                // значки системных панелей — под тему (светлая / тёмная)
                LaunchedEffect(look.dark) {
                    val style = if (look.dark) SystemBarStyle.dark(Color.TRANSPARENT) else SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT)
                    enableEdgeToEdge(style, style)
                }
                KosmoRoot(app)
            }
        }
        if (Build.VERSION.SDK_INT >= 33) askNotify.launch(Manifest.permission.POST_NOTIFICATIONS)
        openFrom(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        openFrom(intent)
    }

    private fun openFrom(i: Intent?) {
        val chat = i?.getStringExtra("chat") ?: return
        state(this).openChat(chat)
    }

    override fun onStart() {
        super.onStart()
        val app = state(this)
        app.notifier.foreground = true
        app.onStart()
        app.kosmo.wake()
    }

    override fun onStop() {
        super.onStop()
        val app = state(this)
        app.notifier.foreground = false
        app.onStop()
        // в фоне соединение держит служба (если вход выполнен)
        if (app.token != null) KosmoService.start(this)
    }

    override fun onDestroy() {
        super.onDestroy()
        if (isFinishing && state(this).token == null) KosmoService.stop(this)
    }

    companion object {
        // одно состояние на процесс: служба и экран используют одно соединение
        @Volatile private var shared: AppState? = null
        fun state(a: ComponentActivity): AppState = shared ?: synchronized(this) {
            shared ?: AppState(a.applicationContext, MainScope()).also { shared = it; Design.init(a.applicationContext) }
        }
    }
}
