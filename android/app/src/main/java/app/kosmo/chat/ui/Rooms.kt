package app.kosmo.chat.ui

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ExitToApp
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.CheckCircle
import androidx.compose.material.icons.rounded.ContentCopy
import androidx.compose.material.icons.rounded.Delete
import androidx.compose.material.icons.rounded.PersonAdd
import androidx.compose.material.icons.rounded.PhotoCamera
import androidx.compose.material.icons.rounded.RadioButtonUnchecked
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
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
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.kosmo.chat.BuildConfig
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
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.JsonObject

/** Новая группа или канал: аватар, название, @username (публичный), описание, участники. */
@Composable
fun NewRoomScreen(app: AppState, type: String) {
    val data by app.kosmo.data.collectAsState()
    val look = LocalLook.current
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var name by remember { mutableStateOf("") }
    var username by remember { mutableStateOf("") }
    var bio by remember { mutableStateOf("") }
    var photo by remember { mutableStateOf<Uri?>(null) }
    var free by remember { mutableStateOf<Boolean?>(null) }
    var busy by remember { mutableStateOf(false) }
    val picked = remember { mutableStateListOf<String>() }
    val channel = type == "channel"
    val pick = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { photo = it }
    LaunchedEffect(username) {
        free = null
        if (!Regex("^(?=.*[a-z])[a-z0-9]{3,32}$").matches(username)) return@LaunchedEffect
        delay(350)
        free = runCatching { app.auth.usernameFree(username) }.getOrNull()
    }
    // кого можно добавить: люди из моих личных чатов
    val people = remember(data) {
        data.chatList().filter { !isRoom(it) && !isSaved(it) }.mapNotNull { data.otherOf(it) }.distinctBy { it.str("id") }
    }
    val okUser = username.isEmpty() || (Regex("^(?=.*[a-z])[a-z0-9]{3,32}$").matches(username) && free != false)
    Column(Modifier.fillMaxSize()) {
        Header {
            BackBtn(app)
            TitlePill(if (channel) "New channel" else "New group")
            CircleBtn(Icons.Rounded.Check, "Create", accent = true, enabled = name.isNotBlank() && okUser && !busy) {
                busy = true
                scope.launch {
                    try {
                        val avatarId = photo?.let { p -> withContext(Dispatchers.IO) { compressPhoto(ctx, p, 640) }?.let { (f, _, _) -> app.api.upload(f, "image/jpeg") } }
                        val me = data.me!!
                        val id = "${type}_${app.kosmo.newId()}"
                        val now = System.currentTimeMillis()
                        app.kosmo.commit(jobj("col" to "chats", "id" to id, "op" to "put", "set" to jobj(
                            "type" to type, "name" to name.trim(), "username" to username, "bio" to bio.trim(),
                            "avatar" to jobj("color" to null, "text" to "", "photo" to avatarId), "owner" to me, "admins" to emptyList<String>(),
                            "members" to listOf(me) + picked, "read" to mapOf(me to now), "createdAt" to now,
                            "settings" to jobj("invite" to true, "media" to true, "reactions" to true),
                        )))
                        app.toast = if (channel) "Channel created" else "Group created"
                        app.pop()
                        app.openChat(id)
                    } catch (e: Exception) { app.toast = e.message; busy = false }
                }
            }
        }
        LazyColumn(contentPadding = PaddingValues(bottom = 40.dp)) {
            item {
                Column(Modifier.fillMaxWidth().padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(Modifier.size(96.dp).clip(if (channel) RoundedCornerShape(28.dp) else CircleShape).background(look.accent.copy(alpha = 0.2f)).clickable { pick.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) }, contentAlignment = Alignment.Center) {
                        if (photo != null) AsyncImage(photo, null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
                        else Icon(Icons.Rounded.PhotoCamera, null, tint = look.accent, modifier = Modifier.size(36.dp))
                    }
                    Spacer(Modifier.height(16.dp))
                    OutlinedTextField(name, { name = it.take(64) }, Modifier.fillMaxWidth(), placeholder = { Text(tr(if (channel) "Channel name" else "Group name")) }, singleLine = true)
                    Spacer(Modifier.height(8.dp))
                    OutlinedTextField(
                        username, { username = it.lowercase().filter { c -> c in 'a'..'z' || c in '0'..'9' }.take(32) }, Modifier.fillMaxWidth(), singleLine = true,
                        prefix = { Text("@") }, placeholder = { Text(tr("username (optional)")) }, isError = !okUser,
                        supportingText = { Text(tr(when { username.isEmpty() -> "With a @username anyone can find and join it"; free == true -> "@$username is available"; free == false -> "@$username is taken"; username.length < 3 -> "At least 3 characters"; else -> "Checking…" })) },
                    )
                    OutlinedTextField(bio, { bio = it.take(255) }, Modifier.fillMaxWidth(), placeholder = { Text(tr("Description (optional)")) })
                }
            }
            if (people.isNotEmpty()) item { SectionLabel(if (channel) "Add subscribers" else "Add members") }
            items(people, key = { it.str("id") ?: "" }) { u ->
                val id = u.str("id") ?: ""
                val on = id in picked
                Row(Modifier.fillMaxWidth().clickable { if (on) picked.remove(id) else picked.add(id) }.padding(horizontal = 16.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                    UserAvatar(u, 44.dp)
                    Text(u.str("name") ?: "", Modifier.weight(1f).padding(start = 12.dp), fontSize = 16.sp)
                    Icon(if (on) Icons.Rounded.CheckCircle else Icons.Rounded.RadioButtonUnchecked, null, tint = if (on) look.accent else look.text3)
                }
            }
        }
    }
}

/** Информация о группе / канале: участники, ссылка, добавить, выйти / удалить. */
@Composable
fun RoomInfoScreen(app: AppState, id: String) {
    val data by app.kosmo.data.collectAsState()
    val look = LocalLook.current
    val c = data.chats[id]
    val clip = LocalClipboardManager.current
    var adding by remember { mutableStateOf(false) }
    if (c == null) { LaunchedEffect(Unit) { app.pop() }; return }
    val me = data.me
    val owner = c.str("owner") == me
    val admin = owner || me in c.strings("admins")
    val channel = isChannel(c)
    val members = c.strings("members")
    Column(Modifier.fillMaxSize()) {
        Header { BackBtn(app); TitlePill(if (channel) "Channel info" else "Group info"); CircleSpacer() }
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).navigationBarsPadding().padding(bottom = 32.dp)) {
            Column(Modifier.fillMaxWidth().padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                ChatAvatar(data, c, 110.dp)
                Text(c.str("name") ?: "", style = MaterialTheme.typography.headlineMedium, modifier = Modifier.padding(top = 12.dp), textAlign = TextAlign.Center)
                Text(tr("${members.size} ${if (channel) "subscribers" else "members"}"), color = look.text2)
                c.str("bio")?.takeIf { it.isNotEmpty() }?.let { Text(it, modifier = Modifier.padding(top = 10.dp), textAlign = TextAlign.Center) }
            }
            Group {
                c.str("username")?.takeIf { it.isNotEmpty() }?.let { u ->
                    GroupRow(Icons.Rounded.ContentCopy, "@$u", value = tr("Copy link"), chevron = false) {
                        clip.setText(AnnotatedString("${BuildConfig.KOSMO_URL}/@$u")); app.toast = "Copied"
                    }
                }
                if (admin || (!channel && c.obj("settings")?.get("invite")?.toString() != "false")) GroupRow(Icons.Rounded.PersonAdd, if (channel) "Add subscribers" else "Add members") { adding = true }
            }
            SectionLabel(tr(if (channel) "Subscribers" else "Members") + " · ${members.size}")
            Group {
                members.mapNotNull { data.accounts[it] }.sortedByDescending { if (it.str("id") == c.str("owner")) 2 else if (it.str("id") in c.strings("admins")) 1 else 0 }.forEach { u ->
                    val uid = u.str("id") ?: ""
                    Row(Modifier.fillMaxWidth().clickable { if (uid != me) app.push(Screen.User(uid)) }.padding(horizontal = 14.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                        UserAvatar(u, 40.dp)
                        Column(Modifier.weight(1f).padding(start = 12.dp)) {
                            Text(u.str("name") ?: "", fontSize = 16.sp)
                            Text(lastSeen(u), fontSize = 13.sp, color = look.text2)
                        }
                        val role = if (uid == c.str("owner")) "Owner" else if (uid in c.strings("admins")) "Admin" else null
                        if (role != null) Text(tr(role), color = look.accent, fontSize = 13.sp)
                        else if (admin && uid != me) Text(tr("Remove"), color = MaterialTheme.colorScheme.error, fontSize = 13.sp, modifier = Modifier.clickable {
                            app.kosmo.commit(jobj("col" to "chats", "id" to id, "op" to "put", "set" to jobj("members" to (members - uid))))
                        }.padding(6.dp))
                    }
                }
            }
            Spacer(Modifier.height(16.dp))
            Group {
                if (owner) GroupRow(Icons.Rounded.Delete, if (channel) "Delete channel" else "Delete group", danger = true) { app.deleteChat(id); app.pop() }
                else GroupRow(Icons.AutoMirrored.Rounded.ExitToApp, if (channel) "Leave channel" else "Leave group", danger = true) { app.deleteChat(id); app.pop() }
            }
        }
    }
    if (adding) {
        val people = data.chatList().filter { !isRoom(it) && !isSaved(it) }.mapNotNull { data.otherOf(it) }.filter { it.str("id") !in members }
        androidx.compose.material3.AlertDialog(
            onDismissRequest = { adding = false },
            title = { Text(tr(if (channel) "Add subscribers" else "Add members")) },
            text = {
                Column(Modifier.verticalScroll(rememberScrollState())) {
                    if (people.isEmpty()) Text(tr("Everyone you chat with is already here"))
                    people.forEach { u ->
                        Row(Modifier.fillMaxWidth().clickable {
                            app.kosmo.commit(jobj("col" to "chats", "id" to id, "op" to "put", "set" to jobj("members" to (members + (u.str("id") ?: "")))))
                            adding = false; app.toast = "Added"
                        }.padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                            UserAvatar(u, 36.dp); Text(u.str("name") ?: "", Modifier.padding(start = 10.dp))
                        }
                    }
                }
            },
            confirmButton = { androidx.compose.material3.TextButton({ adding = false }) { Text(tr("Close")) } },
        )
    }
}

/** Переслать сообщение или поделиться постом: выбор чата. */
@Composable
fun ForwardScreen(app: AppState, chatId: String?, msgId: String?, postId: String?) {
    val data by app.kosmo.data.collectAsState()
    val look = LocalLook.current
    var q by remember { mutableStateOf("") }
    val me = data.me ?: return
    val src = chatId?.let { data.chats[it] }?.arr("messages")?.objects()?.firstOrNull { it.str("id") == msgId }
    val targets = remember(data, q) {
        data.chatList().filter { c -> (!isChannel(c) || c.str("owner") == me || me in c.strings("admins")) && data.chatTitle(c).lowercase().contains(q.lowercase()) }
    }
    Column(Modifier.fillMaxSize()) {
        Header { BackBtn(app); TitlePill(if (postId != null) "Share post" else "Forward to"); CircleSpacer() }
        SearchField(q, "Search", Modifier.padding(horizontal = 16.dp).fillMaxWidth()) { q = it }
        LazyColumn(contentPadding = PaddingValues(vertical = 8.dp)) {
            items(targets, key = { it.str("id") ?: "" }) { c ->
                Row(Modifier.fillMaxWidth().clickable {
                    val to = c.str("id")!!
                    if (postId != null) {
                        app.kosmo.sendMessage(to, c.strings("members"), jobj("kind" to "post", "post" to postId))
                        data.feed.firstOrNull { it.str("id") == postId }?.let { p ->
                            app.kosmo.commit(jobj("col" to "feed", "id" to postId, "op" to "put", "set" to jobj("shareTo" to to, "forwards" to (p.num("forwards") ?: 0) + 1)))
                        }
                        app.toast = "Post shared"
                    } else if (src != null) {
                        val fields = listOf("kind", "text", "media", "w", "h", "duration", "wave", "lang", "caption", "emoji", "items", "name", "post", "sticker")
                        val copy = JsonObject(src.filterKeys { it in fields })
                        val author = src.obj("fwd") ?: jobj("from" to src.str("from"), "name" to data.accounts[src.str("from")]?.str("name"))
                        app.kosmo.sendMessage(to, c.strings("members"), JsonObject(copy + ("fwd" to author)))
                        app.toast = "Message forwarded"
                    }
                    app.pop()
                }.padding(horizontal = 16.dp, vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                    ChatAvatar(data, c, 48.dp)
                    Text(if (isSaved(c)) tr("Saved Messages") else data.chatTitle(c), Modifier.padding(start = 12.dp), fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
                }
            }
        }
    }
}

@Suppress("unused") private fun keep(o: JsonObject) = o.bool("x")
