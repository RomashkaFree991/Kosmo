package app.kosmo.chat.ui

import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.wrapContentHeight
import androidx.compose.foundation.layout.widthIn
import androidx.compose.ui.draw.drawBehind
import androidx.compose.material3.ExperimentalMaterial3Api
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
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.animation.core.animateFloat
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

private data class TileSpec(val icon: ImageVector, val label: String, val value: String, val wide: Boolean = false, val muted: Boolean = false, val hidden: Boolean = false, val pen: Boolean = false, val onClick: (() -> Unit)? = null)

/** Плашки по две в ряд: маленькая без пары растягивается на всю ширину (как на сайте). */
@Composable
private fun Tiles(list: List<TileSpec>) {
    val small = list.filter { !it.wide }.toMutableList()
    val wide = list.filter { it.wide }.toMutableList()
    if (small.size % 2 == 1) wide.add(0, small.removeAt(small.lastIndex).copy(wide = true))
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        var n = 0
        small.chunked(2).forEach { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) { row.forEach { Tile(it, Modifier.weight(1f), n++) } }
        }
        wide.forEach { Tile(it, Modifier.fillMaxWidth(), n++) }
    }
}

private val TILE_COLORS = listOf(
    Color(0x290A84FF) to Color(0xFF64B5FF), Color(0x2630D158) to Color(0xFF4CD964), Color(0x29BF5AF2) to Color(0xFFD68CFF),
    Color(0x26FF9F0A) to Color(0xFFFFB340), Color(0x26FF375F) to Color(0xFFFF6B8A),
)

/** Плашка (.tile на сайте): значок 36 в цветном квадрате, подпись 13, значение 16/600. */
@Composable
private fun Tile(t: TileSpec, modifier: Modifier, index: Int = 0) {
    val look = LocalLook.current
    val cs = MaterialTheme.colorScheme
    val (ibg, ifg) = if (look.glass) TILE_COLORS.getOrElse(index) { TILE_COLORS[0] } else cs.primaryContainer to cs.onPrimaryContainer
    Column(
        modifier.clip(RoundedCornerShape(if (look.glass) 24.dp else 28.dp)).background(look.cell)
            .then(if (t.onClick != null) Modifier.clickable { t.onClick.invoke() } else Modifier)
            .padding(start = 16.dp, end = 16.dp, top = 14.dp, bottom = 16.dp),
    ) {
        Row(Modifier.fillMaxWidth()) {
            Box(Modifier.size(36.dp).clip(RoundedCornerShape(if (look.glass) 12.dp else 14.dp)).background(ibg), contentAlignment = Alignment.Center) {
                Icon(t.icon, null, tint = ifg, modifier = Modifier.size(20.dp))
            }
            if (t.pen) { Spacer(Modifier.weight(1f)); Icon(PenIcon, null, tint = look.text.copy(alpha = 0.38f), modifier = Modifier.size(16.dp)) }
        }
        Spacer(Modifier.height(10.dp))
        Row(Modifier.padding(bottom = 2.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(tr(t.label), fontSize = 13.sp, color = look.text2)
            if (t.hidden) Row(Modifier.padding(start = 6.dp).clip(CircleShape).background(look.ink.copy(alpha = 0.08f)).padding(horizontal = 7.dp, vertical = 1.dp), verticalAlignment = Alignment.CenterVertically) {
                Icon(WI.eye, null, tint = look.text2, modifier = Modifier.size(11.dp)); Text(" " + tr("hidden"), fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = look.text2)
            }
        }
        Text(
            t.value, fontSize = 16.sp, lineHeight = if (t.wide) 22.sp else 20.sp, fontWeight = if (t.wide || !look.glass) FontWeight.Medium else FontWeight.SemiBold,
            color = if (t.muted) look.text2 else look.text, maxLines = if (t.wide) 6 else 1, overflow = TextOverflow.Ellipsis,
        )
    }
}

private val monthYear = SimpleDateFormat("LLLL yyyy", Locale.getDefault())

/** Верх профиля: баннер, аватар с орбитой, имя. */
@Composable
private fun Hero(u: JsonObject?, big: Boolean = true, top: androidx.compose.ui.unit.Dp = 24.dp, avatarClick: (() -> Unit)? = null, nameClick: (() -> Unit)? = null, extra: @Composable () -> Unit = {}) {
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
        val look = LocalLook.current
        Column(Modifier.fillMaxWidth().statusBarsPadding().padding(top = if (banner != null) 110.dp else top + if (look.glass) 0.dp else 14.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            val cs = MaterialTheme.colorScheme
            val spin = androidx.compose.animation.core.rememberInfiniteTransition(label = "orbit")
            val turn by spin.animateFloat(0f, 360f, androidx.compose.animation.core.infiniteRepeatable(androidx.compose.animation.core.tween(8000, easing = androidx.compose.animation.core.LinearEasing)), label = "t")
            Box(contentAlignment = Alignment.Center, modifier = Modifier.size(132.dp).then(if (avatarClick != null) Modifier.clip(CircleShape).clickable(onClick = avatarClick) else Modifier)) {
                if (look.glass) Canvas(Modifier.fillMaxSize()) {
                    rotate(turn) {
                        val ring = if (look.glass) listOf(Color(0xFF64D2FF), Color(0xFF7D5CFF), Color(0xFFBF5AF2), Color(0xFFFF375F), Color(0xFF64D2FF)) else listOf(cs.primary, cs.tertiary, cs.primary)
                        drawCircle(Brush.sweepGradient(ring), radius = size.minDimension / 2 - 1.5.dp.toPx(), style = androidx.compose.ui.graphics.drawscope.Stroke(3.dp.toPx()))
                        val star = androidx.compose.ui.geometry.Offset(size.width / 2, 6.dp.toPx() + 4.5.dp.toPx())
                        drawCircle(Color(0xCCBF5AF2), 9.dp.toPx(), star, alpha = 0.35f)
                        drawCircle(Color.White, 4.5.dp.toPx(), star)
                    }
                }
                if (look.glass) UserAvatar(u, 116.dp, if (banner != null) Modifier.border(4.dp, MaterialTheme.colorScheme.background, CircleShape) else Modifier)
                else UserAvatar(u, 132.dp, Modifier.shadow(18.dp, m3Shape(Design.profileShape), ambientColor = cs.primary, spotColor = cs.primary), shape = m3Shape(Design.profileShape))
                if (avatarClick != null) Box(
                    Modifier.align(Alignment.BottomEnd).padding(end = 8.dp, bottom = 8.dp).size(34.dp).shadow(8.dp, if (look.glass) CircleShape else RoundedCornerShape(12.dp))
                        .clip(if (look.glass) CircleShape else RoundedCornerShape(12.dp)).background(if (look.glass) Color.White else cs.primary),
                    contentAlignment = Alignment.Center,
                ) { Icon(WI.camera, null, tint = if (look.glass) Color.Black else cs.onPrimary, modifier = Modifier.size(18.dp)) }
            }
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 16.dp, start = 24.dp, end = 24.dp).then(if (nameClick != null) Modifier.clickable(interactionSource = null, indication = null, onClick = nameClick) else Modifier)) {
                Text(u?.str("name")?.ifEmpty { null } ?: if (nameClick != null) tr("Your name") else "", fontSize = if (big) 30.sp else 26.sp, lineHeight = 36.sp, fontWeight = if (look.glass) FontWeight.Bold else FontWeight.Medium, letterSpacing = if (look.glass) (-0.6).sp else 0.sp, textAlign = TextAlign.Center)
                if (nameClick != null) Unit
                else if (u?.bool("official") == true) CosmicBadge("official", 26.dp, Modifier.padding(start = 8.dp))
                else if (u?.str("role") == "owner") CosmicBadge("owner", 26.dp, Modifier.padding(start = 8.dp))
                if (nameClick != null) Icon(PenIcon, null, tint = look.text.copy(alpha = 0.5f), modifier = Modifier.padding(start = 8.dp).size(20.dp))
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
    var sheet by remember { mutableStateOf<String?>(null) }
    when (sheet) {
        "bookmarks" -> BookmarksSheet(app) { sheet = null }
        "dnd" -> DndSheet(app) { sheet = null }
        "bots" -> BotsSheet(app) { sheet = null }
        "backup" -> BackupSheet(app) { sheet = null }
        "stats" -> StatsSheet(app) { sheet = null }
    }
    Box(Modifier.fillMaxSize()) {
    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(bottom = 120.dp)) {
        Hero(u, top = 78.dp, avatarClick = { app.push(Screen.EditProfile) }) {
            Row(
                Modifier.padding(top = 12.dp).height(36.dp).clip(CircleShape).background(if (look.glass) look.ink.copy(alpha = 0.1f) else MaterialTheme.colorScheme.secondaryContainer).clickable { app.push(Screen.EditProfile) }.padding(horizontal = 16.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) { Icon(WI.edit, null, Modifier.size(16.dp)); Spacer(Modifier.width(6.dp)); Text(tr("Edit profile"), fontWeight = FontWeight.SemiBold, fontSize = 14.sp) }
        }
        Column(Modifier.padding(horizontal = 16.dp).padding(top = 18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Extras(app, data, u)
            Tiles(listOfNotNull(
                TileSpec(WI.at, "Username", u?.str("username")?.takeIf { it.isNotEmpty() }?.let { "@$it" } ?: tr("Not set"), muted = u?.str("username").isNullOrEmpty()) {
                    u?.str("username")?.takeIf { it.isNotEmpty() }?.let { clip.setText(AnnotatedString("@$it")); app.toast = "Username copied" } ?: app.push(Screen.EditProfile)
                },
                TileSpec(WI.hash, "ID", u?.str("publicId") ?: u?.num("publicId")?.toString() ?: "") { clip.setText(AnnotatedString(u?.str("publicId") ?: u?.num("publicId")?.toString() ?: "")); app.toast = "ID copied" },
                TileSpec(WI.mail, "Email", u?.str("email") ?: "", wide = true, hidden = u?.obj("privacy")?.bool("showEmail") != true),
                u?.str("bio")?.takeIf { it.isNotEmpty() }?.let { TileSpec(WI.quote, "Bio", it, wide = true, hidden = u.obj("privacy")?.bool("hideBio") == true) },
                TileSpec(WI.calendar, "Joined", u?.num("createdAt")?.let { monthYear.format(Date(it)) } ?: ""),
                TileSpec(WI.devices, "Sessions", tr("${u?.arr("sessions")?.size ?: 0} active")) { app.push(Screen.Sessions) },
            ))
        }
        // группы строк — как на сайте: цвета ic-blue / ic-pink / ic-violet …
        val blue = Color(0xFF0A84FF); val pink = Color(0xFFFF375F); val violet = Color(0xFF8E5CF7); val green = Color(0xFF30B458)
        val red = Color(0xFFFF453A); val orange = Color(0xFFFF9F0A); val teal = Color(0xFF19A7B5)
        Spacer(Modifier.height(14.dp))
        Group {
            GroupRow(PH.bookmarkSimpleFill, "Saved Messages", blue, msIcon = MS.bookmark, first = true) { data.me?.let { app.openChat("saved_$it") } }
            GroupRow(PH.starFill, "Bookmarks", orange, value = bookmarksOf(u).size.takeIf { it > 0 }?.toString(), msIcon = MS.star) { sheet = "bookmarks" }
            if ((u?.num("publicId")?.toString() ?: u?.str("publicId")) == "1") GroupRow(PH.chartBarFill, "Statistics", violet, msIcon = MS.barChart) { sheet = "stats" }
            val dnd = app.dndUntil()
            GroupRow(PH.moonFill, "Do not disturb", violet, value = if (dnd > 0) tr("until") + " " + java.text.SimpleDateFormat("HH:mm", java.util.Locale.getDefault()).format(java.util.Date(dnd)) else tr("Off"), msIcon = MS.doNotDisturbOn) { sheet = "dnd" }
        }
        Spacer(Modifier.height(14.dp))
        Group {
            GroupRow(PH.pencilSimpleFill, "Edit profile", blue, msIcon = MS.edit, first = true) { app.push(Screen.EditProfile) }
            GroupRow(PH.paletteFill, "Designs", pink, msIcon = MS.palette) { app.push(Screen.Settings("designs")) }
        }
        Spacer(Modifier.height(14.dp))
        Group {
            GroupRow(PH.lockSimpleFill, "Privacy", violet, msIcon = MS.lock, first = true) { app.push(Screen.Settings("privacy")) }
            GroupRow(PH.shieldCheckFill, "Security", green, value = if (u?.obj("security")?.bool("lock") == true) tr("Passcode lock") else null, msIcon = MS.shield) { app.push(Screen.Settings("security")) }
            GroupRow(PH.bellSimpleFill, "Notifications", red, msIcon = MS.notifications) { app.push(Screen.Settings("notifications")) }
            GroupRow(PH.databaseFill, "Data and storage", orange, msIcon = MS.database) { app.push(Screen.Settings("storage")) }
            GroupRow(PH.devicesFill, "Sessions", teal, value = "${u?.arr("sessions")?.size ?: 0}", msIcon = MS.devices) { app.push(Screen.Sessions) }
        }
        AccountsSection(app)
        Spacer(Modifier.height(14.dp))
        Group {
            GroupRow(PH.lockSimpleFill, "Backup", green, msIcon = MS.cloudDownload, first = true) { sheet = "backup" }
            GroupRow(PH.robotFill, "My bots", teal, msIcon = MS.smartToy) { sheet = "bots" }
            GroupRow(PH.infoFill, "About Kosmo", blue, msIcon = MS.info) { app.push(Screen.Settings("about")) }
            GroupRow(PH.signOutFill, "Log out", danger = true, msIcon = MS.logout) { confirmLogout = true }
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
    Box(Modifier.fillMaxSize()) {
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).navigationBarsPadding().padding(bottom = 24.dp)) {
            Hero(u, big = true, top = 82.dp) {
                if (u?.bool("official") == true) Text(tr("Official account"), color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.labelLarge)
                Row(Modifier.padding(16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Action(WI.chat, "Message", Modifier.weight(1f)) { app.openDm(id) }
                    Action(WI.call, "Call", Modifier.weight(1f)) { app.startCall(id, false) }
                    Action(WI.video, "Video", Modifier.weight(1f)) { app.startCall(id, true) }
                    Action(WI.lock, "Secret", Modifier.weight(1f)) { data.me?.let { app.openChat("secret_" + app.kosmo.dmId(it, id), id) } }
                    Action(WI.block, if (blocked) "Unblock" else "Block", Modifier.weight(1f), danger = blocked) {
                        val priv = me?.obj("privacy") ?: JsonObject(emptyMap())
                        val list = priv.strings("blocked").let { if (blocked) it - id else it + id }
                        app.kosmo.updateMe(jobj("privacy" to priv.with("blocked" to list)))
                    }
                }
            }
            Column(Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Extras(app, data, u)
                Tiles(listOfNotNull(
                    u?.str("username")?.takeIf { it.isNotEmpty() }?.let { n -> TileSpec(WI.at, "Username", "@$n") { clip.setText(AnnotatedString("@$n")); app.toast = "Username copied" } },
                    TileSpec(WI.hash, "ID", u?.num("publicId")?.toString() ?: "") { clip.setText(AnnotatedString(u?.num("publicId")?.toString() ?: "")); app.toast = "ID copied" },
                    u?.str("email")?.takeIf { it.isNotEmpty() }?.let { TileSpec(WI.mail, "Email", it, wide = true) } ?: TileSpec(WI.lock, "Email", tr("Hidden")),
                    u?.str("bio")?.takeIf { it.isNotEmpty() && u.obj("privacy")?.bool("hideBio") != true }?.let { TileSpec(WI.quote, "Bio", it, wide = true) },
                    TileSpec(WI.calendar, "Joined", u?.num("createdAt")?.let { monthYear.format(Date(it)) } ?: ""),
                ))
            }
        }
        Header { BackBtn(app); TitlePill("Profile"); CircleSpacer() }
    }
}

@Composable
private fun Action(icon: ImageVector, label: String, modifier: Modifier, danger: Boolean = false, onClick: () -> Unit) {
    // .act-tile: белила .08, радиус 18, значок и подпись цвета акцента
    val look = LocalLook.current
    val c = if (danger) MaterialTheme.colorScheme.error else look.accent
    Column(
        modifier.heightIn(min = 64.dp).clip(RoundedCornerShape(18.dp)).background(if (look.glass) look.ink.copy(alpha = 0.08f) else MaterialTheme.colorScheme.secondaryContainer)
            .clickable(onClick = onClick).padding(top = 10.dp, bottom = 8.dp, start = 4.dp, end = 4.dp),
        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Icon(icon, null, tint = if (look.glass) c else MaterialTheme.colorScheme.onSecondaryContainer, modifier = Modifier.size(22.dp))
        Text(tr(label), fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = if (danger) c else look.text, maxLines = 1)
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
    val myRooms = data.chats.values.filter { isRoom(it) && !it.str("username").isNullOrEmpty() && it.str("owner") == data.me }
    var channel by remember { mutableStateOf(u.str("profileChannel")?.takeIf { id -> myRooms.any { it.str("id") == id } } ?: "") }
    var music by remember { mutableStateOf(u.arr("music").objects()) }
    var sheet by remember { mutableStateOf<String?>(null) }   // channel / music / look / avatar
    var busyWhat by remember { mutableStateOf<String?>(null) }
    val ctx = androidx.compose.ui.platform.LocalContext.current
    var field by remember { mutableStateOf<Field?>(null) }
    var crop by remember { mutableStateOf<Pair<Uri, Boolean>?>(null) }   // фото и «это аватар?»
    var busy by remember { mutableStateOf(false) }
    var askLeave by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val dirty = name != (u.str("name") ?: "") || username != (u.str("username") ?: "") || bio != (u.str("bio") ?: "") || avatar != (u.obj("avatar") ?: JsonObject(emptyMap())) || banner != u.obj("banner") || channel != (u.str("profileChannel")?.takeIf { id -> myRooms.any { it.str("id") == id } } ?: "") || music != u.arr("music").objects()
    val pickAvatar = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { it?.let { uri -> crop = uri to true } }
    val pickBanner = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { it?.let { uri -> crop = uri to false } }
    val pickMusic = rememberLauncherForActivityResult(ActivityResultContracts.OpenMultipleDocuments()) { uris ->
        if (uris.isEmpty()) return@rememberLauncherForActivityResult
        val room = 50 - music.size
        if (uris.size > room) app.toast = "Up to 50 tracks"
        busyWhat = "music"
        scope.launch {
            for (uri in uris.take(room)) {
                try {
                    val t = uploadTrack(app, ctx, uri) ?: continue
                    music = music + t
                } catch (e: Exception) { app.toast = e.message ?: "Upload failed" }
            }
            busyWhat = null
        }
    }

    fun save() {
        if (busy) { app.toast = "Wait until the upload finishes"; return }
        if (name.isBlank()) { app.toast = "The name can’t be empty"; return }
        app.kosmo.updateMe(jobj(
            "name" to name.trim(), "username" to username, "bio" to bio.trim(), "avatar" to avatar, "banner" to banner,
            "profileChannel" to channel.ifEmpty { null }, "music" to music.takeIf { it.isNotEmpty() }?.let { JsonArray(it) },
        ))
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
            else -> Box(Modifier.fillMaxSize()) {
                val look = LocalLook.current
                val preview = u.with("name" to name, "avatar" to avatar, "banner" to banner)
                Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).navigationBarsPadding().padding(bottom = 24.dp)) {
                    Box {
                        Hero(preview, top = 132.dp, avatarClick = {
                            if (avatar.str("photo") != null) sheet = "avatar" else pickAvatar.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly))
                        }, nameClick = { field = Field.Name }) {
                            if (busy) Text(tr("Uploading…"), color = look.accent, modifier = Modifier.padding(top = 6.dp))
                        }
                        // .edit-chip: «Add banner» справа вверху
                        Row(
                            Modifier.align(Alignment.TopEnd).statusBarsPadding().padding(top = 78.dp, end = 16.dp).height(34.dp).clip(CircleShape)
                                .background(if (!look.glass) MaterialTheme.colorScheme.secondaryContainer else if (banner != null) Color.Black.copy(alpha = 0.45f) else look.ink.copy(alpha = 0.1f))
                                .clickable { pickBanner.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) }.padding(start = 10.dp, end = 14.dp),
                            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp),
                        ) {
                            val fg = if (!look.glass) MaterialTheme.colorScheme.onSecondaryContainer else if (banner != null) Color.White else look.text
                            Icon(BannerIcon, null, tint = fg, modifier = Modifier.size(18.dp))
                            Text(tr(if (banner != null) "Change banner" else "Add banner"), fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = fg)
                        }
                    }
                    // канал и музыка (.edit-extras)
                    Row(Modifier.padding(horizontal = 16.dp).padding(top = 18.dp, bottom = 10.dp).height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        val ch = data.chats[channel]
                        if (ch != null) EditExtra(Modifier.weight(1f), { ChatAvatar(data, ch, 40.dp) }, ch.str("name") ?: "", "${if (isChannel(ch)) "Channel" else "Group"} · @${ch.str("username")}") { sheet = "channel" }
                        else AddTile("Add channel", Modifier.weight(1f)) { sheet = "channel" }
                        if (music.isNotEmpty()) EditExtra(Modifier.weight(1f), {
                            Box(Modifier.size(40.dp).clip(CircleShape).background(look.accent), contentAlignment = Alignment.Center) { Icon(WI.music, null, tint = look.onAccent, modifier = Modifier.size(20.dp)) }
                        }, music[0].str("title") ?: "Track", if (music.size > 1) "${music.size} tracks" else music[0].str("artist")?.ifEmpty { null } ?: "Music") { sheet = "music" }
                        else AddTile(if (busyWhat == "music") "Uploading…" else "Add music", Modifier.weight(1f)) { pickMusic.launch(arrayOf("audio/*")) }
                    }
                    Column(Modifier.padding(horizontal = 16.dp)) {
                        Tiles(listOf(
                            TileSpec(WI.user, "Name", name, pen = true) { field = Field.Name },
                            TileSpec(WI.at, "Username", if (username.isEmpty()) tr("Not set") else "@$username", muted = username.isEmpty(), pen = true) { field = Field.Username },
                            TileSpec(WI.quote, "Bio", bio.ifEmpty { tr("A few words about you") }, wide = true, muted = bio.isEmpty(), pen = true) { field = Field.Bio },
                            TileSpec(WI.palette, "Avatar", if (avatar.str("photo") != null) tr("Photo") else tr("Color") + (avatar.str("text")?.takeIf { it.isNotEmpty() }?.let { " · $it" } ?: ""), pen = true) { sheet = "look" },
                            TileSpec(WI.mail, "Email", u.str("email") ?: "", pen = true) { app.push(Screen.ChangeEmail) },
                        ))
                    }
                }
                Header {
                    BackBtn(app) { if (dirty) askLeave = true else app.pop() }
                    TitlePill("Edit profile")
                    CircleBtn(WI.check, "Save", accent = true) { save() }
                }
            }
        }
    }
    when (sheet) {
        "channel" -> PickSheet("Channel in profile", { sheet = null }) {
            PickOpt({ PickIc(WI.channel) }, "Don’t show", "Nothing in your profile", channel.isEmpty()) { channel = ""; sheet = null }
            myRooms.forEach { c ->
                PickOpt({ ChatAvatar(data, c, 40.dp) }, c.str("name") ?: "", "${if (isChannel(c)) "Channel" else "Group"} · @${c.str("username")} · ${c.strings("members").size}", channel == c.str("id")) { channel = c.str("id")!!; sheet = null }
            }
            if (myRooms.isEmpty()) Text(tr("You have no public channels or groups yet. Create one and give it a @username — then you can show it here."), fontSize = 14.sp, color = LocalLook.current.text2, modifier = Modifier.padding(4.dp))
        }
        "music" -> PickSheet("Music in profile", { sheet = null }) {
            PickOpt({ PickIc(WI.music) }, if (music.isNotEmpty()) "${music.size} of 50 tracks" else "No tracks yet", "Everyone who opens your profile can play them", null) {}
            music.forEachIndexed { i, t ->
                val dur = (t.num("dur") ?: 0L).toInt()
                PickOpt({ Text("${i + 1}", fontSize = 15.sp, color = LocalLook.current.text2, modifier = Modifier.width(40.dp), textAlign = TextAlign.Center) }, t.str("title") ?: "Track",
                    listOfNotNull(t.str("artist")?.ifEmpty { null }, if (dur > 0) "%d:%02d".format(dur / 60, dur % 60) else null).joinToString(" · "), null,
                    trailing = { Icon(WI.close, tr("Remove"), modifier = Modifier.size(20.dp).clickable { music = music.filterIndexed { j, _ -> j != i } }) }) {}
            }
            if (music.size < 50) BigButton(if (busyWhat == "music") "Uploading…" else "Add tracks", Modifier.padding(top = 8.dp)) { pickMusic.launch(arrayOf("audio/*")) }
        }
        "avatar" -> PickSheet("Profile photo", { sheet = null }) {
            PickOpt({ PickIc(WI.camera) }, "Choose photo or video", "From your gallery", null) { sheet = null; pickAvatar.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) }
            PickOpt({ PickIc(WI.close, danger = true) }, "Remove photo", "Use color and letters instead", null, danger = true) { avatar = avatar.with("photo" to null, "video" to null); sheet = null }
        }
        "look" -> PickSheet("Avatar color and letters", { sheet = null }) { LookSheet(name, avatar) { avatar = it } }
    }
    if (askLeave) AlertDialog(
        onDismissRequest = { askLeave = false },
        title = { Text(tr("Save changes?")) }, text = { Text(tr("You changed your profile. Save it before leaving?")) },
        confirmButton = { TextButton({ askLeave = false; save() }) { Text(tr("Save")) } },
        dismissButton = { TextButton({ askLeave = false; app.pop() }) { Text(tr("Discard")) } },
    )
}

/** .tile-add: пунктирная рамка, плюс в круге акцента. */
@Composable
private fun AddTile(label: String, modifier: Modifier, onClick: () -> Unit) {
    val look = LocalLook.current
    val cs = MaterialTheme.colorScheme
    val line = if (look.glass) look.ink.copy(alpha = 0.22f) else cs.outlineVariant
    val r = if (look.glass) 24.dp else 28.dp
    Column(
        modifier.fillMaxHeight().heightIn(min = 104.dp).clip(RoundedCornerShape(r))
            .drawBehind {
                val w = 1.5.dp.toPx()
                drawRoundRect(line, topLeft = androidx.compose.ui.geometry.Offset(w / 2, w / 2), size = androidx.compose.ui.geometry.Size(size.width - w, size.height - w),
                    cornerRadius = androidx.compose.ui.geometry.CornerRadius(r.toPx()), style = androidx.compose.ui.graphics.drawscope.Stroke(w, pathEffect = androidx.compose.ui.graphics.PathEffect.dashPathEffect(floatArrayOf(4.dp.toPx(), 4.dp.toPx()))))
            }
            .clickable(onClick = onClick).padding(12.dp),
        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterVertically),
    ) {
        Box(Modifier.size(34.dp).clip(CircleShape).background(if (look.glass) look.accent else cs.primaryContainer), contentAlignment = Alignment.Center) {
            Icon(WI.plus, null, tint = if (look.glass) Color.White else cs.onPrimaryContainer, modifier = Modifier.size(20.dp))
        }
        Text(tr(label), fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = look.text2)
    }
}

/** Канал или музыка, уже выбранные в редакторе. */
@Composable
private fun EditExtra(modifier: Modifier, icon: @Composable () -> Unit, title: String, sub: String, onClick: () -> Unit) {
    val look = LocalLook.current
    Column(
        modifier.fillMaxHeight().clip(RoundedCornerShape(if (look.glass) 24.dp else 28.dp)).background(if (look.glass) look.cell else MaterialTheme.colorScheme.surfaceContainer)
            .clickable(onClick = onClick).padding(14.dp),
    ) {
        icon()
        Text(title, fontSize = 16.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 8.dp))
        Text(tr(sub), fontSize = 13.sp, color = look.text2, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

/** Лист выбора (.pick-sheet): заголовок и список строк. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PickSheet(title: String, onClose: () -> Unit, content: @Composable ColumnScope.() -> Unit) {
    val look = LocalLook.current
    androidx.compose.material3.ModalBottomSheet(onClose, sheetState = androidx.compose.material3.rememberModalBottomSheetState(skipPartiallyExpanded = true), containerColor = if (look.glass) Color(if (look.dark) 0xFF1C1C1E else 0xFFF2F2F7) else MaterialTheme.colorScheme.surfaceContainerLow) {
        Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp).padding(bottom = 24.dp)) {
            Text(tr(title), fontSize = 20.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(start = 4.dp, bottom = 14.dp))
            Column(Modifier.clip(RoundedCornerShape(if (look.glass) 20.dp else 0.dp)), verticalArrangement = Arrangement.spacedBy(2.dp)) { content() }
        }
    }
}

/** .pick-ic: квадрат 40 с акцентом 22 %. */
@Composable
fun PickIc(icon: ImageVector, danger: Boolean = false) {
    val look = LocalLook.current
    val c = if (danger) MaterialTheme.colorScheme.error else look.accent
    Box(Modifier.size(40.dp).clip(RoundedCornerShape(12.dp)).background(c.copy(alpha = 0.22f)), contentAlignment = Alignment.Center) { Icon(icon, null, tint = c, modifier = Modifier.size(22.dp)) }
}

/** .pick-opt: значок, жирная строка и подпись, справа кружок выбора. on = null — без кружка. */
@Composable
fun PickOpt(icon: @Composable () -> Unit, title: String, sub: String, on: Boolean?, danger: Boolean = false, trailing: (@Composable () -> Unit)? = null, onClick: () -> Unit) {
    val look = LocalLook.current
    Row(
        Modifier.fillMaxWidth().heightIn(min = 62.dp).background(if (look.glass) look.ink.copy(alpha = 0.06f) else MaterialTheme.colorScheme.surfaceContainerHigh)
            .clickable(onClick = onClick).padding(horizontal = 14.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        icon()
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(tr(title), fontSize = 16.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis, color = if (danger) MaterialTheme.colorScheme.error else look.text)
            if (sub.isNotEmpty()) Text(tr(sub), fontSize = 13.sp, color = look.text2, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
        trailing?.invoke()
        if (on != null) Box(
            Modifier.size(22.dp).clip(CircleShape).then(
                if (on) Modifier.background(look.accent).padding(6.dp).clip(CircleShape).background(Color.White).padding(3.dp).clip(CircleShape).background(look.accent)
                else Modifier.border(2.dp, look.text3, CircleShape),
            ),
        )
    }
}

/** Цвет и буквы аватарки (как openLookSheet на сайте). */
@Composable
@OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
private fun LookSheet(name: String, avatar: JsonObject, onChange: (JsonObject) -> Unit) {
    val look = LocalLook.current
    var letters by remember { mutableStateOf(avatar.str("text") ?: "") }
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(look.ink.copy(alpha = 0.06f)).padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Box(Modifier.fillMaxWidth().padding(top = 4.dp, bottom = 8.dp), contentAlignment = Alignment.Center) {
            UserAvatar(jobj("name" to name, "avatar" to avatar.with("photo" to null, "video" to null)), 96.dp)
        }
        if (avatar.str("photo") != null) Text(tr("Color and letters are shown when there is no photo."), fontSize = 14.sp, color = look.text2)
        Text(tr("Color"), fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = look.text2, modifier = Modifier.padding(start = 4.dp))
        androidx.compose.foundation.layout.FlowRow(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            val cur = avatar["color"]?.let { (it as? JsonPrimitive)?.content?.toIntOrNull() }
            Box(
                Modifier.size(48.dp).border(2.dp, if (cur == null) look.text else Color.Transparent, CircleShape).padding(4.dp).clip(CircleShape).background(look.ink.copy(alpha = 0.1f))
                    .clickable { onChange(avatar.with("color" to null)) },
                contentAlignment = Alignment.Center,
            ) { Text(tr("Auto"), fontSize = 11.sp, fontWeight = FontWeight.Bold, color = look.text2) }
            AvatarColors.forEachIndexed { i, (a, b) ->
                Box(
                    Modifier.size(48.dp).border(2.dp, if (cur == i) look.text else Color.Transparent, CircleShape).padding(4.dp).clip(CircleShape)
                        .background(Brush.linearGradient(listOf(a, b))).clickable { onChange(avatar.with("color" to i)) },
                )
            }
        }
        Text(tr("Letters"), fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = look.text2, modifier = Modifier.padding(start = 4.dp, top = 6.dp))
        BasicTextField(
            value = letters,
            onValueChange = { v -> letters = v.take(4); onChange(avatar.with("text" to v.trim().take(2).uppercase())) },
            singleLine = true,
            textStyle = TextStyle(fontSize = 17.sp, color = look.text),
            cursorBrush = androidx.compose.ui.graphics.SolidColor(look.accent),
            modifier = Modifier.fillMaxWidth().height(50.dp).clip(CircleShape).background(look.field).padding(horizontal = 20.dp).wrapContentHeight(),
            decorationBox = { inner -> Box { if (letters.isEmpty()) Text(name.split(" ").mapNotNull { it.firstOrNull()?.uppercase() }.take(2).joinToString("").ifEmpty { tr("Auto") }, color = look.text3, fontSize = 17.sp); inner() } },
        )
    }
}

/** Трек в профиль: файл → загрузка, «Исполнитель - Название» из имени файла, длительность. */
private suspend fun uploadTrack(app: AppState, ctx: android.content.Context, uri: Uri): JsonObject? = kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.IO) {
    val cr = ctx.contentResolver
    var fname = "Track"; var size = 0L
    cr.query(uri, null, null, null, null)?.use { c ->
        if (c.moveToFirst()) {
            c.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME).takeIf { it >= 0 }?.let { fname = c.getString(it) ?: fname }
            c.getColumnIndex(android.provider.OpenableColumns.SIZE).takeIf { it >= 0 }?.let { size = c.getLong(it) }
        }
    }
    if (size > 15L * 1024 * 1024) { kotlinx.coroutines.withContext(kotlinx.coroutines.Dispatchers.Main) { app.toast = "The track is too large (max 15 MB)" }; return@withContext null }
    val file = java.io.File(ctx.cacheDir, "track-" + System.nanoTime())
    cr.openInputStream(uri)?.use { inp -> file.outputStream().use { inp.copyTo(it) } } ?: return@withContext null
    val dur = runCatching {
        android.media.MediaMetadataRetriever().run { setDataSource(file.path); val d = extractMetadata(android.media.MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: 0L; release(); d / 1000 }
    }.getOrDefault(0L)
    val base = fname.replace(Regex("\\.[a-zA-Z0-9]+$"), "")
    val (artist, title) = if (" - " in base) base.substringBefore(" - ") to base.substringAfter(" - ") else "" to base
    val media = app.api.upload(file, cr.getType(uri) ?: "audio/mpeg")
    file.delete()
    jobj("media" to media, "title" to title.trim().take(80), "artist" to artist.trim().take(60), "dur" to dur)
}

/** Смена почты: код на старую → новая почта → код на новую (как панель «Change email» на сайте). */
@Composable
fun ChangeEmailScreen(app: AppState) {
    val data by app.kosmo.data.collectAsState()
    val look = LocalLook.current
    val scope = rememberCoroutineScope()
    var step by remember { mutableStateOf("intro") }
    var ticket by remember { mutableStateOf<String?>(null) }
    var newEmail by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val current = data.user?.str("email") ?: ""
    BackHandler { app.pop() }
    Box(Modifier.fillMaxSize()) {
        AnimatedContent(step, transitionSpec = { fadeIn() togetherWith fadeOut() }, label = "email") { st ->
            Column(Modifier.fillMaxSize().statusBarsPadding().padding(top = 96.dp).padding(horizontal = 24.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(14.dp)) {
                when (st) {
                    "intro" -> {
                        Box(Modifier.size(84.dp).clip(RoundedCornerShape(28.dp)).background(if (look.glass) Color(0x290A84FF) else MaterialTheme.colorScheme.primaryContainer), contentAlignment = Alignment.Center) {
                            Icon(WI.mail, null, tint = if (look.glass) Color(0xFF64B5FF) else MaterialTheme.colorScheme.onPrimaryContainer, modifier = Modifier.size(40.dp))
                        }
                        Text(current, fontSize = 18.sp, fontWeight = FontWeight.SemiBold, color = look.accent)
                        Text(tr("To confirm it's you, we'll send a code to your current email. Then you'll enter the new email and confirm it too."), fontSize = 15.sp, lineHeight = 22.sp, color = look.text2, textAlign = TextAlign.Center, modifier = Modifier.widthIn(max = 340.dp))
                        BigButton(if (busy) "…" else "Change email", enabled = !busy) {
                            busy = true
                            scope.launch {
                                try { app.api.call("POST", "/api/email/code", jobj("step" to "old")); error = null; step = "old-code" } catch (e: Exception) { app.toast = e.message }
                                busy = false
                            }
                        }
                    }
                    "old-code" -> CodeStep(current, error) { code ->
                        scope.launch {
                            try { ticket = app.api.call("POST", "/api/email/verify", jobj("step" to "old", "code" to code)).str("ticket"); error = null; step = "new-email" }
                            catch (e: Exception) { error = e.message }
                        }
                    }
                    "new-email" -> {
                        Text(tr("New email"), fontSize = 24.sp, fontWeight = FontWeight.Bold)
                        var v by remember { mutableStateOf("") }
                        val ok = Regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$").matches(v.trim())
                        BasicTextField(
                            value = v, onValueChange = { v = it.trim().lowercase(); error = null }, singleLine = true,
                            textStyle = TextStyle(fontSize = 17.sp, color = look.text),
                            cursorBrush = androidx.compose.ui.graphics.SolidColor(look.accent),
                            keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(keyboardType = androidx.compose.ui.text.input.KeyboardType.Email),
                            modifier = Modifier.fillMaxWidth().height(56.dp).clip(CircleShape).background(look.field)
                                .then(if (error != null) Modifier.border(1.5.dp, MaterialTheme.colorScheme.error, CircleShape) else Modifier).padding(horizontal = 20.dp).wrapContentHeight(),
                            decorationBox = { inner -> Box { if (v.isEmpty()) Text("new@email.com", color = look.text3, fontSize = 17.sp); inner() } },
                        )
                        BigButton(if (busy) "…" else "Send code", enabled = ok && !busy) {
                            if (v == current) { app.toast = "This is already your email"; return@BigButton }
                            busy = true
                            scope.launch {
                                try { app.api.call("POST", "/api/email/code", jobj("step" to "new", "email" to v, "ticket" to ticket)); newEmail = v; error = null; step = "new-code" }
                                catch (e: Exception) { error = e.message; app.toast = e.message }
                                busy = false
                            }
                        }
                    }
                    "new-code" -> CodeStep(newEmail, error) { code ->
                        scope.launch {
                            try { app.api.call("POST", "/api/email/verify", jobj("step" to "new", "email" to newEmail, "code" to code, "ticket" to ticket)); runCatching { app.kosmo.load() }; step = "done" }
                            catch (e: Exception) { error = e.message }
                        }
                    }
                    else -> {
                        Box(Modifier.size(84.dp).clip(CircleShape).background(Color(0x2930D158)), contentAlignment = Alignment.Center) { Icon(WI.check, null, tint = Color(0xFF4CD964), modifier = Modifier.size(40.dp)) }
                        Text(tr("Email changed"), fontSize = 24.sp, fontWeight = FontWeight.Bold)
                        Text(newEmail, fontSize = 18.sp, fontWeight = FontWeight.SemiBold, color = look.accent)
                        BigButton("Done") { app.pop() }
                    }
                }
            }
        }
        Header { BackBtn(app); TitlePill("Change email"); CircleSpacer() }
    }
}

private val PenIcon = stroke(P("M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"))
private val BannerIcon = stroke(
    P("M6 5h12a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3z"),
    P("M10.1 10a1.6 1.6 0 1 1-3.2 0a1.6 1.6 0 1 1 3.2 0z"),
    P("M4 17l5-4.5 3.5 3 3-3L20 16"),
)

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
    Column(Modifier.fillMaxSize().statusBarsPadding()) {
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
    Column(Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding()) {
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
    LaunchedEffect(notes.size) { app.setPref(KOSMO_CHAT, "readAt", System.currentTimeMillis()) }
    Column(Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding()) {
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

