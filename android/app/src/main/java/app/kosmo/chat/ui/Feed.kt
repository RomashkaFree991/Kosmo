package app.kosmo.chat.ui

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.Send
import androidx.compose.material.icons.outlined.ChatBubbleOutline
import androidx.compose.material.icons.rounded.AddPhotoAlternate
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material.icons.rounded.Visibility
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
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

private fun ago(at: Long?): String {
    at ?: return ""
    val m = (System.currentTimeMillis() - at) / 60000
    return when { m < 1 -> "just now"; m < 60 -> "$m min ago"; m < 24 * 60 -> "${m / 60} h ago"; else -> listTime(at) }
}

/** Лента: посты всех, свой пост — текст и фото. */
@Composable
fun FeedScreen(app: AppState, data: Data) {
    var text by remember { mutableStateOf("") }
    var photo by remember { mutableStateOf<Uri?>(null) }
    var busy by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val ctx = LocalContext.current
    val pick = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { photo = it }
    LazyColumn(Modifier.fillMaxSize().statusBarsPadding(), contentPadding = PaddingValues(12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item("title") { Text("Feed", style = MaterialTheme.typography.headlineMedium, modifier = Modifier.padding(start = 6.dp, top = 6.dp, bottom = 4.dp)) }
        item("compose") {
            Surface(shape = RoundedCornerShape(24.dp), color = MaterialTheme.colorScheme.surfaceContainer) {
                Column(Modifier.padding(12.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        UserAvatar(data.user, 40.dp)
                        TextField(
                            text, { text = it.take(4000) }, placeholder = { Text("What’s new?") }, modifier = Modifier.weight(1f), maxLines = 6,
                            colors = TextFieldDefaults.colors(focusedContainerColor = Color.Transparent, unfocusedContainerColor = Color.Transparent, focusedIndicatorColor = Color.Transparent, unfocusedIndicatorColor = Color.Transparent),
                        )
                    }
                    photo?.let { p ->
                        Box(Modifier.padding(top = 8.dp)) {
                            AsyncImage(p, null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxWidth().aspectRatio(4f / 3f).clip(RoundedCornerShape(18.dp)))
                            IconButton({ photo = null }, Modifier.align(Alignment.TopEnd)) { Icon(Icons.Rounded.Close, "Remove", tint = Color.White) }
                        }
                    }
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        IconButton({ pick.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) }) { Icon(Icons.Rounded.AddPhotoAlternate, "Photo") }
                        Spacer(Modifier.weight(1f))
                        FilledIconButton(
                            enabled = !busy && (text.isNotBlank() || photo != null),
                            onClick = {
                                busy = true
                                scope.launch {
                                    try {
                                        val media = photo?.let { p ->
                                            val (f, w, h) = withContext(Dispatchers.IO) { compressPhoto(ctx, p) } ?: error("Could not read this photo")
                                            listOf(jobj("type" to "photo", "media" to app.api.upload(f, "image/jpeg"), "w" to w, "h" to h))
                                        } ?: emptyList()
                                        val me = data.me!!
                                        app.kosmo.commit(jobj("col" to "feed", "id" to app.kosmo.newId(), "op" to "put", "set" to jobj(
                                            "author" to me, "text" to text.trim(), "media" to media, "code" to null, "views" to listOf(me), "at" to System.currentTimeMillis(),
                                            "reactions" to emptyMap<String, Any>(), "comments" to emptyList<Any>(), "forwards" to 0,
                                        )))
                                        text = ""; photo = null
                                    } catch (e: Exception) { app.toast = e.message ?: "Could not publish" }
                                    busy = false
                                }
                            },
                        ) { Icon(Icons.AutoMirrored.Rounded.Send, "Publish") }
                    }
                }
            }
        }
        if (data.feed.isEmpty()) item("empty") { Text("No posts yet — be the first", color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.fillMaxWidth().padding(32.dp)) }
        items(data.feed, key = { it.str("id") ?: "" }) { p -> PostCard(app, data, p) }
        item("pad") { Spacer(Modifier.height(24.dp)) }
    }
}

@Composable
private fun PostCard(app: AppState, data: Data, p: JsonObject) {
    val author = data.accounts[p.str("author")]
    val me = data.me
    Surface(shape = RoundedCornerShape(24.dp), color = MaterialTheme.colorScheme.surfaceContainer) {
        Column(Modifier.padding(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.clickable { p.str("author")?.let { if (it != me) app.push(Screen.User(it)) } }) {
                UserAvatar(author, 40.dp)
                Column(Modifier.padding(start = 10.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(author?.str("name") ?: "Deleted account", style = MaterialTheme.typography.titleSmall)
                        if (author?.bool("official") == true) VerifiedBadge(Modifier.padding(start = 4.dp), 16)
                    }
                    Text(ago(p.num("at")) + if (p.bool("edited")) " · edited" else "", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            p.str("text")?.takeIf { it.isNotEmpty() }?.let { Text(it, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.padding(top = 10.dp)) }
            p.arr("media").objects().firstOrNull()?.let { m ->
                val w = m.num("w")?.toFloat() ?: 4f
                val h = m.num("h")?.toFloat() ?: 3f
                AsyncImage(
                    LocalMedia.current(m.str("media") ?: ""), null, contentScale = ContentScale.Crop,
                    modifier = Modifier.padding(top = 10.dp).fillMaxWidth().aspectRatio((w / h).coerceIn(0.6f, 1.9f)).clip(RoundedCornerShape(18.dp))
                        .clickable { m.str("media")?.let { if (m.str("type") == "video") app.push(Screen.Video(it)) else app.push(Screen.Photo(it)) } },
                )
            }
            p.obj("code")?.let { c ->
                Text(c.str("text") ?: "", fontFamily = androidx.compose.ui.text.font.FontFamily.Monospace, fontSize = 13.sp, maxLines = 12, overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.padding(top = 10.dp).fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(MaterialTheme.colorScheme.surfaceContainerHighest).padding(12.dp))
            }
            // реакции: касание — своя реакция (одна на человека)
            val reactions = p.obj("reactions") ?: JsonObject(emptyMap())
            Row(Modifier.padding(top = 10.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                listOf("heart", "fire", "laugh", "like").forEach { key ->
                    val who = (reactions[key] as? JsonArray)?.mapNotNull { (it as? JsonPrimitive)?.content }.orEmpty()
                    val mine = me in who
                    Text(
                        "${EMOJI[key]} ${if (who.isNotEmpty()) who.size else ""}".trim(),
                        modifier = Modifier.clip(CircleShape).background(if (mine) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceContainerHighest)
                            .clickable {
                                me ?: return@clickable
                                val next = reactions.mapValues { (_, v) -> JsonArray((v as? JsonArray)?.filter { (it as? JsonPrimitive)?.content != me }.orEmpty()) }.toMutableMap()
                                if (!mine) next[key] = JsonArray(((next[key] as? JsonArray)?.toList().orEmpty()) + JsonPrimitive(me))
                                app.kosmo.commit(jobj("col" to "feed", "id" to p.str("id"), "op" to "put", "set" to jobj("reactions" to JsonObject(next.filterValues { (it as JsonArray).isNotEmpty() }))))
                            }.padding(horizontal = 10.dp, vertical = 5.dp),
                    )
                }
                Spacer(Modifier.weight(1f))
                Icon(Icons.Outlined.ChatBubbleOutline, null, Modifier.size(16.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(" ${p.arr("comments").size}   ", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Icon(Icons.Rounded.Visibility, null, Modifier.size(16.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(" ${p.strings("views").size}", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
    // просмотр засчитывается один раз
    androidx.compose.runtime.LaunchedEffect(p.str("id")) {
        val my = me ?: return@LaunchedEffect
        if (my !in p.strings("views")) app.kosmo.commit(jobj("col" to "feed", "id" to p.str("id"), "op" to "put", "set" to jobj("views" to (p.strings("views") + my))))
    }
}

/** Поиск людей по имени, @username или ID. */
@Composable
fun SearchScreen(app: AppState, data: Data) {
    var q by remember { mutableStateOf("") }
    val me = data.me
    val found = remember(q, data.accounts) {
        val s = q.trim().removePrefix("@").lowercase()
        if (s.isEmpty()) emptyList() else data.accounts.values.filter { u ->
            u.str("id") != me && (
                (u.str("username") ?: "").startsWith(s) ||
                    (u.str("name") ?: "").lowercase().split(Regex("\\s+")).any { it.startsWith(s) } ||
                    u.num("publicId")?.toString() == s
                )
        }.take(50)
    }
    Column(Modifier.fillMaxSize().statusBarsPadding().padding(12.dp)) {
        TextField(
            q, { q = it }, singleLine = true, placeholder = { Text("Name, @username or ID") },
            leadingIcon = { Icon(Icons.Rounded.Search, null) },
            shape = RoundedCornerShape(26.dp), modifier = Modifier.fillMaxWidth(),
            colors = TextFieldDefaults.colors(focusedIndicatorColor = Color.Transparent, unfocusedIndicatorColor = Color.Transparent),
        )
        Spacer(Modifier.height(8.dp))
        if (q.isBlank()) {
            Column(Modifier.fillMaxWidth().padding(top = 60.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                PlanetLogo(Modifier.size(110.dp))
                Text("Find people to chat with", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 8.dp))
                Text("Type a name, @username or ID", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        LazyColumn {
            items(found, key = { it.str("id") ?: "" }) { u ->
                Row(Modifier.fillMaxWidth().clip20().clickable { app.openDm(u.str("id")!!) }.padding(10.dp), verticalAlignment = Alignment.CenterVertically) {
                    UserAvatar(u, 48.dp)
                    Column(Modifier.padding(start = 12.dp).weight(1f)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(u.str("name") ?: "", style = MaterialTheme.typography.titleMedium)
                            if (u.bool("official")) VerifiedBadge(Modifier.padding(start = 4.dp), 16)
                        }
                        Text(listOfNotNull(u.str("username")?.takeIf { it.isNotEmpty() }?.let { "@$it" }, "ID ${u.num("publicId") ?: ""}").joinToString(" · "), color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
                    }
                }
            }
            if (q.isNotBlank() && found.isEmpty()) item { Text("Nobody found", color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(20.dp)) }
        }
    }
}

