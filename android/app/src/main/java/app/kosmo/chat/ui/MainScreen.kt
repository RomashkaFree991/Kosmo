package app.kosmo.chat.ui

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.spring
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.Chat
import androidx.compose.material.icons.automirrored.rounded.Chat
import androidx.compose.material.icons.outlined.ChatBubbleOutline
import androidx.compose.material.icons.outlined.Newspaper
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Archive
import androidx.compose.material.icons.rounded.Campaign
import androidx.compose.material.icons.rounded.ChatBubble
import androidx.compose.material.icons.rounded.CleaningServices
import androidx.compose.material.icons.rounded.Delete
import androidx.compose.material.icons.rounded.Done
import androidx.compose.material.icons.rounded.DoneAll
import androidx.compose.material.icons.rounded.Group
import androidx.compose.material.icons.rounded.MarkChatRead
import androidx.compose.material.icons.rounded.Newspaper
import androidx.compose.material.icons.rounded.NotificationsOff
import androidx.compose.material.icons.rounded.PushPin
import androidx.compose.material.icons.rounded.Schedule
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material.icons.rounded.Unarchive
import androidx.compose.material.icons.rounded.VolumeOff
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.kosmo.chat.core.Data
import app.kosmo.chat.core.bool
import app.kosmo.chat.core.num
import app.kosmo.chat.core.obj
import app.kosmo.chat.core.str
import app.kosmo.chat.core.strings
import kotlinx.serialization.json.JsonObject

@Composable
fun KosmoRoot(app: AppState) {
    val snack = remember { SnackbarHostState() }
    LaunchedEffect(app.toast) { app.toast?.let { snack.showSnackbar(tr(it)); app.toast = null } }
    val look = LocalLook.current
    Box(Modifier.fillMaxSize().background(look.page)) {
        AnimatedContent(
            when { app.token == null -> 0; app.locked -> 1; else -> 2 },
            transitionSpec = { fadeIn() togetherWith fadeOut() }, label = "root",
        ) { s ->
            when (s) {
                0 -> AuthScreen(app)
                1 -> LockScreen(app)
                else -> Main(app)
            }
        }
        if (app.token != null) CallOverlay(app)
        SnackbarHost(snack, Modifier.align(Alignment.BottomCenter).padding(bottom = 100.dp))
    }
}

@Composable
private fun Main(app: AppState) {
    val data by app.kosmo.data.collectAsState()
    BackHandler(app.stack.isNotEmpty()) { app.pop() }
    BackHandler(app.stack.isEmpty() && app.tab != Tab.Chats) { app.tab = Tab.Chats }
    val top = app.stack.lastOrNull()
    AnimatedContent(
        targetState = top,
        transitionSpec = {
            val spec = spring<androidx.compose.ui.unit.IntOffset>(dampingRatio = 0.9f, stiffness = 500f)
            if (app.lastNavForward) slideInHorizontally(spec) { it } togetherWith slideOutHorizontally(spec) { -it / 4 } + fadeOut()
            else slideInHorizontally(spec) { -it / 4 } + fadeIn() togetherWith slideOutHorizontally(spec) { it }
        },
        label = "stack",
    ) { screen ->
        when (screen) {
            null -> Tabs(app, data)
            is Screen.Chat -> ChatScreen(app, screen.id, screen.other, screen.focus)
            is Screen.User -> UserScreen(app, screen.id)
            Screen.EditProfile -> EditProfileScreen(app)
            is Screen.Photo -> PhotoViewer(app, screen.media)
            is Screen.Video -> VideoViewer(app, screen.media)
            Screen.KosmoChat -> KosmoChatScreen(app)
            Screen.Sessions -> SessionsScreen(app)
            is Screen.Settings -> SettingsScreen(app, screen.page)
            is Screen.NewRoom -> NewRoomScreen(app, screen.type)
            is Screen.RoomInfo -> RoomInfoScreen(app, screen.id)
            Screen.Archive -> ArchiveScreen(app)
            is Screen.Post -> PostScreen(app, screen.id)
            Screen.NewPost -> NewPostScreen(app)
            is Screen.Stories -> StoryViewer(app, screen.author)
            is Screen.Forward -> ForwardScreen(app, screen.chatId, screen.msgId, screen.postId)
            Screen.Round -> RoundRecorder(app)
        }
    }
}

@Composable
private fun Tabs(app: AppState, data: Data) {
    val unread = remember(data) { data.chatList().sumOf { if (data.muted(it)) 0 else data.unread(it) } }
    Box(Modifier.fillMaxSize()) {
        MaterialWallpaper(Modifier.fillMaxSize())
        when (app.tab) {
            Tab.Chats -> ChatListScreen(app, data)
            Tab.Feed -> FeedScreen(app, data)
            Tab.Search -> SearchScreen(app, data)
            Tab.Profile -> ProfileScreen(app, data)
        }
        TabBar(
            listOf(
                TabItem("Chats", Icons.Outlined.ChatBubbleOutline, Icons.Rounded.ChatBubble, unread),
                TabItem("Feed", Icons.Outlined.Newspaper, Icons.Rounded.Newspaper),
                TabItem("Search", Icons.Outlined.Search, Icons.Rounded.Search),
                TabItem("Profile", Icons.Outlined.Search, Icons.Rounded.Search, custom = { on ->
                    Box(Modifier.size(26.dp).then(if (on) Modifier.clip(CircleShape).background(LocalLook.current.accent).padding(1.5.dp) else Modifier)) { UserAvatar(data.user, if (on) 23.dp else 26.dp) }
                }),
            ),
            app.tab.ordinal,
            Modifier.align(Alignment.BottomCenter).navigationBarsPadding().padding(start = 14.dp, end = 14.dp, bottom = 14.dp),
        ) { app.tab = Tab.entries[it] }
    }
}

private val FOLDERS = listOf("all" to "All", "personal" to "Personal", "groups" to "Groups", "channels" to "Channels", "unread" to "Unread")

@Composable
fun ChatListScreen(app: AppState, data: Data) {
    val look = LocalLook.current
    val all = remember(data) { data.chatList() }
    val archived = remember(data) { data.chatList(archived = true) }
    val notes = remember(data.user) { data.kosmoNotes() }
    val online by app.kosmo.online.collectAsState()
    var folder by remember { mutableStateOf("all") }
    var newMenu by remember { mutableStateOf(false) }
    val list = remember(all, folder) {
        all.filter { c ->
            when (folder) {
                "personal" -> !isRoom(c)
                "groups" -> c.str("type") == "group"
                "channels" -> isChannel(c)
                "unread" -> data.unread(c) > 0
                else -> true
            }
        }
    }
    Column(Modifier.fillMaxSize()) {
        Header {
            Box {
                CircleBtn(Icons.Rounded.Add, "New") { newMenu = true }
                KosmoMenu(newMenu, { newMenu = false }, listOf(
                    MenuItem(Icons.AutoMirrored.Outlined.Chat, "New chat") { app.tab = Tab.Search },
                    MenuItem(Icons.Rounded.Group, "New group") { app.push(Screen.NewRoom("group")) },
                    MenuItem(Icons.Rounded.Campaign, "New channel") { app.push(Screen.NewRoom("channel")) },
                ))
            }
            TitlePill(if (online || !data.loaded) "Chats" else "Connecting…")
            CircleBtn(Icons.Rounded.Search, "Search") { app.tab = Tab.Search }
        }
        LazyRow(contentPadding = PaddingValues(horizontal = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(bottom = 6.dp)) {
            items(FOLDERS) { (id, label) ->
                val count = when (id) {
                    "personal" -> all.count { !isRoom(it) && data.unread(it) > 0 }
                    "groups" -> all.count { it.str("type") == "group" && data.unread(it) > 0 }
                    "channels" -> all.count { isChannel(it) && data.unread(it) > 0 }
                    else -> 0
                }
                Chip(label, folder == id, count) { folder = id }
            }
        }
        if (list.isEmpty() && notes.isEmpty() && archived.isEmpty()) {
            Column(Modifier.fillMaxSize().padding(32.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                PlanetLogo(Modifier.size(120.dp))
                Spacer(Modifier.height(12.dp))
                Text(tr("No chats yet"), style = MaterialTheme.typography.titleLarge)
                Text(tr("Find people by name, @username or ID"), color = look.text2, modifier = Modifier.padding(top = 6.dp))
            }
            return@Column
        }
        LazyColumn(contentPadding = PaddingValues(bottom = 110.dp)) {
            if (archived.isNotEmpty() && folder == "all") item("archive") {
                ChatRow(app, data, null, avatar = {
                    Box(Modifier.size(56.dp).clip(CircleShape).background(look.ink.copy(alpha = 0.1f)), contentAlignment = Alignment.Center) { Icon(Icons.Rounded.Archive, null, tint = look.text2) }
                }, title = tr("Archived chats"), preview = archived.joinToString(", ") { data.chatTitle(it) }, time = "", unread = archived.sumOf { data.unread(it) }, onClick = { app.push(Screen.Archive) })
            }
            if (notes.isNotEmpty() && folder in setOf("all", "personal")) item("kosmo") {
                ChatRow(app, data, null, avatar = { KosmoAvatar(56.dp) }, title = "Kosmo", verified = true, preview = tr(notes.last().title), time = listTime(notes.last().at), unread = 0) { app.push(Screen.KosmoChat) }
            }
            items(list, key = { it.str("id") ?: "" }) { c -> ChatListItem(app, data, c) }
        }
    }
}

@Composable
fun ChatListItem(app: AppState, data: Data, c: JsonObject) {
    val last = data.visibleMessages(c).lastOrNull()
    val me = data.me
    val mine = last?.takeIf { it.str("from") == me }?.let { m ->
        when {
            m.str("id") in data.pending -> TickState.Pending
            c.strings("members").any { it != me && (c.obj("read")?.num(it) ?: 0) >= (m.num("at") ?: 0) } -> TickState.Read
            else -> TickState.Sent
        }
    }
    val who = if (isRoom(c) && last != null && last.str("from") != me && last.str("kind") != "join") (firstName(data.accounts[last.str("from")]?.str("name")) + ": ") else if (isRoom(c) && last?.str("from") == me) tr("You") + ": " else ""
    ChatRow(
        app, data, c,
        avatar = { ChatAvatar(data, c, 56.dp) },
        title = data.chatTitle(c).let { if (isSaved(c)) tr(it) else it },
        preview = if (last == null) tr(if (isChannel(c)) "Channel" else "No messages yet") else who + tr(data.previewText(last)),
        time = listTime(last?.num("at") ?: c.num("createdAt")),
        unread = data.unread(c), mine = mine,
        pinned = data.pref(c.str("id"))?.bool("pinned") == true,
        muted = data.muted(c),
        verified = data.otherOf(c)?.bool("official") == true && !isRoom(c),
    ) { app.openChat(c.str("id")!!, data.otherOf(c)?.str("id")) }
}

enum class TickState { Pending, Sent, Read }

@Composable
fun Ticks(state: TickState, modifier: Modifier = Modifier, tint: Color = LocalLook.current.accent) {
    val icon = when (state) { TickState.Pending -> Icons.Rounded.Schedule; TickState.Sent -> Icons.Rounded.Done; TickState.Read -> Icons.Rounded.DoneAll }
    Icon(icon, null, tint = tint, modifier = modifier.size(16.dp))
}

/** Строка чата как на сайте; долгое нажатие — меню чата. */
@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun ChatRow(
    app: AppState, data: Data, c: JsonObject?,
    avatar: @Composable () -> Unit, title: String, preview: String, time: String, unread: Int, mine: TickState? = null,
    pinned: Boolean = false, muted: Boolean = false, verified: Boolean = false, onClick: () -> Unit,
) {
    val look = LocalLook.current
    var menu by remember { mutableStateOf(false) }
    Box {
        Row(
            Modifier.fillMaxWidth().combinedClickable(onClick = onClick, onLongClick = { if (c != null) menu = true }).padding(horizontal = 16.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            avatar()
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(title, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false))
                    if (verified) VerifiedBadge(Modifier.padding(start = 4.dp), 16)
                    if (muted) Icon(Icons.Rounded.VolumeOff, null, tint = look.text3, modifier = Modifier.padding(start = 4.dp).size(14.dp))
                    Spacer(Modifier.weight(1f))
                    if (mine != null) Ticks(mine, Modifier.padding(end = 4.dp))
                    Text(time, fontSize = 13.sp, color = look.text2)
                }
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 2.dp)) {
                    Text(preview, fontSize = 15.sp, color = look.text2, maxLines = 2, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                    if (unread > 0) Box(Modifier.padding(start = 8.dp).size(width = maxOf(22, 10 + 7 * "$unread".length).dp, height = 22.dp).clip(CircleShape).background(if (muted) look.text3 else look.accent), contentAlignment = Alignment.Center) {
                        Text("$unread", color = look.onAccent, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    } else if (pinned) Icon(Icons.Rounded.PushPin, null, tint = look.text3, modifier = Modifier.padding(start = 8.dp).size(16.dp))
                }
                HorizontalDivider(Modifier.padding(top = 10.dp), thickness = 0.5.dp, color = look.ink.copy(alpha = 0.1f))
            }
        }
        if (c != null) {
            val id = c.str("id") ?: ""
            val p = data.pref(id)
            KosmoMenu(menu, { menu = false }, listOfNotNull(
                MenuItem(Icons.Rounded.PushPin, if (p?.bool("pinned") == true) "Unpin" else "Pin") { app.setPref(id, "pinned", if (p?.bool("pinned") == true) null else true) },
                MenuItem(Icons.Rounded.NotificationsOff, if (data.muted(c)) "Unmute notifications" else "Mute notifications") { app.setPref(id, "muted", if (data.muted(c)) null else true) },
                MenuItem(if (p?.bool("archived") == true) Icons.Rounded.Unarchive else Icons.Rounded.Archive, if (p?.bool("archived") == true) "Unarchive" else "Archive") { app.setPref(id, "archived", if (p?.bool("archived") == true) null else true) },
                if (unread > 0) MenuItem(Icons.Rounded.MarkChatRead, "Mark as read") { app.kosmo.markRead(id) } else null,
                MenuItem(Icons.Rounded.CleaningServices, "Clear history") { app.setPref(id, "clearedAt", System.currentTimeMillis()) },
                MenuItem(Icons.Rounded.Delete, if (isRoom(c) && c.str("owner") != data.me) "Leave" else "Delete chat", danger = true) { app.deleteChat(id) },
            ), offset = androidx.compose.ui.unit.DpOffset(80.dp, (-20).dp))
        }
    }
}

/** Архив: те же строки, свайп меню — «Вернуть». */
@Composable
fun ArchiveScreen(app: AppState) {
    val data by app.kosmo.data.collectAsState()
    val list = remember(data) { data.chatList(archived = true) }
    Column(Modifier.fillMaxSize().background(LocalLook.current.page)) {
        Header { BackBtn(app); TitlePill("Archived chats"); CircleSpacer() }
        LazyColumn(contentPadding = PaddingValues(bottom = 40.dp)) {
            items(list, key = { it.str("id") ?: "" }) { c -> ChatListItem(app, data, c) }
        }
    }
}
