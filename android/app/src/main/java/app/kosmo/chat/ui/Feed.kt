package app.kosmo.chat.ui

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.tween
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
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.Send
import androidx.compose.material.icons.outlined.ChatBubbleOutline
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.AddPhotoAlternate
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Delete
import androidx.compose.material.icons.rounded.Edit
import androidx.compose.material.icons.rounded.Favorite
import androidx.compose.material.icons.rounded.FavoriteBorder
import androidx.compose.material.icons.rounded.MoreHoriz
import androidx.compose.material.icons.rounded.Visibility
import androidx.compose.material3.Icon
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.kosmo.chat.core.Data
import app.kosmo.chat.core.arr
import app.kosmo.chat.core.bool
import app.kosmo.chat.core.jobj
import app.kosmo.chat.core.num
import app.kosmo.chat.core.obj
import app.kosmo.chat.core.objects
import app.kosmo.chat.core.str
import app.kosmo.chat.core.strings
import coil.compose.AsyncImage
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

fun ago(at: Long?): String {
    at ?: return ""
    val m = (System.currentTimeMillis() - at) / 60000
    return tr(when { m < 1 -> "just now"; m < 60 -> "$m min ago"; m < 24 * 60 -> "${m / 60} h ago"; else -> listTime(at) })
}

/** Лента: шапка, истории, посты. */
@Composable
fun FeedScreen(app: AppState, data: Data) {
    val look = LocalLook.current
    val scope = rememberCoroutineScope()
    val ctx = LocalContext.current
    val pickStory = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        uri ?: return@rememberLauncherForActivityResult
        scope.launch {
            try {
                val (f, w, h) = withContext(Dispatchers.IO) { compressPhoto(ctx, uri) } ?: error("Could not read this photo")
                val id = app.api.upload(f, "image/jpeg")
                app.kosmo.commit(jobj("col" to "stories", "id" to app.kosmo.newId(), "op" to "put", "set" to jobj("author" to data.me, "at" to System.currentTimeMillis(), "media" to jobj("type" to "photo", "media" to id, "w" to w, "h" to h), "text" to "", "views" to listOf(data.me), "likes" to emptyList<String>())))
                app.toast = "Story published · visible for 24 hours"
            } catch (e: Exception) { app.toast = e.message }
        }
    }
    Column(Modifier.fillMaxSize()) {
        Header { CircleSpacer(); TitlePill("Feed"); CircleBtn(Icons.Rounded.Edit, "New post") { app.push(Screen.NewPost) } }
        LazyColumn(contentPadding = PaddingValues(start = 12.dp, end = 12.dp, bottom = 110.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            item("stories") {
                val groups = remember(data.stories) {
                    val day = System.currentTimeMillis() - 24 * 3600 * 1000
                    data.stories.filter { (it.num("at") ?: 0) > day }.groupBy { it.str("author") ?: "" }
                        .toList().sortedWith(compareByDescending<Pair<String, List<JsonObject>>> { it.first == data.me }.thenByDescending { g -> g.second.any { data.me !in it.strings("views") } })
                }
                LazyRow(horizontalArrangement = Arrangement.spacedBy(14.dp), contentPadding = PaddingValues(horizontal = 4.dp, vertical = 4.dp)) {
                    if (groups.none { it.first == data.me }) item("mine") {
                        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.clickable { pickStory.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) }) {
                            Box {
                                UserAvatar(data.user, 64.dp)
                                Box(Modifier.align(Alignment.BottomEnd).size(22.dp).clip(CircleShape).background(look.accent).border(2.dp, look.page, CircleShape), contentAlignment = Alignment.Center) { Icon(Icons.Rounded.Add, null, tint = look.onAccent, modifier = Modifier.size(14.dp)) }
                            }
                            Text(tr("Your story"), fontSize = 12.sp, color = look.text2, modifier = Modifier.padding(top = 4.dp))
                        }
                    }
                    items(groups, key = { it.first }) { (author, list) ->
                        val unseen = list.any { data.me !in it.strings("views") }
                        val u = data.accounts[author]
                        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.width(72.dp).clickable { app.push(Screen.Stories(author)) }) {
                            Box(Modifier.size(70.dp).clip(CircleShape).background(if (unseen) Brush.sweepGradient(listOf(PlanetA, PlanetB, PlanetA)) else SolidColor(look.ink.copy(alpha = 0.2f))).padding(3.dp).clip(CircleShape).background(look.page).padding(2.dp)) {
                                UserAvatar(u, 62.dp)
                            }
                            Text(if (author == data.me) tr("Your story") else firstName(u?.str("name")), fontSize = 12.sp, color = look.text2, maxLines = 1, modifier = Modifier.padding(top = 4.dp))
                        }
                    }
                }
            }
            if (data.feed.isEmpty()) item("empty") {
                Column(Modifier.fillMaxWidth().padding(top = 60.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    PlanetLogo(Modifier.size(120.dp))
                    Text(tr("Nothing here yet"), fontSize = 22.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 10.dp))
                    Text(tr("Share a photo, a video, some code or a thought with everyone on Kosmo."), color = look.text2, modifier = Modifier.padding(16.dp), textAlign = androidx.compose.ui.text.style.TextAlign.Center)
                    BigButton("Create a post", Modifier.width(200.dp)) { app.push(Screen.NewPost) }
                }
            }
            items(data.feed, key = { it.str("id") ?: "" }) { p -> PostCard(app, data, p) }
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun PostCard(app: AppState, data: Data, p: JsonObject, full: Boolean = false) {
    val look = LocalLook.current
    val author = data.accounts[p.str("author")]
    val me = data.me
    var menu by remember { mutableStateOf(false) }
    val id = p.str("id") ?: ""
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(24.dp)).background(look.cell).combinedClickable(onClick = { if (!full) app.push(Screen.Post(id)) }, onLongClick = {}).padding(14.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Row(Modifier.weight(1f).clickable { p.str("author")?.let { if (it != me) app.push(Screen.User(it)) } }, verticalAlignment = Alignment.CenterVertically) {
                UserAvatar(author, 40.dp)
                Column(Modifier.padding(start = 10.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(author?.str("name") ?: tr("Deleted account"), fontWeight = FontWeight.SemiBold)
                        if (author?.bool("official") == true) VerifiedBadge(Modifier.padding(start = 4.dp), 16)
                    }
                    Text(ago(p.num("at")) + if (p.bool("edited")) " · " + tr("edited") else "", fontSize = 13.sp, color = look.text2)
                }
            }
            if (p.str("author") == me) Box {
                Icon(Icons.Rounded.MoreHoriz, null, tint = look.text2, modifier = Modifier.clip(CircleShape).clickable { menu = true }.padding(6.dp))
                KosmoMenu(menu, { menu = false }, listOf(MenuItem(Icons.Rounded.Delete, "Delete post", danger = true) {
                    app.kosmo.commit(jobj("col" to "feed", "id" to id, "op" to "del")); if (full) app.pop()
                }))
            }
        }
        p.str("text")?.takeIf { it.isNotEmpty() }?.let { Text(it, fontSize = 16.sp, lineHeight = 22.sp, modifier = Modifier.padding(top = 10.dp), maxLines = if (full) Int.MAX_VALUE else 12, overflow = TextOverflow.Ellipsis) }
        val media = p.arr("media").objects()
        if (media.isNotEmpty()) {
            val m = media.first()
            val w = m.num("w")?.toFloat() ?: 4f
            val h = m.num("h")?.toFloat() ?: 3f
            Box(Modifier.padding(top = 10.dp)) {
                AsyncImage(
                    LocalMedia.current(m.str("media") ?: ""), null, contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxWidth().aspectRatio((w / h).coerceIn(0.6f, 1.9f)).clip(RoundedCornerShape(18.dp)).background(Color(0xFF1A1A1E))
                        .clickable { m.str("media")?.let { if (m.str("type") == "video") app.push(Screen.Video(it)) else app.push(Screen.Photo(it)) } },
                )
                if (media.size > 1) Text("+${media.size - 1}", color = Color.White, modifier = Modifier.align(Alignment.TopEnd).padding(10.dp).clip(CircleShape).background(Color.Black.copy(alpha = 0.5f)).padding(horizontal = 8.dp, vertical = 2.dp))
            }
        }
        p.obj("code")?.let { c ->
            Text(c.str("text") ?: "", fontFamily = FontFamily.Monospace, fontSize = 13.sp, color = Color(0xFFE6E6E6), maxLines = if (full) Int.MAX_VALUE else 12, overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(top = 10.dp).fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(Color(0xFF0D0D10)).padding(12.dp))
        }
        val reactions = p.obj("reactions") ?: JsonObject(emptyMap())
        Row(Modifier.padding(top = 10.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
            listOf("heart", "fire", "laugh", "like").forEach { key ->
                val who = (reactions[key] as? JsonArray)?.mapNotNull { (it as? JsonPrimitive)?.content }.orEmpty()
                val mine = me in who
                Text(
                    "${EMOJI[key]}${if (who.isNotEmpty()) " ${who.size}" else ""}", fontSize = 14.sp,
                    modifier = Modifier.clip(CircleShape).background(if (mine) look.accent.copy(alpha = 0.3f) else look.ink.copy(alpha = 0.08f))
                        .clickable {
                            me ?: return@clickable
                            val next = reactions.mapValues { (_, v) -> JsonArray((v as? JsonArray)?.filter { (it as? JsonPrimitive)?.content != me }.orEmpty()) }.toMutableMap()
                            if (!mine) next[key] = JsonArray(((next[key] as? JsonArray)?.toList().orEmpty()) + JsonPrimitive(me))
                            app.kosmo.commit(jobj("col" to "feed", "id" to id, "op" to "put", "set" to jobj("reactions" to JsonObject(next.filterValues { (it as JsonArray).isNotEmpty() }))))
                        }.padding(horizontal = 10.dp, vertical = 5.dp),
                )
            }
        }
        Row(Modifier.padding(top = 10.dp), verticalAlignment = Alignment.CenterVertically) {
            Row(Modifier.clip(CircleShape).clickable { app.push(Screen.Post(id)) }.padding(6.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Outlined.ChatBubbleOutline, null, Modifier.size(19.dp), tint = look.text2)
                Text(" ${p.arr("comments").size.takeIf { it > 0 } ?: ""}", color = look.text2, fontSize = 14.sp)
            }
            Row(Modifier.clip(CircleShape).clickable { app.push(Screen.Forward(postId = id)) }.padding(6.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.AutoMirrored.Rounded.Send, null, Modifier.size(19.dp), tint = look.text2)
                Text(" ${p.num("forwards")?.takeIf { it > 0 } ?: ""}", color = look.text2, fontSize = 14.sp)
            }
            Spacer(Modifier.weight(1f))
            Icon(Icons.Rounded.Visibility, null, Modifier.size(17.dp), tint = look.text2)
            Text(" ${p.strings("views").size}", color = look.text2, fontSize = 14.sp)
        }
    }
    // просмотр засчитывается один раз
    LaunchedEffect(id) {
        val my = me ?: return@LaunchedEffect
        if (my !in p.strings("views")) app.kosmo.commit(jobj("col" to "feed", "id" to id, "op" to "put", "set" to jobj("views" to (p.strings("views") + my))))
    }
}

/** Пост с комментариями. */
@Composable
fun PostScreen(app: AppState, id: String) {
    val data by app.kosmo.data.collectAsState()
    val look = LocalLook.current
    val p = data.feed.firstOrNull { it.str("id") == id }
    var text by remember { mutableStateOf("") }
    val comments = p?.arr("comments")?.objects().orEmpty()
    Column(Modifier.fillMaxSize().background(look.page).imePadding()) {
        Header { BackBtn(app); TitlePill(if (comments.isNotEmpty()) tr("${comments.size} ${if (comments.size == 1) "comment" else "comments"}") else "Post"); CircleSpacer() }
        if (p == null) { Text(tr("Post deleted"), Modifier.padding(24.dp), color = look.text2); return@Column }
        LazyColumn(Modifier.weight(1f), contentPadding = PaddingValues(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            item { PostCard(app, data, p, full = true) }
            item { SectionLabel(if (comments.isEmpty()) "No comments yet — be the first" else "Comments") }
            items(comments, key = { it.str("id") ?: "" }) { c ->
                val u = data.accounts[c.str("from")]
                Row(Modifier.fillMaxWidth().padding(horizontal = 4.dp)) {
                    UserAvatar(u, 36.dp, Modifier.clickable { c.str("from")?.let { if (it != data.me) app.push(Screen.User(it)) } })
                    Column(Modifier.padding(start = 10.dp).weight(1f).clip(RoundedCornerShape(16.dp)).background(look.theirs).padding(horizontal = 12.dp, vertical = 8.dp)) {
                        Row { Text(u?.str("name") ?: "", fontWeight = FontWeight.SemiBold, fontSize = 14.sp, modifier = Modifier.weight(1f)); Text(ago(c.num("at")), color = look.text2, fontSize = 12.sp) }
                        Text(c.str("text") ?: "", fontSize = 15.sp)
                        if (c.str("from") == data.me || p.str("author") == data.me) Text(tr("Delete"), color = androidx.compose.material3.MaterialTheme.colorScheme.error, fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp).clickable {
                            app.kosmo.commit(jobj("col" to "feed", "id" to id, "op" to "put", "set" to jobj("comments" to JsonArray(comments.filter { it.str("id") != c.str("id") }))))
                        })
                    }
                }
            }
        }
        Row(Modifier.fillMaxWidth().navigationBarsPadding().padding(12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Box(Modifier.weight(1f).height(48.dp).chrome(look, RoundedCornerShape(24.dp)).padding(horizontal = 16.dp), contentAlignment = Alignment.CenterStart) {
                if (text.isEmpty()) Text(tr("Comment"), color = look.text3)
                BasicTextField(text, { text = it.take(2000) }, textStyle = TextStyle(color = look.text, fontSize = 16.sp), cursorBrush = SolidColor(look.accent), modifier = Modifier.fillMaxWidth())
            }
            CircleBtn(Icons.AutoMirrored.Rounded.Send, "Send", accent = true, enabled = text.isNotBlank()) {
                val c = jobj("id" to app.kosmo.newId(), "from" to data.me, "text" to text.trim(), "at" to System.currentTimeMillis())
                app.kosmo.commit(jobj("col" to "feed", "id" to id, "op" to "put", "set" to jobj("comments" to JsonArray(comments + c))))
                text = ""
            }
        }
    }
}

/** Новый пост: текст, фото (до 10), код. */
@Composable
fun NewPostScreen(app: AppState) {
    val data by app.kosmo.data.collectAsState()
    val look = LocalLook.current
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var text by remember { mutableStateOf("") }
    var code by remember { mutableStateOf("") }
    var withCode by remember { mutableStateOf(false) }
    val photos = remember { mutableStateListOf<Uri>() }
    var busy by remember { mutableStateOf(false) }
    val pick = rememberLauncherForActivityResult(ActivityResultContracts.PickMultipleVisualMedia(10)) { photos.addAll(it.take(10 - photos.size)) }
    Column(Modifier.fillMaxSize().background(look.page).imePadding()) {
        Header {
            CircleBtn(Icons.Rounded.Close, "Cancel") { app.pop() }
            TitlePill("New post")
            CircleBtn(Icons.Rounded.Check, "Publish", accent = true, enabled = !busy && (text.isNotBlank() || photos.isNotEmpty() || code.isNotBlank())) {
                busy = true
                scope.launch {
                    try {
                        val media = photos.map { p ->
                            val (f, w, h) = withContext(Dispatchers.IO) { compressPhoto(ctx, p) } ?: error("Could not read this photo")
                            jobj("type" to "photo", "media" to app.api.upload(f, "image/jpeg"), "w" to w, "h" to h)
                        }
                        val me = data.me!!
                        app.kosmo.commit(jobj("col" to "feed", "id" to app.kosmo.newId(), "op" to "put", "set" to jobj(
                            "author" to me, "text" to text.trim(), "media" to media, "code" to (if (withCode && code.isNotBlank()) jobj("lang" to "code", "text" to code) else null),
                            "views" to listOf(me), "at" to System.currentTimeMillis(), "reactions" to emptyMap<String, Any>(), "comments" to emptyList<Any>(), "forwards" to 0,
                        )))
                        app.toast = "Post published"
                        app.pop()
                    } catch (e: Exception) { app.toast = e.message ?: "Could not publish"; busy = false }
                }
            }
        }
        Column(Modifier.fillMaxSize().padding(16.dp)) {
            Row {
                UserAvatar(data.user, 44.dp)
                Box(Modifier.weight(1f).padding(start = 12.dp, top = 10.dp)) {
                    if (text.isEmpty()) Text(tr("What’s new?"), color = look.text3, fontSize = 18.sp)
                    BasicTextField(text, { text = it.take(4000) }, textStyle = TextStyle(color = look.text, fontSize = 18.sp), cursorBrush = SolidColor(look.accent), modifier = Modifier.fillMaxWidth())
                }
            }
            if (photos.isNotEmpty()) LazyRow(Modifier.padding(top = 14.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                items(photos.toList()) { u ->
                    Box {
                        AsyncImage(u, null, contentScale = ContentScale.Crop, modifier = Modifier.size(120.dp).clip(RoundedCornerShape(16.dp)))
                        Icon(Icons.Rounded.Close, null, tint = Color.White, modifier = Modifier.align(Alignment.TopEnd).padding(6.dp).clip(CircleShape).background(Color.Black.copy(alpha = 0.5f)).clickable { photos.remove(u) }.padding(2.dp))
                    }
                }
            }
            if (withCode) BasicTextField(
                code, { code = it }, textStyle = TextStyle(color = Color(0xFFE6E6E6), fontFamily = FontFamily.Monospace, fontSize = 14.sp), cursorBrush = SolidColor(look.accent),
                modifier = Modifier.padding(top = 14.dp).fillMaxWidth().height(160.dp).clip(RoundedCornerShape(14.dp)).background(Color(0xFF0D0D10)).padding(12.dp),
            )
            Spacer(Modifier.weight(1f))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Chip(tr("Photo"), false) { pick.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) }
                Chip(tr("Code"), withCode) { withCode = !withCode }
            }
        }
    }
}

/** Просмотр историй: полоски прогресса, касание слева/справа, лайк, ответ в личку. */
@Composable
fun StoryViewer(app: AppState, author: String) {
    val data by app.kosmo.data.collectAsState()
    val list = remember(author) { data.stories.filter { it.str("author") == author }.sortedBy { it.num("at") ?: 0 } }
    if (list.isEmpty()) { LaunchedEffect(Unit) { app.pop() }; return }
    var i by remember { mutableIntStateOf(list.indexOfFirst { data.me !in it.strings("views") }.takeIf { it >= 0 } ?: 0) }
    val progress = remember { Animatable(0f) }
    var reply by remember { mutableStateOf("") }
    val s = list[i.coerceIn(0, list.lastIndex)]
    val sid = s.str("id") ?: ""
    val u = data.accounts[author]
    val me = data.me
    LaunchedEffect(i) {
        if (me != null && me !in s.strings("views")) app.kosmo.commit(jobj("col" to "stories", "id" to sid, "op" to "put", "set" to jobj("views" to (s.strings("views") + me))))
        progress.snapTo(0f)
        progress.animateTo(1f, tween(5000, easing = LinearEasing))
        if (i < list.lastIndex) i++ else app.pop()
    }
    Box(Modifier.fillMaxSize().background(Color.Black)) {
        s.obj("media")?.str("media")?.let { AsyncImage(LocalMedia.current(it), null, contentScale = ContentScale.Fit, modifier = Modifier.fillMaxSize()) }
        Box(Modifier.fillMaxSize().pointerInput(i) { detectTapGestures { o -> if (o.x < size.width / 3) { if (i > 0) i-- } else { if (i < list.lastIndex) i++ else app.pop() } } })
        Column(Modifier.fillMaxSize().safeDrawingPadding().padding(12.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                list.indices.forEach { k ->
                    Box(Modifier.weight(1f).height(3.dp).clip(CircleShape).background(Color.White.copy(alpha = 0.3f))) {
                        Box(Modifier.fillMaxWidth(if (k < i) 1f else if (k == i) progress.value else 0f).height(3.dp).background(Color.White))
                    }
                }
            }
            Row(Modifier.padding(top = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                UserAvatar(u, 36.dp)
                Column(Modifier.weight(1f).padding(start = 10.dp)) {
                    Text(u?.str("name") ?: "", color = Color.White, fontWeight = FontWeight.SemiBold)
                    Text(ago(s.num("at")), color = Color.White.copy(alpha = 0.7f), fontSize = 12.sp)
                }
                if (author == me) Icon(Icons.Rounded.Delete, tr("Delete"), tint = Color.White, modifier = Modifier.clip(CircleShape).clickable { app.kosmo.commit(jobj("col" to "stories", "id" to sid, "op" to "del")); app.pop() }.padding(8.dp))
                Icon(Icons.Rounded.Close, tr("Close"), tint = Color.White, modifier = Modifier.clip(CircleShape).clickable { app.pop() }.padding(8.dp))
            }
            Spacer(Modifier.weight(1f))
            s.str("text")?.takeIf { it.isNotEmpty() }?.let { Text(it, color = Color.White, fontSize = 17.sp, modifier = Modifier.padding(12.dp)) }
            if (author == me) Text("👁 ${s.strings("views").size - 1}   ❤️ ${s.strings("likes").size}", color = Color.White, modifier = Modifier.padding(12.dp))
            else Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Box(Modifier.weight(1f).height(48.dp).clip(RoundedCornerShape(24.dp)).border(1.dp, Color.White.copy(alpha = 0.5f), RoundedCornerShape(24.dp)).padding(horizontal = 16.dp), contentAlignment = Alignment.CenterStart) {
                    if (reply.isEmpty()) Text(tr("Reply…"), color = Color.White.copy(alpha = 0.6f))
                    BasicTextField(reply, { reply = it }, textStyle = TextStyle(color = Color.White, fontSize = 16.sp), cursorBrush = SolidColor(Color.White), modifier = Modifier.fillMaxWidth())
                }
                val liked = me in s.strings("likes")
                Icon(if (liked) Icons.Rounded.Favorite else Icons.Rounded.FavoriteBorder, null, tint = if (liked) Color(0xFFFF375F) else Color.White, modifier = Modifier.size(44.dp).clip(CircleShape).clickable {
                    me ?: return@clickable
                    app.kosmo.commit(jobj("col" to "stories", "id" to sid, "op" to "put", "set" to jobj("likes" to (if (liked) s.strings("likes") - me else s.strings("likes") + me))))
                }.padding(8.dp))
                if (reply.isNotBlank()) Icon(Icons.AutoMirrored.Rounded.Send, tr("Send"), tint = Color.White, modifier = Modifier.size(44.dp).clip(CircleShape).clickable {
                    me ?: return@clickable
                    app.kosmo.sendMessage(app.kosmo.dmId(me, author), listOf(me, author), jobj("kind" to "text", "text" to reply.trim()))
                    reply = ""; app.toast = "Message sent"
                }.padding(8.dp))
            }
        }
    }
}

/** Поиск: чаты и люди, сообщения, медиа — как на сайте. */
@Composable
fun SearchScreen(app: AppState, data: Data) {
    val look = LocalLook.current
    var q by remember { mutableStateOf("") }
    var tab by remember { mutableStateOf("chats") }
    val me = data.me
    Column(Modifier.fillMaxSize()) {
        Header { SearchField(q, "Search", Modifier.weight(1f)) { q = it } }
        Segs(listOf("chats" to "Chats", "messages" to "Messages", "media" to "Media"), tab, Modifier.fillMaxWidth().padding(horizontal = 16.dp)) { tab = it }
        val s = q.trim().removePrefix("@").lowercase()
        when (tab) {
            "chats" -> {
                val people = remember(s, data.accounts) {
                    if (s.isEmpty()) emptyList() else data.accounts.values.filter { u ->
                        u.str("id") != me && ((u.str("username") ?: "").startsWith(s) || (u.str("name") ?: "").lowercase().split(Regex("\\s+")).any { it.startsWith(s) } || u.num("publicId")?.toString() == s)
                    }.sortedByDescending { it.bool("official") }.take(40)
                }
                val rooms = remember(s, data.chats) { if (s.isEmpty()) emptyList() else data.chats.values.filter { isRoom(it) && ((it.str("name") ?: "").lowercase().contains(s) || (it.str("username") ?: "").startsWith(s)) } }
                LazyColumn(contentPadding = PaddingValues(top = 8.dp, bottom = 110.dp)) {
                    item { SectionLabel("Chats") }
                    if (s.isEmpty() || "kosmo official".contains(s)) item {
                        ResultRow({ KosmoAvatar(48.dp) }, "Kosmo", tr("official account"), verified = true) { app.push(Screen.KosmoChat) }
                    }
                    items(rooms, key = { "r" + it.str("id") }) { c ->
                        ResultRow({ ChatAvatar(data, c, 48.dp) }, c.str("name") ?: "", tr("${c.strings("members").size} ${if (isChannel(c)) "subscribers" else "members"}") + (c.str("username")?.takeIf { it.isNotEmpty() }?.let { " · @$it" } ?: "")) { app.openChat(c.str("id")!!) }
                    }
                    if (people.isNotEmpty()) item { SectionLabel("People") }
                    items(people, key = { "p" + it.str("id") }) { u ->
                        ResultRow({ UserAvatar(u, 48.dp) }, u.str("name") ?: "", listOfNotNull(u.str("username")?.takeIf { it.isNotEmpty() }?.let { "@$it" }, "ID ${u.num("publicId") ?: ""}").joinToString(" · "), verified = u.bool("official")) { app.openDm(u.str("id")!!) }
                    }
                    if (s.isNotEmpty() && people.isEmpty() && rooms.isEmpty()) item { Text(tr("Nobody found"), color = look.text2, modifier = Modifier.padding(20.dp)) }
                }
            }
            "messages" -> {
                val hits = remember(s, data.chats) {
                    if (s.length < 2) emptyList() else data.chatList().flatMap { c -> data.visibleMessages(c).filter { (it.str("text") ?: it.str("caption") ?: "").lowercase().contains(s) }.map { c to it } }
                        .sortedByDescending { it.second.num("at") ?: 0 }.take(100)
                }
                LazyColumn(contentPadding = PaddingValues(top = 8.dp, bottom = 110.dp)) {
                    if (s.length < 2) item { Text(tr("Type at least 2 letters"), color = look.text2, modifier = Modifier.padding(20.dp)) }
                    items(hits, key = { it.second.str("id") ?: "" }) { (c, m) ->
                        ResultRow({ ChatAvatar(data, c, 48.dp) }, data.chatTitle(c), (m.str("text") ?: m.str("caption") ?: "")) { app.push(Screen.Chat(c.str("id")!!, data.otherOf(c)?.str("id"), focus = m.str("id"))) }
                    }
                }
            }
            else -> {
                val media = remember(data.chats) { data.chatList().flatMap { c -> data.visibleMessages(c).filter { it.str("kind") == "photo" && !it.bool("viewOnce") && it.str("media") != null } }.sortedByDescending { it.num("at") ?: 0 } }
                LazyVerticalGrid(GridCells.Fixed(3), contentPadding = PaddingValues(start = 12.dp, end = 12.dp, top = 12.dp, bottom = 110.dp), horizontalArrangement = Arrangement.spacedBy(3.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                    items(media.size) { k ->
                        val id = media[k].str("media") ?: ""
                        AsyncImage(LocalMedia.current(id), null, contentScale = ContentScale.Crop, modifier = Modifier.aspectRatio(1f).clip(RoundedCornerShape(8.dp)).background(look.cell).clickable { app.push(Screen.Photo(id)) })
                    }
                }
            }
        }
    }
}

@Composable
private fun ResultRow(avatar: @Composable () -> Unit, title: String, sub: String, verified: Boolean = false, onClick: () -> Unit) {
    val look = LocalLook.current
    Row(Modifier.fillMaxWidth().clickable(onClick = onClick).padding(horizontal = 16.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        avatar()
        Column(Modifier.padding(start = 12.dp).weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(title, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                if (verified) VerifiedBadge(Modifier.padding(start = 4.dp), 16)
            }
            Text(sub, color = look.text2, fontSize = 14.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }
}

@Suppress("unused") private val keep = Icons.Rounded.AddPhotoAlternate
