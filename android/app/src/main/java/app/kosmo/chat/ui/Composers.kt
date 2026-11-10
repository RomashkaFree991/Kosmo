package app.kosmo.chat.ui

import androidx.compose.foundation.gestures.waitForUpOrCancellation
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.ui.graphics.Color
import androidx.compose.material3.MaterialTheme
import kotlinx.coroutines.launch
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
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

/* ---------------- Всплывающие карточки над полем ввода (как .menu на сайте) ---------------- */

/** Появление «menu-in»: из точки у кнопки, пружиной. */
@Composable
fun PopIn(visible: Boolean, origin: androidx.compose.ui.graphics.TransformOrigin, modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    androidx.compose.animation.AnimatedVisibility(
        visible, modifier,
        enter = androidx.compose.animation.scaleIn(androidx.compose.animation.core.spring(dampingRatio = 0.62f, stiffness = 420f), initialScale = 0.4f, transformOrigin = origin) + androidx.compose.animation.fadeIn(androidx.compose.animation.core.tween(160)),
        exit = androidx.compose.animation.scaleOut(androidx.compose.animation.core.tween(160), targetScale = 0.7f, transformOrigin = origin) + androidx.compose.animation.fadeOut(androidx.compose.animation.core.tween(160)),
    ) { content() }
}

@Composable
private fun popBg(): Color {
    val look = LocalLook.current
    return if (look.glass) (if (look.dark) Color(0xFF2C2C2E) else Color.White) else MaterialTheme.colorScheme.surfaceContainer
}

private val AttIcons = mapOf(
    "photo" to stroke(P("M7 4.5h10a3.5 3.5 0 0 1 3.5 3.5v8a3.5 3.5 0 0 1-3.5 3.5H7a3.5 3.5 0 0 1-3.5-3.5V8A3.5 3.5 0 0 1 7 4.5z"), P("M10.8 10a1.8 1.8 0 1 1-3.6 0a1.8 1.8 0 1 1 3.6 0z"), P("M4 17.5l4.8-4.3 3.4 3 3.3-3.4 4.5 4.2")),
    "video" to stroke(P("M6 6h7a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3z"), P("M16 10.5l5-3v9l-5-3z")),
    "code" to stroke(P("M8.5 7.5L4 12l4.5 4.5M15.5 7.5L20 12l-4.5 4.5M13.5 5l-3 14")),
    "round" to stroke(P("M20.5 12a8.5 8.5 0 1 1-17 0a8.5 8.5 0 1 1 17 0z"), P("M15.5 12a3.5 3.5 0 1 1-7 0a3.5 3.5 0 1 1 7 0z")),
    "poll" to stroke(P("M5 20V10M12 20V4M19 20v-7")),
    "todo" to stroke(P("M4 6.5l1.5 1.5L8.5 5M4 12.5l1.5 1.5 3-3M4 18.5l1.5 1.5 3-3M11.5 7h8.5M11.5 13h8.5M11.5 19h8.5")),
    "location" to stroke(P("M12 21s-6.5-6.2-6.5-11a6.5 6.5 0 0 1 13 0c0 4.8-6.5 11-6.5 11z"), P("M14.4 10a2.4 2.4 0 1 1-4.8 0a2.4 2.4 0 1 1 4.8 0z")),
    "music" to stroke(P("M9 18V6l11-2v12"), P("M9 18a2.5 2.5 0 1 1-5 0a2.5 2.5 0 1 1 5 0z"), P("M20 16a2.5 2.5 0 1 1-5 0a2.5 2.5 0 1 1 5 0z")),
)
private val AttColors = mapOf("photo" to 0xFF0A84FF, "video" to 0xFFFF375F, "code" to 0xFF5E5CE6, "round" to 0xFF34C759, "poll" to 0xFFFF9F0A, "todo" to 0xFF34C759, "location" to 0xFFFF9500, "music" to 0xFFFF9F0A)

/** Меню «+» (.attach-menu): цветные значки 32 (стекло) / фигуры M3 (Material). */
@Composable
fun AttachPopup(rooms: Boolean, onPick: (String) -> Unit) {
    val look = LocalLook.current
    val cs = MaterialTheme.colorScheme
    val items = listOfNotNull("photo" to "Photo", "video" to "Video", "code" to "Code", "round" to "Video message", if (rooms) "poll" to "Poll" else null, "todo" to "Checklist", "location" to "Location", "music" to "Music")
    Column(
        Modifier.width(250.dp).shadow(16.dp, RoundedCornerShape(if (look.glass) 16.dp else 18.dp)).clip(RoundedCornerShape(if (look.glass) 16.dp else 18.dp)).background(popBg())
            .padding(vertical = if (look.glass) 0.dp else 8.dp),
    ) {
        items.forEachIndexed { i, (id, label) ->
            if (i > 0 && look.glass) Box(Modifier.fillMaxWidth().height(0.5.dp).background(if (look.dark) Color(0x8C545458) else Color(0x2E3C3C43)))
            Row(Modifier.fillMaxWidth().heightIn(min = 48.dp).clickable { onPick(id) }.padding(horizontal = 12.dp), verticalAlignment = Alignment.CenterVertically) {
                val shape = if (look.glass) RoundedCornerShape(10.dp) else m3Shape(listOf("cookie7", "clover", "flower")[when { (i + 1) % 3 == 0 -> 2; (i + 1) % 2 == 0 -> 1; else -> 0 }])
                Box(Modifier.size(if (look.glass) 32.dp else 36.dp).clip(shape).background(if (look.glass) Color(AttColors[id]!!) else cs.primaryContainer), contentAlignment = Alignment.Center) {
                    Icon(AttIcons[id]!!, null, tint = if (look.glass) Color.White else cs.onPrimaryContainer, modifier = Modifier.size(18.dp))
                }
                Text(tr(label), fontSize = 16.sp, color = look.text, modifier = Modifier.padding(start = 12.dp))
            }
        }
    }
}

/* ---------- Эмодзи: полный набор сайта (web/js/emoji-data.js → assets/emoji.json) ---------- */
private var emojiGroups: List<Pair<String, List<Pair<String, String>>>>? = null
private fun loadEmoji(ctx: android.content.Context): List<Pair<String, List<Pair<String, String>>>> = emojiGroups ?: runCatching {
    val arr = app.kosmo.chat.core.JSON.parseToJsonElement(ctx.assets.open("emoji.json").bufferedReader().readText()) as kotlinx.serialization.json.JsonArray
    arr.map { g ->
        val ga = g as kotlinx.serialization.json.JsonArray
        (ga[0] as kotlinx.serialization.json.JsonPrimitive).content to (ga[1] as kotlinx.serialization.json.JsonArray).map { e ->
            val ea = e as kotlinx.serialization.json.JsonArray
            (ea[0] as kotlinx.serialization.json.JsonPrimitive).content to (ea[1] as kotlinx.serialization.json.JsonPrimitive).content
        }
    }
}.getOrDefault(listOf("Smileys" to EMOJI_ALL.map { it to "" })).also { emojiGroups = it }

/** Выбор эмодзи и стикеров (.emoji-picker): вкладки, поиск, категории, сетка 8 в ряд. */
@OptIn(androidx.compose.foundation.ExperimentalFoundationApi::class)
@Composable
fun EmojiPicker(onEmoji: (String) -> Unit, onSticker: (JsonObject) -> Unit) {
    val look = LocalLook.current
    val ctx = androidx.compose.ui.platform.LocalContext.current
    val groups = remember { loadEmoji(ctx) }
    var tab by remember { mutableStateOf("emoji") }
    var q by remember { mutableStateOf("") }
    val grid = androidx.compose.foundation.lazy.grid.rememberLazyGridState()
    val scope = rememberCoroutineScope()
    val conf = androidx.compose.ui.platform.LocalConfiguration.current
    val r = RoundedCornerShape(if (look.glass) 16.dp else 28.dp)
    Column(
        Modifier.width(minOf(360.dp, conf.screenWidthDp.dp - 20.dp)).height(minOf(420.dp, conf.screenHeightDp.dp * 0.55f))
            .shadow(16.dp, r).clip(r).background(popBg()).padding(8.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        // вкладки (.picker-tabs)
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            listOf("emoji" to "Emoji", "stickers" to "Stickers").forEach { (id, label) ->
                val on = tab == id
                Box(
                    Modifier.weight(1f).height(34.dp).clip(RoundedCornerShape(12.dp)).background(if (on) look.accent.copy(alpha = 0.22f) else Color.Transparent).clickable { tab = id },
                    contentAlignment = Alignment.Center,
                ) { Text(tr(label), fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = if (on) look.text else look.text2) }
            }
        }
        if (tab == "emoji") {
            Box(Modifier.fillMaxWidth().height(40.dp).clip(RoundedCornerShape(12.dp)).background(look.field).padding(horizontal = 12.dp), contentAlignment = Alignment.CenterStart) {
                if (q.isEmpty()) Text(tr("Search emoji"), color = look.text3, fontSize = 16.sp)
                androidx.compose.foundation.text.BasicTextField(q, { q = it }, singleLine = true, textStyle = androidx.compose.ui.text.TextStyle(color = look.text, fontSize = 16.sp), cursorBrush = androidx.compose.ui.graphics.SolidColor(look.accent), modifier = Modifier.fillMaxWidth())
            }
            val s = q.trim().lowercase()
            if (s.isEmpty()) {
                // категории: первый символ каждой группы, нажатие — прокрутка к ней
                val heads = remember(groups) { var n = 0; groups.map { g -> n.also { n += 1 + g.second.size } } }
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    groups.forEachIndexed { i, g ->
                        Text(g.second.first().first, fontSize = 20.sp, modifier = Modifier.clip(RoundedCornerShape(8.dp)).clickable { scope.launch { grid.animateScrollToItem(heads[i]) } }.padding(4.dp))
                    }
                }
            }
            LazyVerticalGrid(GridCells.Fixed(8), state = grid, modifier = Modifier.fillMaxWidth().weight(1f)) {
                if (s.isNotEmpty()) {
                    val hits = groups.flatMap { it.second }.filter { (e, k) -> k.contains(s) || e == s }.take(240)
                    if (hits.isEmpty()) item(span = { GridItemSpan(8) }) { Text(tr("Nothing found"), color = look.text2, modifier = Modifier.padding(12.dp)) }
                    items(hits.size) { i -> EmojiCell(hits[i].first) { onEmoji(hits[i].first) } }
                } else groups.forEach { (name, list) ->
                    item(span = { GridItemSpan(8) }) { Text(tr(name).uppercase(), fontSize = 12.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 0.5.sp, color = look.text2, modifier = Modifier.padding(start = 4.dp, top = 8.dp, bottom = 4.dp)) }
                    items(list.size) { i -> EmojiCell(list[i].first) { onEmoji(list[i].first) } }
                }
            }
        } else LazyVerticalGrid(GridCells.Fixed(4), Modifier.fillMaxWidth().weight(1f)) {
            STICKER_PACKS.forEach { (name, items) ->
                item(span = { GridItemSpan(4) }) { Text(tr(name).uppercase(), fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = look.text2, modifier = Modifier.padding(start = 4.dp, top = 8.dp, bottom = 4.dp)) }
                items(items) { s ->
                    Column(Modifier.padding(2.dp).clip(RoundedCornerShape(14.dp)).clickable { onSticker(s) }.padding(6.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(emojiChar(s["emoji"]?.toString()?.trim('"')), fontSize = 40.sp)
                        val t = s["text"]?.toString()?.trim('"').orEmpty()
                        if (t.isNotEmpty()) Text(t, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    }
                }
            }
        }
    }
}

@Composable
private fun EmojiCell(e: String, onClick: () -> Unit) {
    var down by remember { mutableStateOf(false) }
    val sc by androidx.compose.animation.core.animateFloatAsState(if (down) 0.9f else 1f, androidx.compose.animation.core.spring(dampingRatio = 0.5f, stiffness = 600f), label = "e")
    Box(
        Modifier.aspectRatio(1f).scale(sc).clip(RoundedCornerShape(10.dp)).background(if (down) LocalLook.current.ink.copy(alpha = 0.12f) else Color.Transparent)
            .pointerInput(e) {
                awaitEachGesture {
                    awaitFirstDown(); down = true
                    val up = waitForUpOrCancellation(); down = false
                    if (up != null) onClick()
                }
            },
        contentAlignment = Alignment.Center,
    ) { Text(e, fontSize = 26.sp) }
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
    var solo by remember { mutableStateOf(false) }
    SwitchRow("Members can add tasks", open) { open = it }
    SwitchRow("Only I can check off tasks", solo, "Others see the progress but can’t mark tasks.") { solo = it }
    val me = app.kosmo.data.value.me
    BigButton("Send", enabled = items.any { it.isNotBlank() }) {
        onSend(jobj("kind" to "todo", "todo" to jobj("title" to title.trim(), "open" to open, "solo" to (if (solo) true else null), "items" to items.filter { it.isNotBlank() }.map { jobj("id" to UUID.randomUUID().toString(), "text" to it.trim(), "by" to me, "done" to emptyList<String>()) })))
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
