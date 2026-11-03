package app.kosmo.chat.ui

import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.ChevronRight
import androidx.compose.material.icons.rounded.Pause
import androidx.compose.material.icons.rounded.PlayArrow
import androidx.compose.material.icons.automirrored.rounded.Logout
import androidx.compose.material.icons.automirrored.rounded.Notes
import androidx.compose.material.icons.rounded.AlternateEmail
import androidx.compose.material.icons.rounded.Add
import androidx.compose.material.icons.rounded.Block
import androidx.compose.material.icons.rounded.Bookmark
import androidx.compose.material.icons.rounded.CalendarMonth
import androidx.compose.material.icons.rounded.Call
import androidx.compose.material.icons.rounded.Campaign
import androidx.compose.material.icons.rounded.ChatBubble
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material.icons.rounded.Devices
import androidx.compose.material.icons.rounded.Edit
import androidx.compose.material.icons.rounded.Image
import androidx.compose.material.icons.rounded.Archive
import androidx.compose.material.icons.rounded.Info
import androidx.compose.material.icons.rounded.Lock
import androidx.compose.material.icons.rounded.Notifications
import androidx.compose.material.icons.rounded.Shield
import androidx.compose.material.icons.rounded.Storage
import androidx.compose.material.icons.rounded.Mail
import androidx.compose.material.icons.rounded.MusicNote
import androidx.compose.material.icons.rounded.Palette
import androidx.compose.material.icons.rounded.Person
import androidx.compose.material.icons.rounded.PhotoCamera
import androidx.compose.material.icons.rounded.Tag
import androidx.compose.material.icons.rounded.Verified
import androidx.compose.material.icons.rounded.Videocam
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
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
import app.kosmo.chat.core.with
import coil.compose.AsyncImage
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

@Composable
fun VerifiedBadge(modifier: Modifier = Modifier, size: Int = 18) =
    Icon(Icons.Rounded.Verified, "Official", tint = PlanetA, modifier = modifier.size(size.dp))

private data class TileSpec(val icon: ImageVector, val label: String, val value: String, val wide: Boolean = false, val muted: Boolean = false, val onClick: (() -> Unit)? = null)

/** Плашки по две в ряд: маленькая без пары растягивается на всю ширину (как на сайте). */
@Composable
private fun Tiles(list: List<TileSpec>) {
    val small = list.filter { !it.wide }.toMutableList()
    val wide = list.filter { it.wide }.toMutableList()
    if (small.size % 2 == 1) wide.add(0, small.removeAt(small.lastIndex).copy(wide = true))
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        small.chunked(2).forEach { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) { row.forEach { Tile(it, Modifier.weight(1f)) } }
        }
        wide.forEach { Tile(it, Modifier.fillMaxWidth()) }
    }
}

@Composable
private fun Tile(t: TileSpec, modifier: Modifier) {
    Surface(
        onClick = { t.onClick?.invoke() }, enabled = t.onClick != null, shape = RoundedCornerShape(24.dp),
        color = MaterialTheme.colorScheme.surfaceContainer, modifier = modifier,
    ) {
        Column(Modifier.padding(start = 16.dp, end = 16.dp, top = 14.dp, bottom = 16.dp)) {
            Box(Modifier.size(36.dp).background(MaterialTheme.colorScheme.primaryContainer, RoundedCornerShape(12.dp)), contentAlignment = Alignment.Center) {
                Icon(t.icon, null, tint = MaterialTheme.colorScheme.onPrimaryContainer, modifier = Modifier.size(20.dp))
            }
            Spacer(Modifier.height(10.dp))
            Text(tr(t.label), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(
                t.value, style = if (t.wide) MaterialTheme.typography.bodyLarge else MaterialTheme.typography.titleMedium,
                color = if (t.muted) MaterialTheme.colorScheme.onSurfaceVariant else MaterialTheme.colorScheme.onSurface,
                maxLines = if (t.wide) 6 else 1, overflow = TextOverflow.Ellipsis,
            )
        }
    }
}

private val monthYear = SimpleDateFormat("LLLL yyyy", Locale.getDefault())

/** Верх профиля: баннер, аватар с орбитой, имя. */
@Composable
private fun Hero(u: JsonObject?, big: Boolean = true, top: androidx.compose.ui.unit.Dp = 24.dp, avatarClick: (() -> Unit)? = null, extra: @Composable () -> Unit = {}) {
    val banner = u?.obj("banner")?.str("media")
    Box(Modifier.fillMaxWidth()) {
        if (banner != null) {
            AsyncImage(
                LocalMedia.current(if (u.obj("banner")?.str("type") == "video") u.obj("banner")?.str("poster") ?: banner else banner), null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxWidth().height(230.dp),
            )
            Box(Modifier.fillMaxWidth().height(230.dp).background(Brush.verticalGradient(0.5f to Color.Transparent, 1f to MaterialTheme.colorScheme.background)))
        }
        Column(Modifier.fillMaxWidth().statusBarsPadding().padding(top = if (banner != null) 110.dp else top), horizontalAlignment = Alignment.CenterHorizontally) {
            Box(contentAlignment = Alignment.Center, modifier = Modifier.size(140.dp).then(if (avatarClick != null) Modifier.clip(CircleShape).clickable(onClick = avatarClick) else Modifier)) {
                Canvas(Modifier.fillMaxSize()) { drawCircle(Brush.sweepGradient(listOf(PlanetA, PlanetB, PlanetA)), style = androidx.compose.ui.graphics.drawscope.Stroke(2.5.dp.toPx())) }
                UserAvatar(u, 124.dp, if (banner != null) Modifier.border(4.dp, MaterialTheme.colorScheme.background, CircleShape) else Modifier)
            }
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 14.dp, start = 24.dp, end = 24.dp)) {
                Text(u?.str("name") ?: "", style = MaterialTheme.typography.headlineMedium.copy(fontSize = if (big) 30.sp else 26.sp), textAlign = TextAlign.Center)
                if (u?.bool("official") == true) VerifiedBadge(Modifier.padding(start = 6.dp), 24)
            }
            extra()
        }
    }
}

/** Свой профиль. */
@Composable
fun ProfileScreen(app: AppState, data: Data) {
    val u = data.user
    val look = LocalLook.current
    val clip = LocalClipboardManager.current
    var confirmLogout by remember { mutableStateOf(false) }
    Box(Modifier.fillMaxSize()) {
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(bottom = 120.dp)) {
        Hero(u, top = 64.dp, avatarClick = { app.push(Screen.EditProfile) }) {
            Row(
                Modifier.padding(top = 12.dp).height(40.dp).chrome(look, CircleShape).clickable { app.push(Screen.EditProfile) }.padding(horizontal = 18.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) { Icon(Icons.Rounded.Edit, null, Modifier.size(18.dp)); Spacer(Modifier.width(8.dp)); Text(tr("Edit profile"), fontWeight = FontWeight.SemiBold) }
        }
        Column(Modifier.padding(horizontal = 16.dp).padding(top = 18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Extras(app, data, u)
            Tiles(listOfNotNull(
                TileSpec(Icons.Rounded.AlternateEmail, "Username", u?.str("username")?.takeIf { it.isNotEmpty() }?.let { "@$it" } ?: tr("Not set"), muted = u?.str("username").isNullOrEmpty()) {
                    u?.str("username")?.takeIf { it.isNotEmpty() }?.let { clip.setText(AnnotatedString("@$it")); app.toast = "Username copied" } ?: app.push(Screen.EditProfile)
                },
                TileSpec(Icons.Rounded.Tag, "ID", u?.str("publicId") ?: u?.num("publicId")?.toString() ?: "") { clip.setText(AnnotatedString(u?.str("publicId") ?: u?.num("publicId")?.toString() ?: "")); app.toast = "ID copied" },
                TileSpec(Icons.Rounded.Mail, "Email", u?.str("email") ?: "", wide = true),
                u?.str("bio")?.takeIf { it.isNotEmpty() }?.let { TileSpec(Icons.AutoMirrored.Rounded.Notes, "Bio", it, wide = true) },
                TileSpec(Icons.Rounded.CalendarMonth, "Joined", u?.num("createdAt")?.let { monthYear.format(Date(it)) } ?: ""),
                TileSpec(Icons.Rounded.Devices, "Sessions", tr("${u?.arr("sessions")?.size ?: 0} active")) { app.push(Screen.Sessions) },
            ))
        }
        Spacer(Modifier.height(14.dp))
        Group {
            GroupRow(Icons.Rounded.Bookmark, "Saved Messages", tint = Color(0xFF0A84FF)) { data.me?.let { app.openChat("saved_$it") } }
            GroupRow(Icons.Rounded.Archive, "Archived chats", tint = Color(0xFF8E8E93)) { app.push(Screen.Archive) }
        }
        Spacer(Modifier.height(12.dp))
        Group {
            GroupRow(Icons.Rounded.Edit, "Edit profile", tint = Color(0xFF0A84FF)) { app.push(Screen.EditProfile) }
            GroupRow(Icons.Rounded.Palette, "Designs", tint = Color(0xFFFF375F)) { app.push(Screen.Settings("designs")) }
        }
        Spacer(Modifier.height(12.dp))
        Group {
            GroupRow(Icons.Rounded.Lock, "Privacy", tint = Color(0xFFBF5AF2)) { app.push(Screen.Settings("privacy")) }
            GroupRow(Icons.Rounded.Shield, "Security", tint = Color(0xFF30D158), value = if (u?.obj("security")?.bool("lock") == true) tr("Passcode lock") else null) { app.push(Screen.Settings("security")) }
            GroupRow(Icons.Rounded.Notifications, "Notifications", tint = Color(0xFFFF453A)) { app.push(Screen.Settings("notifications")) }
            GroupRow(Icons.Rounded.Storage, "Data and storage", tint = Color(0xFFFF9F0A)) { app.push(Screen.Settings("storage")) }
            GroupRow(Icons.Rounded.Devices, "Sessions", tint = Color(0xFF64D2FF), value = "${u?.arr("sessions")?.size ?: 0}") { app.push(Screen.Sessions) }
        }
        Spacer(Modifier.height(12.dp))
        Group {
            GroupRow(Icons.Rounded.Info, "About Kosmo", tint = Color(0xFF0A84FF)) { app.push(Screen.Settings("about")) }
            GroupRow(Icons.AutoMirrored.Rounded.Logout, "Log out", danger = true) { confirmLogout = true }
        }
    }
    Header { CircleSpacer(); TitlePill("Profile"); CircleSpacer() }
    }
    if (confirmLogout) AlertDialog(
        onDismissRequest = { confirmLogout = false },
        title = { Text(tr("Log out?")) }, text = { Text(tr("You can sign in again with your email and passcode.")) },
        confirmButton = { TextButton({ confirmLogout = false; app.signOut() }) { Text(tr("Log out"), color = MaterialTheme.colorScheme.error) } },
        dismissButton = { TextButton({ confirmLogout = false }) { Text(tr("Cancel")) } },
    )
}

@Composable
fun SettingsRow(icon: ImageVector, text: String, value: String? = null, danger: Boolean = false, onClick: () -> Unit) {
    Surface(onClick = onClick, shape = RoundedCornerShape(20.dp), color = MaterialTheme.colorScheme.surfaceContainer, modifier = Modifier.fillMaxWidth()) {
        Row(Modifier.padding(horizontal = 16.dp, vertical = 14.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(icon, null, tint = if (danger) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary)
            Text(text, Modifier.weight(1f).padding(start = 14.dp), color = if (danger) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurface, style = MaterialTheme.typography.bodyLarge)
            if (value != null) Text(value, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(end = 6.dp))
            if (!danger) Icon(Icons.Rounded.ChevronRight, null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

/** Канал и музыка в профиле — плитки в одну строку. */
@Composable
private fun Extras(app: AppState, data: Data, u: JsonObject?) {
    val ch = u?.str("profileChannel")?.let { data.chats[it] }?.takeIf { !it.str("username").isNullOrEmpty() }
    val tracks = u?.arr("music")?.objects().orEmpty()
    if (ch == null && tracks.isEmpty()) return
    val st by Voice.state.collectAsState()
    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        if (ch != null) Surface(onClick = { app.openChat(ch.str("id")!!) }, shape = RoundedCornerShape(24.dp), color = MaterialTheme.colorScheme.surfaceContainer, modifier = Modifier.weight(1f)) {
            Column(Modifier.padding(14.dp)) {
                ChatAvatar(data, ch, 40.dp)
                Text(ch.str("name") ?: "", style = MaterialTheme.typography.titleSmall, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 8.dp))
                Text("${if (isChannel(ch)) "Channel" else "Group"} · ${ch.strings("members").size}", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        if (tracks.isNotEmpty()) {
            val t = tracks.first()
            val id = "music-" + (u?.str("id") ?: "")
            val media = LocalMedia.current
            Surface(onClick = { t.str("media")?.let { Voice.toggle(id, media(it)) } }, shape = RoundedCornerShape(24.dp), color = MaterialTheme.colorScheme.surfaceContainer, modifier = Modifier.weight(1f)) {
                Column(Modifier.padding(14.dp)) {
                    Box(Modifier.size(40.dp).background(MaterialTheme.colorScheme.primary, CircleShape), contentAlignment = Alignment.Center) {
                        Icon(if (st.id == id && st.playing) Icons.Rounded.Pause else Icons.Rounded.PlayArrow, null, tint = MaterialTheme.colorScheme.onPrimary)
                    }
                    Text(t.str("title") ?: "Track", style = MaterialTheme.typography.titleSmall, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 8.dp))
                    Text((t.str("artist")?.takeIf { it.isNotEmpty() } ?: "Music") + if (tracks.size > 1) " · ${tracks.size} tracks" else "", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1)
                }
            }
        }
    }
}

/** Чужой профиль. */
@Composable
fun UserScreen(app: AppState, id: String) {
    val data by app.kosmo.data.collectAsState()
    val u = data.accounts[id]
    val me = data.user
    val blocked = me?.obj("privacy")?.strings("blocked")?.contains(id) == true
    val clip = LocalClipboardManager.current
    Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).navigationBarsPadding().padding(bottom = 24.dp)) {
            Hero(u, big = false, top = 64.dp) {
                if (u?.bool("official") == true) Text(tr("Official account"), color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.labelLarge)
                Text(u?.let { lastSeen(it) } ?: "", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 4.dp))
                Row(Modifier.padding(16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Action(Icons.Rounded.ChatBubble, "Message", Modifier.weight(1f)) { app.openDm(id) }
                    Action(Icons.Rounded.Call, "Call", Modifier.weight(1f)) { app.startCall(id, false) }
                    Action(Icons.Rounded.Videocam, "Video", Modifier.weight(1f)) { app.startCall(id, true) }
                    Action(Icons.Rounded.Block, if (blocked) "Unblock" else "Block", Modifier.weight(1f), danger = !blocked) {
                        val priv = me?.obj("privacy") ?: JsonObject(emptyMap())
                        val list = priv.strings("blocked").let { if (blocked) it - id else it + id }
                        app.kosmo.updateMe(jobj("privacy" to priv.with("blocked" to list)))
                    }
                }
            }
            Column(Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Extras(app, data, u)
                Tiles(listOfNotNull(
                    u?.str("username")?.takeIf { it.isNotEmpty() }?.let { n -> TileSpec(Icons.Rounded.AlternateEmail, "Username", "@$n") { clip.setText(AnnotatedString("@$n")); app.toast = "Username copied" } },
                    TileSpec(Icons.Rounded.Tag, "ID", u?.num("publicId")?.toString() ?: "") { clip.setText(AnnotatedString(u?.num("publicId")?.toString() ?: "")); app.toast = "ID copied" },
                    u?.str("email")?.let { TileSpec(Icons.Rounded.Mail, "Email", it, wide = true) },
                    u?.str("bio")?.takeIf { it.isNotEmpty() && u.obj("privacy")?.bool("hideBio") != true }?.let { TileSpec(Icons.AutoMirrored.Rounded.Notes, "Bio", it, wide = true) },
                    TileSpec(Icons.Rounded.CalendarMonth, "Joined", u?.num("createdAt")?.let { monthYear.format(Date(it)) } ?: ""),
                ))
            }
        }
        BackCircle(app, Modifier.statusBarsPadding().padding(12.dp))
    }
}

@Composable
private fun Action(icon: ImageVector, label: String, modifier: Modifier, danger: Boolean = false, onClick: () -> Unit) {
    Surface(onClick = onClick, shape = RoundedCornerShape(20.dp), color = MaterialTheme.colorScheme.surfaceContainerHigh, modifier = modifier) {
        Column(Modifier.padding(vertical = 12.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(icon, null, tint = if (danger) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary)
            Text(tr(label), style = MaterialTheme.typography.labelMedium, modifier = Modifier.padding(top = 4.dp), maxLines = 1)
        }
    }
}

/* ---------------------------------------------------------------------------
   Редактирование профиля: выглядит как профиль; плашка → экран поля;
   галочка справа от заголовка сохраняет всё
   --------------------------------------------------------------------------- */
private enum class Field { Name, Username, Bio }

@Composable
fun EditProfileScreen(app: AppState) {
    val data by app.kosmo.data.collectAsState()
    val u = data.user ?: return
    var name by remember { mutableStateOf(u.str("name") ?: "") }
    var username by remember { mutableStateOf(u.str("username") ?: "") }
    var bio by remember { mutableStateOf(u.str("bio") ?: "") }
    var avatar by remember { mutableStateOf(u.obj("avatar") ?: JsonObject(emptyMap())) }
    var banner by remember { mutableStateOf(u.obj("banner")) }
    var field by remember { mutableStateOf<Field?>(null) }
    var crop by remember { mutableStateOf<Pair<Uri, Boolean>?>(null) }   // фото и «это аватар?»
    var busy by remember { mutableStateOf(false) }
    var askLeave by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val dirty = name != (u.str("name") ?: "") || username != (u.str("username") ?: "") || bio != (u.str("bio") ?: "") || avatar != (u.obj("avatar") ?: JsonObject(emptyMap())) || banner != u.obj("banner")
    val pickAvatar = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { it?.let { uri -> crop = uri to true } }
    val pickBanner = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { it?.let { uri -> crop = uri to false } }

    fun save() {
        if (busy) { app.toast = "Wait until the upload finishes"; return }
        app.kosmo.updateMe(jobj("name" to name.trim(), "username" to username, "bio" to bio.trim(), "avatar" to avatar, "banner" to banner))
        app.toast = "Profile updated"
        app.pop()
    }
    BackHandler(field == null && crop == null && dirty) { askLeave = true }

    AnimatedContent(Triple(field, crop, 0), transitionSpec = { fadeIn() togetherWith fadeOut() }, label = "edit") { (f, c, _) ->
        when {
            c != null -> Cropper(c.first, circle = c.second, aspect = 16f / 9f, title = if (c.second) "Profile photo" else "Banner", onCancel = { crop = null }) { file ->
                crop = null
                busy = true
                scope.launch {
                    try {
                        val id = app.api.upload(file, "image/jpeg")
                        if (c.second) avatar = avatar.with("photo" to id, "video" to null) else banner = jobj("media" to id, "type" to "photo")
                    } catch (e: Exception) { app.toast = e.message ?: "Upload failed" }
                    busy = false
                }
            }
            f != null -> FieldScreen(
                app, f,
                when (f) { Field.Name -> name; Field.Username -> username; Field.Bio -> bio },
                onBack = { field = null },
            ) { v -> when (f) { Field.Name -> name = v; Field.Username -> username = v; Field.Bio -> bio = v }; field = null }
            else -> Box(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
                val preview = u.with("name" to name, "avatar" to avatar, "banner" to banner)
                Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).navigationBarsPadding().padding(bottom = 24.dp)) {
                    Box {
                        Hero(preview, top = 76.dp, avatarClick = { pickAvatar.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) }) {
                            if (busy) Text(tr("Uploading…"), color = MaterialTheme.colorScheme.primary, modifier = Modifier.padding(top = 6.dp))
                        }
                        Box(Modifier.align(Alignment.TopCenter).statusBarsPadding().padding(top = if (banner != null) 216.dp else 182.dp).offset(x = 50.dp).size(36.dp).background(MaterialTheme.colorScheme.primary, CircleShape), contentAlignment = Alignment.Center) {
                            Icon(Icons.Rounded.PhotoCamera, null, tint = MaterialTheme.colorScheme.onPrimary, modifier = Modifier.size(20.dp))
                        }
                    }
                    Row(Modifier.padding(horizontal = 16.dp, vertical = 14.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        AddTile(Icons.Rounded.Image, if (banner != null) "Change banner" else "Add banner", Modifier.weight(1f)) { pickBanner.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) }
                        if (avatar.str("photo") != null) AddTile(Icons.Rounded.Person, "Remove photo", Modifier.weight(1f)) { avatar = avatar.with("photo" to null, "video" to null) }
                        else if (banner != null) AddTile(Icons.Rounded.Image, "Remove banner", Modifier.weight(1f)) { banner = null }
                    }
                    Column(Modifier.padding(horizontal = 16.dp)) {
                        Tiles(listOf(
                            TileSpec(Icons.Rounded.Person, "Name", name) { field = Field.Name },
                            TileSpec(Icons.Rounded.AlternateEmail, "Username", if (username.isEmpty()) "Not set" else "@$username", muted = username.isEmpty()) { field = Field.Username },
                            TileSpec(Icons.AutoMirrored.Rounded.Notes, "Bio", bio.ifEmpty { "A few words about you" }, wide = true, muted = bio.isEmpty()) { field = Field.Bio },
                        ))
                    }
                }
                Row(Modifier.statusBarsPadding().padding(12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    BackCircle(app, onClick = { if (dirty) askLeave = true else app.pop() })
                    Box(Modifier.weight(1f).height(48.dp).clip(RoundedCornerShape(24.dp)).background(MaterialTheme.colorScheme.surfaceContainerHigh), contentAlignment = Alignment.Center) {
                        Text(tr("Edit profile"), style = MaterialTheme.typography.titleMedium)
                    }
                    FilledIconButton(onClick = { save() }, modifier = Modifier.size(48.dp)) { Icon(Icons.Rounded.Check, "Save") }
                }
            }
        }
    }
    if (askLeave) AlertDialog(
        onDismissRequest = { askLeave = false },
        title = { Text(tr("Save changes?")) }, text = { Text(tr("You changed your profile. Save it before leaving?")) },
        confirmButton = { TextButton({ askLeave = false; save() }) { Text(tr("Save")) } },
        dismissButton = { TextButton({ askLeave = false; app.pop() }) { Text(tr("Discard")) } },
    )
}

@Composable
private fun AddTile(icon: ImageVector, label: String, modifier: Modifier, onClick: () -> Unit) {
    Surface(onClick = onClick, shape = RoundedCornerShape(24.dp), color = Color.Transparent, border = BorderStroke(1.5.dp, MaterialTheme.colorScheme.outlineVariant), modifier = modifier.heightIn(min = 96.dp)) {
        Column(Modifier.padding(12.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
            Box(Modifier.size(34.dp).background(MaterialTheme.colorScheme.primaryContainer, CircleShape), contentAlignment = Alignment.Center) {
                Icon(if (label.startsWith("Add")) Icons.Rounded.Add else icon, null, tint = MaterialTheme.colorScheme.onPrimaryContainer, modifier = Modifier.size(20.dp))
            }
            Text(tr(label), style = MaterialTheme.typography.labelLarge, modifier = Modifier.padding(top = 8.dp), color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

/** Экран одного поля: круг «назад», поле с тонкой линией, правила, галочка — когда всё верно. */
@Composable
private fun FieldScreen(app: AppState, f: Field, initial: String, onBack: () -> Unit, onDone: (String) -> Unit) {
    var v by remember { mutableStateOf(initial) }
    var status by remember { mutableStateOf("") }
    var ok by remember { mutableStateOf(true) }
    val me = app.kosmo.data.value.user
    BackHandler { onBack() }
    LaunchedEffect(v) {
        when (f) {
            Field.Name -> { ok = v.isNotBlank(); status = if (ok) "" else "The name can’t be empty" }
            Field.Bio -> { ok = true; status = "" }
            Field.Username -> {
                when {
                    v.isEmpty() -> { ok = true; status = if (!me?.str("username").isNullOrEmpty()) "Your username will be removed" else "" }
                    v == me?.str("username") -> { ok = true; status = "This is your username" }
                    v.length < 3 -> { ok = false; status = "At least 3 characters" }
                    v.none { it in 'a'..'z' } -> { ok = false; status = "Add at least one letter" }
                    else -> {
                        ok = false; status = "Checking…"
                        delay(350)
                        val free = runCatching { app.auth.usernameFree(v) }.getOrNull()
                        ok = free != false
                        status = when (free) { true -> "@$v is available"; false -> "@$v is taken"; null -> "Could not check now — will check when saving" }
                    }
                }
            }
        }
    }
    val max = when (f) { Field.Name -> 40; Field.Username -> 32; Field.Bio -> 70 }
    Column(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background).statusBarsPadding()) {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            BackCircle(app, onClick = onBack)
            Box(Modifier.weight(1f).height(48.dp).clip(RoundedCornerShape(24.dp)).background(MaterialTheme.colorScheme.surfaceContainerHigh), contentAlignment = Alignment.Center) {
                Text(when (f) { Field.Name -> "Name"; Field.Username -> "Username"; Field.Bio -> "Bio" }, style = MaterialTheme.typography.titleMedium)
            }
            FilledIconButton(onClick = { onDone(v.trim()) }, enabled = ok, modifier = Modifier.size(48.dp)) { Icon(Icons.Rounded.Check, "Done") }
        }
        Column(Modifier.padding(horizontal = 24.dp, vertical = 20.dp)) {
            Row(verticalAlignment = Alignment.Bottom) {
                if (f == Field.Username) Text("@", fontSize = 22.sp, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onSurfaceVariant)
                BasicTextField(
                    value = v,
                    onValueChange = { n -> v = (if (f == Field.Username) n.lowercase().filter { it in 'a'..'z' || it in '0'..'9' } else n).take(max) },
                    textStyle = TextStyle(fontSize = 22.sp, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onSurface),
                    cursorBrush = androidx.compose.ui.graphics.SolidColor(MaterialTheme.colorScheme.primary),
                    singleLine = f != Field.Bio,
                    modifier = Modifier.weight(1f),
                )
                if (f != Field.Username) Text("${max - v.length}", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelMedium)
            }
            val tone = when { status.endsWith("available") -> MaterialTheme.colorScheme.primary; !ok -> MaterialTheme.colorScheme.error; else -> MaterialTheme.colorScheme.outline }
            Box(Modifier.padding(top = 10.dp).fillMaxWidth().height(if (ok && status.isEmpty()) 1.dp else 2.dp).background(tone))
            Text(status, color = if (!ok) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 10.dp))
            val rules = when (f) {
                Field.Name -> listOf("" to "This is how people see you in chats, groups and search.", "You can: " to "any letters, spaces, emoji — up to 40 characters.", "You can’t: " to "leave it empty.")
                Field.Username -> listOf(
                    "" to "People can find you by this name and write to you without knowing your email.",
                    "You can: " to "English letters a–z and numbers 0–9, from 3 to 32 characters.",
                    "You can’t: " to "spaces, dots, dashes or other symbols; only numbers without a letter; a name someone else already has.",
                    "" to "You can also leave it empty — then you can only be found by ID.",
                )
                Field.Bio -> listOf("" to "Shown in your profile under your name.", "You can: " to "any text, emoji and links — up to 70 characters. Can be empty.")
            }
            Spacer(Modifier.height(14.dp))
            rules.forEach { (b, t) ->
                Text(
                    androidx.compose.ui.text.buildAnnotatedString {
                        if (b.isNotEmpty()) { pushStyle(androidx.compose.ui.text.SpanStyle(fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.onSurface)); append(b); pop() }
                        append(t)
                    },
                    style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(bottom = 10.dp),
                )
            }
        }
    }
}

/** Сеансы: где выполнен вход; чужие можно завершить. */
@Composable
fun SessionsScreen(app: AppState) {
    val data by app.kosmo.data.collectAsState()
    val list = data.user?.arr("sessions")?.objects().orEmpty()
    val scope = rememberCoroutineScope()
    Column(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background).statusBarsPadding().navigationBarsPadding()) {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            BackCircle(app)
            Box(Modifier.weight(1f).height(48.dp).clip(RoundedCornerShape(24.dp)).background(MaterialTheme.colorScheme.surfaceContainerHigh), contentAlignment = Alignment.Center) { Text(tr("Sessions"), style = MaterialTheme.typography.titleMedium) }
            Spacer(Modifier.width(48.dp))
        }
        Column(Modifier.verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            list.forEach { s ->
                Surface(shape = RoundedCornerShape(20.dp), color = MaterialTheme.colorScheme.surfaceContainer, modifier = Modifier.fillMaxWidth()) {
                    Row(Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Rounded.Devices, null, tint = MaterialTheme.colorScheme.primary)
                        Column(Modifier.weight(1f).padding(start = 14.dp)) {
                            Text(s.str("name") ?: "Device", style = MaterialTheme.typography.titleSmall)
                            Text("${s.str("location") ?: ""} · ${listTime(s.num("lastActive"))}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        }
                        if (s.bool("current")) Text(tr("This device"), color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.labelMedium)
                        else if (!s.bool("first")) TextButton({
                            scope.launch {
                                try { app.api.call("DELETE", "/api/sessions/${s.str("id")}"); app.kosmo.load() } catch (e: Exception) { app.toast = e.message }
                            }
                        }) { Text(tr("End"), color = MaterialTheme.colorScheme.error) }
                    }
                }
            }
        }
    }
}

/** Чат «Kosmo»: приветствие, новые входы, смена почты. */
@Composable
fun KosmoChatScreen(app: AppState) {
    val data by app.kosmo.data.collectAsState()
    val notes = data.kosmoNotes()
    Column(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background).statusBarsPadding().navigationBarsPadding()) {
        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            BackCircle(app)
            Row(Modifier.weight(1f).height(48.dp).clip(RoundedCornerShape(24.dp)).background(MaterialTheme.colorScheme.surfaceContainerHigh), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.Center) {
                Text("Kosmo", style = MaterialTheme.typography.titleMedium); VerifiedBadge(Modifier.padding(start = 4.dp))
            }
            KosmoAvatar(48.dp)
        }
        Column(Modifier.verticalScroll(rememberScrollState(), reverseScrolling = true).padding(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            notes.forEach { n ->
                Surface(shape = RoundedCornerShape(22.dp), color = MaterialTheme.colorScheme.surfaceContainerHigh, modifier = Modifier.fillMaxWidth(0.9f)) {
                    Column(Modifier.padding(16.dp)) {
                        Text(n.title, style = MaterialTheme.typography.titleMedium)
                        Text(n.text, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 6.dp))
                        n.rows.forEach { (k, v) -> Row(Modifier.padding(top = 6.dp)) { Text(k, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.width(96.dp), style = MaterialTheme.typography.bodySmall); Text(v, style = MaterialTheme.typography.bodySmall) } }
                        Text(listTime(n.at) + " " + timeOf(n.at), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.align(Alignment.End).padding(top = 6.dp))
                    }
                }
            }
        }
    }
}

