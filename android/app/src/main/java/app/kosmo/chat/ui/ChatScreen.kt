package app.kosmo.chat.ui

import android.Manifest
import android.content.pm.PackageManager
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.Reply
import androidx.compose.material.icons.automirrored.rounded.Send
import androidx.compose.material.icons.outlined.EmojiEmotions
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Call
import androidx.compose.material.icons.rounded.Checklist
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Code
import androidx.compose.material.icons.rounded.Delete
import androidx.compose.material.icons.rounded.Edit
import androidx.compose.material.icons.rounded.Group
import androidx.compose.material.icons.rounded.Image
import androidx.compose.material.icons.rounded.KeyboardArrowDown
import androidx.compose.material.icons.rounded.KeyboardArrowUp
import androidx.compose.material.icons.rounded.Mic
import androidx.compose.material.icons.rounded.MoreVert
import androidx.compose.material.icons.rounded.MusicNote
import androidx.compose.material.icons.rounded.Place
import androidx.compose.material.icons.rounded.Poll
import androidx.compose.material.icons.rounded.PushPin
import androidx.compose.material.icons.rounded.RadioButtonChecked
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material.icons.rounded.Videocam
import androidx.compose.material.icons.rounded.Wallpaper
import androidx.compose.material.icons.rounded.CleaningServices
import androidx.compose.material.icons.rounded.NotificationsOff
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import app.kosmo.chat.core.KosmoEvent
import app.kosmo.chat.core.jobj
import app.kosmo.chat.core.num
import app.kosmo.chat.core.obj
import app.kosmo.chat.core.str
import app.kosmo.chat.core.strings
import app.kosmo.chat.core.with
import coil.compose.AsyncImage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.JsonObject
import java.io.File

/** Загрузка, которая ещё идёт: в чате сразу видно само фото/голосовое с кругом прогресса. */
data class Upload(val id: String, val kind: String, val file: File, val w: Int = 0, val h: Int = 0, val duration: Double = 0.0, val progress: Float = 0f, val failed: Boolean = false)

@Composable
fun ChatScreen(app: AppState, chatId: String, otherId: String?, focus: String? = null) {
    val data by app.kosmo.data.collectAsState()
    val look = LocalLook.current
    val me = data.me ?: return
    val chat = data.chats[chatId]
    val saved = chatId == "saved_$me"
    val other = otherId?.let { data.accounts[it] } ?: chat?.let { data.otherOf(it) }
    val members = chat?.strings("members") ?: if (saved) listOf(me) else listOfNotNull(me, otherId)
    val messages = remember(chat, data.user) { chat?.let { data.visibleMessages(it) } ?: emptyList() }
    val uploads = remember { mutableStateListOf<Upload>() }
    val scope = rememberCoroutineScope()
    val ctx = LocalContext.current
    var typing by remember { mutableStateOf<String?>(null) }
    var replyTo by remember { mutableStateOf<JsonObject?>(null) }
    var editing by remember { mutableStateOf<JsonObject?>(null) }
    var text by remember { mutableStateOf("") }
    var menu by remember { mutableStateOf(false) }
    var plus by remember { mutableStateOf(false) }
    var emoji by remember { mutableStateOf(false) }
    var sheet by remember { mutableStateOf<String?>(null) }   // code / todo / poll / location
    var searching by remember { mutableStateOf(false) }
    var query by remember { mutableStateOf("") }
    var hit by remember { mutableIntStateOf(0) }
    val list = rememberLazyListState()
    val room = isRoom(chat)
    val admin = chat?.str("owner") == me || me in (chat?.strings("admins") ?: emptyList())
    val canPost = !room || if (isChannel(chat)) admin else me in members
    val joined = !room || me in members

    LaunchedEffect(chatId, messages.size) {
        app.openChatId = chatId
        app.kosmo.markRead(chatId)
        app.notifier.clear(chatId)
        if (list.firstVisibleItemIndex <= 2) list.animateScrollToItem(0)
    }
    LaunchedEffect(chatId) {
        app.kosmo.events.collect { e ->
            if (e is KosmoEvent.Typing && e.chat == chatId) {
                val who = if (room) firstName(data.accounts[e.from]?.str("name")) + " " else ""
                typing = who + tr(if (e.kind == "voice") "recording a voice message…" else if (e.kind == "round") "recording a video…" else "typing…")
                val mark = typing
                launch { delay(5000); if (typing == mark) typing = null }
            }
        }
    }
    // открыть на найденном сообщении
    val rows = remember(messages) { messages.asReversed() }
    LaunchedEffect(focus, rows.size) { focus?.let { f -> rows.indexOfFirst { it.str("id") == f }.takeIf { it >= 0 }?.let { list.scrollToItem(it + uploads.size) } } }

    fun send(fields: JsonObject) {
        val extra = replyTo?.let { jobj("replyTo" to it.str("id")) } ?: jobj()
        val ttl = chat?.num("ttl")
        val exp = if (ttl != null && ttl > 0) jobj("expiresAt" to System.currentTimeMillis() + ttl * 1000) else jobj()
        app.kosmo.sendMessage(chatId, members, JsonObject(extra + exp + fields), saved = saved)
        replyTo = null
        typing = null
    }

    fun upload(u: Upload, mime: String, build: (String) -> JsonObject) {
        uploads.add(u)
        scope.launch {
            try {
                val id = app.api.upload(u.file, mime) { p -> val i = uploads.indexOfFirst { it.id == u.id }; if (i >= 0) uploads[i] = uploads[i].copy(progress = p) }
                send(build(id))
                uploads.removeAll { it.id == u.id }
            } catch (e: Exception) {
                val i = uploads.indexOfFirst { it.id == u.id }
                if (i >= 0) uploads[i] = uploads[i].copy(failed = true)
                app.toast = e.message ?: "Upload failed"
            }
        }
    }

    fun sendPicked(uris: List<Uri>) {
        val cap = text.trim()
        text = ""
        scope.launch {
            for ((i, uri) in uris.withIndex()) {
                val mime = ctx.contentResolver.getType(uri) ?: "image/jpeg"
                val caption = if (i == uris.lastIndex) cap.ifEmpty { null } else null
                if (mime.startsWith("video/")) {
                    val f = withContext(Dispatchers.IO) { copyToCache(ctx, uri, "mp4") } ?: continue
                    val dur = runCatching { android.media.MediaMetadataRetriever().run { setDataSource(f.absolutePath); (extractMetadata(android.media.MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLong() ?: 0L).also { release() } } }.getOrDefault(0L) / 1000.0
                    upload(Upload(app.kosmo.newId(), "video", f, duration = dur), mime) { id -> jobj("kind" to "video", "media" to id, "duration" to dur, "caption" to caption) }
                } else {
                    val (f, w, h) = withContext(Dispatchers.IO) { compressPhoto(ctx, uri) } ?: run { app.toast = "Could not read this photo"; null } ?: continue
                    upload(Upload(app.kosmo.newId(), "photo", f, w, h), "image/jpeg") { id -> jobj("kind" to "photo", "media" to id, "w" to w, "h" to h, "caption" to caption) }
                }
            }
        }
    }
    val pickMedia = rememberLauncherForActivityResult(ActivityResultContracts.PickMultipleVisualMedia(10)) { uris -> if (uris.isNotEmpty()) sendPicked(uris) }
    val pickMusic = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        uri ?: return@rememberLauncherForActivityResult
        scope.launch {
            val name = ctx.contentResolver.query(uri, null, null, null, null)?.use { c -> if (c.moveToFirst()) c.getString(c.getColumnIndexOrThrow(android.provider.OpenableColumns.DISPLAY_NAME)) else null }?.substringBeforeLast('.') ?: "Music"
            val f = withContext(Dispatchers.IO) { copyToCache(ctx, uri, "mp3") } ?: return@launch
            val dur = runCatching { android.media.MediaMetadataRetriever().run { setDataSource(f.absolutePath); (extractMetadata(android.media.MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLong() ?: 0L).also { release() } } }.getOrDefault(0L) / 1000.0
            upload(Upload(app.kosmo.newId(), "voice", f, duration = dur), ctx.contentResolver.getType(uri) ?: "audio/mpeg") { id -> jobj("kind" to "audio", "media" to id, "name" to name, "duration" to dur) }
        }
    }
    val pickWallpaper = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        uri ?: return@rememberLauncherForActivityResult
        scope.launch {
            val (f, _, _) = withContext(Dispatchers.IO) { compressPhoto(ctx, uri, 1800) } ?: return@launch
            runCatching { app.setPref(chatId, "wp", app.api.upload(f, "image/jpeg")) }.onFailure { app.toast = it.message }
        }
    }
    // кружок с камеры: экран записи кладёт готовый файл сюда
    LaunchedEffect(app.roundResult) {
        val r = app.roundResult ?: return@LaunchedEffect
        app.roundResult = null
        upload(Upload(app.kosmo.newId(), "round", r.first, duration = r.second), "video/mp4") { id -> jobj("kind" to "round", "media" to id, "duration" to r.second) }
    }

    // голосовое: нажать — запись, ещё раз — отправить
    val recorder = remember { VoiceRecorder(ctx) }
    var recording by remember { mutableStateOf(false) }
    var recStart by remember { mutableStateOf(0L) }
    val micPerm = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { ok -> if (!ok) app.toast = "Allow microphone access to record" }
    val camPerm = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { r -> if (r.values.all { it }) app.push(Screen.Round) else app.toast = "Allow camera and microphone access to record" }
    fun toggleRecord() {
        if (!recording) {
            if (ContextCompat.checkSelfPermission(ctx, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) { micPerm.launch(Manifest.permission.RECORD_AUDIO); return }
            if (recorder.start()) { recording = true; recStart = System.currentTimeMillis(); app.kosmo.typing(chatId, "voice") }
            return
        }
        recording = false
        val (f, secs) = recorder.stop() ?: return
        upload(Upload(app.kosmo.newId(), "voice", f, duration = secs), "audio/mp4") { id -> jobj("kind" to "voice", "media" to id, "duration" to secs) }
    }

    val hits = remember(query, messages) {
        val q = query.trim().lowercase()
        if (q.length < 2) emptyList() else rows.indices.filter { i -> (rows[i].str("text") ?: rows[i].str("caption") ?: "").lowercase().contains(q) }
    }
    LaunchedEffect(hits, hit) { hits.getOrNull(hit)?.let { list.animateScrollToItem(it + uploads.size) } }

    Box(Modifier.fillMaxSize().background(look.page)) {
        MaterialWallpaper(Modifier.fillMaxSize())
        // свои обои чата
        data.pref(chatId)?.str("wp")?.let { wp -> AsyncImage(LocalMedia.current(wp), null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize(), alpha = 0.85f) }
        Column(Modifier.fillMaxSize().imePadding()) {
            if (searching) Header {
                CircleBtn(Icons.Rounded.Close, "Close search") { searching = false; query = "" }
                SearchField(query, "Search messages", Modifier.weight(1f), autofocus = true) { query = it; hit = 0 }
            } else Header {
                BackBtn(app)
                val sub = when {
                    typing != null -> typing!!
                    saved -> "notes for yourself"
                    room -> tr("${members.size} ${if (isChannel(chat)) "subscribers" else "members"}")
                    else -> other?.let { lastSeen(it) } ?: ""
                }
                TitlePill(
                    if (saved) "Saved Messages" else chat?.let { data.chatTitle(it) } ?: other?.str("name") ?: "Chat",
                    sub, subAccent = typing != null,
                ) { if (room) app.push(Screen.RoomInfo(chatId)) else if (other != null && !saved) app.push(Screen.User(other.str("id")!!)) }
                Box {
                    CircleBtn(Icons.Rounded.MoreVert, "Chat options") { menu = true }
                    KosmoMenu(menu, { menu = false }, listOfNotNull(
                        MenuItem(Icons.Rounded.Search, "Search") { searching = true },
                        if (!room && !saved && other != null) MenuItem(Icons.Rounded.Call, "Voice call") { app.startCall(other.str("id")!!, false) } else null,
                        if (!room && !saved && other != null) MenuItem(Icons.Rounded.Videocam, "Video call") { app.startCall(other.str("id")!!, true) } else null,
                        if (room) MenuItem(Icons.Rounded.Group, if (isChannel(chat)) "Channel info" else "Group info") { app.push(Screen.RoomInfo(chatId)) } else null,
                        MenuItem(Icons.Rounded.Wallpaper, "Wallpaper") { if (data.pref(chatId)?.str("wp") != null) app.setPref(chatId, "wp", null) else pickWallpaper.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) },
                        MenuItem(Icons.Rounded.NotificationsOff, if (chat != null && data.muted(chat)) "Unmute notifications" else "Mute notifications") { app.setPref(chatId, "muted", if (chat != null && data.muted(chat)) null else true) },
                        MenuItem(Icons.Rounded.CleaningServices, "Clear history") { app.setPref(chatId, "clearedAt", System.currentTimeMillis()) },
                        if (chat != null) MenuItem(Icons.Rounded.Delete, if (room && !admin) "Leave" else "Delete chat", danger = true) { app.deleteChat(chatId) } else null,
                    ))
                }
                when {
                    saved -> ChatAvatar(data, chat ?: jobj("saved" to true), 48.dp)
                    chat != null && room -> ChatAvatar(data, chat, 48.dp, Modifier.clickable { app.push(Screen.RoomInfo(chatId)) })
                    else -> UserAvatar(other, 48.dp, Modifier.clip(CircleShape).clickable { other?.str("id")?.let { app.push(Screen.User(it)) } })
                }
            }
            // закреплённое сообщение
            chat?.str("pinned")?.let { pid -> messages.firstOrNull { it.str("id") == pid } }?.let { pm ->
                Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp).chrome(look, RoundedCornerShape(16.dp)).clickable {
                    rows.indexOfFirst { it.str("id") == pm.str("id") }.takeIf { it >= 0 }?.let { i -> scope.launch { list.animateScrollToItem(i + uploads.size) } }
                }.padding(horizontal = 12.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(Icons.Rounded.PushPin, null, tint = look.accent, modifier = Modifier.size(18.dp))
                    Column(Modifier.padding(start = 10.dp)) {
                        Text(tr("Pinned message"), color = look.accent, fontSize = 12.sp)
                        Text(tr(data.previewText(pm)), maxLines = 1, overflow = TextOverflow.Ellipsis, fontSize = 14.sp)
                    }
                }
            }

            LazyColumn(
                state = list, reverseLayout = true, modifier = Modifier.weight(1f).fillMaxWidth(),
                contentPadding = PaddingValues(horizontal = 10.dp, vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(3.dp),
            ) {
                items(uploads.size, key = { "up-" + uploads.asReversed()[it].id }) { i -> val u = uploads.asReversed()[i]; UploadBubble(u) { uploads.remove(u) } }
                items(rows.size, key = { rows[it].str("id") ?: "$it" }) { i ->
                    val m = rows[i]
                    val older = rows.getOrNull(i + 1)
                    Column {
                        val at = m.num("at") ?: 0
                        if (older == null || !sameDay(older.num("at") ?: 0, at)) DayPill(dayLabel(at))
                        MessageRow(
                            app, data, chat, m, mine = m.str("from") == me,
                            showName = older?.str("from") != m.str("from") || older?.str("kind") == "join",
                            highlight = (searching && hits.getOrNull(hit) == i) || focus == m.str("id"),
                            byId = { id -> messages.firstOrNull { it.str("id") == id } },
                            onReply = { replyTo = m; editing = null },
                            onEdit = { editing = m; replyTo = null; text = m.str("text") ?: m.str("caption") ?: "" },
                        )
                    }
                }
                if (messages.isEmpty() && uploads.isEmpty()) item("empty") {
                    Column(Modifier.fillMaxWidth().padding(top = 80.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        PlanetLogo(Modifier.size(110.dp))
                        Text(tr(if (saved) "Save messages, photos and notes here" else "No messages yet"), color = look.text2, modifier = Modifier.padding(top = 8.dp))
                        if (!saved && !room) Column(
                            Modifier.padding(top = 16.dp).chrome(look, RoundedCornerShape(22.dp)).clickable { send(jobj("kind" to "sticker", "sticker" to jobj("emoji" to "like", "anim" to "wave", "text" to "Hi!"))) }.padding(18.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                        ) { Text("👍", fontSize = 48.sp); Text(tr("Say hi"), fontSize = 14.sp) }
                    }
                }
            }

            if (searching) Row(Modifier.fillMaxWidth().navigationBarsPadding().padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(if (query.length < 2) "" else if (hits.isEmpty()) tr("No messages found") else tr("${hit + 1} of ${hits.size}"), color = look.text2, modifier = Modifier.weight(1f).padding(start = 8.dp))
                CircleBtn(Icons.Rounded.KeyboardArrowUp, "Older", enabled = hit < hits.lastIndex) { hit++ }
                Spacer(Modifier.width(8.dp))
                CircleBtn(Icons.Rounded.KeyboardArrowDown, "Newer", enabled = hit > 0) { hit-- }
            }
            else {
                // ответ / правка над полем ввода
                AnimatedVisibility(replyTo != null || editing != null, enter = expandVertically() + fadeIn(), exit = shrinkVertically() + fadeOut()) {
                    val m = replyTo ?: editing
                    Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp).chrome(look, RoundedCornerShape(16.dp)).padding(horizontal = 12.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(if (editing != null) Icons.Rounded.Edit else Icons.AutoMirrored.Rounded.Reply, null, tint = look.accent)
                        Column(Modifier.weight(1f).padding(horizontal = 12.dp)) {
                            Text(if (editing != null) tr("Editing") else tr("Reply to ${data.accounts[m?.str("from")]?.str("name") ?: ""}"), color = look.accent, fontSize = 13.sp)
                            Text(m?.let { tr(data.previewText(it)) } ?: "", maxLines = 1, overflow = TextOverflow.Ellipsis, fontSize = 14.sp)
                        }
                        IconButton({ replyTo = null; if (editing != null) { editing = null; text = "" } }) { Icon(Icons.Rounded.Close, tr("Cancel")) }
                    }
                }
                if (!joined) Box(Modifier.fillMaxWidth().navigationBarsPadding().padding(12.dp)) {
                    BigButton(if (isChannel(chat)) "Join channel" else "Join group") {
                        app.kosmo.commit(jobj("col" to "chats", "id" to chatId, "op" to "put", "set" to jobj("members" to (members + me))))
                    }
                } else if (!canPost) Text(
                    tr(if (isChannel(chat)) "Only admins can post in this channel" else "You can’t write here"), color = look.text2,
                    modifier = Modifier.fillMaxWidth().navigationBarsPadding().padding(20.dp), textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                ) else Row(Modifier.fillMaxWidth().navigationBarsPadding().padding(start = 12.dp, end = 12.dp, top = 6.dp, bottom = 10.dp), verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    if (recording) {
                        val t = rememberInfiniteTransition(label = "rec")
                        val a by t.animateFloat(1f, 0.25f, infiniteRepeatable(tween(600), RepeatMode.Reverse), label = "dot")
                        var secs by remember { mutableStateOf(0L) }
                        LaunchedEffect(recStart) { while (true) { secs = (System.currentTimeMillis() - recStart) / 1000; delay(250) } }
                        CircleBtn(Icons.Rounded.Delete, "Cancel") { recorder.cancel(); recording = false }
                        Row(Modifier.weight(1f).height(48.dp).chrome(look, RoundedCornerShape(24.dp)).padding(horizontal = 18.dp), verticalAlignment = Alignment.CenterVertically) {
                            Box(Modifier.size(10.dp).background(Color(0xFFFF453A).copy(alpha = a), CircleShape))
                            Text("  ${fmtDur(secs)}   " + tr("Recording…"))
                        }
                        CircleBtn(Icons.AutoMirrored.Rounded.Send, "Send", accent = true) { toggleRecord() }
                    } else {
                        Box {
                            CircleBtn(if (plus) Icons.Rounded.Close else Icons.Rounded.Add, "Attach") { plus = !plus; emoji = false }
                            AttachMenu(plus, { plus = false }) { what ->
                                when (what) {
                                    "photo" -> pickMedia.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageAndVideo))
                                    "video" -> pickMedia.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.VideoOnly))
                                    "round" -> camPerm.launch(arrayOf(Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO))
                                    "music" -> pickMusic.launch("audio/*")
                                    else -> sheet = what
                                }
                            }
                        }
                        Row(
                            Modifier.weight(1f).heightIn(min = 48.dp).chrome(look, RoundedCornerShape(24.dp)).padding(start = 16.dp, end = 4.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Box(Modifier.weight(1f).padding(vertical = 12.dp)) {
                                if (text.isEmpty()) Text(tr("Message"), color = look.text3, fontSize = 16.sp)
                                BasicTextField(
                                    value = text,
                                    onValueChange = { v -> if (v.length > text.length) app.kosmo.typing(chatId); text = v },
                                    textStyle = TextStyle(color = look.text, fontSize = 16.sp), cursorBrush = SolidColor(look.accent), maxLines = 6,
                                    modifier = Modifier.fillMaxWidth(),
                                )
                            }
                            IconButton({ emoji = !emoji; plus = false }) { Icon(Icons.Outlined.EmojiEmotions, tr("Emoji"), tint = look.text2) }
                        }
                        val hasText = text.isNotBlank()
                        CircleBtn(if (hasText) Icons.AutoMirrored.Rounded.Send else Icons.Rounded.Mic, if (hasText) "Send" else "Record voice", accent = true) {
                            if (!hasText) { toggleRecord(); return@CircleBtn }
                            val t = text.trim()
                            val e = editing
                            if (e != null) {
                                val field = if (e.str("kind") == "text") "text" else "caption"
                                if ((e.str(field) ?: "") != t) app.kosmo.editMessage(chatId, e.with(field to t, "edited" to true))
                                editing = null
                            } else {
                                val lone = t.takeIf { it.codePointCount(0, it.length) <= 2 && (EMOJI.containsValue(it) || it in EMOJI_ALL) }
                                send(if (lone != null) jobj("kind" to "emoji", "emoji" to lone) else jobj("kind" to "text", "text" to t))
                            }
                            text = ""
                        }
                    }
                }
                AnimatedVisibility(emoji && canPost, enter = expandVertically(), exit = shrinkVertically()) {
                    EmojiPanel(onEmoji = { text += it }, onSticker = { st -> send(jobj("kind" to "sticker", "sticker" to st)); emoji = false })
                }
            }
        }
    }
    sheet?.let { s ->
        ComposeSheet(app, s, onClose = { sheet = null }) { fields -> send(fields); sheet = null }
    }
}

/** Меню «+» в поле ввода: как на сайте — цветные значки. */
@Composable
private fun AttachMenu(open: Boolean, onClose: () -> Unit, onPick: (String) -> Unit) {
    KosmoMenu(open, onClose, listOf(
        MenuItem(Icons.Rounded.Image, "Photo", Color(0xFF0A84FF)) { onPick("photo") },
        MenuItem(Icons.Rounded.Videocam, "Video", Color(0xFFFF375F)) { onPick("video") },
        MenuItem(Icons.Rounded.Code, "Code", Color(0xFF5E5CE6)) { onPick("code") },
        MenuItem(Icons.Rounded.RadioButtonChecked, "Video message", Color(0xFF30D158)) { onPick("round") },
        MenuItem(Icons.Rounded.Checklist, "Checklist", Color(0xFF32D74B)) { onPick("todo") },
        MenuItem(Icons.Rounded.Poll, "Poll", Color(0xFFBF5AF2)) { onPick("poll") },
        MenuItem(Icons.Rounded.Place, "Location", Color(0xFFFF9F0A)) { onPick("location") },
        MenuItem(Icons.Rounded.MusicNote, "Music", Color(0xFFFF9F0A)) { onPick("music") },
    ), offset = androidx.compose.ui.unit.DpOffset(0.dp, (-8).dp))
}

/** Поле поиска-пилюля. */
@Composable
fun SearchField(value: String, hint: String, modifier: Modifier = Modifier, autofocus: Boolean = false, onChange: (String) -> Unit) {
    val look = LocalLook.current
    val focus = remember { FocusRequester() }
    if (autofocus) LaunchedEffect(Unit) { focus.requestFocus() }
    Row(modifier.height(48.dp).chrome(look, RoundedCornerShape(24.dp)).padding(horizontal = 14.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(Icons.Rounded.Search, null, tint = look.text2, modifier = Modifier.size(20.dp))
        Box(Modifier.weight(1f).padding(start = 10.dp)) {
            if (value.isEmpty()) Text(tr(hint), color = look.text3, fontSize = 16.sp)
            BasicTextField(value, onChange, singleLine = true, textStyle = TextStyle(color = look.text, fontSize = 16.sp), cursorBrush = SolidColor(look.accent), modifier = Modifier.fillMaxWidth().focusRequester(focus))
        }
        if (value.isNotEmpty()) Icon(Icons.Rounded.Close, tr("Clear"), tint = look.text2, modifier = Modifier.size(20.dp).clickable { onChange("") })
    }
}

fun lastSeen(u: JsonObject): String {
    if (u.str("online") == "true" || u["online"]?.toString() == "true") return tr("online")
    val at = u.num("lastSeen") ?: return tr("last seen recently")
    val mins = (System.currentTimeMillis() - at) / 60000
    return when {
        mins < 2 -> tr("online")
        mins < 60 -> tr("last seen $mins min ago")
        sameDay(at, System.currentTimeMillis()) -> tr("last seen at ${timeOf(at)}")
        else -> tr("last seen ${listTime(at)}")
    }
}

@Composable
fun UploadBubble(u: Upload, onDismiss: () -> Unit) {
    val look = LocalLook.current
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
        Box(contentAlignment = Alignment.Center) {
            when (u.kind) {
                "photo" -> AsyncImage(u.file, null, contentScale = ContentScale.Crop, modifier = Modifier.width(260.dp).aspectRatio((u.w.toFloat() / u.h.coerceAtLeast(1)).coerceIn(0.5f, 2f)).clip(RoundedCornerShape(18.dp)))
                "video" -> Box(Modifier.width(260.dp).aspectRatio(4f / 3f).clip(RoundedCornerShape(18.dp)).background(Color(0xFF1A1A1E)))
                "round" -> Box(Modifier.size(220.dp).clip(CircleShape).background(Color(0xFF111111))) {
                    AsyncImage(coil.request.ImageRequest.Builder(LocalContext.current).data(u.file).decoderFactory(coil.decode.VideoFrameDecoder.Factory()).build(), null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
                }
                else -> Row(Modifier.width(240.dp).clip(RoundedCornerShape(18.dp)).background(look.accent).padding(10.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(44.dp))
                    Row(Modifier.weight(1f).height(28.dp).padding(start = 10.dp), horizontalArrangement = Arrangement.spacedBy(2.dp), verticalAlignment = Alignment.CenterVertically) {
                        repeat(28) { i -> Box(Modifier.weight(1f).fillMaxHeight(0.2f + 0.6f * kotlin.math.abs(kotlin.math.sin(i * 1.7f))).clip(RoundedCornerShape(2.dp)).background(look.onAccent.copy(alpha = 0.4f))) }
                    }
                    Text(tr("  ") + fmtDur(u.duration), color = look.onAccent, fontSize = 12.sp)
                }
            }
            val ringAt = if (u.kind == "voice") Modifier.align(Alignment.CenterStart).padding(start = 10.dp) else Modifier
            Box(ringAt.size(48.dp).background(Color.Black.copy(alpha = 0.4f), CircleShape).clickable(enabled = u.failed) { onDismiss() }, contentAlignment = Alignment.Center) {
                if (u.failed) Icon(Icons.Rounded.Close, "Remove", tint = Color.White)
                else CircularProgressIndicator(progress = { u.progress.coerceAtLeast(0.04f) }, color = Color.White, trackColor = Color.White.copy(alpha = 0.25f), strokeWidth = 3.dp, modifier = Modifier.size(40.dp))
            }
        }
    }
}

@Suppress("unused") private fun keep() = MaterialTheme
