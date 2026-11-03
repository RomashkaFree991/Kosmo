package app.kosmo.chat.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Bookmark
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.kosmo.chat.core.num
import app.kosmo.chat.core.obj
import app.kosmo.chat.core.str
import coil.compose.AsyncImage
import kotlinx.serialization.json.JsonObject

/** Аватарка: своё фото или градиент с буквами (цвет и буквы — из настроек человека). */
@Composable
fun Avatar(
    name: String?,
    avatar: JsonObject?,
    size: Dp,
    modifier: Modifier = Modifier,
    shape: Shape = CircleShape,
    media: (String) -> String = LocalMedia.current,
) {
    val idx = avatar?.num("color")?.toInt()?.takeIf { it in AvatarColors.indices } ?: avatarIndex(name.orEmpty())
    val (c1, c2) = AvatarColors[idx]
    val photo = avatar?.str("photo")
    Box(
        modifier.size(size).clip(shape).background(Brush.linearGradient(listOf(c1, c2), start = androidx.compose.ui.geometry.Offset(size.value, 0f), end = androidx.compose.ui.geometry.Offset(0f, size.value * 3))),
        contentAlignment = Alignment.Center,
    ) {
        val text = avatar?.str("text")?.takeIf { it.isNotBlank() } ?: initials(name)
        Text(text, color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = (size.value * 0.38f).sp, maxLines = 1)
        if (photo != null) AsyncImage(model = media(photo), contentDescription = null, contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
    }
}

@Composable
fun UserAvatar(u: JsonObject?, size: Dp, modifier: Modifier = Modifier) =
    Avatar(u?.str("name"), u?.obj("avatar"), size, modifier)

/** Аватарка чата: человек, группа/канал (скруглённый квадрат у каналов) или «Избранное». */
@Composable
fun ChatAvatar(data: app.kosmo.chat.core.Data, c: JsonObject, size: Dp, modifier: Modifier = Modifier) {
    when {
        isSaved(c) -> Box(modifier.size(size).clip(CircleShape).background(Brush.linearGradient(listOf(Color(0xFF72D5FD), Color(0xFF2A9EF1)))), contentAlignment = Alignment.Center) {
            Icon(Icons.Rounded.Bookmark, null, tint = Color.White, modifier = Modifier.size(size * 0.48f))
        }
        isRoom(c) -> Avatar(c.str("name"), c.obj("avatar"), size, modifier, shape = if (isChannel(c)) RoundedCornerShape(size * 0.3f) else CircleShape)
        else -> UserAvatar(data.otherOf(c), size, modifier)
    }
}

@Composable
fun KosmoAvatar(size: Dp, modifier: Modifier = Modifier) {
    Box(modifier.size(size).clip(CircleShape).background(Color(0xFF14102A)), contentAlignment = Alignment.Center) {
        PlanetLogo(Modifier.size(size * 1.1f))
    }
}
