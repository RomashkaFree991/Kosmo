package app.kosmo.chat.ui

import android.Manifest
import android.content.ClipData
import android.content.pm.PackageManager
import android.net.Uri
import android.widget.VideoView
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
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.Reply
import androidx.compose.material.icons.automirrored.rounded.Send
import androidx.compose.material.icons.rounded.AddPhotoAlternate
import androidx.compose.material.icons.rounded.Call
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.ContentCopy
import androidx.compose.material.icons.rounded.Delete
import androidx.compose.material.icons.rounded.Edit
import androidx.compose.material.icons.rounded.Mic
import androidx.compose.material.icons.rounded.Pause
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Videocam
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import app.kosmo.chat.core.Data
import app.kosmo.chat.core.KosmoEvent
import app.kosmo.chat.core.arr
import app.kosmo.chat.core.bool
import app.kosmo.chat.core.dbl
import app.kosmo.chat.core.jobj
import app.kosmo.chat.core.num
import app.kosmo.chat.core.obj
import app.kosmo.chat.core.objects
import app.kosmo.chat.core.str
import app.kosmo.chat.core.strings
import app.kosmo.chat.core.with
import app.kosmo.chat.core.without
import coil.compose.AsyncImage
import coil.decode.VideoFrameDecoder
import coil.request.ImageRequest
import coil.request.videoFrameMillis
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import java.io.File

/** Загрузка, которая ещё идёт: в чате сразу видно само фото/голосовое с кругом прогресса. */
private data class Upload(val id: String, val kind: String, val file: File, val w: Int = 0, val h: Int = 0, val duration: Double = 0.0, val progress: Float = 0f, val failed: Boolean = false)

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun ChatScreen(app: AppState, chatId: String, otherId: String?) {
    val data by app.kosmo.data.collectAsState()
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
    val list = rememberLazyListState()
    val canPost = !isRoom(chat) || if (isChannel(chat)) (chat!!.str("owner") == me || me in chat.strings("admins")) else me in members

    // открыт этот чат: прочитано всё, что пришло
    LaunchedEffect(chatId, messages.size) {
        app.openChatId = chatId
        app.kosmo.markRead(chatId)
        if (list.firstVisibleItemIndex <= 2) list.animateScrollToItem(0)
    }
    LaunchedEffect(chatId) {
        app.kosmo.events.collect { e ->
            if (e is KosmoEvent.Typing && e.chat == chatId) {
                typing = if (e.kind == "voice") "recording a voice message…" else if (e.kind == "round") "recording a video…" else "typing…"
                val mark = typing
                launch { delay(5000); if (typing == mark) typing = null }
            }
        }
    }

    fun send(fields: JsonObject) {
        val extra = replyTo?.let { jobj("replyTo" to it.str("id")) } ?: jobj()
        app.kosmo.sendMessage(chatId, members, JsonObject(extra + fields), saved = saved)
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

    val pick = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri: Uri? ->
        uri ?: return@rememberLauncherForActivityResult
        val mime = ctx.contentResolver.getType(uri) ?: "image/jpeg"
        scope.launch {
            if (mime.startsWith("video/")) {
                val f = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) { copyToCache(ctx, uri, "mp4") } ?: return@launch
                val dur = runCatching { android.media.MediaMetadataRetriever().run { setDataSource(f.absolutePath); (extractMetadata(android.media.MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLong() ?: 0L).also { release() } } }.getOrDefault(0L) / 1000.0
                upload(Upload(app.kosmo.newId(), "video", f, duration = dur), mime) { id -> jobj("kind" to "video", "media" to id, "duration" to dur) }
            } else {
                val (f, w, h) = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) { compressPhoto(ctx, uri) } ?: run { app.toast = "Could not read this photo"; return@launch }
                val cap = text.trim()
                text = ""
                upload(Upload(app.kosmo.newId(), "photo", f, w, h), "image/jpeg") { id -> jobj("kind" to "photo", "media" to id, "w" to w, "h" to h, "caption" to cap.ifEmpty { null }) }
            }
        }
    }

    // голосовое: нажать — запись, ещё раз — отправить сразу
    val recorder = remember { VoiceRecorder(ctx) }
    var recording by remember { mutableStateOf(false) }
    var recStart by remember { mutableStateOf(0L) }
    val micPerm = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { ok -> if (!ok) app.toast = "Allow the microphone to record voice messages" }
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

    Column(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background).imePadding()) {
        // шапка: назад, имя и статус, аватар
        Row(Modifier.fillMaxWidth().statusBarsPadding().padding(horizontal = 12.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            BackCircle(app)
            Spacer(Modifier.width(10.dp))
            Column(
                Modifier.weight(1f).clip(RoundedCornerShape(24.dp)).background(MaterialTheme.colorScheme.surfaceContainerHigh)
                    .clickable { if (other != null && !isRoom(chat) && !saved) app.push(Screen.User(other.str("id")!!)) }.padding(vertical = 6.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(if (saved) "Saved Messages" else chat?.let { data.chatTitle(it) } ?: other?.str("name") ?: "Chat", style = MaterialTheme.typography.titleMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
                val sub = when {
                    typing != null -> typing!!
                    saved -> "notes for yourself"
                    isRoom(chat) -> "${members.size} ${if (isChannel(chat)) "subscribers" else "members"}"
                    else -> other?.let { lastSeen(it) } ?: ""
                }
                if (sub.isNotEmpty()) Text(sub, style = MaterialTheme.typography.labelMedium, color = if (typing != null) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Spacer(Modifier.width(10.dp))
            when {
                saved -> ChatAvatar(data, chat ?: jobj("saved" to true), 48.dp)
                chat != null && isRoom(chat) -> ChatAvatar(data, chat, 48.dp)
                else -> UserAvatar(other, 48.dp, Modifier.clickable { other?.str("id")?.let { app.push(Screen.User(it)) } })
            }
        }

        // сообщения: новые снизу
        val rows = remember(messages) { messages.asReversed() }
        LazyColumn(
            state = list, reverseLayout = true, modifier = Modifier.weight(1f).fillMaxWidth(),
            contentPadding = PaddingValues(horizontal = 10.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(3.dp),
        ) {
            items(uploads.asReversed(), key = { "up-" + it.id }) { u -> UploadBubble(u) { uploads.remove(u) } }
            items(rows.size, key = { rows[it].str("id") ?: "$it" }) { i ->
                val m = rows[i]
                val older = rows.getOrNull(i + 1)
                Column {
                    val at = m.num("at") ?: 0
                    if (older == null || !sameDay(older.num("at") ?: 0, at)) DayPill(dayLabel(at))
                    MessageRow(
                        app, data, chat, m, mine = m.str("from") == me,
                        showName = isRoom(chat) && !isChannel(chat) && m.str("from") != me && older?.str("from") != m.str("from"),
                        byId = { id -> messages.firstOrNull { it.str("id") == id } },
                        onReply = { replyTo = m; editing = null },
                        onEdit = { editing = m; replyTo = null; text = m.str("text") ?: m.str("caption") ?: "" },
                    )
                }
            }
            if (messages.isEmpty() && uploads.isEmpty()) item("empty") {
                Column(Modifier.fillMaxWidth().padding(top = 80.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    PlanetLogo(Modifier.size(110.dp))
                    Text(if (saved) "Save messages, photos and notes here" else "No messages yet", color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 8.dp))
                    if (!saved && !isRoom(chat)) Surface(
                        onClick = { send(jobj("kind" to "sticker", "sticker" to jobj("emoji" to "like", "anim" to "wave", "text" to "Hi!"))) },
                        shape = RoundedCornerShape(20.dp), color = MaterialTheme.colorScheme.surfaceContainerHigh, modifier = Modifier.padding(top = 16.dp),
                    ) { Column(Modifier.padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) { Text("👍", fontSize = 48.sp); Text("Say hi", style = MaterialTheme.typography.labelLarge) } }
                }
            }
        }

        // ответ / правка над полем ввода
        AnimatedVisibility(replyTo != null || editing != null, enter = expandVertically() + fadeIn(), exit = shrinkVertically() + fadeOut()) {
            val m = replyTo ?: editing
            Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(if (editing != null) Icons.Rounded.Edit else Icons.AutoMirrored.Rounded.Reply, null, tint = MaterialTheme.colorScheme.primary)
                Column(Modifier.weight(1f).padding(horizontal = 12.dp)) {
                    Text(if (editing != null) "Editing" else data.accounts[m?.str("from")]?.str("name") ?: "", color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.labelLarge)
                    Text(m?.let { data.previewText(it) } ?: "", maxLines = 1, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.bodyMedium)
                }
                IconButton({ replyTo = null; if (editing != null) { editing = null; text = "" } }) { Icon(Icons.Rounded.Close, "Cancel") }
            }
        }

        if (!canPost) {
            Text(if (isChannel(chat)) "Only admins can post in this channel" else "You can’t write here", color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.fillMaxWidth().navigationBarsPadding().padding(20.dp), textAlign = androidx.compose.ui.text.style.TextAlign.Center)
        } else Row(Modifier.fillMaxWidth().navigationBarsPadding().padding(horizontal = 10.dp, vertical = 8.dp), verticalAlignment = Alignment.Bottom) {
            if (recording) {
                val t = rememberInfiniteTransition(label = "rec")
                val a by t.animateFloat(1f, 0.25f, infiniteRepeatable(tween(600), RepeatMode.Reverse), label = "dot")
                var secs by remember { mutableStateOf(0L) }
                LaunchedEffect(recStart) { while (true) { secs = (System.currentTimeMillis() - recStart) / 1000; delay(250) } }
                IconButton({ recorder.cancel(); recording = false }, Modifier.size(52.dp)) { Icon(Icons.Rounded.Delete, "Cancel", tint = MaterialTheme.colorScheme.error) }
                Row(Modifier.weight(1f).height(52.dp).clip(RoundedCornerShape(26.dp)).background(MaterialTheme.colorScheme.surfaceContainerHigh).padding(horizontal = 18.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(10.dp).background(MaterialTheme.colorScheme.error.copy(alpha = a), CircleShape))
                    Text("  ${fmtDur(secs)}   Recording…", style = MaterialTheme.typography.bodyLarge)
                }
                Spacer(Modifier.width(8.dp))
                FilledIconButton(onClick = { toggleRecord() }, modifier = Modifier.size(52.dp)) { Icon(Icons.AutoMirrored.Rounded.Send, "Send") }
            } else {
                IconButton({ pick.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageAndVideo)) }, Modifier.size(52.dp)) {
                    Icon(Icons.Rounded.AddPhotoAlternate, "Attach")
                }
                TextField(
                    value = text,
                    onValueChange = { v -> if (v.length > text.length) app.kosmo.typing(chatId); text = v },
                    placeholder = { Text("Message") },
                    modifier = Modifier.weight(1f).heightIn(min = 52.dp),
                    shape = RoundedCornerShape(26.dp), maxLines = 6,
                    colors = TextFieldDefaults.colors(
                        focusedIndicatorColor = Color.Transparent, unfocusedIndicatorColor = Color.Transparent,
                        focusedContainerColor = MaterialTheme.colorScheme.surfaceContainerHigh, unfocusedContainerColor = MaterialTheme.colorScheme.surfaceContainerHigh,
                    ),
                )
                Spacer(Modifier.width(8.dp))
                val hasText = text.isNotBlank()
                FilledIconButton(
                    onClick = {
                        if (!hasText) { toggleRecord(); return@FilledIconButton }
                        val t = text.trim()
                        val e = editing
                        if (e != null) {
                            val field = if (e.str("kind") == "text") "text" else "caption"
                            if ((e.str(field) ?: "") != t) app.kosmo.editMessage(chatId, e.with(field to t, "edited" to true))
                            editing = null
                        } else {
                            // одна эмодзи — большая, как на сайте
                            val lone = t.takeIf { it.codePointCount(0, it.length) <= 2 && EMOJI.containsValue(it) }
                            send(if (lone != null) jobj("kind" to "emoji", "emoji" to lone) else jobj("kind" to "text", "text" to t))
                        }
                        text = ""
                    },
                    modifier = Modifier.size(52.dp),
                ) { Icon(if (hasText) Icons.AutoMirrored.Rounded.Send else Icons.Rounded.Mic, if (hasText) "Send" else "Record voice") }
            }
        }
    }
}

fun lastSeen(u: JsonObject): String {
    if (u.bool("online")) return "online"
    val at = u.num("lastSeen") ?: return "last seen recently"
    val mins = (System.currentTimeMillis() - at) / 60000
    return when {
        mins < 2 -> "online"
        mins < 60 -> "last seen $mins min ago"
        sameDay(at, System.currentTimeMillis()) -> "last seen at ${timeOf(at)}"
        else -> "last seen ${listTime(at)}"
    }
}

@Composable
private fun DayPill(label: String) {
    Box(Modifier.fillMaxWidth().padding(vertical = 8.dp), contentAlignment = Alignment.Center) {
        Text(label, style = MaterialTheme.typography.labelMedium, modifier = Modifier.clip(CircleShape).background(MaterialTheme.colorScheme.surfaceContainerHigh).padding(horizontal = 12.dp, vertical = 4.dp))
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun MessageRow(
    app: AppState, data: Data, chat: JsonObject?, m: JsonObject, mine: Boolean, showName: Boolean,
    byId: (String) -> JsonObject?, onReply: () -> Unit, onEdit: () -> Unit,
) {
    val kind = m.str("kind") ?: "text"
    if (kind == "join") { ServicePill(data.previewText(m)); return }
    if (m.bool("viewOnce") && m.bool("viewed")) { ServicePill(if (mine) "Photo viewed" else "You viewed the photo"); return }
    val chatId = chat?.str("id")
    var menu by remember { mutableStateOf(false) }
    val clip = LocalClipboardManager.current
    val me = data.me
    val bare = kind in setOf("sticker", "emoji", "round")
    val tick = if (mine) when {
        m.str("id") in data.pending -> TickState.Pending
        chat != null && chat.strings("members").any { it != me && (chat.obj("read")?.num(it) ?: 0) >= (m.num("at") ?: 0) } -> TickState.Read
        else -> TickState.Sent
    } else null

    Row(Modifier.fillMaxWidth(), horizontalArrangement = if (mine) Arrangement.End else Arrangement.Start, verticalAlignment = Alignment.Bottom) {
        if (showName || (isRoom(chat) && !isChannel(chat) && !mine)) {
            Box(Modifier.size(34.dp)) { if (showName) UserAvatar(data.accounts[m.str("from")], 34.dp, Modifier.clickable { m.str("from")?.let { app.push(Screen.User(it)) } }) }
            Spacer(Modifier.width(6.dp))
        }
        Box {
            val shape = RoundedCornerShape(20.dp, 20.dp, if (mine) 6.dp else 20.dp, if (mine) 20.dp else 6.dp)
            val bg = if (mine) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceContainerHigh
            val fg = if (mine) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurface
            Column(
                Modifier.widthIn(max = 300.dp)
                    .then(if (bare) Modifier else Modifier.clip(shape).background(bg))
                    .combinedClickable(onClick = {
                        when (kind) {
                            "photo" -> m.str("media")?.let { app.push(Screen.Photo(it)) }
                            "video" -> m.str("media")?.let { app.push(Screen.Video(it)) }
                        }
                    }, onLongClick = { menu = true })
                    .padding(if (bare) 0.dp else if (kind == "photo" || kind == "video") 3.dp else 0.dp),
            ) {
                if (showName) Text(data.accounts[m.str("from")]?.str("name") ?: "", color = MaterialTheme.colorScheme.tertiary, style = MaterialTheme.typography.labelLarge, modifier = Modifier.padding(start = 12.dp, end = 12.dp, top = 8.dp))
                m.str("replyTo")?.let { rid ->
                    val r = byId(rid)
                    Row(Modifier.padding(start = 8.dp, end = 8.dp, top = 8.dp).clip(RoundedCornerShape(10.dp)).background(fg.copy(alpha = 0.12f)).padding(horizontal = 10.dp, vertical = 6.dp)) {
                        Column {
                            Text(data.accounts[r?.str("from")]?.str("name") ?: "Message", color = fg, style = MaterialTheme.typography.labelLarge)
                            Text(r?.let { data.previewText(it) } ?: "Deleted message", color = fg.copy(alpha = 0.8f), maxLines = 1, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.bodySmall)
                        }
                    }
                }
                MessageBody(app, data, m, kind, mine, fg, tick)
                val reactions = m.obj("reactions")?.entries?.filter { (it.value as? JsonArray)?.isNotEmpty() == true }.orEmpty()
                if (reactions.isNotEmpty()) Row(Modifier.padding(horizontal = 8.dp).padding(bottom = 8.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    reactions.forEach { (key, who) ->
                        val ids = (who as JsonArray).mapNotNull { (it as? JsonPrimitive)?.content }
                        val minePicked = me in ids
                        Text(
                            "${emojiChar(key)} ${ids.size}",
                            fontSize = 13.sp,
                            modifier = Modifier.clip(CircleShape).background(if (minePicked) fg.copy(alpha = 0.3f) else fg.copy(alpha = 0.12f))
                                .clickable { chatId?.let { react(app, it, m, key) } }.padding(horizontal = 8.dp, vertical = 3.dp),
                            color = fg,
                        )
                    }
                }
            }
            DropdownMenu(menu, { menu = false }, shape = RoundedCornerShape(20.dp)) {
                LazyRow(Modifier.padding(horizontal = 8.dp).width(260.dp)) {
                    items(REACTIONS) { r ->
                        Text(EMOJI[r]!!, fontSize = 26.sp, modifier = Modifier.clip(CircleShape).clickable { menu = false; chatId?.let { react(app, it, m, r) } }.padding(6.dp))
                    }
                }
                HorizontalDivider(Modifier.padding(vertical = 4.dp))
                DropdownMenuItem({ Text("Reply") }, { menu = false; onReply() }, leadingIcon = { Icon(Icons.AutoMirrored.Rounded.Reply, null) })
                val copyable = m.str("text") ?: m.str("caption")
                if (!copyable.isNullOrEmpty()) DropdownMenuItem({ Text("Copy") }, { menu = false; clip.setText(AnnotatedString(copyable)) }, leadingIcon = { Icon(Icons.Rounded.ContentCopy, null) })
                if (mine && (kind == "text" || m.str("caption") != null)) DropdownMenuItem({ Text("Edit") }, { menu = false; onEdit() }, leadingIcon = { Icon(Icons.Rounded.Edit, null) })
                if (mine || !isRoom(chat)) DropdownMenuItem(
                    { Text("Delete", color = MaterialTheme.colorScheme.error) },
                    { menu = false; chatId?.let { app.kosmo.deleteMessage(it, m.str("id")!!) } },
                    leadingIcon = { Icon(Icons.Rounded.Delete, null, tint = MaterialTheme.colorScheme.error) },
                )
            }
        }
    }
}

private fun react(app: AppState, chatId: String, m: JsonObject, key: String) {
    val me = app.kosmo.data.value.me ?: return
    val cur = m.obj("reactions") ?: JsonObject(emptyMap())
    val had = (cur[key] as? JsonArray)?.any { (it as? JsonPrimitive)?.content == me } == true
    // одна реакция от человека: прежнюю убрать
    val next = cur.mapValues { (_, v) -> JsonArray((v as? JsonArray)?.filter { (it as? JsonPrimitive)?.content != me }.orEmpty()) }.toMutableMap()
    if (!had) next[key] = JsonArray(((next[key] as? JsonArray)?.toList().orEmpty()) + JsonPrimitive(me))
    val clean = next.filterValues { (it as JsonArray).isNotEmpty() }
    app.kosmo.editMessage(chatId, if (clean.isEmpty()) m.without("reactions") else m.with("reactions" to JsonObject(clean)))
}

@Composable
private fun ServicePill(text: String) {
    Box(Modifier.fillMaxWidth().padding(vertical = 6.dp), contentAlignment = Alignment.Center) {
        Text(text, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.clip(CircleShape).background(MaterialTheme.colorScheme.surfaceContainerHigh).padding(horizontal = 12.dp, vertical = 5.dp))
    }
}

@Composable
private fun Meta(m: JsonObject, color: Color, tick: TickState?, modifier: Modifier = Modifier) {
    Row(modifier, verticalAlignment = Alignment.CenterVertically) {
        if (m.bool("edited")) Text("edited ", fontSize = 11.sp, fontStyle = FontStyle.Italic, color = color.copy(alpha = 0.7f))
        Text(timeOf(m.num("at")), fontSize = 11.sp, color = color.copy(alpha = 0.75f))
        if (tick != null) Ticks(tick, Modifier.padding(start = 3.dp), tint = color.copy(alpha = 0.85f))
    }
}

@Composable
private fun MessageBody(app: AppState, data: Data, m: JsonObject, kind: String, mine: Boolean, fg: Color, tick: TickState?) {
    val media = LocalMedia.current
    when (kind) {
        "text" -> Box(Modifier.padding(start = 12.dp, end = 12.dp, top = 8.dp, bottom = 6.dp)) {
            val text = m.str("text").orEmpty()
            Column {
                Text(if (text.startsWith("e1:")) "Message unavailable" else text, color = fg, style = MaterialTheme.typography.bodyLarge, fontStyle = if (text.startsWith("e1:")) FontStyle.Italic else null)
                Meta(m, fg, tick, Modifier.align(Alignment.End))
            }
        }
        "photo" -> {
            val w = m.num("w")?.toFloat() ?: 4f
            val h = m.num("h")?.toFloat() ?: 3f
            if (m.bool("viewOnce")) {
                Box(Modifier.width(240.dp).aspectRatio(1f).clip(RoundedCornerShape(17.dp)).background(Color(0xFF222226)), contentAlignment = Alignment.Center) {
                    Text("🔥 Photo · opens once on the site", color = Color.White, style = MaterialTheme.typography.labelLarge)
                }
            } else Box {
                AsyncImage(
                    model = m.str("media")?.let(media), contentDescription = null, contentScale = ContentScale.Crop,
                    modifier = Modifier.width(260.dp).aspectRatio((w / h).coerceIn(0.5f, 2f)).clip(RoundedCornerShape(17.dp)).background(Color(0xFF1A1A1E)),
                )
                if (m.str("caption").isNullOrEmpty()) Meta(m, Color.White, tick, Modifier.align(Alignment.BottomEnd).padding(8.dp).clip(CircleShape).background(Color.Black.copy(alpha = 0.45f)).padding(horizontal = 6.dp, vertical = 2.dp))
            }
            m.str("caption")?.takeIf { it.isNotEmpty() }?.let { cap ->
                Column(Modifier.padding(start = 9.dp, end = 9.dp, top = 6.dp, bottom = 3.dp)) {
                    Text(cap, color = fg, style = MaterialTheme.typography.bodyLarge)
                    Meta(m, fg, tick, Modifier.align(Alignment.End))
                }
            }
        }
        "video" -> Box(contentAlignment = Alignment.Center) {
            val ctx = LocalContext.current
            AsyncImage(
                model = ImageRequest.Builder(ctx).data(m.str("media")?.let(media)).decoderFactory(VideoFrameDecoder.Factory()).videoFrameMillis(500).build(),
                contentDescription = null, contentScale = ContentScale.Crop,
                modifier = Modifier.width(260.dp).aspectRatio(4f / 3f).clip(RoundedCornerShape(17.dp)).background(Color(0xFF1A1A1E)),
            )
            Box(Modifier.size(52.dp).background(Color.Black.copy(alpha = 0.5f), CircleShape), contentAlignment = Alignment.Center) { Icon(Icons.Rounded.PlayArrow, null, tint = Color.White, modifier = Modifier.size(32.dp)) }
            Text(fmtDur(m.dbl("duration")), color = Color.White, fontSize = 12.sp, modifier = Modifier.align(Alignment.TopStart).padding(8.dp).clip(CircleShape).background(Color.Black.copy(alpha = 0.45f)).padding(horizontal = 6.dp, vertical = 2.dp))
            Meta(m, Color.White, tick, Modifier.align(Alignment.BottomEnd).padding(8.dp).clip(CircleShape).background(Color.Black.copy(alpha = 0.45f)).padding(horizontal = 6.dp, vertical = 2.dp))
        }
        "voice", "audio" -> VoiceBody(m, fg, tick, media)
        "round" -> RoundBody(m, tick, media)
        "sticker" -> {
            val st = m.obj("sticker")
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Text(emojiChar(st?.str("emoji")), fontSize = 96.sp)
                st?.str("text")?.takeIf { it.isNotEmpty() }?.let { Text(it, fontWeight = FontWeight.Bold, color = Color.White, modifier = Modifier.clip(RoundedCornerShape(12.dp)).background(Color(0xFF2A2A30)).padding(horizontal = 12.dp, vertical = 4.dp)) }
                Meta(m, MaterialTheme.colorScheme.onSurfaceVariant, tick)
            }
        }
        "emoji" -> Column(horizontalAlignment = Alignment.End) {
            Text(emojiChar(m.str("emoji")), fontSize = 72.sp)
            Meta(m, MaterialTheme.colorScheme.onSurfaceVariant, tick)
        }
        "call" -> Row(Modifier.padding(horizontal = 14.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(if (m.bool("video")) Icons.Rounded.Videocam else Icons.Rounded.Call, null, tint = fg)
            Column(Modifier.padding(start = 10.dp)) {
                val status = m.str("status")
                val title = when (status) {
                    "missed" -> if (mine) "Cancelled call" else "Missed call"
                    "declined" -> "Declined call"
                    "busy" -> "Line busy"
                    else -> if (mine) "Outgoing call" else "Incoming call"
                }
                Text(title, color = fg, style = MaterialTheme.typography.titleSmall)
                Row { Text(m.num("duration")?.takeIf { it > 0 }?.let { fmtDur(it) + " · " } ?: "", color = fg.copy(alpha = 0.75f), fontSize = 12.sp); Meta(m, fg, tick) }
            }
        }
        else -> Column(Modifier.padding(horizontal = 12.dp, vertical = 8.dp)) {
            Text(data.previewText(m), color = fg, style = MaterialTheme.typography.bodyLarge)
            if (kind in setOf("poll", "todo", "code", "album", "post", "location", "invite")) Text("Open on the site to see it in full", color = fg.copy(alpha = 0.6f), fontSize = 12.sp)
            Meta(m, fg, tick, Modifier.align(Alignment.End))
        }
    }
}

@Composable
private fun VoiceBody(m: JsonObject, fg: Color, tick: TickState?, media: (String) -> String) {
    val st by Voice.state.collectAsState()
    val id = m.str("id") ?: ""
    val me = st.id == id
    val dur = m.dbl("duration") ?: st.dur.toDouble()
    val frac = if (me && st.dur > 0) st.pos / st.dur else 0f
    val wave = m.arr("wave").mapNotNull { (it as? JsonPrimitive)?.content?.toFloatOrNull() }.ifEmpty { List(36) { i -> 0.25f + 0.6f * kotlin.math.abs(kotlin.math.sin(i * 1.7f)) } }
    Row(Modifier.padding(10.dp).width(240.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(
            Modifier.size(44.dp).clip(CircleShape).background(fg.copy(alpha = 0.18f)).clickable { m.str("media")?.let { Voice.toggle(id, media(it)) } },
            contentAlignment = Alignment.Center,
        ) { Icon(if (me && st.playing) Icons.Rounded.Pause else Icons.Rounded.PlayArrow, null, tint = fg) }
        Column(Modifier.weight(1f).padding(start = 10.dp)) {
            if (m.str("kind") == "audio") Text(m.str("name") ?: "Music", color = fg, maxLines = 1, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.titleSmall)
            // волна: проигранная часть ярче; касание — перемотка
            var widthPx by remember { mutableStateOf(1) }
            Row(
                Modifier.fillMaxWidth().height(28.dp)
                    .onSizeChanged { widthPx = it.width }
                    .pointerInput(id) { detectTapGestures { o -> Voice.seek(id, o.x / widthPx) } },
                horizontalArrangement = Arrangement.spacedBy(2.dp), verticalAlignment = Alignment.CenterVertically,
            ) {
                wave.take(40).forEachIndexed { i, v ->
                    val played = me && i.toFloat() / wave.size.coerceAtMost(40) < frac
                    Box(Modifier.weight(1f).fillMaxHeight(v.coerceIn(0.12f, 1f)).clip(RoundedCornerShape(2.dp)).background(if (played) fg else fg.copy(alpha = 0.38f)))
                }
            }
            Row {
                Text(fmtDur(if (me && st.pos > 0) st.pos else dur), color = fg.copy(alpha = 0.75f), fontSize = 12.sp, modifier = Modifier.weight(1f))
                Meta(m, fg, tick)
            }
        }
    }
}

@Composable
private fun RoundBody(m: JsonObject, tick: TickState?, media: (String) -> String) {
    var playing by remember { mutableStateOf(false) }
    val ctx = LocalContext.current
    val url = m.str("media")?.let(media)
    Column(horizontalAlignment = Alignment.End) {
        Box(Modifier.size(220.dp).clip(CircleShape).background(Color(0xFF111111)).clickable { playing = !playing }, contentAlignment = Alignment.Center) {
            if (playing && url != null) AndroidView(
                factory = { c -> VideoView(c).apply { setVideoPath(url); setOnPreparedListener { start() }; setOnCompletionListener { playing = false } } },
                modifier = Modifier.fillMaxSize(),
                onRelease = { it.stopPlayback() },
            ) else {
                AsyncImage(
                    model = ImageRequest.Builder(ctx).data(url).decoderFactory(VideoFrameDecoder.Factory()).videoFrameMillis(300).build(),
                    contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize(),
                )
                Box(Modifier.size(48.dp).background(Color.Black.copy(alpha = 0.45f), CircleShape), contentAlignment = Alignment.Center) { Icon(Icons.Rounded.PlayArrow, null, tint = Color.White) }
            }
        }
        Row { Text(fmtDur(m.dbl("duration")) + "  ", fontSize = 11.sp, color = MaterialTheme.colorScheme.onSurfaceVariant); Meta(m, MaterialTheme.colorScheme.onSurfaceVariant, tick) }
    }
}

@Composable
private fun UploadBubble(u: Upload, onDismiss: () -> Unit) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
        Box(contentAlignment = Alignment.Center) {
            when (u.kind) {
                "photo" -> AsyncImage(u.file, null, contentScale = ContentScale.Crop, modifier = Modifier.width(260.dp).aspectRatio((u.w.toFloat() / u.h.coerceAtLeast(1)).coerceIn(0.5f, 2f)).clip(RoundedCornerShape(18.dp)))
                "video" -> Box(Modifier.width(260.dp).aspectRatio(4f / 3f).clip(RoundedCornerShape(18.dp)).background(Color(0xFF1A1A1E)))
                else -> Row(Modifier.width(240.dp).clip(RoundedCornerShape(20.dp)).background(MaterialTheme.colorScheme.primary).padding(10.dp), verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(44.dp))
                    Row(Modifier.weight(1f).height(28.dp).padding(start = 10.dp), horizontalArrangement = Arrangement.spacedBy(2.dp), verticalAlignment = Alignment.CenterVertically) {
                        repeat(28) { i -> Box(Modifier.weight(1f).fillMaxHeight(0.2f + 0.6f * kotlin.math.abs(kotlin.math.sin(i * 1.7f))).clip(RoundedCornerShape(2.dp)).background(MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.4f))) }
                    }
                    Text("  " + fmtDur(u.duration), color = MaterialTheme.colorScheme.onPrimary, fontSize = 12.sp)
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

