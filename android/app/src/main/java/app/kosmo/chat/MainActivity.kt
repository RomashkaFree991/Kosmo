package app.kosmo.chat

import android.graphics.Color
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.lifecycle.lifecycleScope
import app.kosmo.chat.ui.AppState
import app.kosmo.chat.ui.KosmoRoot
import app.kosmo.chat.ui.KosmoTheme

/** Kosmo для Android — нативный клиент на Kotlin и Jetpack Compose. */
class MainActivity : ComponentActivity() {
    private lateinit var app: AppState

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge(SystemBarStyle.dark(Color.TRANSPARENT), SystemBarStyle.dark(Color.TRANSPARENT))
        super.onCreate(savedInstanceState)
        app = (lastNonConfigurationInstance as? AppState) ?: AppState(applicationContext, lifecycleScope)
        setContent { KosmoTheme { KosmoRoot(app) } }
    }

    override fun onResume() {
        super.onResume()
        app.kosmo.wake()
    }
}
