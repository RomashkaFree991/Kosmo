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
    shape: Shape? = null,
    media: (String) -> String = LocalMedia.current,
) {
    // Material You: аватарки в форме M3 (Designs → Chat avatars), как clip-path на сайте
    val shape = shape ?: if (LocalLook.current.glass) CircleShape else m3Shape(Design.chatShape)
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
fun UserAvatar(u: JsonObject?, size: Dp, modifier: Modifier = Modifier, shape: Shape? = null) =
    Avatar(u?.str("name"), u?.obj("avatar"), size, modifier, shape)

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

/* ---------- Формы Material 3 (как SHAPES в web/js/design.js) ---------- */
val SHAPE_IDS = listOf("circle" to "Circle", "squircle" to "Square", "cookie4" to "4-sided cookie", "cookie7" to "7-sided cookie", "cookie9" to "9-sided cookie", "cookie12" to "12-sided cookie", "clover" to "4-leaf clover", "flower" to "Flower")

private val shapeCache = HashMap<String, List<Pair<Float, Float>>>()

/** Точки контура в единичном круге [-1, 1] — тот же расчёт, что shapePoints() на сайте. */
private fun shapePoints(id: String): List<Pair<Float, Float>> = shapeCache.getOrPut(id) {
    val wave: Pair<Int, Double>? = when (id) {
        "cookie4" -> 4 to 0.07; "cookie7" -> 7 to 0.065; "cookie9" -> 9 to 0.055; "cookie12" -> 12 to 0.04
        "clover" -> 4 to 0.24; "flower" -> 8 to 0.12; else -> null
    }
    val pts = (0 until 200).map { i ->
        val t = i / 200.0 * Math.PI * 2 - Math.PI / 2
        if (id == "squircle") {
            val e = 2.0 / 5
            Math.signum(Math.cos(t)) * Math.pow(Math.abs(Math.cos(t)), e) to Math.signum(Math.sin(t)) * Math.pow(Math.abs(Math.sin(t)), e)
        } else {
            val r = if (wave == null) 1.0 else 1 + wave.second * Math.cos(wave.first * t)
            Math.cos(t) * r to Math.sin(t) * r
        }
    }
    val mx = pts.maxOf { maxOf(Math.abs(it.first), Math.abs(it.second)) }
    pts.map { (it.first / mx).toFloat() to (it.second / mx).toFloat() }
}

fun m3Shape(id: String): Shape = if (id == "circle") CircleShape else androidx.compose.foundation.shape.GenericShape { size, _ ->
    val pts = shapePoints(id)
    pts.forEachIndexed { i, (x, y) ->
        val px = size.width / 2 * (1 + x); val py = size.height / 2 * (1 + y)
        if (i == 0) moveTo(px, py) else lineTo(px, py)
    }
    close()
}
