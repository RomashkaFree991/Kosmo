package app.kosmo.sms

import android.Manifest
import android.annotation.SuppressLint
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.LargeTopAppBar
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent { KosmoTheme { GatewayScreen() } }
    }
}

@Composable
fun KosmoTheme(content: @Composable () -> Unit) {
    val dark = isSystemInDarkTheme()
    val ctx = LocalContext.current
    val scheme = when {
        Build.VERSION.SDK_INT >= 31 -> if (dark) dynamicDarkColorScheme(ctx) else dynamicLightColorScheme(ctx)
        dark -> darkColorScheme(primary = Color(0xFFD0BCFF), secondary = Color(0xFF64D2FF))
        else -> lightColorScheme(primary = Color(0xFF6750A4), secondary = Color(0xFF00658F))
    }
    MaterialTheme(colorScheme = scheme, content = content)
}

@SuppressLint("BatteryLife")
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GatewayScreen() {
    val ctx = LocalContext.current
    val prefs = remember { Prefs(ctx) }
    val state by GatewayService.state.collectAsStateWithLifecycle()
    var server by remember { mutableStateOf(prefs.server) }
    var key by remember { mutableStateOf(prefs.key) }
    var hasSms by remember { mutableStateOf(granted(ctx, Manifest.permission.SEND_SMS)) }
    val pm = ctx.getSystemService(PowerManager::class.java)
    var batteryFree by remember { mutableStateOf(pm.isIgnoringBatteryOptimizations(ctx.packageName)) }

    val askPerms = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { res ->
        hasSms = res[Manifest.permission.SEND_SMS] == true || granted(ctx, Manifest.permission.SEND_SMS)
        if (hasSms) GatewayService.start(ctx)
    }
    fun start() {
        prefs.server = server
        prefs.key = key
        val need = buildList {
            add(Manifest.permission.SEND_SMS)
            if (Build.VERSION.SDK_INT >= 33) add(Manifest.permission.POST_NOTIFICATIONS)
        }.filterNot { granted(ctx, it) }
        if (need.isEmpty()) GatewayService.start(ctx) else askPerms.launch(need.toTypedArray())
    }

    val scroll = TopAppBarDefaults.exitUntilCollapsedScrollBehavior()
    Scaffold(
        modifier = Modifier.nestedScroll(scroll.nestedScrollConnection),
        topBar = { LargeTopAppBar(title = { Text("Kosmo SMS") }, scrollBehavior = scroll) },
    ) { pad ->
        Column(
            Modifier.fillMaxSize().padding(pad).verticalScroll(rememberScrollState()).padding(horizontal = 16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            StatusCard(state)

            Text(
                "Телефон отправляет коды входа Kosmo со своей SIM-карты. Бесплатно — по тарифу вашей SIM, без сторонних сервисов.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )

            OutlinedTextField(
                value = server, onValueChange = { server = it },
                label = { Text("Сервер") }, placeholder = { Text("kosmochat.duckdns.org") },
                singleLine = true, enabled = !state.running,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = key, onValueChange = { key = it.uppercase() },
                label = { Text("Ключ шлюза") }, placeholder = { Text("XXXX-XXXX-XXXX-XXXX") },
                supportingText = { Text("Покажет команда на сервере: kosmo sms-key") },
                singleLine = true, enabled = !state.running,
                textStyle = MaterialTheme.typography.bodyLarge.copy(fontFamily = FontFamily.Monospace),
                keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Characters, keyboardType = KeyboardType.Ascii),
                modifier = Modifier.fillMaxWidth(),
            )

            if (state.running) {
                FilledTonalButton(onClick = { GatewayService.stop(ctx) }, modifier = Modifier.fillMaxWidth().height(56.dp)) {
                    Text("Остановить")
                }
            } else {
                Button(
                    onClick = { start() },
                    enabled = server.isNotBlank() && key.isNotBlank(),
                    modifier = Modifier.fillMaxWidth().height(56.dp),
                ) { Text("Включить шлюз") }
            }

            if (!hasSms && state.running.not()) {
                Text("Нужно разрешение на отправку SMS — оно спросится при включении.", style = MaterialTheme.typography.bodySmall)
            }

            if (!batteryFree) {
                Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.tertiaryContainer)) {
                    Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("Экономия батареи", style = MaterialTheme.typography.titleMedium)
                        Text("Чтобы Android не усыплял шлюз, разрешите ему работать в фоне без ограничений.", style = MaterialTheme.typography.bodyMedium)
                        FilledTonalButton(onClick = {
                            ctx.startActivity(Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:${ctx.packageName}")))
                            batteryFree = true
                        }) { Text("Разрешить") }
                    }
                }
            }

            if (state.log.isNotEmpty()) {
                Text("Журнал", style = MaterialTheme.typography.titleMedium)
                state.log.forEach { Text(it, style = MaterialTheme.typography.bodyMedium) }
            }
            Spacer(Modifier.height(24.dp))
        }
    }
}

@Composable
private fun StatusCard(state: GatewayState) {
    val dot by animateColorAsState(
        when {
            state.online -> Color(0xFF34C759)
            state.running -> Color(0xFFFF9F0A)
            else -> MaterialTheme.colorScheme.outline
        },
        animationSpec = spring(), label = "dot",
    )
    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer),
        shape = MaterialTheme.shapes.extraLarge,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Spacer(Modifier.size(12.dp).clip(CircleShape).background(dot))
                Spacer(Modifier.width(10.dp))
                Text(state.status, style = MaterialTheme.typography.titleMedium)
            }
            Text("Отправлено кодов: ${state.sent}", style = MaterialTheme.typography.bodyMedium)
        }
    }
}

private fun granted(ctx: android.content.Context, perm: String) =
    ContextCompat.checkSelfPermission(ctx, perm) == PackageManager.PERMISSION_GRANTED
