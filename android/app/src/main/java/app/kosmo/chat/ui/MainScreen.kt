package app.kosmo.chat.ui

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.core.spring
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.ChatBubbleOutline
import androidx.compose.material.icons.outlined.DynamicFeed
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.rounded.ChatBubble
import androidx.compose.material.icons.rounded.Done
import androidx.compose.material.icons.rounded.DoneAll
import androidx.compose.material.icons.rounded.DynamicFeed
import androidx.compose.material.icons.rounded.Edit
import androidx.compose.material.icons.rounded.Schedule
import androidx.compose.material.icons.rounded.Search
import androidx.compose.material.icons.rounded.PushPin
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.kosmo.chat.core.Data
import app.kosmo.chat.core.num
import app.kosmo.chat.core.obj
import app.kosmo.chat.core.str
import app.kosmo.chat.core.strings
import app.kosmo.chat.core.bool
import androidx.compose.ui.draw.clip

@Composable
fun KosmoRoot(app: AppState) {
    val snack = remember { SnackbarHostState() }
    LaunchedEffect(app.toast) { app.toast?.let { snack.showSnackbar(it); app.toast = null } }
    Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        AnimatedContent(app.token != null, transitionSpec = { fadeIn() togetherWith fadeOut() }, label = "root") { signed ->
            if (!signed) AuthScreen(app) else Main(app)
        }
        if (app.token != null) CallOverlay(app)
        SnackbarHost(snack, Modifier.align(Alignment.BottomCenter).padding(bottom = 96.dp))
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
            val forward = (targetState != null && initialState == null) || (app.stack.size > 1 && targetState != null)
            val spec = spring<androidx.compose.ui.unit.IntOffset>(dampingRatio = 0.9f, stiffness = 500f)
            if (forward) slideInHorizontally(spec) { it } togetherWith slideOutHorizontally(spec) { -it / 4 } + fadeOut()
            else slideInHorizontally(spec) { -it / 4 } + fadeIn() togetherWith slideOutHorizontally(spec) { it }
        },
        label = "stack",
    ) { screen ->
        when (screen) {
            null -> Tabs(app, data)
            is Screen.Chat -> ChatScreen(app, screen.id, screen.other)
            is Screen.User -> UserScreen(app, screen.id)
            Screen.EditProfile -> EditProfileScreen(app)
            is Screen.Photo -> PhotoViewer(app, screen.media)
            is Screen.Video -> VideoViewer(app, screen.media)
            Screen.KosmoChat -> KosmoChatScreen(app)
            Screen.Sessions -> SessionsScreen(app)
        }
    }
}

@Composable
private fun Tabs(app: AppState, data: Data) {
    val unread = remember(data) { data.chatList().sumOf { data.unread(it) } }
    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        bottomBar = {
            NavigationBar(containerColor = MaterialTheme.colorScheme.surfaceContainer) {
                NavigationBarItem(
                    app.tab == Tab.Chats, { app.tab = Tab.Chats },
                    icon = { BadgedBox(badge = { if (unread > 0) Badge { Text("$unread") } }) { Icon(if (app.tab == Tab.Chats) Icons.Rounded.ChatBubble else Icons.Outlined.ChatBubbleOutline, null) } },
                    label = { Text("Chats") },
                )
                NavigationBarItem(app.tab == Tab.Feed, { app.tab = Tab.Feed }, icon = { Icon(if (app.tab == Tab.Feed) Icons.Rounded.DynamicFeed else Icons.Outlined.DynamicFeed, null) }, label = { Text("Feed") })
                NavigationBarItem(app.tab == Tab.Search, { app.tab = Tab.Search }, icon = { Icon(if (app.tab == Tab.Search) Icons.Rounded.Search else Icons.Outlined.Search, null) }, label = { Text("Search") })
                NavigationBarItem(
                    app.tab == Tab.Profile, { app.tab = Tab.Profile },
                    icon = { UserAvatar(data.user, 26.dp) },
                    label = { Text("Profile") },
                )
            }
        },
    ) { pad ->
        Box(Modifier.padding(pad)) {
            when (app.tab) {
                Tab.Chats -> ChatListScreen(app, data)
                Tab.Feed -> FeedScreen(app, data)
                Tab.Search -> SearchScreen(app, data)
                Tab.Profile -> ProfileScreen(app, data)
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatListScreen(app: AppState, data: Data) {
    val list = remember(data) { data.chatList() }
    val notes = remember(data.user) { data.kosmoNotes() }
    val online by app.kosmo.online.collectAsState()
    val behavior = TopAppBarDefaults.pinnedScrollBehavior()
    Scaffold(
        modifier = Modifier.nestedScroll(behavior.nestedScrollConnection),
        containerColor = MaterialTheme.colorScheme.background,
        topBar = {
            CenterAlignedTopAppBar(
                title = { Text(if (online || !data.loaded) "Chats" else "Connecting…", fontWeight = FontWeight.SemiBold) },
                scrollBehavior = behavior,
                colors = TopAppBarDefaults.centerAlignedTopAppBarColors(containerColor = MaterialTheme.colorScheme.background, scrolledContainerColor = MaterialTheme.colorScheme.surfaceContainer),
            )
        },
        floatingActionButton = {
            FloatingActionButton(onClick = { app.tab = Tab.Search }, containerColor = MaterialTheme.colorScheme.primaryContainer) { Icon(Icons.Rounded.Edit, "New chat") }
        },
    ) { pad ->
        if (list.isEmpty() && notes.isEmpty()) {
            Column(Modifier.fillMaxSize().padding(pad).padding(32.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                PlanetLogo(Modifier.size(120.dp))
                Spacer(Modifier.height(12.dp))
                Text("No chats yet", style = MaterialTheme.typography.titleLarge)
                Text("Find people by name, @username or ID", color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 6.dp))
            }
            return@Scaffold
        }
        LazyColumn(contentPadding = PaddingValues(top = pad.calculateTopPadding(), bottom = 96.dp, start = 8.dp, end = 8.dp)) {
            if (notes.isNotEmpty()) item("kosmo") {
                ChatRow(
                    avatar = { KosmoAvatar(56.dp) }, title = "Kosmo", verified = true,
                    preview = notes.last().title, time = listTime(notes.last().at), unread = 0, mine = null, pinned = false,
                ) { app.push(Screen.KosmoChat) }
            }
            items(list, key = { it.str("id") ?: "" }) { c ->
                val last = data.visibleMessages(c).lastOrNull()
                val me = data.me
                val mine = last?.takeIf { it.str("from") == me }?.let { m ->
                    when {
                        m.str("id") in data.pending -> TickState.Pending
                        c.strings("members").any { it != me && (c.obj("read")?.num(it) ?: 0) >= (m.num("at") ?: 0) } -> TickState.Read
                        else -> TickState.Sent
                    }
                }
                val who = if (isRoom(c) && last != null && last.str("from") != me && last.str("kind") != "join") (firstName(data.accounts[last.str("from")]?.str("name")) + ": ") else ""
                ChatRow(
                    avatar = { ChatAvatar(data, c, 56.dp) },
                    title = data.chatTitle(c),
                    preview = if (last == null) (if (isChannel(c)) "Channel" else "No messages yet") else who + data.previewText(last),
                    time = listTime(last?.num("at") ?: c.num("createdAt")),
                    unread = data.unread(c), mine = mine,
                    pinned = data.user?.obj("chatPrefs")?.obj(c.str("id") ?: "")?.bool("pinned") == true,
                ) { app.openChat(c.str("id")!!, data.otherOf(c)?.str("id")) }
            }
        }
    }
}

enum class TickState { Pending, Sent, Read }

@Composable
fun Ticks(state: TickState, modifier: Modifier = Modifier, tint: androidx.compose.ui.graphics.Color = MaterialTheme.colorScheme.primary) {
    val icon = when (state) { TickState.Pending -> Icons.Rounded.Schedule; TickState.Sent -> Icons.Rounded.Done; TickState.Read -> Icons.Rounded.DoneAll }
    Icon(icon, null, tint = tint, modifier = modifier.size(16.dp))
}

@Composable
private fun ChatRow(
    avatar: @Composable () -> Unit, title: String, preview: String, time: String, unread: Int, mine: TickState?,
    pinned: Boolean, verified: Boolean = false, onClick: () -> Unit,
) {
    Row(
        Modifier.fillMaxWidth().clip20().clickable(onClick = onClick).padding(horizontal = 10.dp, vertical = 9.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        avatar()
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(title, style = MaterialTheme.typography.titleMedium, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false))
                if (verified) VerifiedBadge(Modifier.padding(start = 4.dp))
                Spacer(Modifier.weight(1f))
                if (mine != null) Ticks(mine, Modifier.padding(end = 4.dp))
                Text(time, style = MaterialTheme.typography.labelMedium, color = if (unread > 0) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 2.dp)) {
                Text(preview, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 2, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
                if (unread > 0) Box(Modifier.padding(start = 8.dp).widthIn(min = 22.dp).height(22.dp).background(MaterialTheme.colorScheme.primary, CircleShape).padding(horizontal = 6.dp), contentAlignment = Alignment.Center) {
                    Text("$unread", color = MaterialTheme.colorScheme.onPrimary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                } else if (pinned) Icon(Icons.Rounded.PushPin, null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(start = 8.dp).size(16.dp))
            }
        }
    }
}

fun Modifier.clip20() = this.clip(androidx.compose.foundation.shape.RoundedCornerShape(20.dp))
