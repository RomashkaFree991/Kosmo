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
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.heightIn
import androidx.compose.ui.draw.alpha
import androidx.compose.foundation.border
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

/** Дата между сообщениями (.day-chip на сайте). */
@Composable
fun DayPill(label: String) {
    val look = LocalLook.current
    Box(Modifier.fillMaxWidth().padding(top = 6.dp, bottom = 2.dp), contentAlignment = Alignment.Center) {
        Text(tr(label), fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = look.text2, modifier = Modifier.clip(CircleShape).background(if (look.glass) look.ink.copy(alpha = 0.08f) else MaterialTheme.colorScheme.surfaceContainerHigh).padding(horizontal = 12.dp, vertical = 4.dp))
    }
}

/** Служебная строка по центру (.service-note). */
@Composable
fun ServicePill(text: String) {
    Box(Modifier.fillMaxWidth().padding(vertical = 6.dp), contentAlignment = Alignment.Center) {
        Text(tr(text), fontSize = 13.sp, fontWeight = FontWeight.Medium, color = Color.White, modifier = Modifier.clip(CircleShape).background(Color(0xD12C2C30)).padding(horizontal = 12.dp, vertical = 5.dp))
    }
}

/** Цвета пузыря: свой — акцент/белый текст, чужой — #26262a (Material: primary / surface-container-high). */
@Composable
private fun bubbleColors(mine: Boolean): Pair<Color, Color> {
    val look = LocalLook.current
    val cs = MaterialTheme.colorScheme
    return if (mine) (if (look.glass) look.accent to Color.White else cs.primary to cs.onPrimary)
    else (if (look.glass) look.theirs to look.text else cs.surfaceContainerHigh to cs.onSurface)
}

@OptIn(ExperimentalFoundationApi::class, androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
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
    val channel = isChannel(chat)
    val side = mine && !channel
    val bare = kind in setOf("sticker", "emoji", "round")
    val tick = if (side) when {
        m.str("id") in data.pending -> TickState.Pending
        chat != null && chat.strings("members").any { it != me && (chat.obj("read")?.num(it) ?: 0) >= (m.num("at") ?: 0) } -> TickState.Read
        else -> TickState.Sent
    } else null
    val groupChat = isRoom(chat) && !channel
    val (bg, fg) = bubbleColors(side)
    val pad = when (kind) { "photo", "video", "album" -> PaddingValues(4.dp); "code" -> PaddingValues(6.dp); "sticker", "emoji", "round" -> PaddingValues(0.dp); else -> PaddingValues(horizontal = 12.dp, vertical = 8.dp) }
    val views = if (channel) chat!!.obj("read")?.values?.count { (it as? JsonPrimitive)?.content?.toLongOrNull() ?: 0 >= (m.num("at") ?: 0) } ?: 0 else -1
    val reactions = m.obj("reactions")?.entries?.filter { (it.value as? JsonArray)?.isNotEmpty() == true }.orEmpty()
    androidx.compose.foundation.layout.BoxWithConstraints(Modifier.fillMaxWidth().background(if (highlight) look.accent.copy(alpha = 0.16f) else Color.Transparent)) {
        val maxW = minOf(maxWidth * 0.78f, 460.dp)
        Row(Modifier.fillMaxWidth(), horizontalArrangement = if (side) Arrangement.End else Arrangement.Start, verticalAlignment = Alignment.Bottom) {
            if (groupChat && !mine) {
                Box(Modifier.size(30.dp)) { if (showName) UserAvatar(data.accounts[m.str("from")], 30.dp, Modifier.clickable { m.str("from")?.let { app.push(Screen.User(it)) } }) }
                Spacer(Modifier.width(6.dp))
            }
            Box {
                val shape = RoundedCornerShape(topStart = 20.dp, topEnd = 20.dp, bottomEnd = if (side) 6.dp else 20.dp, bottomStart = if (side) 20.dp else 6.dp)
                Column(
                    Modifier.widthIn(max = maxW)
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
                        .padding(pad),
                ) {
                    androidx.compose.runtime.CompositionLocalProvider(androidx.compose.material3.LocalContentColor provides fg) {
                        if (channel && chat != null) Row(Modifier.padding(bottom = 3.dp), verticalAlignment = Alignment.CenterVertically) {
                            ChatAvatar(data, chat, 20.dp); Text(chat.str("name") ?: "", color = look.accent, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(start = 6.dp))
                        }
                        if (showName && groupChat && !mine) Text(data.accounts[m.str("from")]?.str("name") ?: "", color = look.accent, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(bottom = 3.dp))
                        m.obj("fwd")?.let { f ->
                            Row(Modifier.padding(bottom = 4.dp).alpha(0.85f), verticalAlignment = Alignment.CenterVertically) {
                                Icon(WI.forward, null, Modifier.size(14.dp), tint = fg)
                                Text(" " + tr("Forwarded from") + " ", fontSize = 13.sp, color = fg)
                                Text(data.accounts[f.str("from")]?.str("name") ?: f.str("name") ?: tr("Hidden user"), fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = fg)
                            }
                        }
                        m.str("replyTo")?.let { rid -> ReplyQuote(data, byId(rid), fg) }
                        MessageBody(app, data, chatId, m, kind, side, fg, tick, views, reactions.isEmpty())
                        if (reactions.isNotEmpty()) Row(Modifier.padding(top = 4.dp), verticalAlignment = Alignment.Bottom) {
                            androidx.compose.foundation.layout.FlowRow(Modifier.weight(1f, fill = false), horizontalArrangement = Arrangement.spacedBy(5.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                                reactions.forEach { (key, who) ->
                                    val ids = (who as JsonArray).mapNotNull { (it as? JsonPrimitive)?.content }
                                    val picked = me in ids
                                    val chipFg = if (bare) look.text else fg
                                    Row(
                                        Modifier.height(30.dp).clip(CircleShape).background(chipFg.copy(alpha = if (picked) 0.24f else 0.1f))
                                            .border(1.dp, chipFg.copy(alpha = 0.06f), CircleShape).clickable { react(app, chatId, m, key) }.padding(start = 5.dp, end = 10.dp),
                                        verticalAlignment = Alignment.CenterVertically,
                                    ) { Text(emojiChar(key), fontSize = 18.sp); Text(" ${ids.size}", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = chipFg) }
                                }
                            }
                            Meta(m, if (bare) look.text2 else fg, tick, Modifier.padding(start = 8.dp), views)
                        }
                    }
                }
                KosmoMenu(
                    menu, { menu = false },
                    listOfNotNull(
                        MenuItem(WI.reply, "Reply") { onReply() },
                        (m.str("text") ?: m.str("caption"))?.takeIf { it.isNotEmpty() }?.let { t -> MenuItem(WI.copy, "Copy") { clip.setText(AnnotatedString(t)); app.toast = "Copied" } },
                        if (kind !in setOf("poll", "invite", "call") && chat?.bool("secret") != true) MenuItem(WI.forward, "Forward") { app.push(Screen.Forward(chatId = chatId, msgId = m.str("id"))) } else null,
                        if (canPin(chat, me)) MenuItem(WI.pin, if (chat?.str("pinned") == m.str("id")) "Unpin" else "Pin") {
                            if (chat?.str("pinned") == m.str("id")) app.kosmo.commit(jobj("col" to "chats", "id" to chatId, "op" to "put", "unset" to listOf("pinned")))
                            else app.kosmo.commit(jobj("col" to "chats", "id" to chatId, "op" to "put", "set" to jobj("pinned" to m.str("id"))))
                        } else null,
                        if (chat?.bool("secret") != true) MenuItem(WI.star, if (bookmarksOf(data.user).any { it.str("chatId") == chatId && it.str("msgId") == m.str("id") }) "Remove bookmark" else "Bookmark") {
                            toggleBookmark(app, chatId, m, m.str("text") ?: m.str("caption") ?: data.previewText(m))
                        } else null,
                        if (mine && (kind == "text" || m.str("caption") != null || kind == "photo")) MenuItem(WI.edit, "Edit") { onEdit() } else null,
                        if (mine || !isRoom(chat) || chat?.str("owner") == me || me in (chat?.strings("admins") ?: emptyList())) MenuItem(WI.trash, "Delete", danger = true) { app.kosmo.deleteMessage(chatId, m.str("id")!!) } else null,
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
}

/** Цитата ответа (.b-reply): полоса слева, фон белила .12, имя жирным. */
@Composable
private fun ReplyQuote(data: Data, r: JsonObject?, fg: Color) {
    val look = LocalLook.current
    Row(Modifier.padding(bottom = 6.dp).widthIn(min = 140.dp).clip(RoundedCornerShape(8.dp)).background(look.ink.copy(alpha = 0.12f)).height(androidx.compose.foundation.layout.IntrinsicSize.Min)) {
        Box(Modifier.width(3.dp).fillMaxHeight().background(fg))
        Column(Modifier.padding(horizontal = 10.dp, vertical = 4.dp)) {
            Text(data.accounts[r?.str("from")]?.str("name") ?: tr("Message"), fontSize = 13.sp, lineHeight = 17.sp, fontWeight = FontWeight.SemiBold, color = fg)
            Text(r?.let { tr(data.previewText(it)) } ?: tr("Deleted message"), fontSize = 13.sp, lineHeight = 17.sp, color = fg.copy(alpha = 0.85f), maxLines = 1, overflow = TextOverflow.Ellipsis)
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

/** Время и галочки (.b-meta): 11 px, прозрачность .72. */
@Composable
fun Meta(m: JsonObject, color: Color, tick: TickState?, modifier: Modifier = Modifier, views: Int = -1) {
    Row(modifier.alpha(0.72f), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(2.dp)) {
        if (m.num("expiresAt") != null) Icon(WI.timer, null, tint = color, modifier = Modifier.size(13.dp))
        if (m.bool("edited")) Text(tr("edited"), fontSize = 11.sp, lineHeight = 14.sp, fontStyle = FontStyle.Italic, color = color)
        if (views >= 0) { Icon(WI.eye, null, tint = color, modifier = Modifier.size(14.dp)); Text("$views ", fontSize = 11.sp, lineHeight = 14.sp, color = color) }
        Text(timeOf(m.num("at")), fontSize = 11.sp, lineHeight = 14.sp, color = color)
        if (tick != null) Ticks(tick, tint = color, size = 15.dp)
    }
}

/**
 * Текст и время в одной строке, если помещается (время «обтекается» текстом, как float:right на сайте),
 * иначе время — отдельной строкой справа.
 */
@Composable
fun TextWithMeta(text: AnnotatedString, color: Color, meta: @Composable () -> Unit, showMeta: Boolean = true, italic: Boolean = false) {
    androidx.compose.ui.layout.SubcomposeLayout { c ->
        var layout: androidx.compose.ui.text.TextLayoutResult? = null
        val tp = subcompose("t") { Text(text, color = color, fontSize = 16.sp, lineHeight = 22.sp, fontStyle = if (italic) FontStyle.Italic else null, onTextLayout = { layout = it }) }.first().measure(c.copy(minWidth = 0))
        val mp = if (showMeta) subcompose("m") { meta() }.first().measure(androidx.compose.ui.unit.Constraints()) else null
        val l = layout
        val gap = 10.dp.roundToPx()
        val lastW = if (l != null) (l.getLineRight(l.lineCount - 1) - l.getLineLeft(l.lineCount - 1)).toInt() else tp.width
        val mw = (mp?.width ?: 0) + gap
        val sameLine = mp == null || lastW + mw <= c.maxWidth
        val w = if (mp == null) tp.width else if (sameLine) maxOf(tp.width, lastW + mw) else maxOf(tp.width, mp.width)
        val h = if (mp == null) tp.height else if (sameLine) maxOf(tp.height, tp.height + (mp.height - 18.dp.roundToPx()).coerceAtLeast(0)) else tp.height + mp.height + 2.dp.roundToPx()
        layout(w.coerceAtMost(c.maxWidth), h) {
            tp.place(0, 0)
            mp?.place(w - mp.width, if (sameLine) h - mp.height + 4.dp.roundToPx() else tp.height + 2.dp.roundToPx())
        }
    }
}

@Composable
private fun MessageBody(app: AppState, data: Data, chatId: String, m: JsonObject, kind: String, mine: Boolean, fg: Color, tick: TickState?, views: Int, showMeta: Boolean) {
    val media = LocalMedia.current
    val look = LocalLook.current
    val ctx = LocalContext.current
    val meta: @Composable () -> Unit = { Meta(m, fg, tick, views = views) }
    @Composable fun textBlock(text: String) {
        val sealed = text.startsWith("e1:")
        TextWithMeta(AnnotatedString(if (sealed) tr("Message unavailable") else text), fg, meta, showMeta, sealed)
    }
    // на фото и видео время — пилюлей на картинке
    @Composable fun overMeta(mod: Modifier) { if (showMeta) Row(mod.clip(CircleShape).background(Color.Black.copy(alpha = 0.5f)).padding(horizontal = 8.dp, vertical = 2.dp)) { Meta(m, Color.White, tick, views = views) } }
    when (kind) {
        "text" -> textBlock(m.str("text").orEmpty())
        "photo" -> {
            val w = m.num("w")?.toFloat() ?: 4f
            val h = m.num("h")?.toFloat() ?: 3f
            Box {
                AsyncImage(
                    model = m.str("media")?.let(media), contentDescription = null, contentScale = ContentScale.Crop,
                    modifier = Modifier.width(260.dp).aspectRatio((w / h).coerceIn(260f / 360f, 2.5f)).clip(RoundedCornerShape(16.dp)).background(look.ink.copy(alpha = 0.06f))
                        .then(if (m.bool("viewOnce")) Modifier.blur(28.dp) else Modifier),
                )
                if (m.bool("viewOnce")) Box(Modifier.align(Alignment.Center).size(56.dp).clip(CircleShape).background(Color.Black.copy(alpha = 0.45f)), contentAlignment = Alignment.Center) { Icon(WI.fire, null, tint = Color.White) }
                if (m.str("caption").isNullOrEmpty()) overMeta(Modifier.align(Alignment.BottomEnd).padding(10.dp))
            }
            m.str("caption")?.takeIf { it.isNotEmpty() }?.let { Box(Modifier.padding(start = 8.dp, end = 8.dp, top = 6.dp, bottom = 4.dp)) { textBlock(it) } }
        }
        "video" -> {
            Box(contentAlignment = Alignment.Center) {
                AsyncImage(
                    model = ImageRequest.Builder(ctx).data(m.str("media")?.let(media)).decoderFactory(VideoFrameDecoder.Factory()).videoFrameMillis(500).build(),
                    contentDescription = null, contentScale = ContentScale.Crop,
                    modifier = Modifier.width(280.dp).aspectRatio(16f / 10f).clip(RoundedCornerShape(16.dp)).background(Color.Black),
                )
                Box(Modifier.size(52.dp).background(Color.Black.copy(alpha = 0.5f), CircleShape), contentAlignment = Alignment.Center) { Icon(WI.play, null, tint = Color.White, modifier = Modifier.size(24.dp)) }
                if (m.str("caption").isNullOrEmpty()) overMeta(Modifier.align(Alignment.TopEnd).padding(10.dp))
            }
            m.str("caption")?.takeIf { it.isNotEmpty() }?.let { Box(Modifier.padding(start = 8.dp, end = 8.dp, top = 6.dp, bottom = 4.dp)) { textBlock(it) } }
        }
        "album" -> {
            val items = m.arr("items").objects()
            Column(Modifier.width(260.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                items.take(6).chunked(if (items.size == 1) 1 else 2).forEach { row ->
                    Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
                        row.forEach { it2 ->
                            val id = it2.str("media") ?: ""
                            Box(Modifier.weight(1f).aspectRatio(1f).clip(RoundedCornerShape(12.dp)).background(Color.Black).clickable { if (it2.str("type") == "video") app.push(Screen.Video(id)) else app.push(Screen.Photo(id)) }, contentAlignment = Alignment.Center) {
                                AsyncImage(ImageRequest.Builder(ctx).data(media(id)).apply { if (it2.str("type") == "video") decoderFactory(VideoFrameDecoder.Factory()) }.build(), null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
                                if (it2.str("type") == "video") Icon(WI.play, null, tint = Color.White)
                            }
                        }
                    }
                }
            }
            m.str("caption")?.takeIf { it.isNotEmpty() }?.let { Box(Modifier.padding(start = 8.dp, end = 8.dp, top = 6.dp, bottom = 4.dp)) { textBlock(it) } } ?: Box(Modifier.padding(6.dp)) { if (showMeta) meta() }
        }
        "voice", "audio" -> VoiceBody(m, fg, tick, media, mine, showMeta)
        "round" -> RoundBody(m, tick, media)
        "sticker" -> Sticker(m, tick)
        "emoji" -> Column(horizontalAlignment = Alignment.End) {
            Text(emojiChar(m.str("emoji")), fontSize = 72.sp)
            Meta(m, look.text2, tick)
        }
        "code" -> Column(Modifier.widthIn(min = 240.dp)) {
            val clip = LocalClipboardManager.current
            Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Color.Black.copy(alpha = 0.38f))) {
                Row(Modifier.fillMaxWidth().padding(start = 12.dp, end = 4.dp, top = 4.dp, bottom = 4.dp).alpha(0.85f), verticalAlignment = Alignment.CenterVertically) {
                    Text(m.str("lang") ?: "code", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = fg, modifier = Modifier.weight(1f))
                    Box(Modifier.size(32.dp).clip(RoundedCornerShape(10.dp)).clickable { clip.setText(AnnotatedString(m.str("text") ?: "")); app.toast = "Code copied" }, contentAlignment = Alignment.Center) {
                        Icon(WI.copy, tr("Copy"), tint = fg, modifier = Modifier.size(16.dp))
                    }
                }
                Text(m.str("text") ?: "", color = Color(0xFFE8E8EA), fontFamily = FontFamily.Monospace, fontSize = 13.sp, lineHeight = 19.5.sp, modifier = Modifier.padding(start = 12.dp, end = 12.dp, top = 4.dp, bottom = 12.dp))
            }
            m.str("caption")?.takeIf { it.isNotEmpty() }?.let { Box(Modifier.padding(start = 6.dp, end = 6.dp, top = 6.dp)) { textBlock(it) } }
                ?: if (showMeta) Box(Modifier.align(Alignment.End).padding(start = 10.dp, end = 4.dp, top = 6.dp)) { meta() } else Unit
        }
        "poll" -> PollBody(app, data, chatId, m, fg, mine, tick, showMeta)
        "todo" -> TodoBody(app, data, chatId, m, fg, mine, tick, showMeta)
        "location" -> {
            val l = m.obj("location") ?: JsonObject(emptyMap())
            val lat = l.dbl("lat") ?: 0.0
            val lon = l.dbl("lon") ?: 0.0
            val z = 15
            val n = 1 shl z
            val xt = floor((lon + 180) / 360 * n).toInt()
            val yt = floor((1 - ln(tan(lat * PI / 180) + 1 / cos(lat * PI / 180)) / PI) / 2 * n).toInt()
            Column(Modifier.width(240.dp)) {
                Box(Modifier.fillMaxWidth().height(150.dp).clip(RoundedCornerShape(14.dp)).background(Color(0xFF2A2D33)).clickable {
                    ctx.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("geo:$lat,$lon?q=$lat,$lon")))
                }, contentAlignment = Alignment.Center) {
                    AsyncImage("https://tile.openstreetmap.org/$z/$xt/$yt.png", null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
                    Icon(WI.pin, null, tint = Color(0xFFFF453A), modifier = Modifier.size(32.dp))
                }
                Row(Modifier.padding(top = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(tr(if (l.bool("live")) "Live location" else "Location"), color = fg, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                    if (showMeta) meta()
                }
            }
        }
        "post" -> {
            val p = data.feed.firstOrNull { it.str("id") == m.str("post") }
            val author = data.accounts[p?.str("author")]
            Column(Modifier.width(250.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    UserAvatar(author, 28.dp)
                    Text(author?.str("name") ?: tr("Post"), color = fg, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(start = 8.dp))
                }
                p?.arr("media")?.objects()?.firstOrNull()?.str("media")?.let { AsyncImage(media(it), null, contentScale = ContentScale.Crop, modifier = Modifier.padding(top = 8.dp).fillMaxWidth().aspectRatio(4f / 3f).clip(RoundedCornerShape(12.dp))) }
                Text(p?.str("text") ?: tr("Post deleted"), color = fg, maxLines = 4, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 6.dp))
                Row(Modifier.padding(top = 6.dp).alpha(0.8f), verticalAlignment = Alignment.CenterVertically) { Icon(WI.forward, null, Modifier.size(14.dp), tint = fg); Text(" " + tr("Shared from Feed"), fontSize = 12.sp, color = fg, modifier = Modifier.weight(1f)); if (showMeta) meta() }
            }
        }
        "call" -> {
            // .b-call: значок в круге, заголовок и длительность, кнопка «перезвонить»
            val missed = m.str("status") != "ended"
            val base = when (m.str("status")) { "declined" -> "Declined call"; "busy" -> "Line busy"; else -> if (missed) (if (mine) "Cancelled call" else "Missed call") else if (mine) "Outgoing call" else "Incoming call" }
            val title = if (m.bool("video")) base.replace("call", "video call") else base
            Column(Modifier.widthIn(min = 236.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(36.dp).clip(CircleShape).background(look.ink.copy(alpha = 0.16f)), contentAlignment = Alignment.Center) {
                        Icon(if (mine) WI.callOut else WI.callIn, null, tint = if (missed) Color(0xFFFF6961) else fg, modifier = Modifier.size(18.dp))
                    }
                    Column(Modifier.weight(1f).padding(start = 10.dp)) {
                        Text(tr(title), color = fg, fontWeight = FontWeight.SemiBold, fontSize = 16.sp, lineHeight = 20.sp)
                        Text(m.num("duration")?.takeIf { it > 0 }?.let { fmtDur(it) } ?: timeOf(m.num("at")), color = fg.copy(alpha = 0.7f), fontSize = 12.sp, lineHeight = 15.sp)
                    }
                    Box(Modifier.size(36.dp).clip(CircleShape).clickable {
                        val other = data.chats[chatId]?.strings("members")?.firstOrNull { it != data.me }
                        if (other != null) app.startCall(other, m.bool("video"))
                    }, contentAlignment = Alignment.Center) { Icon(if (m.bool("video")) WI.video else WI.call, tr("Call back"), tint = fg, modifier = Modifier.size(20.dp)) }
                }
                if (showMeta) Box(Modifier.align(Alignment.End).padding(top = 2.dp)) { meta() }
            }
        }
        else -> textBlock(tr(data.previewText(m)))
    }
}

@Composable
private fun Sticker(m: JsonObject, tick: TickState?) {
    val st = m.obj("sticker")
    val look = LocalLook.current
    val t = androidx.compose.animation.core.rememberInfiniteTransition(label = "st")
    val a by t.animateFloat(-6f, 6f, androidx.compose.animation.core.infiniteRepeatable(androidx.compose.animation.core.tween(900), androidx.compose.animation.core.RepeatMode.Reverse), label = "a")
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Box(contentAlignment = Alignment.BottomCenter) {
            Text(emojiChar(st?.str("emoji")), fontSize = 96.sp, modifier = Modifier.offset(y = (a / 2).dp))
        }
        st?.str("text")?.takeIf { it.isNotEmpty() }?.let { Text(it, fontWeight = FontWeight.Bold, color = Color.White, fontSize = 15.sp, modifier = Modifier.clip(RoundedCornerShape(12.dp)).background(Color(0xFF2A2A30)).padding(horizontal = 12.dp, vertical = 4.dp)) }
        Meta(m, look.text2, tick, Modifier.padding(top = 4.dp))
    }
}

/** Опрос (.poll): до голоса — пилюли с кружком, после — проценты и полосы. */
@Composable
private fun PollBody(app: AppState, data: Data, chatId: String, m: JsonObject, fg: Color, mine: Boolean, tick: TickState?, showMeta: Boolean) {
    val p = m.obj("poll") ?: return
    val me = data.me ?: return
    val look = LocalLook.current
    val votes = p.obj("votes") ?: JsonObject(emptyMap())
    val total = votes.values.flatMap { (it as? JsonArray)?.map { x -> (x as JsonPrimitive).content }.orEmpty() }.toSet().size
    val mineVotes = votes.filter { (it.value as? JsonArray)?.any { x -> (x as JsonPrimitive).content == me } == true }.keys
    val show = mineVotes.isNotEmpty() || p.bool("closed")
    val quiz = p.bool("quiz")
    Column(Modifier.widthIn(min = 276.dp).padding(vertical = 2.dp)) {
        Text(p.str("question") ?: "", color = fg, fontWeight = FontWeight.Bold, fontSize = 16.sp, lineHeight = 21.sp)
        Text(tr(if (quiz) "Quiz" else if (p.bool("anonymous")) "Anonymous poll" else "Public poll") + if (p.bool("multiple")) " · " + tr("multiple answers") else "", color = fg.copy(alpha = 0.7f), fontSize = 12.sp, modifier = Modifier.padding(top = 6.dp))
        Column(Modifier.padding(top = 12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            p.arr("options").objects().forEach { o ->
                val id = o.str("id") ?: ""
                val n = (votes[id] as? JsonArray)?.size ?: 0
                val pct = if (total > 0) Math.round(n * 100f / total) else 0
                val chosen = id in mineVotes
                val right = quiz && show && id == p.str("correct")
                val wrong = quiz && chosen && id != p.str("correct")
                if (!show) Row(
                    Modifier.fillMaxWidth().heightIn(min = 42.dp).clip(RoundedCornerShape(14.dp)).background(look.ink.copy(alpha = if (mine) 0.18f else 0.08f)).clickable {
                        val next = votes.toMutableMap()
                        next[id] = JsonArray(((votes[id] as? JsonArray)?.toList().orEmpty()) + JsonPrimitive(me))
                        app.kosmo.editMessage(chatId, m.with("poll" to p.with("votes" to JsonObject(next))))
                    }.padding(horizontal = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box(Modifier.size(20.dp).alpha(0.6f).border(2.dp, fg, if (p.bool("multiple")) RoundedCornerShape(6.dp) else CircleShape))
                    Text(o.str("text") ?: "", color = fg, fontSize = 15.sp, modifier = Modifier.padding(start = 10.dp))
                } else Row(Modifier.fillMaxWidth().padding(vertical = 4.dp), verticalAlignment = Alignment.Top) {
                    Text("$pct%", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = fg, modifier = Modifier.width(50.dp))
                    Column(Modifier.weight(1f)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(o.str("text") ?: "", fontSize = 15.sp, color = fg)
                            if (right || chosen) Icon(if (wrong) WI.close else WI.check, null, tint = if (right) Color(0xFF34C759) else if (wrong) Color(0xFFFF453A) else fg, modifier = Modifier.padding(start = 6.dp).size(16.dp))
                        }
                        Box(Modifier.padding(top = 4.dp).fillMaxWidth(maxOf(pct / 100f, 0.02f)).height(5.dp).clip(RoundedCornerShape(3.dp))
                            .background((if (right) Color(0xFF34C759) else if (wrong) Color(0xFFFF453A) else fg).copy(alpha = if (chosen || right) 0.85f else 0.35f)))
                    }
                }
            }
        }
        if (show && quiz && !p.str("explanation").isNullOrEmpty()) Text("💡 " + p.str("explanation"), color = fg, fontSize = 13.sp, modifier = Modifier.padding(top = 4.dp).clip(RoundedCornerShape(12.dp)).background(look.ink.copy(alpha = 0.08f)).padding(horizontal = 10.dp, vertical = 8.dp))
        Row(Modifier.padding(top = 10.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(if (total > 0) tr("$total ${if (total == 1) "vote" else "votes"}") else tr("No votes yet"), color = fg.copy(alpha = 0.75f), fontSize = 12.sp, modifier = Modifier.weight(1f))
            if (showMeta) Meta(m, fg, tick)
        }
    }
}

/** Список дел (.todo): заголовок со значком и счётом, круглые галочки, кто отметил, поле «Добавить». */
@Composable
private fun TodoBody(app: AppState, data: Data, chatId: String, m: JsonObject, fg: Color, mine: Boolean, tick: TickState?, showMeta: Boolean) {
    val t = m.obj("todo") ?: return
    val me = data.me ?: return
    val look = LocalLook.current
    val items = t.arr("items").objects()
    var add by remember { mutableStateOf("") }
    Column(Modifier.widthIn(min = 256.dp)) {
        Row(Modifier.padding(top = 2.dp, bottom = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(WI.todo, null, tint = fg, modifier = Modifier.size(18.dp))
            Text(t.str("title")?.takeIf { it.isNotEmpty() } ?: tr("Checklist"), color = fg, fontWeight = FontWeight.Bold, fontSize = 16.sp, modifier = Modifier.weight(1f).padding(start = 8.dp))
            Text("${items.count { it.strings("done").isNotEmpty() }}/${items.size}", color = fg.copy(alpha = 0.7f), fontSize = 13.sp)
        }
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            items.forEach { it2 ->
                val done = it2.strings("done")
                val minePick = me in done
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        Modifier.size(24.dp).clip(CircleShape)
                            .background(if (minePick) (if (mine) Color.White else look.accent) else Color.Transparent)
                            .border(2.dp, if (minePick) Color.Transparent else look.ink.copy(alpha = 0.4f), CircleShape)
                            .clickable {
                                val nextItems = items.map { x -> if (x.str("id") == it2.str("id")) x.with("done" to (if (minePick) done - me else done + me)) else x }
                                app.kosmo.editMessage(chatId, m.with("todo" to t.with("items" to JsonArray(nextItems))))
                            },
                        contentAlignment = Alignment.Center,
                    ) { if (minePick) Icon(WI.check, null, tint = if (mine) look.accent else Color.White, modifier = Modifier.size(15.dp)) }
                    Text(
                        it2.str("text") ?: "", color = fg.copy(alpha = if (done.isNotEmpty()) 0.6f else 1f), fontSize = 16.sp,
                        textDecoration = if (done.isNotEmpty()) androidx.compose.ui.text.style.TextDecoration.LineThrough else null,
                        modifier = Modifier.weight(1f).padding(start = 10.dp),
                    )
                    Row { done.take(3).forEachIndexed { i, u -> UserAvatar(data.accounts[u], 18.dp, Modifier.offset(x = (-5 * i).dp).border(1.5.dp, look.cell, CircleShape)) } }
                }
            }
        }
        if (t["open"]?.toString() != "false" || m.str("from") == me) Row(Modifier.padding(top = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Box(Modifier.weight(1f).height(34.dp).clip(CircleShape).background(look.ink.copy(alpha = 0.12f)).padding(horizontal = 12.dp), contentAlignment = Alignment.CenterStart) {
                if (add.isEmpty()) Text(tr("Add a task"), color = fg.copy(alpha = 0.55f), fontSize = 14.sp)
                androidx.compose.foundation.text.BasicTextField(add, { add = it.take(200) }, singleLine = true, textStyle = androidx.compose.ui.text.TextStyle(color = fg, fontSize = 14.sp), cursorBrush = androidx.compose.ui.graphics.SolidColor(fg), modifier = Modifier.fillMaxWidth())
            }
            Box(Modifier.size(34.dp).clip(CircleShape).background(look.ink.copy(alpha = 0.16f)).clickable {
                if (add.isBlank()) return@clickable
                val item = jobj("id" to java.util.UUID.randomUUID().toString(), "text" to add.trim(), "by" to me, "done" to emptyList<String>())
                app.kosmo.editMessage(chatId, m.with("todo" to t.with("items" to JsonArray(items + item))))
                add = ""
            }, contentAlignment = Alignment.Center) { Icon(WI.plus, tr("Add"), tint = fg, modifier = Modifier.size(18.dp)) }
        }
        if (showMeta) Box(Modifier.align(Alignment.End).padding(top = 6.dp)) { Meta(m, fg, tick) }
    }
}

/** Голосовое / музыка (.b-player): кнопка 42, волна .38, прослушанная часть ярче. */
@Composable
fun VoiceBody(m: JsonObject, fg: Color, tick: TickState?, media: (String) -> String, mine: Boolean = false, showMeta: Boolean = true) {
    val st by Voice.state.collectAsState()
    val look = LocalLook.current
    val id = m.str("id") ?: ""
    val me = st.id == id
    val dur = m.dbl("duration") ?: st.dur.toDouble()
    val frac = if (me && st.dur > 0) st.pos / st.dur else 0f
    val music = m.str("kind") == "audio"
    val wave = m.arr("wave").mapNotNull { (it as? JsonPrimitive)?.content?.toFloatOrNull() }.ifEmpty { List(36) { i -> 0.25f + 0.6f * kotlin.math.abs(kotlin.math.sin(i * 1.7f)) } }
    val playBg = if (mine) Color.White else look.accent
    val playFg = if (mine) look.accent else Color.White
    Column(Modifier.widthIn(min = 240.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(42.dp).clip(CircleShape).background(playBg).clickable { m.str("media")?.let { Voice.toggle(id, media(it)) } }, contentAlignment = Alignment.Center) {
                Icon(if (me && st.playing) WI.pause else WI.play, null, tint = playFg, modifier = Modifier.size(20.dp))
            }
            Column(Modifier.weight(1f).padding(start = 10.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                var widthPx by remember { mutableStateOf(1) }
                if (music) {
                    Text(m.str("name") ?: tr("Music"), color = fg, maxLines = 1, overflow = TextOverflow.Ellipsis, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                    Box(Modifier.fillMaxWidth().height(4.dp).clip(RoundedCornerShape(2.dp)).background(fg.copy(alpha = 0.25f)).onSizeChanged { widthPx = it.width }.pointerInput(id) { detectTapGestures { o -> Voice.seek(id, o.x / widthPx) } }) {
                        Box(Modifier.fillMaxWidth(frac).fillMaxHeight().background(fg))
                    }
                } else Row(
                    Modifier.fillMaxWidth().height(26.dp).onSizeChanged { widthPx = it.width }.pointerInput(id) { detectTapGestures { o -> Voice.seek(id, o.x / widthPx) } },
                    horizontalArrangement = Arrangement.spacedBy(2.dp), verticalAlignment = Alignment.CenterVertically,
                ) {
                    wave.forEachIndexed { i, v ->
                        val played = me && i.toFloat() / wave.size < frac
                        Box(Modifier.weight(1f).heightIn(min = 3.dp).fillMaxHeight(v.coerceIn(0.12f, 1f)).clip(RoundedCornerShape(2.dp)).background(if (played) fg else fg.copy(alpha = 0.38f)))
                    }
                }
                Text(fmtDur(if (me && st.pos > 0) st.pos else dur), color = fg.copy(alpha = 0.75f), fontSize = 12.sp)
            }
        }
        m.str("transcript")?.takeIf { it.isNotEmpty() }?.let { Text(it, color = fg.copy(alpha = 0.85f), fontSize = 14.sp, fontStyle = FontStyle.Italic, modifier = Modifier.padding(top = 6.dp)) }
        if (showMeta) Box(Modifier.align(Alignment.End).padding(top = 2.dp)) { Meta(m, fg, tick) }
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
