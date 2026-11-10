package app.kosmo.chat.ui

import android.util.Base64
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.kosmo.chat.BuildConfig
import app.kosmo.chat.core.JSON
import app.kosmo.chat.core.arr
import app.kosmo.chat.core.bool
import app.kosmo.chat.core.jobj
import app.kosmo.chat.core.num
import app.kosmo.chat.core.obj
import app.kosmo.chat.core.objects
import app.kosmo.chat.core.str
import app.kosmo.chat.core.strings
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import java.security.SecureRandom
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import javax.crypto.Cipher
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.PBEKeySpec
import javax.crypto.spec.SecretKeySpec

/* Профиль → «Закладки», «Не беспокоить», «Мои боты», «Резервная копия», «Статистика»,
   «Аккаунты» — те же листы, что web/js/plus.js и accounts.js. */

/** Лист с заголовком: поля и кнопки столбиком (.modal на сайте). */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun KSheet(title: String, onClose: () -> Unit, content: @Composable ColumnScope.() -> Unit) {
    val look = LocalLook.current
    ModalBottomSheet(
        onClose, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = if (look.glass) Color(if (look.dark) 0xFF1C1C1E else 0xFFF2F2F7) else MaterialTheme.colorScheme.surfaceContainerHigh,
    ) {
        Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp).padding(bottom = 28.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(tr(title), fontSize = 20.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(start = 4.dp, bottom = 4.dp))
            content()
        }
    }
}

@Composable
fun SheetNote(text: String) = Text(tr(text), fontSize = 14.sp, lineHeight = 20.sp, color = LocalLook.current.text2, modifier = Modifier.padding(horizontal = 4.dp))

@Composable
fun SheetLabel(text: String) = Text(tr(text), fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = LocalLook.current.text2, modifier = Modifier.padding(start = 4.dp, top = 4.dp))

/** Поле-пилюля (.field): фон --c-field-bg, высота 50. */
@Composable
fun SheetField(value: String, onChange: (String) -> Unit, placeholder: String, password: Boolean = false) {
    val look = LocalLook.current
    BasicTextField(
        value, onChange, singleLine = true,
        textStyle = TextStyle(fontSize = 17.sp, color = look.text),
        cursorBrush = SolidColor(look.accent),
        visualTransformation = if (password) PasswordVisualTransformation() else VisualTransformation.None,
        modifier = Modifier.fillMaxWidth().height(50.dp).clip(RoundedCornerShape(if (look.glass) 25.dp else 12.dp)).background(look.field).padding(horizontal = 20.dp).wrapContentHeight(),
        decorationBox = { inner -> Box { if (value.isEmpty()) Text(tr(placeholder), color = look.text3, fontSize = 17.sp); inner() } },
    )
}

/* ---------------- Закладки ---------------- */

fun bookmarksOf(u: JsonObject?): List<JsonObject> = u?.arr("bookmarks")?.objects().orEmpty()

fun toggleBookmark(app: AppState, chatId: String, m: JsonObject, text: String) {
    val u = app.kosmo.data.value.user ?: return
    val id = m.str("id") ?: return
    val list = bookmarksOf(u).filterNot { it.str("chatId") == chatId && it.str("msgId") == id }
    val on = list.size == bookmarksOf(u).size
    val next = if (on) listOf(jobj("chatId" to chatId, "msgId" to id, "at" to System.currentTimeMillis(), "msgAt" to m.num("at"), "text" to text.take(300))) + list else list
    app.kosmo.updateMe(jobj("bookmarks" to JsonArray(next.take(500))))
    app.toast = if (on) "Bookmark added" else "Bookmark removed"
}

private val dayFmt = SimpleDateFormat("d MMM", Locale.getDefault())

@Composable
fun BookmarksSheet(app: AppState, onClose: () -> Unit) {
    val data = app.kosmo.data.value
    val look = LocalLook.current
    var q by remember { mutableStateOf("") }
    KSheet("Bookmarks", onClose) {
        SheetField(q, { q = it }, "Search bookmarks")
        fun title(id: String) = if (id.startsWith("saved_")) tr("Saved Messages") else data.chats[id]?.let { data.chatTitle(it) } ?: tr("Chat")
        val s = q.trim().lowercase()
        val list = bookmarksOf(data.user).filter { b -> s.isEmpty() || (b.str("text") ?: "").lowercase().contains(s) || title(b.str("chatId") ?: "").lowercase().contains(s) }
        if (list.isEmpty()) SheetNote(if (s.isNotEmpty()) "Nothing found" else "No bookmarks yet. Long-press a message and tap “Bookmark”.")
        Column(Modifier.clip(RoundedCornerShape(20.dp)), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            list.forEach { b ->
                PickOpt({ PickIc(PH.bookmarkSimple) }, title(b.str("chatId") ?: ""), b.str("text")?.ifEmpty { null } ?: tr("Message"), null,
                    trailing = { Text(dayFmt.format(Date(b.num("msgAt") ?: b.num("at") ?: 0L)), fontSize = 13.sp, color = look.text3) }) {
                    onClose()
                    val cid = b.str("chatId") ?: return@PickOpt
                    app.push(Screen.Chat(cid, data.chats[cid]?.let { data.otherOf(it)?.str("id") }, focus = b.str("msgId")))
                }
            }
        }
    }
}

/* ---------------- Не беспокоить ---------------- */

private val hm = SimpleDateFormat("HH:mm", Locale.getDefault())

@Composable
fun DndSheet(app: AppState, onClose: () -> Unit) {
    val until = app.dndUntil()
    KSheet("Do not disturb", onClose) {
        SheetNote(if (until > 0) tr("Notifications are muted until") + " " + hm.format(Date(until)) else "Mute notification sounds, vibration and pop-ups for a while.")
        fun morning(): Long {
            val c = java.util.Calendar.getInstance().apply { set(java.util.Calendar.HOUR_OF_DAY, 7); set(java.util.Calendar.MINUTE, 0); set(java.util.Calendar.SECOND, 0); set(java.util.Calendar.MILLISECOND, 0) }
            if (c.timeInMillis <= System.currentTimeMillis()) c.add(java.util.Calendar.DAY_OF_MONTH, 1)
            return c.timeInMillis
        }
        val opts = listOf("For 1 hour" to { System.currentTimeMillis() + 3_600_000L }, "For 8 hours" to { System.currentTimeMillis() + 8 * 3_600_000L }, "Until 7:00" to { morning() })
        Column(Modifier.clip(RoundedCornerShape(20.dp)), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            opts.forEach { (label, at) ->
                PickOpt({ PickIc(PH.moon) }, label, "", null) {
                    val v = at()
                    app.setSetting("dnd", v)
                    app.toast = tr("Do not disturb until") + " " + hm.format(Date(v))
                    onClose()
                }
            }
        }
        if (until > 0) BigButton("Turn off", secondary = true) { app.setSetting("dnd", 0); app.toast = "Do not disturb is off"; onClose() }
    }
}

/* ---------------- Мои боты ---------------- */

@Composable
fun BotsSheet(app: AppState, onClose: () -> Unit) {
    val look = LocalLook.current
    val scope = rememberCoroutineScope()
    val clip = LocalClipboardManager.current
    var list by remember { mutableStateOf<List<JsonObject>?>(null) }
    var token by remember { mutableStateOf<String?>(null) }
    var name by remember { mutableStateOf("") }
    var username by remember { mutableStateOf("") }
    LaunchedEffect(Unit) {
        try { list = app.api.call("GET", "/api/bots").arr("bots").objects() } catch (e: Exception) { app.toast = e.message; onClose() }
    }
    fun act(block: suspend () -> Unit) = scope.launch { try { block() } catch (e: Exception) { app.toast = e.message } }
    KSheet("My bots", onClose) {
        val bots = list
        if (bots == null) SheetNote("…")
        else if (bots.isEmpty()) SheetNote("No bots yet")
        else Column(Modifier.clip(RoundedCornerShape(20.dp)), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            bots.forEach { b ->
                PickOpt({ PickIc(PH.robot) }, b.str("name") ?: "", "@" + (b.str("username") ?: ""), null, trailing = {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        Text(tr("New token"), fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = look.accent, modifier = Modifier.clip(CircleShape).background(look.accent.copy(alpha = 0.14f)).clickable {
                            act { token = app.api.call("POST", "/api/bots/${b.str("id")}/token").str("token"); app.toast = "Old token no longer works" }
                        }.padding(horizontal = 10.dp, vertical = 6.dp))
                        Icon(WI.trash, tr("Delete"), tint = MaterialTheme.colorScheme.error, modifier = Modifier.size(34.dp).clip(CircleShape).clickable {
                            act { app.api.call("DELETE", "/api/bots/${b.str("id")}"); list = list?.filter { it.str("id") != b.str("id") }; app.toast = "Bot deleted" }
                        }.padding(7.dp))
                    }
                }) {}
            }
        }
        token?.let { t ->
            Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(look.ink.copy(alpha = 0.06f)).padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                SheetLabel("Token — keep it secret, shown once")
                Text(t, fontFamily = FontFamily.Monospace, fontSize = 13.sp, color = look.text)
                BigButton("Copy", secondary = true) { clip.setText(AnnotatedString(t)); app.toast = "Token copied" }
                SheetLabel("1. Get messages people sent the bot (chat_id is in the answer)")
                val get = "curl '${BuildConfig.KOSMO_URL}/api/bot/$t/getUpdates?timeout=30'"
                Text(get, fontFamily = FontFamily.Monospace, fontSize = 12.sp, color = look.text2)
                BigButton("Copy command", secondary = true) { clip.setText(AnnotatedString(get)); app.toast = "Command copied" }
                SheetLabel("2. Reply (put the chat_id instead of CHAT_ID)")
                val send = "curl -X POST '${BuildConfig.KOSMO_URL}/api/bot/$t/sendMessage' -H 'Content-Type: application/json' -d '{\"chat_id\":\"CHAT_ID\",\"text\":\"Hello!\"}'"
                Text(send, fontFamily = FontFamily.Monospace, fontSize = 12.sp, color = look.text2)
                BigButton("Copy command", secondary = true) { clip.setText(AnnotatedString(send)); app.toast = "Command copied" }
            }
        }
        SheetLabel("New bot")
        SheetField(name, { name = it.take(64) }, "Name")
        SheetField(username, { username = it.trim().lowercase().take(32) }, "username ending with bot")
        BigButton("Create bot", icon = PH.robot) {
            act {
                val r = app.api.call("POST", "/api/bots", jobj("name" to name, "username" to username))
                list = (list ?: emptyList()) + r
                token = r.str("token")
                name = ""; username = ""
            }
        }
        SheetNote("Bots get messages people send them (getUpdates) and reply with sendMessage. Docs: GET /api/bot/<token>/getMe.")
    }
}

/* ---------------- Резервная копия (тот же формат, что на сайте: PBKDF2 250 000 + AES-GCM) ---------------- */

private fun keyFrom(pass: String, salt: ByteArray): SecretKeySpec {
    val k = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(PBEKeySpec(pass.toCharArray(), salt, 250_000, 256))
    return SecretKeySpec(k.encoded, "AES")
}
private fun b64(b: ByteArray) = Base64.encodeToString(b, Base64.NO_WRAP)
private fun unb64(s: String) = Base64.decode(s, Base64.DEFAULT)

private fun encryptBackup(plain: String, pass: String): String {
    val rnd = SecureRandom()
    val salt = ByteArray(16).also(rnd::nextBytes)
    val iv = ByteArray(12).also(rnd::nextBytes)
    val c = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.ENCRYPT_MODE, keyFrom(pass, salt), GCMParameterSpec(128, iv)) }
    return jobj("kosmo" to "backup", "v" to 1, "salt" to b64(salt), "iv" to b64(iv), "data" to b64(c.doFinal(plain.toByteArray()))).toString()
}

private fun decryptBackup(file: String, pass: String): JsonObject {
    val j = JSON.parseToJsonElement(file) as JsonObject
    val c = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.DECRYPT_MODE, keyFrom(pass, unb64(j.str("salt")!!)), GCMParameterSpec(128, unb64(j.str("iv")!!))) }
    return JSON.parseToJsonElement(String(c.doFinal(unb64(j.str("data")!!)))) as JsonObject
}

@Composable
fun BackupSheet(app: AppState, onClose: () -> Unit) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var pass by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var opened by remember { mutableStateOf<JsonObject?>(null) }
    val save = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/octet-stream")) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        val d = app.kosmo.data.value
        val me = d.me ?: return@rememberLauncherForActivityResult
        busy = true
        scope.launch {
            try {
                val mine = d.chats.values.filter { me in it.strings("members") }
                val ids = mine.flatMap { it.strings("members") }.toSet()
                val backup = jobj(
                    "kosmo" to "backup", "exportedAt" to System.currentTimeMillis(), "me" to me, "bookmarks" to JsonArray(bookmarksOf(d.user)),
                    "accounts" to JsonObject(ids.associateWith { jobj("name" to (d.accounts[it]?.str("name") ?: "Unknown"), "username" to (d.accounts[it]?.str("username") ?: "")) }),
                    "chats" to JsonObject(mine.associate { it.str("id")!! to it }),
                )
                val text = withContext(Dispatchers.Default) { encryptBackup(backup.toString(), pass) }
                withContext(Dispatchers.IO) { ctx.contentResolver.openOutputStream(uri)?.use { it.write(text.toByteArray()) } }
                app.toast = "Backup saved"
            } catch (e: Exception) { app.toast = e.message }
            busy = false
        }
    }
    val open = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        busy = true
        scope.launch {
            try {
                val text = withContext(Dispatchers.IO) { ctx.contentResolver.openInputStream(uri)?.use { String(it.readBytes()) } } ?: ""
                opened = withContext(Dispatchers.Default) { decryptBackup(text, pass) }
            } catch (e: Exception) { app.toast = "Wrong password or damaged file" }
            busy = false
        }
    }
    val b = opened
    if (b != null) { BackupView(b) { opened = null; onClose() }; return }
    KSheet("Backup", onClose) {
        SheetNote("Save all your chats to a file protected with a password.")
        SheetLabel("Password")
        SheetField(pass, { pass = it }, "At least 6 characters", password = true)
        BigButton(if (busy) "…" else "Download backup", enabled = !busy) {
            if (pass.length < 6) { app.toast = "Password: at least 6 characters"; return@BigButton }
            save.launch("kosmo-backup-${SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())}.kosmo")
        }
        Text(tr("or"), fontSize = 13.sp, color = LocalLook.current.text3, modifier = Modifier.align(Alignment.CenterHorizontally))
        BigButton("Open a backup file", secondary = true, enabled = !busy) {
            if (pass.isEmpty()) { app.toast = "Enter the backup password first"; return@BigButton }
            open.launch(arrayOf("*/*"))
        }
    }
}

@Composable
private fun BackupView(b: JsonObject, onClose: () -> Unit) {
    val look = LocalLook.current
    val me = b.str("me")
    fun name(id: String?) = b.obj("accounts")?.obj(id ?: "")?.str("name") ?: tr("Unknown")
    val chats = b.obj("chats")?.values?.mapNotNull { it as? JsonObject }.orEmpty()
    var open by remember { mutableStateOf<JsonObject?>(null) }
    val fmt = SimpleDateFormat("d MMM yyyy, HH:mm", Locale.getDefault())
    KSheet(tr("Backup") + " · " + fmt.format(Date(b.num("exportedAt") ?: 0L)), onClose) {
        val c = open
        if (c == null) Column(Modifier.clip(RoundedCornerShape(20.dp)), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            if (chats.isEmpty()) SheetNote("No chats")
            chats.forEach { ch ->
                val title = ch.str("name") ?: if (ch.bool("saved")) tr("Saved Messages") else ch.strings("members").filter { it != me }.joinToString(", ") { name(it) }
                PickOpt({ PickIc(if (ch.str("type") != null) WI.users else WI.chat) }, title, "${ch.arr("messages").size} " + tr("messages"), null) { open = ch }
            }
        } else {
            BigButton("Back", secondary = true) { open = null }
            c.arr("messages").objects().forEach { m ->
                val mine = m.str("from") == me
                Column(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(if (mine) look.accent.copy(alpha = 0.16f) else look.ink.copy(alpha = 0.06f)).padding(10.dp),
                ) {
                    Text(name(m.str("from")) + "  " + fmt.format(Date(m.num("at") ?: 0L)), fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = look.text2)
                    Text(m.str("text") ?: m.str("caption") ?: "[${m.str("kind") ?: "message"}]", fontSize = 15.sp)
                }
            }
        }
    }
}

/* ---------------- Статистика (только ID 1) ---------------- */

@Composable
fun StatsSheet(app: AppState, onClose: () -> Unit) {
    val look = LocalLook.current
    var data by remember { mutableStateOf<JsonObject?>(null) }
    var tab by remember { mutableStateOf("users") }
    var q by remember { mutableStateOf("") }
    var reload by remember { mutableStateOf(0) }
    LaunchedEffect(reload) {
        try { data = app.api.call("GET", "/api/admin/stats") } catch (e: Exception) { app.toast = e.message ?: "Could not load statistics" }
    }
    fun n(v: Long?) = String.format(Locale.getDefault(), "%,d", v ?: 0L)
    KSheet("Statistics", onClose) {
        val d = data
        if (d == null) { SheetNote("…"); return@KSheet }
        val t = d.obj("totals") ?: JsonObject(emptyMap())
        val tiles = listOf(
            Triple("Accounts", t.num("users"), "+${n(t.num("newToday"))} " + tr("today") + " · +${n(t.num("newWeek"))} " + tr("week")),
            Triple("Online now", t.num("online"), "${n(t.num("activeToday"))} " + tr("active today")),
            Triple("Messages", t.num("messages"), "${n(t.num("messagesToday"))} " + tr("today")),
            Triple("Reactions", t.num("reactions"), ""),
            Triple("Channels", t.num("channel"), ""),
            Triple("Groups", t.num("group"), "${n(t.num("publicRooms"))} " + tr("public rooms")),
            Triple("Private chats", t.num("dm"), "${n(t.num("secret"))} " + tr("secret") + " · ${n(t.num("saved"))} " + tr("saved")),
            Triple("Usernames", t.num("withUsername"), "${n(t.num("premium"))} premium"),
            Triple("Posts", t.num("posts"), "${n(t.num("comments"))} " + tr("comments")),
            Triple("Stories", t.num("stories"), tr("last 24 h")),
            Triple("Files", t.num("files"), ""),
            Triple("Sessions", t.num("sessions"), "${n(t.num("bots"))} " + tr("bots")),
        )
        tiles.chunked(2).forEach { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                row.forEach { (label, v, sub) ->
                    Column(Modifier.weight(1f).clip(RoundedCornerShape(16.dp)).background(look.ink.copy(alpha = 0.06f)).padding(12.dp)) {
                        Text(n(v), fontSize = 22.sp, fontWeight = FontWeight.Bold)
                        Text(tr(label), fontSize = 13.sp, color = look.text2)
                        if (sub.isNotEmpty()) Text(sub, fontSize = 11.sp, color = look.text3, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                }
            }
        }
        Segs(listOf("users" to "Accounts", "rooms" to "Channels", "names" to "Usernames"), tab, Modifier.fillMaxWidth()) { tab = it }
        SheetField(q, { q = it.trim().lowercase().removePrefix("@") }, "Search")
        fun match(vararg xs: String?) = q.isEmpty() || xs.any { (it ?: "").lowercase().contains(q) }
        val users = d.arr("users").objects()
        val rooms = d.arr("rooms").objects()
        val rows: List<Triple<String, String, String>> = when (tab) {
            "users" -> users.filter { match(it.num("publicId")?.toString() ?: it.str("publicId"), it.str("name"), it.str("username"), it.str("email")) }.map {
                Triple("${it.num("publicId") ?: it.str("publicId")} · " + (it.str("name") ?: "—") + if (it.bool("bot")) " · bot" else "", listOfNotNull(it.str("username")?.let { u -> "@$u" }, it.str("email")).joinToString(" · "), if (it.bool("online")) "online" else "")
            }
            "rooms" -> rooms.filter { match(it.str("name"), it.str("username")) }.map {
                Triple(it.str("name") ?: "—", "${it.str("type")} · ${it.str("username")?.let { u -> "@$u" } ?: "private"}", "${n(it.num("members"))} " + tr("members"))
            }
            else -> (users.mapNotNull { u -> u.str("username")?.let { Triple("@$it", (if (u.bool("bot")) "bot" else "user") + " · ID ${u.num("publicId") ?: u.str("publicId")}", "") } } +
                rooms.mapNotNull { r -> r.str("username")?.let { Triple("@$it", r.str("type") ?: "", "") } }).filter { match(it.first) }.sortedBy { it.first }
        }
        Column(Modifier.clip(RoundedCornerShape(20.dp)), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            if (rows.isEmpty()) SheetNote("Nothing found")
            rows.take(300).forEach { (a, b2, c) ->
                Row(Modifier.fillMaxWidth().background(look.ink.copy(alpha = 0.06f)).padding(horizontal = 14.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(a, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        if (b2.isNotEmpty()) Text(b2, fontSize = 12.sp, color = look.text2, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                    if (c.isNotEmpty()) Text(c, fontSize = 12.sp, color = if (c == "online") look.accent else look.text2)
                }
            }
        }
        Text(tr("Refresh"), color = look.accent, fontWeight = FontWeight.SemiBold, fontSize = 14.sp, modifier = Modifier.padding(4.dp).clickable { reload++ })
    }
}

/* ---------------- Аккаунты ---------------- */

@Composable
fun AccountsSection(app: AppState) {
    val look = LocalLook.current
    val list = app.accounts
    val me = app.kosmo.data.value.me
    SectionLabel("Accounts · ${list.size}/$MAX_ACCOUNTS")
    Group {
        list.forEachIndexed { i, a ->
            val cur = a.str("uid") == me
            Box {
                Row(
                    Modifier.fillMaxWidth().heightIn(min = 60.dp).then(if (cur) Modifier else Modifier.clickable { app.switchAccount(a.str("uid")!!) }).padding(horizontal = 16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Avatar(a.str("name"), a.obj("avatar"), 32.dp)
                    Column(Modifier.weight(1f).padding(start = 14.dp)) {
                        Text(a.str("name") ?: tr("Account"), fontSize = 16.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text(a.str("email") ?: "", fontSize = 13.sp, color = look.text2, maxLines = 1)
                    }
                    if (cur) Icon(WI.check, null, tint = look.accent, modifier = Modifier.size(22.dp))
                }
                if (i > 0 && look.glass) Box(Modifier.fillMaxWidth().padding(start = 62.dp).height(0.5.dp).background(look.hairline))
            }
        }
        if (list.size < MAX_ACCOUNTS) GroupRow(WI.plus, "Add account", chevron = false, msIcon = MS.personAdd, first = list.isEmpty(), solid = false) { app.addAccount() }
        else Text(tr("Maximum $MAX_ACCOUNTS accounts"), color = look.text3, modifier = Modifier.padding(16.dp))
    }
}
