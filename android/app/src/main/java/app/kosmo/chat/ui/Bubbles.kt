package app.kosmo.chat.ui

import android.content.Intent
import android.net.Uri
import android.widget.VideoView
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.animation.core.animateFloat
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.Reply
import androidx.compose.material.icons.automirrored.rounded.Send
import androidx.compose.material.icons.rounded.Call
import androidx.compose.material.icons.rounded.CheckBox
import androidx.compose.material.icons.rounded.CheckBoxOutlineBlank
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.ContentCopy
import androidx.compose.material.icons.rounded.Delete
import androidx.compose.material.icons.rounded.Edit
import androidx.compose.material.icons.rounded.LocalFireDepartment
import androidx.compose.material.icons.rounded.MusicNote
import androidx.compose.material.icons.rounded.Pause
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.rounded.Place
import androidx.compose.material.icons.rounded.PushPin
import androidx.compose.material.icons.rounded.RadioButtonUnchecked
import androidx.compose.material.icons.rounded.Videocam
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import app.kosmo.chat.core.Data
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
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlin.math.PI
import kotlin.math.atan
import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.ln
import kotlin.math.tan

/** Пузыри сообщений всех видов — как на сайте (web/js/chats.js renderMessage). */

@Composable
fun DayPill(label: String) {
    val look = LocalLook.current
    Box(Modifier.fillMaxWidth().padding(vertical = 8.dp), contentAlignment = Alignment.Center) {
        Text(tr(label), fontSize = 12.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.clip(CircleShape).background(if (look.glass) look.ink.copy(alpha = 0.12f) else MaterialTheme.colorScheme.surfaceContainerHigh).padding(horizontal = 10.dp, vertical = 4.dp))
    }
}

@Composable
fun ServicePill(text: String) {
    val look = LocalLook.current
    Box(Modifier.fillMaxWidth().padding(vertical = 6.dp), contentAlignment = Alignment.Center) {
        Text(tr(text), fontSize = 13.sp, color = look.text2, modifier = Modifier.clip(CircleShape).background(look.ink.copy(alpha = 0.1f)).padding(horizontal = 12.dp, vertical = 5.dp))
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun MessageRow(
    app: AppState, data: Data, chat: JsonObject?, m: JsonObject, mine: Boolean, showName: Boolean, highlight: Boolean,
    byId: (String) -> JsonObject?, onReply: () -> Unit, onEdit: () -> Unit,
) {
    val look = LocalLook.current
    val kind = m.str("kind") ?: "text"
    if (kind == "join") { ServicePill(data.previewText(m)); return }
    if (m.bool("viewOnce") && (m.bool("viewed") || m.strings("viewedBy").isNotEmpty() || m.str("media") == null)) { ServicePill(if (mine) "Photo viewed" else "You viewed the photo"); return }
    val chatId = chat?.str("id") ?: ""
    var menu by remember { mutableStateOf(false) }
    val clip = LocalClipboardManager.current
    val me = data.me
    val bare = kind in setOf("sticker", "emoji", "round")
    val channel = isChannel(chat)
    val tick = if (mine && !channel) when {
        m.str("id") in data.pending -> TickState.Pending
        chat != null && chat.strings("members").any { it != me && (chat.obj("read")?.num(it) ?: 0) >= (m.num("at") ?: 0) } -> TickState.Read
        else -> TickState.Sent
    } else null
    val groupChat = isRoom(chat) && !channel
    Row(
        Modifier.fillMaxWidth().background(if (highlight) look.accent.copy(alpha = 0.18f) else Color.Transparent),
        horizontalArrangement = if (mine && !channel) Arrangement.End else Arrangement.Start, verticalAlignment = Alignment.Bottom,
    ) {
        if (groupChat && !mine) {
            Box(Modifier.size(34.dp)) { if (showName) UserAvatar(data.accounts[m.str("from")], 34.dp, Modifier.clickable { m.str("from")?.let { app.push(Screen.User(it)) } }) }
            Spacer(Modifier.width(6.dp))
        }
        Box {
            val shape = RoundedCornerShape(18.dp)
            val bg = if (mine && !channel) look.accent else look.theirs
            val fg = if (mine && !channel) look.onAccent else look.text
            Column(
                Modifier.widthIn(max = if (channel) 360.dp else 300.dp)
                    .then(if (bare) Modifier else Modifier.clip(shape).background(bg))
                    .combinedClickable(onClick = {
                        when (kind) {
                            "photo" -> m.str("media")?.let {
                                if (m.bool("viewOnce") && !mine) app.kosmo.editMessage(chatId, m.with("viewedBy" to (m.strings("viewedBy") + (me ?: ""))))
                                app.push(Screen.Photo(it))
                            }
                            "video" -> m.str("media")?.let { app.push(Screen.Video(it)) }
                            "post" -> m.str("post")?.let { app.push(Screen.Post(it)) }
                        }
                    }, onLongClick = { menu = true })
                    .padding(if (kind == "photo" || kind == "video" || kind == "album") 3.dp else 0.dp),
            ) {
                if (showName && groupChat && !mine) Text(data.accounts[m.str("from")]?.str("name") ?: "", color = look.accent, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(start = 12.dp, end = 12.dp, top = 8.dp))
                if (channel && chat != null) Text(chat.str("name") ?: "", color = look.accent, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(start = 12.dp, end = 12.dp, top = 8.dp))
                m.obj("fwd")?.let { f -> Text(tr("Forwarded from") + " " + (f.str("name") ?: ""), color = if (mine) fg.copy(alpha = 0.85f) else look.accent, fontSize = 13.sp, fontStyle = FontStyle.Italic, modifier = Modifier.padding(start = 12.dp, end = 12.dp, top = 8.dp)) }
                m.str("replyTo")?.let { rid ->
                    val r = byId(rid)
                    Row(Modifier.padding(start = 8.dp, end = 8.dp, top = 8.dp).clip(RoundedCornerShape(10.dp)).background(fg.copy(alpha = 0.12f))) {
                        Box(Modifier.width(3.dp).height(40.dp).background(if (mine) fg else look.accent))
                        Column(Modifier.padding(horizontal = 8.dp, vertical = 5.dp)) {
                            Text(data.accounts[r?.str("from")]?.str("name") ?: tr("Message"), color = if (mine) fg else look.accent, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                            Text(r?.let { tr(data.previewText(it)) } ?: tr("Deleted message"), color = fg.copy(alpha = 0.8f), maxLines = 1, overflow = TextOverflow.Ellipsis, fontSize = 13.sp)
                        }
                    }
                }
                MessageBody(app, data, chatId, m, kind, mine, fg, tick, views = if (channel) m.strings("views").size else -1)
                val reactions = m.obj("reactions")?.entries?.filter { (it.value as? JsonArray)?.isNotEmpty() == true }.orEmpty()
                if (reactions.isNotEmpty()) Row(Modifier.padding(horizontal = 8.dp).padding(bottom = 8.dp, top = if (bare) 4.dp else 0.dp), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    reactions.forEach { (key, who) ->
                        val ids = (who as JsonArray).mapNotNull { (it as? JsonPrimitive)?.content }
                        val picked = me in ids
                        val chipFg = if (bare) look.text else fg
                        Text(
                            "${emojiChar(key)} ${ids.size}", fontSize = 13.sp, color = chipFg,
                            modifier = Modifier.clip(CircleShape).background(if (picked) chipFg.copy(alpha = 0.3f) else chipFg.copy(alpha = 0.12f))
                                .clickable { react(app, chatId, m, key) }.padding(horizontal = 8.dp, vertical = 3.dp),
                        )
                    }
                }
            }
            KosmoMenu(
                menu, { menu = false },
                listOfNotNull(
                    MenuItem(Icons.AutoMirrored.Rounded.Reply, "Reply") { onReply() },
                    (m.str("text") ?: m.str("caption"))?.takeIf { it.isNotEmpty() }?.let { t -> MenuItem(Icons.Rounded.ContentCopy, "Copy") { clip.setText(AnnotatedString(t)); app.toast = "Copied" } },
                    if (kind !in setOf("poll", "invite", "call") && chat?.bool("secret") != true) MenuItem(Icons.AutoMirrored.Rounded.Send, "Forward") { app.push(Screen.Forward(chatId = chatId, msgId = m.str("id"))) } else null,
                    if (canPin(chat, me)) MenuItem(Icons.Rounded.PushPin, if (chat?.str("pinned") == m.str("id")) "Unpin" else "Pin") {
                        if (chat?.str("pinned") == m.str("id")) app.kosmo.commit(jobj("col" to "chats", "id" to chatId, "op" to "put", "unset" to listOf("pinned")))
                        else app.kosmo.commit(jobj("col" to "chats", "id" to chatId, "op" to "put", "set" to jobj("pinned" to m.str("id"))))
                    } else null,
                    if (mine && (kind == "text" || m.str("caption") != null || kind == "photo")) MenuItem(Icons.Rounded.Edit, "Edit") { onEdit() } else null,
                    if (mine || !isRoom(chat) || chat?.str("owner") == me || me in (chat?.strings("admins") ?: emptyList())) MenuItem(Icons.Rounded.Delete, "Delete", danger = true) { app.kosmo.deleteMessage(chatId, m.str("id")!!) } else null,
                ),
                header = {
                    LazyRow(Modifier.padding(horizontal = 8.dp).width(260.dp)) {
                        items(REACTIONS) { r -> Text(EMOJI[r]!!, fontSize = 26.sp, modifier = Modifier.clip(CircleShape).clickable { menu = false; react(app, chatId, m, r) }.padding(6.dp)) }
                    }
                    HorizontalDivider(Modifier.padding(vertical = 4.dp), color = look.ink.copy(alpha = 0.1f))
                },
            )
        }
    }
}

private fun canPin(c: JsonObject?, me: String?) = c != null && (!isRoom(c) || c.str("owner") == me || me in c.strings("admins"))

fun react(app: AppState, chatId: String, m: JsonObject, key: String) {
    val me = app.kosmo.data.value.me ?: return
    val cur = m.obj("reactions") ?: JsonObject(emptyMap())
    val had = (cur[key] as? JsonArray)?.any { (it as? JsonPrimitive)?.content == me } == true
    val next = cur.mapValues { (_, v) -> JsonArray((v as? JsonArray)?.filter { (it as? JsonPrimitive)?.content != me }.orEmpty()) }.toMutableMap()
    if (!had) next[key] = JsonArray(((next[key] as? JsonArray)?.toList().orEmpty()) + JsonPrimitive(me))
    val clean = next.filterValues { (it as JsonArray).isNotEmpty() }
    app.kosmo.editMessage(chatId, if (clean.isEmpty()) m.without("reactions") else m.with("reactions" to JsonObject(clean)))
}

@Composable
fun Meta(m: JsonObject, color: Color, tick: TickState?, modifier: Modifier = Modifier, views: Int = -1) {
    Row(modifier, verticalAlignment = Alignment.CenterVertically) {
        if (m.bool("edited")) Text(tr("edited") + " ", fontSize = 11.sp, fontStyle = FontStyle.Italic, color = color.copy(alpha = 0.7f))
        if (views >= 0) Text("👁 $views  ", fontSize = 11.sp, color = color.copy(alpha = 0.7f))
        Text(timeOf(m.num("at")), fontSize = 11.sp, color = color.copy(alpha = 0.75f))
        if (tick != null) Ticks(tick, Modifier.padding(start = 3.dp), tint = color.copy(alpha = 0.9f))
    }
}

@Composable
private fun MessageBody(app: AppState, data: Data, chatId: String, m: JsonObject, kind: String, mine: Boolean, fg: Color, tick: TickState?, views: Int) {
    val media = LocalMedia.current
    val look = LocalLook.current
    val ctx = LocalContext.current
    @Composable fun textBlock(text: String) = Column(Modifier.padding(start = 12.dp, end = 12.dp, top = 8.dp, bottom = 6.dp)) {
        val sealed = text.startsWith("e1:")
        Text(if (sealed) tr("Message unavailable") else text, color = fg, fontSize = 16.sp, lineHeight = 21.sp, fontStyle = if (sealed) FontStyle.Italic else null)
        Meta(m, fg, tick, Modifier.align(Alignment.End), views)
    }
    when (kind) {
        "text" -> textBlock(m.str("text").orEmpty())
        "photo" -> {
            val w = m.num("w")?.toFloat() ?: 4f
            val h = m.num("h")?.toFloat() ?: 3f
            Box {
                AsyncImage(
                    model = m.str("media")?.let(media), contentDescription = null, contentScale = ContentScale.Crop,
                    modifier = Modifier.width(260.dp).aspectRatio((w / h).coerceIn(0.5f, 2f)).clip(RoundedCornerShape(15.dp)).background(Color(0xFF1A1A1E))
                        .then(if (m.bool("viewOnce")) Modifier.blur(28.dp) else Modifier),
                )
                if (m.bool("viewOnce")) Box(Modifier.align(Alignment.Center).size(56.dp).clip(CircleShape).background(Color.Black.copy(alpha = 0.45f)), contentAlignment = Alignment.Center) {
                    Icon(Icons.Rounded.LocalFireDepartment, null, tint = Color.White)
                }
                if (m.str("caption").isNullOrEmpty()) Meta(m, Color.White, tick, Modifier.align(Alignment.BottomEnd).padding(8.dp).clip(CircleShape).background(Color.Black.copy(alpha = 0.45f)).padding(horizontal = 6.dp, vertical = 2.dp), views)
            }
            m.str("caption")?.takeIf { it.isNotEmpty() }?.let { textBlock(it) }
        }
        "video" -> {
            Box(contentAlignment = Alignment.Center) {
                AsyncImage(
                    model = ImageRequest.Builder(ctx).data(m.str("media")?.let(media)).decoderFactory(VideoFrameDecoder.Factory()).videoFrameMillis(500).build(),
                    contentDescription = null, contentScale = ContentScale.Crop,
                    modifier = Modifier.width(260.dp).aspectRatio(4f / 3f).clip(RoundedCornerShape(15.dp)).background(Color(0xFF1A1A1E)),
                )
                Box(Modifier.size(52.dp).background(Color.Black.copy(alpha = 0.5f), CircleShape), contentAlignment = Alignment.Center) { Icon(Icons.Rounded.PlayArrow, null, tint = Color.White, modifier = Modifier.size(32.dp)) }
                Text(fmtDur(m.dbl("duration")), color = Color.White, fontSize = 12.sp, modifier = Modifier.align(Alignment.TopStart).padding(8.dp).clip(CircleShape).background(Color.Black.copy(alpha = 0.45f)).padding(horizontal = 6.dp, vertical = 2.dp))
                if (m.str("caption").isNullOrEmpty()) Meta(m, Color.White, tick, Modifier.align(Alignment.BottomEnd).padding(8.dp).clip(CircleShape).background(Color.Black.copy(alpha = 0.45f)).padding(horizontal = 6.dp, vertical = 2.dp), views)
            }
            m.str("caption")?.takeIf { it.isNotEmpty() }?.let { textBlock(it) }
        }
        "album" -> {
            val items = m.arr("items").objects()
            Column(Modifier.width(260.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                items.take(6).chunked(if (items.size == 1) 1 else 2).forEach { row ->
                    Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                        row.forEach { it2 ->
                            val id = it2.str("media") ?: ""
                            Box(Modifier.weight(1f).aspectRatio(1f).clip(RoundedCornerShape(10.dp)).background(Color(0xFF1A1A1E)).clickable { if (it2.str("type") == "video") app.push(Screen.Video(id)) else app.push(Screen.Photo(id)) }, contentAlignment = Alignment.Center) {
                                AsyncImage(ImageRequest.Builder(ctx).data(media(id)).apply { if (it2.str("type") == "video") decoderFactory(VideoFrameDecoder.Factory()) }.build(), null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
                                if (it2.str("type") == "video") Icon(Icons.Rounded.PlayArrow, null, tint = Color.White)
                            }
                        }
                    }
                }
            }
            m.str("caption")?.takeIf { it.isNotEmpty() }?.let { textBlock(it) } ?: Meta(m, fg, tick, Modifier.padding(6.dp), views)
        }
        "voice", "audio" -> VoiceBody(m, fg, tick, media)
        "round" -> RoundBody(m, tick, media)
        "sticker" -> Sticker(m, tick)
        "emoji" -> Column(horizontalAlignment = Alignment.End) {
            Text(emojiChar(m.str("emoji")), fontSize = 72.sp)
            Meta(m, look.text2, tick)
        }
        "code" -> Column(Modifier.padding(8.dp).widthIn(min = 220.dp)) {
            val clip = LocalClipboardManager.current
            Column(Modifier.clip(RoundedCornerShape(12.dp)).background(Color(0xFF0D0D10))) {
                Row(Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(m.str("lang") ?: "code", color = Color(0xFF9CDCFE), fontSize = 12.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                    Icon(Icons.Rounded.ContentCopy, tr("Copy"), tint = Color.White.copy(alpha = 0.7f), modifier = Modifier.size(16.dp).clickable { clip.setText(AnnotatedString(m.str("text") ?: "")); app.toast = "Code copied" })
                }
                Text(m.str("text") ?: "", color = Color(0xFFE6E6E6), fontFamily = FontFamily.Monospace, fontSize = 13.sp, lineHeight = 18.sp, modifier = Modifier.padding(start = 10.dp, end = 10.dp, bottom = 10.dp))
            }
            m.str("caption")?.takeIf { it.isNotEmpty() }?.let { Text(it, color = fg, modifier = Modifier.padding(top = 6.dp, start = 4.dp)) }
            Meta(m, fg, tick, Modifier.align(Alignment.End).padding(top = 4.dp), views)
        }
        "poll" -> PollBody(app, data, chatId, m, fg, tick)
        "todo" -> TodoBody(app, data, chatId, m, fg, tick)
        "location" -> {
            val l = m.obj("location") ?: JsonObject(emptyMap())
            val lat = l.dbl("lat") ?: 0.0
            val lon = l.dbl("lon") ?: 0.0
            val z = 15
            val n = 1 shl z
            val xt = floor((lon + 180) / 360 * n).toInt()
            val yt = floor((1 - ln(tan(lat * PI / 180) + 1 / cos(lat * PI / 180)) / PI) / 2 * n).toInt()
            Column(Modifier.width(240.dp).padding(3.dp)) {
                Box(Modifier.fillMaxWidth().height(150.dp).clip(RoundedCornerShape(15.dp)).background(Color(0xFF2A2D33)).clickable {
                    ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("geo:$lat,$lon?q=$lat,$lon")))
                }, contentAlignment = Alignment.Center) {
                    AsyncImage("https://tile.openstreetmap.org/$z/$xt/$yt.png", null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
                    Icon(Icons.Rounded.Place, null, tint = Color(0xFFFF453A), modifier = Modifier.size(36.dp).offset(y = (-14).dp))
                }
                Row(Modifier.padding(horizontal = 9.dp, vertical = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(tr(if (l.bool("live")) "Live location" else "Location"), color = fg, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                    Meta(m, fg, tick)
                }
            }
        }
        "post" -> {
            val p = data.feed.firstOrNull { it.str("id") == m.str("post") }
            val author = data.accounts[p?.str("author")]
            Column(Modifier.padding(10.dp).width(250.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    UserAvatar(author, 28.dp)
                    Text(author?.str("name") ?: tr("Post"), color = fg, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(start = 8.dp))
                }
                p?.arr("media")?.objects()?.firstOrNull()?.str("media")?.let { AsyncImage(media(it), null, contentScale = ContentScale.Crop, modifier = Modifier.padding(top = 8.dp).fillMaxWidth().aspectRatio(4f / 3f).clip(RoundedCornerShape(12.dp))) }
                Text(p?.str("text") ?: tr("Post deleted"), color = fg, maxLines = 4, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 6.dp))
                Meta(m, fg, tick, Modifier.align(Alignment.End))
            }
        }
        "call" -> Row(Modifier.padding(horizontal = 14.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(if (m.bool("video")) Icons.Rounded.Videocam else Icons.Rounded.Call, null, tint = fg)
            Column(Modifier.padding(start = 10.dp)) {
                val title = when (m.str("status")) {
                    "missed" -> if (mine) "Cancelled call" else "Missed call"
                    "declined" -> "Declined call"
                    "busy" -> "Line busy"
                    else -> if (mine) "Outgoing call" else "Incoming call"
                }
                Text(tr(title), color = fg, fontWeight = FontWeight.SemiBold)
                Row { Text(m.num("duration")?.takeIf { it > 0 }?.let { fmtDur(it) + " · " } ?: "", color = fg.copy(alpha = 0.75f), fontSize = 12.sp); Meta(m, fg, tick) }
            }
        }
        else -> Column(Modifier.padding(horizontal = 12.dp, vertical = 8.dp)) {
            Text(tr(data.previewText(m)), color = fg, fontSize = 16.sp)
            Meta(m, fg, tick, Modifier.align(Alignment.End), views)
        }
    }
}

@Composable
private fun Sticker(m: JsonObject, tick: TickState?) {
    val st = m.obj("sticker")
    val look = LocalLook.current
    val t = androidx.compose.animation.core.rememberInfiniteTransition(label = "st")
    val a by t.animateFloat(-6f, 6f, androidx.compose.animation.core.infiniteRepeatable(androidx.compose.animation.core.tween(900), androidx.compose.animation.core.RepeatMode.Reverse), label = "a")
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(emojiChar(st?.str("emoji")), fontSize = 96.sp, modifier = Modifier.offset(y = (a / 2).dp))
        st?.str("text")?.takeIf { it.isNotEmpty() }?.let { Text(it, fontWeight = FontWeight.Bold, color = Color.White, modifier = Modifier.clip(RoundedCornerShape(12.dp)).background(Color(0xFF2A2A30)).padding(horizontal = 12.dp, vertical = 4.dp)) }
        Meta(m, look.text2, tick)
    }
}

/** Опрос: голос один раз, затем проценты; викторина подсвечивает верный ответ. */
@Composable
private fun PollBody(app: AppState, data: Data, chatId: String, m: JsonObject, fg: Color, tick: TickState?) {
    val p = m.obj("poll") ?: return
    val me = data.me ?: return
    val votes = p.obj("votes") ?: JsonObject(emptyMap())
    val total = votes.values.flatMap { (it as? JsonArray)?.map { x -> (x as JsonPrimitive).content }.orEmpty() }.toSet().size
    val mineVotes = votes.filter { (it.value as? JsonArray)?.any { x -> (x as JsonPrimitive).content == me } == true }.keys
    val show = mineVotes.isNotEmpty() || p.bool("closed")
    val quiz = p.bool("quiz")
    Column(Modifier.padding(12.dp).widthIn(min = 240.dp)) {
        Text(p.str("question") ?: "", color = fg, fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
        Text(tr(if (quiz) "Quiz" else if (p.bool("anonymous")) "Anonymous poll" else "Public poll"), color = fg.copy(alpha = 0.7f), fontSize = 12.sp, modifier = Modifier.padding(bottom = 8.dp))
        p.arr("options").objects().forEach { o ->
            val id = o.str("id") ?: ""
            val n = (votes[id] as? JsonArray)?.size ?: 0
            val pct = if (total > 0) n * 100 / total else 0
            val right = quiz && show && id == p.str("correct")
            Column(Modifier.fillMaxWidth().padding(vertical = 4.dp).clip(RoundedCornerShape(10.dp)).clickable(enabled = !show) {
                val next = votes.toMutableMap()
                next[id] = JsonArray(((votes[id] as? JsonArray)?.toList().orEmpty()) + JsonPrimitive(me))
                app.kosmo.editMessage(chatId, m.with("poll" to p.with("votes" to JsonObject(next))))
            }.padding(vertical = 4.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(if (id in mineVotes || right) Icons.Rounded.CheckCircle else Icons.Rounded.RadioButtonUnchecked, null, tint = if (right) Color(0xFF30D158) else fg, modifier = Modifier.size(18.dp))
                    Text(o.str("text") ?: "", color = fg, modifier = Modifier.weight(1f).padding(start = 8.dp))
                    if (show) Text("$pct%", color = fg, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                }
                if (show) LinearProgressIndicator(progress = { pct / 100f }, color = if (right) Color(0xFF30D158) else fg, trackColor = fg.copy(alpha = 0.15f), modifier = Modifier.fillMaxWidth().padding(start = 26.dp, top = 4.dp).height(4.dp).clip(CircleShape))
            }
        }
        if (show && quiz && !p.str("explanation").isNullOrEmpty()) Text(tr("💡 ") + p.str("explanation"), color = fg.copy(alpha = 0.85f), fontSize = 13.sp, modifier = Modifier.padding(top = 6.dp))
        Row(Modifier.padding(top = 6.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(if (total > 0) tr("$total ${if (total == 1) "vote" else "votes"}") else tr("No votes yet"), color = fg.copy(alpha = 0.7f), fontSize = 12.sp, modifier = Modifier.weight(1f))
            Meta(m, fg, tick)
        }
    }
}

/** Список дел: отмечают все участники, можно добавлять пункты. */
@Composable
private fun TodoBody(app: AppState, data: Data, chatId: String, m: JsonObject, fg: Color, tick: TickState?) {
    val t = m.obj("todo") ?: return
    val me = data.me ?: return
    val items = t.arr("items").objects()
    Column(Modifier.padding(12.dp).widthIn(min = 240.dp)) {
        Text(t.str("title")?.takeIf { it.isNotEmpty() } ?: tr("Checklist"), color = fg, fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
        Text("${items.count { it.strings("done").isNotEmpty() }} ${tr("of")} ${items.size}", color = fg.copy(alpha = 0.7f), fontSize = 12.sp, modifier = Modifier.padding(bottom = 6.dp))
        items.forEach { it2 ->
            val done = it2.strings("done")
            val on = done.isNotEmpty()
            Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(8.dp)).clickable {
                val nextItems = items.map { x -> if (x.str("id") == it2.str("id")) x.with("done" to (if (me in done) done - me else done + me)) else x }
                app.kosmo.editMessage(chatId, m.with("todo" to t.with("items" to JsonArray(nextItems))))
            }.padding(vertical = 5.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(if (on) Icons.Rounded.CheckBox else Icons.Rounded.CheckBoxOutlineBlank, null, tint = fg, modifier = Modifier.size(20.dp))
                Text(it2.str("text") ?: "", color = fg.copy(alpha = if (on) 0.6f else 1f), modifier = Modifier.padding(start = 8.dp), style = if (on) androidx.compose.ui.text.TextStyle(textDecoration = androidx.compose.ui.text.style.TextDecoration.LineThrough) else androidx.compose.ui.text.TextStyle.Default)
            }
        }
        Meta(m, fg, tick, Modifier.align(Alignment.End))
    }
}

@Composable
fun VoiceBody(m: JsonObject, fg: Color, tick: TickState?, media: (String) -> String) {
    val st by Voice.state.collectAsState()
    val id = m.str("id") ?: ""
    val me = st.id == id
    val dur = m.dbl("duration") ?: st.dur.toDouble()
    val frac = if (me && st.dur > 0) st.pos / st.dur else 0f
    val music = m.str("kind") == "audio"
    val wave = m.arr("wave").mapNotNull { (it as? JsonPrimitive)?.content?.toFloatOrNull() }.ifEmpty { List(36) { i -> 0.25f + 0.6f * kotlin.math.abs(kotlin.math.sin(i * 1.7f)) } }
    Row(Modifier.padding(10.dp).width(250.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(
            Modifier.size(44.dp).clip(CircleShape).background(fg.copy(alpha = 0.18f)).clickable { m.str("media")?.let { Voice.toggle(id, media(it)) } },
            contentAlignment = Alignment.Center,
        ) { Icon(if (me && st.playing) Icons.Rounded.Pause else if (music && !me) Icons.Rounded.MusicNote else Icons.Rounded.PlayArrow, null, tint = fg) }
        Column(Modifier.weight(1f).padding(start = 10.dp)) {
            if (music) Text(m.str("name") ?: tr("Music"), color = fg, maxLines = 1, overflow = TextOverflow.Ellipsis, fontWeight = FontWeight.SemiBold)
            var widthPx by remember { mutableStateOf(1) }
            if (music) LinearProgressIndicator(progress = { frac }, color = fg, trackColor = fg.copy(alpha = 0.2f), modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp).height(3.dp).onSizeChanged { widthPx = it.width }.pointerInput(id) { detectTapGestures { o -> Voice.seek(id, o.x / widthPx) } })
            else Row(
                Modifier.fillMaxWidth().height(28.dp).onSizeChanged { widthPx = it.width }.pointerInput(id) { detectTapGestures { o -> Voice.seek(id, o.x / widthPx) } },
                horizontalArrangement = Arrangement.spacedBy(2.dp), verticalAlignment = Alignment.CenterVertically,
            ) {
                val bars = wave.take(40)
                bars.forEachIndexed { i, v ->
                    val played = me && i.toFloat() / bars.size < frac
                    Box(Modifier.weight(1f).fillMaxHeight(v.coerceIn(0.12f, 1f)).clip(RoundedCornerShape(2.dp)).background(if (played) fg else fg.copy(alpha = 0.38f)))
                }
            }
            Row {
                Text(fmtDur(if (me && st.pos > 0) st.pos else dur), color = fg.copy(alpha = 0.75f), fontSize = 12.sp, modifier = Modifier.weight(1f))
                Meta(m, fg, tick)
            }
            m.str("transcript")?.takeIf { it.isNotEmpty() }?.let { Text(it, color = fg.copy(alpha = 0.85f), fontSize = 13.sp, fontStyle = FontStyle.Italic, modifier = Modifier.padding(top = 4.dp)) }
        }
    }
}

@Composable
fun RoundBody(m: JsonObject, tick: TickState?, media: (String) -> String) {
    var playing by remember { mutableStateOf(false) }
    val ctx = LocalContext.current
    val look = LocalLook.current
    val url = m.str("media")?.let(media)
    Column(horizontalAlignment = Alignment.End) {
        Box(Modifier.size(220.dp).clip(CircleShape).background(Color(0xFF111111)).clickable { playing = !playing }, contentAlignment = Alignment.Center) {
            if (playing && url != null) AndroidView(
                factory = { c -> VideoView(c).apply { setVideoPath(url); setOnPreparedListener { start() }; setOnCompletionListener { playing = false } } },
                modifier = Modifier.fillMaxSize(), onRelease = { it.stopPlayback() },
            ) else {
                AsyncImage(ImageRequest.Builder(ctx).data(url).decoderFactory(VideoFrameDecoder.Factory()).videoFrameMillis(300).build(), null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
                Box(Modifier.size(48.dp).background(Color.Black.copy(alpha = 0.45f), CircleShape), contentAlignment = Alignment.Center) { Icon(Icons.Rounded.PlayArrow, null, tint = Color.White) }
            }
        }
        Row(Modifier.padding(top = 4.dp)) { Text(fmtDur(m.dbl("duration")) + "  ", fontSize = 11.sp, color = look.text2); Meta(m, look.text2, tick) }
    }
}
