package app.kosmo.chat.ui

import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.ui.graphics.compositeOver
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.ui.graphics.toArgb
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.widthIn
import androidx.compose.ui.draw.alpha
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
import app.kosmo.chat.core.objects
import app.kosmo.chat.core.str
import app.kosmo.chat.core.with
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
    Column(Modifier.fillMaxSize()) {
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
    Group(pad = true) { ChoiceRow("Interface language", listOf("en" to "English", "ru" to "Русский"), I18n.lang) { I18n.set(ctx, it) } }
    SectionLabel("Who can see")
    Group(pad = true) {
        ChoiceRow("Email", EN, if (p.bool("showEmail")) "everybody" else "nobody") { app.setPrivacy("showEmail", it == "everybody") }
        ChoiceRow("Last seen & online", EN, p.str("lastSeen") ?: "everybody", "If hidden, people see “last seen recently”.") { app.setPrivacy("lastSeen", it) }
        ChoiceRow("Profile photo", EN, p.str("avatar") ?: "everybody") { app.setPrivacy("avatar", it) }
        ChoiceRow("Bio", EN, if (p.bool("hideBio")) "nobody" else "everybody") { app.setPrivacy("hideBio", it == "nobody") }
    }
    SectionLabel("Who can contact me")
    Group(pad = true) {
        ChoiceRow("New messages", EN, p.str("messages") ?: "everybody", "People who already chat with you can still write.") { app.setPrivacy("messages", it) }
        ChoiceRow("Add me to groups & channels", EN, p.str("groups") ?: "everybody") { app.setPrivacy("groups", it) }
        SwitchRow("Find me by email", p["findByEmail"]?.toString() != "false", "People who know your exact email can find you in Search.") { app.setPrivacy("findByEmail", it) }
    }
    SectionLabel("Messages")
    Group(pad = true) { SwitchRow("Read receipts", p["readReceipts"]?.toString() != "false", "If off, you won’t see read receipts from others either.") { app.setPrivacy("readReceipts", it) } }
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
        Box(Modifier.size(72.dp).clip(if (look.glass) RoundedCornerShape(26.dp) else CircleShape).background(if (look.glass) look.accent.copy(alpha = 0.22f) else MaterialTheme.colorScheme.primaryContainer), contentAlignment = Alignment.Center) {
            Icon(WI.shield, null, tint = if (look.glass) look.accent else MaterialTheme.colorScheme.onPrimaryContainer, modifier = Modifier.size(36.dp))
        }
        Text(tr("Your account is protected"), fontSize = 20.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 14.dp))
        Text(tr("Passcode, trusted devices and login alerts keep Kosmo safe."), color = look.text2, fontSize = 14.sp, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 4.dp))
    }
    SectionLabel("Passcode")
    Group {
        GroupRow(PH.passwordFill, "Change passcode", msIcon = MS.password, first = true, solid = false) { passFlow = "change" }
        GroupRow(PH.keyFill, "Forgot passcode?", msIcon = MS.lockReset, solid = false) { app.toast = "Reset the passcode on the sign-in screen with a code from your email" }
    }
    Spacer(Modifier.height(10.dp))
    Group(pad = true) {
        SwitchRow("Passcode lock", s.bool("lock"), "Ask for the 4-digit passcode when Kosmo opens.") { app.setSecurity("lock", it) }
        if (s.bool("lock")) ChoiceRow("Auto-lock", LOCK_AFTER, "${s.num("autoLock") ?: 0}", wide = true) { app.setSecurity("autoLock", it.toInt()) }
    }
    SectionLabel("Account")
    Group {
        GroupRow(PH.envelopeSimpleFill, "Change email", value = u?.str("email"), msIcon = MS.mail, first = true, solid = false) { app.push(Screen.ChangeEmail) }
        GroupRow(PH.devicesFill, "Active sessions", value = "${u?.arr("sessions")?.size ?: 0}", msIcon = MS.devices, solid = false) { app.push(Screen.Sessions) }
    }
    Spacer(Modifier.height(10.dp))
    Group(pad = true) {
        SwitchRow("Login alerts in Kosmo chat", s["loginAlerts"]?.toString() != "false", "Get a message about every new sign-in.") { app.setSecurity("loginAlerts", it) }
        ChoiceRow("Delete my account if away for", DESTRUCT, "${s.num("destruct") ?: 6}", "Your data will be removed after this period of inactivity.", wide = true) { app.setSecurity("destruct", it.toInt()) }
    }
    Spacer(Modifier.height(10.dp))
    Group { GroupRow(PH.trashFill, "Delete account", danger = true, msIcon = MS.deleteForever, first = true, solid = false) { passFlow = "delete" } }
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
    Group(pad = true) {
        SwitchRow("Private chats", on("private")) { app.setSetting("notify.private", it) }
        SwitchRow("Groups", on("groups")) { app.setSetting("notify.groups", it) }
        SwitchRow("Channels", on("channels")) { app.setSetting("notify.channels", it) }
        SwitchRow("Show message preview", on("preview"), "Show the text of new messages in notifications.") { app.setSetting("notify.preview", it) }
    }
    SectionLabel("In-app")
    Group(pad = true) {
        SwitchRow("Sounds", on("sound")) { app.setSetting("notify.sound", it) }
        SwitchRow("Vibrate", on("vibrate")) { app.setSetting("notify.vibrate", it) }
        SwitchRow("Comments on my posts", on("feed")) { app.setSetting("notify.feed", it) }
    }
    Spacer(Modifier.height(16.dp))
    BigButton("Test notification", Modifier.padding(horizontal = 16.dp), secondary = true, icon = PH.bellSimple) { app.notifier.test() }
}

@Composable
private fun Storage(app: AppState, data: app.kosmo.chat.core.Data) {
    val ctx = LocalContext.current
    val look = LocalLook.current
    var size by remember { mutableStateOf(cacheSize(ctx)) }
    val s = data.user?.obj("settings") ?: JsonObject(emptyMap())
    val mine = data.chatList()
    val total = remember { runCatching { android.os.StatFs(ctx.filesDir.path).totalBytes }.getOrDefault(0L) }
    val files = mine.sumOf { c -> c.arr("messages").objects().count { it.str("media") != null } }
    val cs = MaterialTheme.colorScheme
    // .storage-card: акцент 12 % поверх #111113, большая цифра, полоса, четыре счётчика
    Column(
        Modifier.fillMaxWidth().padding(horizontal = 16.dp).padding(top = 4.dp).clip(RoundedCornerShape(if (look.glass) 26.dp else 28.dp))
            .background(if (look.glass) (if (look.dark) look.accent.copy(alpha = 0.12f).compositeOver(Color(0xFF111113)) else look.accent.copy(alpha = 0.10f).compositeOver(Color.White)) else cs.primaryContainer)
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        val fg = if (look.glass) look.text else cs.onPrimaryContainer
        Text(fmtBytes(size), fontSize = 34.sp, fontWeight = FontWeight.Bold, letterSpacing = (-0.68).sp, color = fg)
        Text(tr("used on this device") + if (total > 0) " " + tr("of") + " " + fmtBytes(total) else "", fontSize = 14.sp, color = fg.copy(alpha = 0.7f))
        val pct = if (total > 0) (size.toFloat() / total).coerceIn(0.01f, 1f) else 0f
        Box(Modifier.padding(vertical = 8.dp).fillMaxWidth().height(8.dp).clip(RoundedCornerShape(4.dp)).background(look.ink.copy(alpha = 0.12f))) {
            Box(Modifier.fillMaxWidth(pct).fillMaxHeight().clip(RoundedCornerShape(4.dp)).background(look.accent))
        }
        Row(Modifier.fillMaxWidth().alpha(0.85f)) {
            listOf(mine.size to "chats", mine.sumOf { it.arr("messages").size } to "messages", files to "files", data.feed.count { it.str("author") == data.me } to "posts").forEach { (n, l) ->
                Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) { Text("$n", fontWeight = FontWeight.Bold, fontSize = 18.sp, color = fg); Text(tr(l), fontSize = 12.sp, color = fg) }
            }
        }
    }
    SectionLabel("Media")
    Group(pad = true) {
        SwitchRow("Auto-play videos in Feed", s["autoplay"]?.toString() != "false") { app.setSetting("autoplay", it) }
        SwitchRow("Send with Enter", s["sendEnter"]?.toString() != "false", "On a keyboard, Shift+Enter adds a new line.") { app.setSetting("sendEnter", it) }
        SwitchRow("Compress photos before sending", s["compress"]?.toString() != "false") { app.setSetting("compress", it) }
    }
    Spacer(Modifier.height(12.dp))
    Group {
        GroupRow(PH.trashFill, "Clear cache", value = "Thumbnails", chevron = false, msIcon = MS.deleteSweep, first = true, solid = false) {
            ctx.cacheDir.listFiles()?.forEach { it.deleteRecursively() }
            coil.Coil.imageLoader(ctx).memoryCache?.clear()
            size = cacheSize(ctx)
            app.toast = "Cache cleared"
        }
    }
}

private fun cacheSize(ctx: android.content.Context): Long = (ctx.cacheDir ?: java.io.File("/nonexistent")).walkTopDown().filter { it.isFile }.sumOf { it.length() }
private fun fmtBytes(b: Long) = when { b > 1_000_000_000 -> "%.1f GB".format(b / 1e9); b > 1_000_000 -> "%.1f MB".format(b / 1e6); else -> "${maxOf(1, b / 1000)} KB" }

/** Оформление: превью, тема, стиль, цвет, стиль цвета — как «Designs» на сайте. */
@Composable
@OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
private fun Designs(app: AppState) {
    val look = LocalLook.current
    // превью (.design-preview): 380 высотой, обои, две строки списка и три пузыря снизу
    Box(
        Modifier.padding(16.dp).fillMaxWidth().height(380.dp).clip(RoundedCornerShape(28.dp)).background(look.page)
            .border(1.dp, look.ink.copy(alpha = 0.08f), RoundedCornerShape(28.dp)),
    ) {
        Wallpaper(Modifier.fillMaxSize(), kind = Design.wallpaper(Design.glass))
        Column(Modifier.padding(start = 6.dp, end = 6.dp, top = 8.dp)) {
            PvRow({ KosmoAvatar(56.dp) }, "Kosmo", "Welcome to Kosmo!", "now", 1, verified = true)
            PvRow({ Avatar("Emma Wilson", null, 56.dp) }, "Emma Wilson", "See you tonight?", "21:42", 0, line = true)
        }
        Column(Modifier.align(Alignment.BottomStart).fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            PvBubble("Hey! Did you try the new design?", "21:40", false)
            PvBubble("Yes, the colors look amazing", "21:41", true)
            PvBubble("Told you", "21:42", false)
        }
    }
    Group { Box(Modifier.padding(14.dp)) { Column { Text(tr("Theme"), fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = look.text2, modifier = Modifier.padding(start = 4.dp, bottom = 10.dp)); Segs(listOf("dark" to "Dark", "light" to "Light", "auto" to "Auto"), Design.scheme, Modifier.width(240.dp)) { Design.scheme = it; Design.save() } } } }
    Spacer(Modifier.height(12.dp))
    Group { Box(Modifier.padding(14.dp)) { Column { Text(tr("Style"), fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = look.text2, modifier = Modifier.padding(start = 4.dp, bottom = 10.dp)); Segs(listOf("glass" to "Liquid Glass", "material" to "Material You"), if (Design.glass) "glass" else "material", Modifier.fillMaxWidth(), connected = true) { Design.glass = it == "glass"; Design.save() } } } }
    Spacer(Modifier.height(12.dp))
    // цвет: образцы и «цвет из фото» (.palette-design + .photo-btn)
    val ctx = LocalContext.current
    val fromPhoto = androidx.activity.compose.rememberLauncherForActivityResult(androidx.activity.result.contract.ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) seedFromPhoto(ctx, uri)?.let { Design.seed = it; Design.save() }
    }
    PadGroup("Color") {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(Modifier.weight(1f), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                SEEDS.forEach { c -> Swatch(c, c.toArgb() == Design.seed.toArgb(), Modifier.weight(1f, fill = false)) { Design.seed = c; Design.save() } }
            }
            Box(
                Modifier.size(40.dp).clip(CircleShape).background(look.ink.copy(alpha = 0.08f))
                    .clickable { fromPhoto.launch(androidx.activity.result.PickVisualMediaRequest(androidx.activity.result.contract.ActivityResultContracts.PickVisualMedia.ImageOnly)) },
                contentAlignment = Alignment.Center,
            ) { Icon(PhotoBtnIcon, tr("Color from photo"), tint = look.text, modifier = Modifier.size(22.dp)) }
        }
    }
    if (!Design.glass) {
        Spacer(Modifier.height(12.dp))
        PadGroup("Color style") { Segs(COLOR_STYLES, Design.colorStyle, Modifier.fillMaxWidth()) { Design.colorStyle = it; Design.save() } }
    }
    Spacer(Modifier.height(12.dp))
    PadGroup("Background") {
        WP_FOR[if (Design.glass) "glass" else "material"].orEmpty().chunked(4).forEach { row ->
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                row.forEach { id ->
                    val on = Design.wallpaper(Design.glass) == id
                    Column(Modifier.weight(1f).clickable(interactionSource = null, indication = null) { if (Design.glass) Design.glassWp = id else Design.materialWp = id; Design.save() }, horizontalAlignment = Alignment.CenterHorizontally) {
                        Box(
                            Modifier.fillMaxWidth().aspectRatio(9f / 14f)
                                .then(if (on) Modifier.border(2.dp, look.accent, RoundedCornerShape(20.dp)).padding(4.dp) else Modifier)
                                .clip(RoundedCornerShape(if (on) 14.dp else 16.dp)).background(Color.Black)
                                .border(1.dp, look.ink.copy(alpha = 0.12f), RoundedCornerShape(if (on) 14.dp else 16.dp)),
                        ) { Wallpaper(Modifier.fillMaxSize(), kind = id) }
                        Text(tr(WALLPAPERS.first { it.first == id }.second), fontSize = 12.sp, fontWeight = if (on) FontWeight.SemiBold else FontWeight.Normal, color = if (on) look.text else look.text2, modifier = Modifier.padding(top = 6.dp))
                    }
                }
                repeat(4 - row.size) { Spacer(Modifier.weight(1f)) }
            }
        }
    }
    if (!Design.glass) {
        Spacer(Modifier.height(12.dp))
        PadGroup("Chat avatars") { ShapeOptions(app.kosmo.data.value.user, Design.chatShape) { Design.chatShape = it; Design.save() } }
        Spacer(Modifier.height(12.dp))
        PadGroup("Profile avatar") { ShapeOptions(app.kosmo.data.value.user, Design.profileShape) { Design.profileShape = it; Design.save() } }
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

/** .shape-options: 4 в ряд, демо 54, выбранная — подложка secondary-container радиусом 20. */
@Composable
private fun ShapeOptions(me: JsonObject?, current: String, onPick: (String) -> Unit) {
    SHAPE_IDS.chunked(4).forEach { row ->
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
            row.forEach { (id, _) ->
                Box(
                    Modifier.clip(RoundedCornerShape(20.dp)).background(if (id == current) MaterialTheme.colorScheme.secondaryContainer else Color.Transparent)
                        .clickable { onPick(id) }.padding(8.dp),
                ) { Avatar(me?.str("name") ?: "You", me?.obj("avatar")?.let { it.with("photo" to null, "video" to null) }, 54.dp, shape = m3Shape(id)) }
            }
        }
    }
}

/** .group.group-pad: подпись внутри карточки, отступ 16, промежуток 10. */
@Composable
private fun PadGroup(label: String, content: @Composable ColumnScope.() -> Unit) {
    val look = LocalLook.current
    Group {
        Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(tr(label), fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = look.text2, modifier = Modifier.padding(start = 4.dp))
            content()
        }
    }
}

/** .swatch: круг до 36, выбранный — скруглённый квадрат 11 с кольцом. */
@Composable
private fun Swatch(c: Color, on: Boolean, modifier: Modifier, onClick: () -> Unit) {
    val look = LocalLook.current
    val r by androidx.compose.animation.core.animateDpAsState(if (on) 11.dp else 18.dp, label = "sw")
    Box(modifier.widthIn(max = 36.dp).aspectRatio(1f).border(2.dp, if (on) look.text else Color.Transparent, RoundedCornerShape(r + 3.dp)).padding(4.dp)) {
        Box(Modifier.fillMaxSize().clip(RoundedCornerShape(r)).background(c).clickable(onClick = onClick))
    }
}

@Composable
private fun PvRow(avatar: @Composable () -> Unit, name: String, text: String, time: String, unread: Int, verified: Boolean = false, line: Boolean = false) {
    val look = LocalLook.current
    Box {
        if (line && look.glass) Box(Modifier.padding(start = 78.dp, end = 10.dp).fillMaxWidth().height(0.5.dp).background(look.hairline))
        Row(Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 7.dp), verticalAlignment = Alignment.CenterVertically) {
            avatar()
            Column(Modifier.weight(1f).padding(start = 12.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(tr(name), fontSize = 16.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
                    if (verified) CosmicBadge(size = 16.dp)
                }
                Text(tr(text), fontSize = 15.sp, color = look.text2, maxLines = 1)
            }
            Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.padding(start = 12.dp)) {
                Text(tr(time), fontSize = 13.sp, color = look.text3)
                if (unread > 0) Box(Modifier.height(22.dp).widthIn(min = 22.dp).clip(CircleShape).background(look.accent).padding(horizontal = 7.dp), contentAlignment = Alignment.Center) {
                    Text("$unread", color = look.onAccent, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                } else Spacer(Modifier.height(22.dp))
            }
        }
    }
}

@Composable
private fun PvBubble(text: String, time: String, mine: Boolean) {
    val look = LocalLook.current
    val cs = MaterialTheme.colorScheme
    val bg = if (mine) look.accent else if (look.glass) look.theirs else cs.surfaceContainerHigh
    val fg = if (mine) look.onAccent else look.text
    Row(Modifier.fillMaxWidth(), horizontalArrangement = if (mine) Arrangement.End else Arrangement.Start) {
        androidx.compose.foundation.layout.BoxWithConstraints(Modifier.fillMaxWidth(0.76f), contentAlignment = if (mine) Alignment.CenterEnd else Alignment.CenterStart) {
            val shape = RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp, bottomEnd = if (mine) 6.dp else 20.dp, bottomStart = if (mine) 20.dp else 6.dp)
            Box(Modifier.clip(shape).background(bg).padding(horizontal = 12.dp, vertical = 8.dp)) {
                TextWithMeta(androidx.compose.ui.text.AnnotatedString(tr(text)), fg, { Text(time, fontSize = 11.sp, lineHeight = 14.sp, color = fg, modifier = Modifier.alpha(0.72f)) })
            }
        }
    }
}

/** Цвет из фото — как на сайте: квантование и оценка Material (Score). */
private fun seedFromPhoto(ctx: android.content.Context, uri: android.net.Uri): Color? = runCatching {
    val opts = android.graphics.BitmapFactory.Options().apply { inSampleSize = 8 }
    val bmp = ctx.contentResolver.openInputStream(uri)?.use { android.graphics.BitmapFactory.decodeStream(it, null, opts) } ?: return null
    val small = android.graphics.Bitmap.createScaledBitmap(bmp, 112, (112f * bmp.height / bmp.width).toInt().coerceAtLeast(1), true)
    val px = IntArray(small.width * small.height).also { small.getPixels(it, 0, small.width, 0, 0, small.width, small.height) }
    val q = com.materialkolor.quantize.QuantizerCelebi.quantize(px, 128)
    Color(com.materialkolor.score.Score.score(q, 1, null, true).first())
}.getOrNull()

private val PhotoBtnIcon = stroke(
    P("M7 4.5h10a3.5 3.5 0 0 1 3.5 3.5v8a3.5 3.5 0 0 1-3.5 3.5H7a3.5 3.5 0 0 1-3.5-3.5V8A3.5 3.5 0 0 1 7 4.5z"),
    P("M10.8 10a1.8 1.8 0 1 1-3.6 0a1.8 1.8 0 1 1 3.6 0z"),
    P("M4 17.5l4.8-4.3 3.4 3 3.3-3.4 4.5 4.2"),
)
