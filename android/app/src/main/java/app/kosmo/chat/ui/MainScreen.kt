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
import androidx.compose.foundation.border
import dev.chrisbanes.haze.haze
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
import androidx.compose.foundation.layout.widthIn
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
        // панели сайта лежат поверх обоев страницы: те же обои под каждым экраном (чат рисует свои)
        val plain = screen != null && screen !is Screen.Chat && screen !is Screen.Photo && screen !is Screen.Video && screen !is Screen.Stories && screen != Screen.Round
        Box(Modifier.fillMaxSize().then(if (plain) Modifier.background(LocalLook.current.page) else Modifier)) {
        if (plain) Wallpaper(Modifier.fillMaxSize())
        when (screen) {
            null -> Tabs(app, data)
            is Screen.Chat -> ChatScreen(app, screen.id, screen.other, screen.focus)
            is Screen.User -> UserScreen(app, screen.id)
            Screen.EditProfile -> EditProfileScreen(app)
            is Screen.Photo -> PhotoViewer(app, screen.media)
            is Screen.Video -> VideoViewer(app, screen.media)
            Screen.KosmoChat -> KosmoChatScreen(app)
            Screen.Sessions -> SessionsScreen(app)
            Screen.ChangeEmail -> ChangeEmailScreen(app)
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
}

@Composable
private fun Tabs(app: AppState, data: Data) {
    val look = LocalLook.current
    val unread = remember(data) { data.chatList().sumOf { if (data.muted(it)) 0 else data.unread(it) } + data.kosmoUnread() }
    val haze = remember { dev.chrisbanes.haze.HazeState() }
    Box(Modifier.fillMaxSize()) {
        // контент — источник размытия для стеклянной панели и шапки
        Box(Modifier.fillMaxSize().then(if (look.glass) Modifier.haze(haze) else Modifier)) {
            Wallpaper(Modifier.fillMaxSize())
            // внутри размываемого слоя стекло без размытия (Haze не вкладывается)
            androidx.compose.runtime.CompositionLocalProvider(LocalHaze provides null) {
                when (app.tab) {
                    Tab.Chats -> ChatListScreen(app, data)
                    Tab.Feed -> FeedScreen(app, data)
                    Tab.Search -> SearchScreen(app, data)
                    Tab.Profile -> ProfileScreen(app, data)
                }
            }
        }
        androidx.compose.runtime.CompositionLocalProvider(LocalHaze provides haze) {
            TabBar(
                listOf(
                    TabItem("Chats", if (look.glass) PH.chatCircleDots else MS.chat, if (look.glass) PH.chatCircleDotsFill else MS.chatFill, unread),
                    TabItem("Feed", if (look.glass) PH.newspaper else MS.dynamicFeed, if (look.glass) PH.newspaperFill else MS.dynamicFeedFill),
                    TabItem("Search", if (look.glass) PH.magnifyingGlass else MS.search, if (look.glass) PH.magnifyingGlassFill else MS.searchFill),
                    TabItem("Profile", MS.search, MS.search, custom = { on ->
                        Box(Modifier.size(26.dp).then(if (on) Modifier.border(1.5.dp, LocalLook.current.accent, CircleShape).padding(2.dp) else Modifier)) { UserAvatar(data.user, if (on) 22.dp else 26.dp) }
                    }),
                ),
                app.tab.ordinal,
                Modifier.align(Alignment.BottomCenter).navigationBarsPadding().padding(start = 14.dp, end = 14.dp, bottom = 14.dp),
            ) { app.tab = Tab.entries[it] }
        }
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
                CircleBtn(WI.hdrPlus, "New") { newMenu = true }
                KosmoMenu(newMenu, { newMenu = false }, listOf(
                    MenuItem(Icons.AutoMirrored.Outlined.Chat, "New chat") { app.tab = Tab.Search },
                    MenuItem(Icons.Rounded.Group, "New group") { app.push(Screen.NewRoom("group")) },
                    MenuItem(Icons.Rounded.Campaign, "New channel") { app.push(Screen.NewRoom("channel")) },
                ))
            }
            TitlePill(if (online || !data.loaded) "Chats" else "Connecting…")
            CircleBtn(WI.hdrSearch, "Search") { app.tab = Tab.Search }
        }
        LazyRow(contentPadding = PaddingValues(horizontal = 14.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.padding(bottom = 8.dp)) {
            items(FOLDERS) { (id, label) ->
                val count = when (id) {
                    "personal" -> all.filter { !isRoom(it) }.sumOf { data.unread(it) } + data.kosmoUnread()
                    "groups" -> all.filter { it.str("type") == "group" }.sumOf { data.unread(it) }
                    "channels" -> all.filter { isChannel(it) }.sumOf { data.unread(it) }
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
        LazyColumn(contentPadding = PaddingValues(start = 8.dp, end = 8.dp, bottom = 110.dp)) {
            if (archived.isNotEmpty() && folder == "all") item("archive") {
                ChatRow(app, data, null, avatar = {
                    Box(Modifier.size(56.dp).clip(CircleShape).background(look.ink.copy(alpha = 0.1f)), contentAlignment = Alignment.Center) { Icon(Icons.Rounded.Archive, null, tint = look.text2) }
                }, title = tr("Archived chats"), preview = archived.joinToString(", ") { data.chatTitle(it) }, time = "", unread = archived.sumOf { data.unread(it) }, onClick = { app.push(Screen.Archive) })
            }
            if (notes.isNotEmpty() && folder in setOf("all", "personal")) item("kosmo") {
                ChatRow(app, data, null, avatar = { KosmoAvatar(56.dp) }, title = "Kosmo", verified = true, preview = tr(notes.last().title), time = listTime(notes.last().at), unread = data.kosmoUnread(), first = archived.isEmpty() || folder != "all") { app.push(Screen.KosmoChat) }
            }
            items(list.size, key = { list[it].str("id") ?: "" }) { i -> ChatListItem(app, data, list[i], first = i == 0 && notes.isEmpty() && (archived.isEmpty() || folder != "all")) }
        }
    }
}

@Composable
fun ChatListItem(app: AppState, data: Data, c: JsonObject, first: Boolean = false) {
    val last = data.visibleMessages(c).lastOrNull()
    val me = data.me
    val mine = last?.takeIf { it.str("from") == me }?.let { m ->
        when {
            m.str("id") in data.pending -> TickState.Pending
            c.strings("members").any { it != me && (c.obj("read")?.num(it) ?: 0) >= (m.num("at") ?: 0) } -> TickState.Read
            else -> TickState.Sent
        }
    }
    // «Вы:» / «Имя:» — жирнее, как <b> на сайте
    val who = if (last == null || last.str("kind") == "join" || isChannel(c)) "" else if (last.str("from") == me) tr("You") + ": " else if (isRoom(c)) firstName(data.accounts[last.str("from")]?.str("name")) + ": " else ""
    ChatRow(
        app, data, c,
        avatar = { ChatAvatar(data, c, 56.dp) },
        title = data.chatTitle(c).let { if (isSaved(c)) tr(it) else it },
        preview = if (last == null) tr(if (isChannel(c)) "Channel" else "No messages yet") else tr(data.previewText(last)), who = who, first = first,
        room = isRoom(c),
        time = listTime(last?.num("at") ?: c.num("createdAt")),
        unread = data.unread(c), mine = mine,
        pinned = data.pref(c.str("id"))?.bool("pinned") == true,
        muted = data.muted(c),
        verified = data.otherOf(c)?.bool("official") == true && !isRoom(c),
    ) { app.openChat(c.str("id")!!, data.otherOf(c)?.str("id")) }
}

enum class TickState { Pending, Sent, Read }

/** Галочки сайта: одна — отправлено, две — прочитано, часы — ещё отправляется. */
@Composable
fun Ticks(state: TickState, modifier: Modifier = Modifier, tint: Color = LocalLook.current.accent, size: androidx.compose.ui.unit.Dp = 16.dp) {
    val icon = when (state) { TickState.Pending -> WI.clock; TickState.Sent -> WI.tickSent; TickState.Read -> WI.tickRead }
    Icon(icon, null, tint = tint, modifier = modifier.size(size))
}

/** Строка чата как на сайте (.chat): аватар 56, имя 16/600, текст 15, справа время и счётчик. */
@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun ChatRow(
    app: AppState, data: Data, c: JsonObject?,
    avatar: @Composable () -> Unit, title: String, preview: String, time: String, unread: Int, mine: TickState? = null,
    pinned: Boolean = false, muted: Boolean = false, verified: Boolean = false, who: String = "", first: Boolean = false, room: Boolean = false, onClick: () -> Unit,
) {
    val look = LocalLook.current
    var menu by remember { mutableStateOf(false) }
    Box {
        if (!first && look.glass) Box(Modifier.padding(start = 78.dp, end = 10.dp).fillMaxWidth().height(0.5.dp).background(look.hairline))
        Row(
            Modifier.fillMaxWidth().clip(androidx.compose.foundation.shape.RoundedCornerShape(if (look.glass) 20.dp else 28.dp))
                .combinedClickable(onClick = onClick, onLongClick = { if (c != null) menu = true }).padding(horizontal = 10.dp, vertical = 9.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            avatar()
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    if (room && c != null) Icon(if (isChannel(c)) PH.megaphone else WI.users, null, tint = look.text2, modifier = Modifier.size(16.dp))
                    Text(title, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false))
                    if (verified) CosmicBadge(size = 16.dp)
                    if (muted) Icon(WI.silent, null, tint = look.text3, modifier = Modifier.size(16.dp))
                }
                Text(
                    androidx.compose.ui.text.buildAnnotatedString {
                        if (who.isNotEmpty()) { pushStyle(androidx.compose.ui.text.SpanStyle(fontWeight = FontWeight.Medium, color = look.text)); append(who); pop() }
                        append(preview)
                    },
                    fontSize = 15.sp, color = look.text2, maxLines = 1, overflow = TextOverflow.Ellipsis,
                )
            }
            Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.padding(start = 12.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    if (mine != null) Ticks(mine, Modifier.padding(end = 3.dp))
                    Text(time, fontSize = 13.sp, color = look.text3)
                }
                if (unread > 0) Box(
                    Modifier.height(22.dp).widthIn(min = 22.dp).clip(CircleShape)
                        .background(if (muted) (if (look.glass) Color(0x4DEBEBF5) else MaterialTheme.colorScheme.surfaceContainerHighest) else look.accent).padding(horizontal = 7.dp),
                    contentAlignment = Alignment.Center,
                ) { Text("$unread", color = if (muted && !look.glass) MaterialTheme.colorScheme.onSurfaceVariant else look.onAccent, fontSize = 13.sp, fontWeight = FontWeight.SemiBold) }
                else if (pinned) Icon(WI.pin, null, tint = look.text3, modifier = Modifier.size(16.dp))
                else Spacer(Modifier.height(22.dp))
            }
        }
        if (c != null) {
            val id = c.str("id") ?: ""
            val p = data.pref(id)
            KosmoMenu(menu, { menu = false }, listOfNotNull(
                MenuItem(WI.pin, if (p?.bool("pinned") == true) "Unpin" else "Pin") { app.setPref(id, "pinned", if (p?.bool("pinned") == true) null else true) },
                MenuItem(WI.silent, if (data.muted(c)) "Unmute notifications" else "Mute notifications") { app.setPref(id, "muted", if (data.muted(c)) null else true) },
                MenuItem(if (p?.bool("archived") == true) WI.unarchive else Icons.Rounded.Archive, if (p?.bool("archived") == true) "Unarchive" else "Archive") { app.setPref(id, "archived", if (p?.bool("archived") == true) null else true) },
                if (unread > 0) MenuItem(WI.check, "Mark as read") { app.kosmo.markRead(id) } else null,
                MenuItem(Icons.Rounded.CleaningServices, "Clear history") { app.setPref(id, "clearedAt", System.currentTimeMillis()) },
                MenuItem(WI.trash, if (isRoom(c) && c.str("owner") != data.me) "Leave" else "Delete chat", danger = true) { app.deleteChat(id) },
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
            items(list.size, key = { list[it].str("id") ?: "" }) { i -> ChatListItem(app, data, list[i], first = i == 0) }
        }
    }
}
