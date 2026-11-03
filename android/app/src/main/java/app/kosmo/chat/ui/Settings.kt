package app.kosmo.chat.ui

import androidx.compose.animation.AnimatedContent
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Block
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.Delete
import androidx.compose.material.icons.rounded.Devices
import androidx.compose.material.icons.rounded.Key
import androidx.compose.material.icons.rounded.Lock
import androidx.compose.material.icons.rounded.Mail
import androidx.compose.material.icons.rounded.NotificationsActive
import androidx.compose.material.icons.rounded.Shield
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.kosmo.chat.BuildConfig
import app.kosmo.chat.core.ApiException
import app.kosmo.chat.core.arr
import app.kosmo.chat.core.bool
import app.kosmo.chat.core.jobj
import app.kosmo.chat.core.num
import app.kosmo.chat.core.obj
import app.kosmo.chat.core.str
import app.kosmo.chat.core.strings
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonObject

private val EN = listOf("everybody" to "Everybody", "nobody" to "Nobody")

/** Страницы настроек — как на сайте. */
@Composable
fun SettingsScreen(app: AppState, page: String) {
    val data by app.kosmo.data.collectAsState()
    val look = LocalLook.current
    val title = when (page) {
        "privacy" -> "Privacy"; "security" -> "Security"; "notifications" -> "Notifications"; "storage" -> "Data and storage"
        "designs" -> "Designs"; "about" -> "About Kosmo"; "blocked" -> "Blocked users"; else -> page
    }
    Column(Modifier.fillMaxSize().background(look.page)) {
        Header { BackBtn(app); TitlePill(title); CircleSpacer() }
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).navigationBarsPadding().padding(bottom = 32.dp)) {
            when (page) {
                "privacy" -> Privacy(app, data.user)
                "security" -> Security(app, data.user)
                "notifications" -> Notifications(app, data.user)
                "storage" -> Storage(app, data)
                "designs" -> Designs(app)
                "about" -> About(app)
            }
        }
    }
}

@Composable
private fun Note(text: String) {
    val look = LocalLook.current
    Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp).clip(RoundedCornerShape(18.dp)).background(look.cell).padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(Icons.Rounded.Lock, null, tint = look.text2, modifier = Modifier.size(18.dp))
        Text(tr(text), color = look.text2, fontSize = 14.sp, modifier = Modifier.padding(start = 10.dp))
    }
}

@Composable
private fun Privacy(app: AppState, u: JsonObject?) {
    val p = u?.obj("privacy") ?: JsonObject(emptyMap())
    val ctx = LocalContext.current
    Note("Choose who can see your info and contact you. Changes apply instantly.")
    SectionLabel("Language")
    Group { ChoiceRow("Interface language", listOf("en" to "English", "ru" to "Русский"), I18n.lang) { I18n.set(ctx, it) } }
    SectionLabel("Who can see")
    Group {
        ChoiceRow("Email", EN, if (p.bool("showEmail")) "everybody" else "nobody") { app.setPrivacy("showEmail", it == "everybody") }
        ChoiceRow("Last seen & online", EN, p.str("lastSeen") ?: "everybody", "If hidden, people see “last seen recently”.") { app.setPrivacy("lastSeen", it) }
        ChoiceRow("Profile photo", EN, p.str("avatar") ?: "everybody") { app.setPrivacy("avatar", it) }
        ChoiceRow("Bio", EN, if (p.bool("hideBio")) "nobody" else "everybody") { app.setPrivacy("hideBio", it == "nobody") }
    }
    SectionLabel("Who can contact me")
    Group {
        ChoiceRow("New messages", EN, p.str("messages") ?: "everybody", "People who already chat with you can still write.") { app.setPrivacy("messages", it) }
        ChoiceRow("Add me to groups & channels", EN, p.str("groups") ?: "everybody") { app.setPrivacy("groups", it) }
        SwitchRow("Find me by email", p["findByEmail"]?.toString() != "false", "People who know your exact email can find you in Search.") { app.setPrivacy("findByEmail", it) }
    }
    SectionLabel("Messages")
    Group { SwitchRow("Read receipts", p["readReceipts"]?.toString() != "false", "If off, you won’t see read receipts from others either.") { app.setPrivacy("readReceipts", it) } }
    val data = app.kosmo.data.value
    val blocked = p.strings("blocked").mapNotNull { data.accounts[it] }
    SectionLabel(tr("Blocked users") + if (blocked.isNotEmpty()) " · ${blocked.size}" else "")
    Group {
        if (blocked.isEmpty()) Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Rounded.Block, null, tint = LocalLook.current.text2)
            Text(tr("Nobody is blocked. Block people from their profile."), color = LocalLook.current.text2, modifier = Modifier.padding(start = 12.dp))
        }
        blocked.forEach { b ->
            Row(Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                UserAvatar(b, 36.dp)
                Text(b.str("name") ?: "", Modifier.weight(1f).padding(start = 12.dp))
                TextButton({ app.setPrivacy("blocked", p.strings("blocked") - (b.str("id") ?: "")); app.toast = "Unblocked" }) { Text(tr("Unblock")) }
            }
        }
    }
}

private val LOCK_AFTER = listOf("0" to "On every launch", "1" to "After 1 min away", "5" to "After 5 min away", "60" to "After 1 hour away")
private val DESTRUCT = listOf("1" to "1 month", "3" to "3 months", "6" to "6 months", "12" to "1 year")

@Composable
private fun Security(app: AppState, u: JsonObject?) {
    val s = u?.obj("security") ?: JsonObject(emptyMap())
    var passFlow by remember { mutableStateOf<String?>(null) }   // change / delete
    val look = LocalLook.current
    Column(Modifier.fillMaxWidth().padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Box(Modifier.size(72.dp).clip(CircleShape).background(Color(0xFF30D158).copy(alpha = 0.16f)), contentAlignment = Alignment.Center) { Icon(Icons.Rounded.Shield, null, tint = Color(0xFF30D158), modifier = Modifier.size(38.dp)) }
        Text(tr("Your account is protected"), style = MaterialTheme.typography.titleLarge, modifier = Modifier.padding(top = 12.dp))
        Text(tr("Passcode, trusted devices and login alerts keep Kosmo safe."), color = look.text2, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 4.dp))
    }
    SectionLabel("Passcode")
    Group { GroupRow(Icons.Rounded.Key, "Change passcode") { passFlow = "change" } }
    Spacer(Modifier.height(10.dp))
    Group {
        SwitchRow("Passcode lock", s.bool("lock"), "Ask for the 4-digit passcode when Kosmo opens.") { app.setSecurity("lock", it) }
        if (s.bool("lock")) ChoiceRow("Auto-lock", LOCK_AFTER, "${s.num("autoLock") ?: 0}", wide = true) { app.setSecurity("autoLock", it.toInt()) }
    }
    SectionLabel("Account")
    Group {
        GroupRow(Icons.Rounded.Mail, "Change email", value = u?.str("email"), chevron = false) { app.toast = "Change email on the site" }
        GroupRow(Icons.Rounded.Devices, "Active sessions", value = "${u?.arr("sessions")?.size ?: 0}") { app.push(Screen.Sessions) }
    }
    Spacer(Modifier.height(10.dp))
    Group {
        SwitchRow("Login alerts in Kosmo chat", s["loginAlerts"]?.toString() != "false", "Get a message about every new sign-in.") { app.setSecurity("loginAlerts", it) }
        ChoiceRow("Delete my account if away for", DESTRUCT, "${s.num("destruct") ?: 6}", "Your data will be removed after this period of inactivity.", wide = true) { app.setSecurity("destruct", it.toInt()) }
    }
    Spacer(Modifier.height(10.dp))
    Group { GroupRow(Icons.Rounded.Delete, "Delete account", danger = true) { passFlow = "delete" } }
    passFlow?.let { mode -> PasscodeDialog(app, mode) { passFlow = null } }
}

/** Смена кода-пароля / удаление аккаунта: ввод кодов поверх экрана. */
@Composable
private fun PasscodeDialog(app: AppState, mode: String, onClose: () -> Unit) {
    var step by remember { mutableStateOf("current") }
    var current by remember { mutableStateOf("") }
    var next by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    var confirmDelete by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    androidx.compose.ui.window.Dialog(onDismissRequest = onClose, properties = androidx.compose.ui.window.DialogProperties(usePlatformDefaultWidth = false)) {
        Box(Modifier.fillMaxSize().background(LocalLook.current.page)) {
            Column(Modifier.fillMaxSize().safeDrawingPadding().padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
                    CircleBtn(Icons.AutoMirrored.Rounded.ArrowBack, "Back", onClick = onClose)
                    TitlePill(if (mode == "delete") "Delete account" else "Change passcode")
                    CircleSpacer()
                }
                Spacer(Modifier.height(40.dp))
                AnimatedContent(step, label = "pc") { st ->
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        PassStep(
                            when (st) { "current" -> "Enter your current passcode"; "new" -> "Create a new passcode"; else -> "Repeat the passcode" },
                            error, busy,
                        ) { code ->
                            error = null
                            when (st) {
                                "current" -> {
                                    busy = true
                                    scope.launch {
                                        val ok = runCatching { app.api.call("POST", "/api/passcode/verify", jobj("code" to code)).bool("ok") }.getOrDefault(false)
                                        busy = false
                                        if (!ok) error = "Wrong passcode"
                                        else { current = code; if (mode == "delete") confirmDelete = true else step = "new" }
                                    }
                                }
                                "new" -> if (code == current) error = "Choose a different passcode" else { next = code; step = "repeat" }
                                else -> if (code != next) error = "Passcodes don’t match" else {
                                    busy = true
                                    scope.launch {
                                        try { app.api.call("POST", "/api/passcode/change", jobj("current" to current, "next" to next)); app.toast = "Passcode changed"; onClose() }
                                        catch (e: ApiException) { error = e.message; busy = false }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    if (confirmDelete) AlertDialog(
        onDismissRequest = { confirmDelete = false; onClose() },
        title = { Text(tr("Delete account")) },
        text = { Text(tr("All your chats, posts and files will be deleted for good. This can’t be undone.")) },
        confirmButton = {
            TextButton({
                scope.launch {
                    try { app.api.call("DELETE", "/api/account", jobj("passcode" to current)); app.signOut(local = true) } catch (e: Exception) { app.toast = e.message }
                }
            }) { Text(tr("Delete"), color = MaterialTheme.colorScheme.error) }
        },
        dismissButton = { TextButton({ confirmDelete = false; onClose() }) { Text(tr("Cancel")) } },
    )
}

@Composable
private fun Notifications(app: AppState, u: JsonObject?) {
    val n = u?.obj("settings")?.obj("notify") ?: JsonObject(emptyMap())
    fun on(k: String) = n[k]?.toString() != "false"
    SectionLabel("Message notifications")
    Group {
        SwitchRow("Private chats", on("private")) { app.setSetting("notify.private", it) }
        SwitchRow("Groups", on("groups")) { app.setSetting("notify.groups", it) }
        SwitchRow("Channels", on("channels")) { app.setSetting("notify.channels", it) }
        SwitchRow("Show message preview", on("preview"), "Show the text of new messages in notifications.") { app.setSetting("notify.preview", it) }
    }
    SectionLabel("In-app")
    Group {
        SwitchRow("Sounds", on("sound")) { app.setSetting("notify.sound", it) }
        SwitchRow("Vibrate", on("vibrate")) { app.setSetting("notify.vibrate", it) }
        SwitchRow("Comments on my posts", on("feed")) { app.setSetting("notify.feed", it) }
    }
    Spacer(Modifier.height(16.dp))
    BigButton("Test notification", Modifier.padding(horizontal = 16.dp), secondary = true) { app.notifier.test() }
}

@Composable
private fun Storage(app: AppState, data: app.kosmo.chat.core.Data) {
    val ctx = LocalContext.current
    val look = LocalLook.current
    var size by remember { mutableStateOf(cacheSize(ctx)) }
    val s = data.user?.obj("settings") ?: JsonObject(emptyMap())
    val mine = data.chatList()
    Column(Modifier.fillMaxWidth().padding(16.dp).clip(RoundedCornerShape(22.dp)).background(look.cell).padding(20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Text(fmtBytes(size), fontSize = 34.sp, fontWeight = FontWeight.Bold)
        Text(tr("used on this device"), color = look.text2)
        Row(Modifier.fillMaxWidth().padding(top = 14.dp), horizontalArrangement = Arrangement.SpaceEvenly) {
            listOf(mine.size to "chats", mine.sumOf { it.arr("messages").size } to "messages", data.feed.count { it.str("author") == data.me } to "posts").forEach { (n, l) ->
                Column(horizontalAlignment = Alignment.CenterHorizontally) { Text("$n", fontWeight = FontWeight.Bold, fontSize = 18.sp); Text(tr(l), color = look.text2, fontSize = 13.sp) }
            }
        }
    }
    SectionLabel("Media")
    Group {
        SwitchRow("Auto-play videos in Feed", s["autoplay"]?.toString() != "false") { app.setSetting("autoplay", it) }
        SwitchRow("Compress photos before sending", s["compress"]?.toString() != "false") { app.setSetting("compress", it) }
    }
    Spacer(Modifier.height(16.dp))
    BigButton("Clear cache", Modifier.padding(horizontal = 16.dp), secondary = true) {
        ctx.cacheDir.listFiles()?.forEach { it.deleteRecursively() }
        coil.Coil.imageLoader(ctx).memoryCache?.clear()
        size = cacheSize(ctx)
        app.toast = "Cache cleared"
    }
}

private fun cacheSize(ctx: android.content.Context): Long = ctx.cacheDir.walkTopDown().filter { it.isFile }.sumOf { it.length() }
private fun fmtBytes(b: Long) = when { b > 1_000_000_000 -> "%.1f GB".format(b / 1e9); b > 1_000_000 -> "%.1f MB".format(b / 1e6); else -> "${maxOf(1, b / 1000)} KB" }

/** Оформление: превью, тема, стиль, цвет, стиль цвета — как «Designs» на сайте. */
@Composable
private fun Designs(app: AppState) {
    val look = LocalLook.current
    // превью: список и пузыри
    Column(Modifier.fillMaxWidth().padding(16.dp).clip(RoundedCornerShape(26.dp)).background(look.page).border(0.8.dp, look.ink.copy(alpha = 0.12f), RoundedCornerShape(26.dp)).padding(12.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            KosmoAvatar(48.dp)
            Column(Modifier.weight(1f).padding(start = 10.dp)) { Text("Kosmo", fontWeight = FontWeight.SemiBold); Text(tr("Welcome to Kosmo!"), color = look.text2, fontSize = 14.sp) }
            Badge(1)
        }
        Spacer(Modifier.height(10.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Avatar("Emma Wilson", null, 48.dp)
            Column(Modifier.weight(1f).padding(start = 10.dp)) { Text(tr("Emma Wilson"), fontWeight = FontWeight.SemiBold); Text(tr("See you tonight?"), color = look.text2, fontSize = 14.sp) }
            Text(tr("21:42"), color = look.text2, fontSize = 12.sp)
        }
        Spacer(Modifier.height(10.dp))
        Text(tr("Hey! Did you try the new design?"), Modifier.clip(RoundedCornerShape(18.dp)).background(look.theirs).padding(horizontal = 12.dp, vertical = 8.dp))
        Spacer(Modifier.height(6.dp))
        Text(tr("Yes, the colors look amazing"), Modifier.align(Alignment.End).clip(RoundedCornerShape(18.dp)).background(look.accent).padding(horizontal = 12.dp, vertical = 8.dp), color = look.onAccent)
    }
    SectionLabel("Theme")
    Group { Box(Modifier.padding(14.dp)) { Segs(listOf("dark" to "Dark", "light" to "Light", "auto" to "Auto"), Design.scheme, Modifier.fillMaxWidth()) { Design.scheme = it; Design.save() } } }
    SectionLabel("Style")
    Group { Box(Modifier.padding(14.dp)) { Segs(listOf("glass" to "Liquid Glass", "material" to "Material You"), if (Design.glass) "glass" else "material", Modifier.fillMaxWidth()) { Design.glass = it == "glass"; Design.save() } } }
    SectionLabel("Color")
    Group {
        Row(Modifier.padding(14.dp).fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            SEEDS.forEach { c ->
                val on = c == Design.seed
                Box(
                    Modifier.size(26.dp).clip(CircleShape).background(c).then(if (on) Modifier.border(2.dp, look.ink, CircleShape) else Modifier)
                        .clickable { Design.seed = c; Design.save() },
                )
            }
        }
    }
    if (!Design.glass) {
        SectionLabel("Color style")
        Group { Box(Modifier.padding(14.dp)) { Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            COLOR_STYLES.chunked(3).forEach { row -> Segs(row, Design.colorStyle, Modifier.fillMaxWidth()) { Design.colorStyle = it; Design.save() } }
        } } }
    }
}

@Composable
private fun About(app: AppState) {
    val look = LocalLook.current
    var build by remember { mutableStateOf("…") }
    androidx.compose.runtime.LaunchedEffect(Unit) { build = runCatching { app.api.call("GET", "/api/config", auth = false).str("version") ?: "—" }.getOrDefault("—") }
    Column(Modifier.fillMaxWidth().padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        PlanetLogo(Modifier.size(140.dp))
        Text("Kosmo", style = MaterialTheme.typography.headlineMedium)
        Text("${tr("Kosmo for Android")} ${BuildConfig.VERSION_NAME}", color = look.text2)
        Text(tr("Server build: $build"), color = look.text3, fontSize = 13.sp)
    }
    SectionLabel("Your data")
    Group { Text(tr("Chats, photos and files are kept on the Kosmo server and are encrypted on its disk."), Modifier.padding(16.dp), color = look.text2) }
}

/** Экран блокировки: код-пароль при открытии (Security → Passcode lock). */
@Composable
fun LockScreen(app: AppState) {
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    var tries by remember { mutableIntStateOf(0) }
    val scope = rememberCoroutineScope()
    val user = app.kosmo.data.value.user
    Column(Modifier.fillMaxSize().background(LocalLook.current.page).safeDrawingPadding().padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Spacer(Modifier.height(40.dp))
        UserAvatar(user, 84.dp)
        Spacer(Modifier.height(16.dp))
        PassStep("Enter passcode", error, busy) { code ->
            busy = true; error = null
            scope.launch {
                val ok = try { app.api.call("POST", "/api/passcode/verify", jobj("code" to code)).bool("ok") } catch (e: ApiException) { if (e.status == 0) null else false }
                busy = false
                when (ok) {
                    true -> app.locked = false
                    false -> { tries++; error = "Wrong passcode" }
                    null -> error = "No connection to the server"
                }
            }
        }
        Spacer(Modifier.weight(1f))
        TextButton({ app.signOut() }) { Text(tr("Log out")) }
    }
}

@Suppress("unused") private val keep = Icons.Rounded.NotificationsActive
@Suppress("unused") private fun keepW() = Modifier.width(1.dp)
