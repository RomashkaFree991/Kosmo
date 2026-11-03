package app.kosmo.chat.ui

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.LocationManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.MyLocation
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import app.kosmo.chat.core.jobj
import kotlinx.serialization.json.JsonObject
import java.util.UUID

// Эмодзи для панели (как в выборе эмодзи на сайте — нативные символы)
val EMOJI_ALL = ("😀 😃 😄 😁 😆 😅 😂 🤣 🥲 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😙 😚 😋 😛 😝 😜 🤪 🤨 🧐 🤓 😎 🥸 🤩 🥳 😏 😒 😞 😔 😟 😕 🙁 😣 😖 😫 😩 🥺 😢 😭 😤 😠 😡 🤬 🤯 😳 🥵 🥶 😱 😨 😰 😥 😓 🤗 🤔 🫣 🤭 🫡 🤫 🤥 😶 😐 😑 😬 🙄 😯 😦 😧 😮 😲 🥱 😴 🤤 😪 😵 🤐 🥴 🤢 🤮 🤧 😷 🤒 🤕 🤑 🤠 😈 👿 👹 👺 🤡 💩 👻 💀 👽 👾 🤖 🎃 😺 😸 😹 😻 😼 😽 🙀 😿 😾 " +
    "👋 🤚 🖐 ✋ 🖖 👌 🤌 🤏 ✌️ 🤞 🫰 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ 👍 👎 ✊ 👊 🤛 🤜 👏 🙌 🫶 👐 🤲 🤝 🙏 💪 " +
    "❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 🔥 ✨ ⭐ 🌟 💫 ⚡ 🌈 ☀️ 🌙 🪐 🚀 🛸 🌍 🎉 🎊 🎁 🎈 🏆 🥇 ⚽ 🏀 🎮 🎧 🎵 🎶 📷 💻 📱 ☕ 🍕 🍔 🍟 🍣 🍩 🍪 🎂 🍓 🍉 🍌 🥑 🌸 🌹 🌻 🍀 🐶 🐱 🦊 🐻 🐼 🐨 🐯 🦁 🐸 🐵 🦄 🐝 🦋").split(" ").filter { it.isNotBlank() }

// Стикерпаки — те же, что web/js/stickers.js
private fun st(emoji: String, anim: String, text: String = "") = jobj("emoji" to emoji, "anim" to anim, "text" to text)
val STICKER_PACKS = listOf(
    "Kosmo Faces" to listOf(st("laugh", "jelly"), st("love", "pulse"), st("wow", "pop"), st("cry", "shake"), st("cool", "float"), st("party", "spin"), st("heart", "beat"), st("like", "wave")),
    "Say it" to listOf(st("like", "wave", "Hi!"), st("laugh", "jelly", "LOL"), st("heart", "beat", "Thanks!"), st("fire", "float", "Hot!"), st("party", "pop", "GG"), st("cool", "float", "OK"), st("wow", "shake", "Wow"), st("cry", "shake", "Sorry")),
    "Deep Space" to listOf(st("rocket", "launch"), st("planet", "orbit"), st("star", "twinkle"), st("fire", "flicker"), st("rocket", "launch", "Let’s go"), st("planet", "orbit", "Kosmo"), st("star", "twinkle", "Nice"), st("love", "float", "Miss you")),
)

/** Панель эмодзи и стикеров под полем ввода. */
@Composable
fun EmojiPanel(onEmoji: (String) -> Unit, onSticker: (JsonObject) -> Unit) {
    val look = LocalLook.current
    var tab by remember { mutableStateOf("emoji") }
    Column(Modifier.fillMaxWidth().height(300.dp).background(look.cell).navigationBarsPadding()) {
        Segs(listOf("emoji" to "Emoji", "stickers" to "Stickers"), tab, Modifier.fillMaxWidth().padding(12.dp)) { tab = it }
        if (tab == "emoji") LazyVerticalGrid(GridCells.Adaptive(44.dp), Modifier.fillMaxWidth().padding(horizontal = 8.dp)) {
            items(EMOJI_ALL) { e -> Box(Modifier.size(44.dp).clip(CircleShape).clickable { onEmoji(e) }, contentAlignment = Alignment.Center) { Text(e, fontSize = 26.sp) } }
        } else LazyVerticalGrid(GridCells.Fixed(4), Modifier.fillMaxWidth().padding(horizontal = 8.dp)) {
            STICKER_PACKS.forEach { (name, items) ->
                item(span = { GridItemSpan(4) }) { Text(tr(name), color = look.text2, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(8.dp)) }
                items(items) { s ->
                    Column(Modifier.padding(4.dp).clip(RoundedCornerShape(14.dp)).clickable { onSticker(s) }.padding(6.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(emojiChar(s["emoji"]?.toString()?.trim('"')), fontSize = 40.sp)
                        val t = s["text"]?.toString()?.trim('"').orEmpty()
                        if (t.isNotEmpty()) Text(t, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

/** Листы создания: код, список дел, опрос, геопозиция. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ComposeSheet(app: AppState, kind: String, onClose: () -> Unit, onSend: (JsonObject) -> Unit) {
    val look = LocalLook.current
    ModalBottomSheet(onClose, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true), containerColor = look.cell) {
        Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp).padding(bottom = 24.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            when (kind) {
                "code" -> CodeSheet(onSend)
                "todo" -> TodoSheet(app, onSend)
                "poll" -> PollSheet(onSend)
                "location" -> LocationSheet(app, onSend)
            }
        }
    }
}

@Composable
private fun SheetTitle(t: String) = Text(tr(t), fontSize = 20.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(bottom = 4.dp))

@Composable
private fun CodeSheet(onSend: (JsonObject) -> Unit) {
    var lang by remember { mutableStateOf("kotlin") }
    var code by remember { mutableStateOf("") }
    SheetTitle("Attach code")
    androidx.compose.foundation.lazy.LazyRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        items(listOf("kotlin", "javascript", "python", "java", "html", "css", "json", "sql", "bash", "text").size) { i ->
            val l = listOf("kotlin", "javascript", "python", "java", "html", "css", "json", "sql", "bash", "text")[i]
            Chip(l, l == lang) { lang = l }
        }
    }
    OutlinedTextField(code, { code = it }, Modifier.fillMaxWidth().height(220.dp), textStyle = androidx.compose.ui.text.TextStyle(fontFamily = FontFamily.Monospace, fontSize = 14.sp), placeholder = { Text(tr("fun main() { }")) })
    BigButton("Send", enabled = code.isNotBlank()) { onSend(jobj("kind" to "code", "lang" to lang, "text" to code.trimEnd())) }
}

@Composable
private fun TodoSheet(app: AppState, onSend: (JsonObject) -> Unit) {
    var title by remember { mutableStateOf("") }
    val items = remember { mutableStateListOf("", "") }
    var open by remember { mutableStateOf(true) }
    SheetTitle("Checklist")
    OutlinedTextField(title, { title = it.take(120) }, Modifier.fillMaxWidth(), placeholder = { Text(tr("Title")) }, singleLine = true)
    items.forEachIndexed { i, v ->
        Row(verticalAlignment = Alignment.CenterVertically) {
            OutlinedTextField(v, { items[i] = it.take(200) }, Modifier.weight(1f), placeholder = { Text(tr("Task") + " ${i + 1}") }, singleLine = true)
            if (items.size > 1) Icon(Icons.Rounded.Close, null, Modifier.padding(start = 6.dp).clickable { items.removeAt(i) })
        }
    }
    if (items.size < 30) Row(Modifier.clickable { items.add("") }.padding(6.dp), verticalAlignment = Alignment.CenterVertically) { Icon(Icons.Rounded.Add, null, tint = LocalLook.current.accent); Text(tr("Add a task"), color = LocalLook.current.accent) }
    SwitchRow("Others can add tasks", open) { open = it }
    val me = app.kosmo.data.value.me
    BigButton("Send", enabled = items.any { it.isNotBlank() }) {
        onSend(jobj("kind" to "todo", "todo" to jobj("title" to title.trim(), "open" to open, "items" to items.filter { it.isNotBlank() }.map { jobj("id" to UUID.randomUUID().toString(), "text" to it.trim(), "by" to me, "done" to emptyList<String>()) })))
    }
}

@Composable
private fun PollSheet(onSend: (JsonObject) -> Unit) {
    var q by remember { mutableStateOf("") }
    val opts = remember { mutableStateListOf("", "") }
    var anon by remember { mutableStateOf(true) }
    var multi by remember { mutableStateOf(false) }
    var quiz by remember { mutableStateOf(false) }
    var correct by remember { mutableStateOf(0) }
    SheetTitle("New poll")
    OutlinedTextField(q, { q = it.take(300) }, Modifier.fillMaxWidth(), placeholder = { Text(tr("Ask a question")) })
    opts.forEachIndexed { i, v ->
        Row(verticalAlignment = Alignment.CenterVertically) {
            if (quiz) androidx.compose.material3.RadioButton(correct == i, { correct = i })
            OutlinedTextField(v, { opts[i] = it.take(100) }, Modifier.weight(1f), placeholder = { Text(tr("Option") + " ${i + 1}") }, singleLine = true)
            if (opts.size > 2) Icon(Icons.Rounded.Close, null, Modifier.padding(start = 6.dp).clickable { opts.removeAt(i); if (correct >= opts.size) correct = 0 })
        }
    }
    if (opts.size < 10) Row(Modifier.clickable { opts.add("") }.padding(6.dp), verticalAlignment = Alignment.CenterVertically) { Icon(Icons.Rounded.Add, null, tint = LocalLook.current.accent); Text(tr("Add an option"), color = LocalLook.current.accent) }
    SwitchRow("Anonymous voting", anon) { anon = it }
    SwitchRow("Multiple answers", multi && !quiz) { multi = it; if (it) quiz = false }
    SwitchRow("Quiz mode", quiz, "One correct answer") { quiz = it; if (it) multi = false }
    val good = q.isNotBlank() && opts.count { it.isNotBlank() } >= 2
    BigButton("Send", enabled = good) {
        val list = opts.mapIndexedNotNull { i, t -> if (t.isBlank()) null else Triple(i, UUID.randomUUID().toString().take(8), t.trim()) }
        onSend(jobj("kind" to "poll", "poll" to jobj(
            "question" to q.trim(), "options" to list.map { jobj("id" to it.second, "text" to it.third) },
            "quiz" to quiz, "correct" to (if (quiz) list.firstOrNull { it.first == correct }?.second ?: list.first().second else null),
            "explanation" to "", "anonymous" to anon, "multiple" to (multi && !quiz), "votes" to emptyMap<String, Any>(), "closed" to false,
        )))
    }
}

@SuppressLint("MissingPermission")
private fun lastLocation(ctx: Context): android.location.Location? {
    val lm = ctx.getSystemService(LocationManager::class.java) ?: return null
    return lm.getProviders(true).mapNotNull { runCatching { lm.getLastKnownLocation(it) }.getOrNull() }.maxByOrNull { it.time }
}

@Composable
private fun LocationSheet(app: AppState, onSend: (JsonObject) -> Unit) {
    val ctx = LocalContext.current
    fun sendNow() {
        val l = lastLocation(ctx) ?: run { app.toast = "Location is not available"; return }
        onSend(jobj("kind" to "location", "location" to jobj("lat" to "%.6f".format(java.util.Locale.US, l.latitude).toDouble(), "lon" to "%.6f".format(java.util.Locale.US, l.longitude).toDouble(), "acc" to l.accuracy.toInt())))
    }
    val perm = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { r -> if (r.values.any { it }) sendNow() else app.toast = "Location is not available" }
    SheetTitle("Location")
    GroupRow(Icons.Rounded.MyLocation, "Send my current location", chevron = false) {
        if (ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
            ContextCompat.checkSelfPermission(ctx, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED) sendNow()
        else perm.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION))
    }
    Spacer(Modifier.height(8.dp))
}
