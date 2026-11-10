package app.kosmo.chat.ui

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.ImageDecoder
import android.net.Uri
import android.os.Build
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.BlendMode
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.dp
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import java.io.File
import java.io.FileOutputStream

fun loadBitmap(ctx: android.content.Context, uri: Uri, max: Int = 2048): Bitmap? = runCatching {
    if (Build.VERSION.SDK_INT >= 28) ImageDecoder.decodeBitmap(ImageDecoder.createSource(ctx.contentResolver, uri)) { d, info, _ ->
        val k = minOf(1f, max.toFloat() / maxOf(info.size.width, info.size.height))
        d.setTargetSize((info.size.width * k).toInt().coerceAtLeast(1), (info.size.height * k).toInt().coerceAtLeast(1))
        d.allocator = ImageDecoder.ALLOCATOR_SOFTWARE
    } else ctx.contentResolver.openInputStream(uri)!!.use { BitmapFactory.decodeStream(it) }
}.getOrNull()

/**
 * Обрезка фото: картинка посередине, круг (аватар) или рамка (баннер),
 * снаружи затемнение. Двигать — пальцем, масштаб — щипком.
 */
@Composable
fun Cropper(uri: Uri, circle: Boolean, aspect: Float, title: String, onCancel: () -> Unit, onDone: (File) -> Unit) {
    val ctx = LocalContext.current
    val bmp = remember(uri) { loadBitmap(ctx, uri) }
    if (bmp == null) { onCancel(); return }
    var scale by remember { mutableFloatStateOf(1f) }
    var offset by remember { mutableStateOf(Offset.Zero) }
    val density = LocalDensity.current
    var holeSize by remember { mutableStateOf(Size.Zero) }
    val img = remember(bmp) { bmp.asImageBitmap() }
    Column(Modifier.fillMaxSize().background(Color.Black).safeDrawingPadding()) {
        Row(Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            BackCircleRaw(onCancel)
            Box(Modifier.weight(1f).size(48.dp).background(Color.White.copy(alpha = 0.12f), RoundedCornerShape(24.dp)), contentAlignment = Alignment.Center) { Text(title, color = Color.White, style = MaterialTheme.typography.titleMedium) }
            FilledIconButton(onClick = {
                // кусок картинки под рамкой → JPEG
                val stage = holeSize
                val base = maxOf(stage.width / bmp.width, stage.height / bmp.height)
                val k = base * scale
                val cx = bmp.width / 2f - offset.x / k
                val cy = bmp.height / 2f - offset.y / k
                val sw = stage.width / k
                val sh = stage.height / k
                val x = (cx - sw / 2).coerceIn(0f, bmp.width - sw)
                val y = (cy - sh / 2).coerceIn(0f, bmp.height - sh)
                val out = Bitmap.createBitmap(bmp, x.toInt(), y.toInt(), sw.toInt().coerceAtMost(bmp.width), sh.toInt().coerceAtMost(bmp.height))
                val target = if (circle) 640 else 1600
                val scaled = if (out.width > target) Bitmap.createScaledBitmap(out, target, (target * out.height / out.width.toFloat()).toInt(), true) else out
                val f = File(ctx.cacheDir, "crop-${System.currentTimeMillis()}.jpg")
                FileOutputStream(f).use { scaled.compress(Bitmap.CompressFormat.JPEG, 90, it) }
                onDone(f)
            }, modifier = Modifier.size(48.dp)) { Icon(Icons.Rounded.Check, "Done") }
        }
        BoxWithConstraints(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
            val w = with(density) { maxWidth.toPx() }
            val h = with(density) { maxHeight.toPx() }
            val hole = if (circle) Size(minOf(w, h) - with(density) { 40.dp.toPx() }, minOf(w, h) - with(density) { 40.dp.toPx() })
            else (w - with(density) { 24.dp.toPx() }).let { Size(it, it / aspect) }
            if (holeSize != hole) androidx.compose.runtime.SideEffect { holeSize = hole }
            val base = maxOf(hole.width / bmp.width, hole.height / bmp.height)
            fun clamp() {
                scale = scale.coerceIn(1f, 6f)
                val k = base * scale
                val mx = ((bmp.width * k) - hole.width) / 2
                val my = ((bmp.height * k) - hole.height) / 2
                offset = Offset(offset.x.coerceIn(-mx, mx), offset.y.coerceIn(-my, my))
            }
            Canvas(Modifier.fillMaxSize().pointerInput(Unit) { detectTransformGestures { _, pan, zoom, _ -> scale *= zoom; offset += pan; clamp() } }) {
                val k = base * scale
                val dw = bmp.width * k
                val dh = bmp.height * k
                drawImage(
                    img,
                    dstOffset = androidx.compose.ui.unit.IntOffset((center.x - dw / 2 + offset.x).toInt(), (center.y - dh / 2 + offset.y).toInt()),
                    dstSize = androidx.compose.ui.unit.IntSize(dw.toInt(), dh.toInt()),
                )
            }
            // затемнение снаружи и рамка
            Canvas(Modifier.fillMaxSize().graphicsLayer { compositingStrategy = CompositingStrategy.Offscreen }) {
                drawRect(Color.Black.copy(alpha = 0.6f))
                val tl = Offset((size.width - hole.width) / 2, (size.height - hole.height) / 2)
                if (circle) {
                    drawCircle(Color.Transparent, hole.width / 2, center, blendMode = BlendMode.Clear)
                    drawCircle(Color.White.copy(alpha = 0.9f), hole.width / 2, center, style = Stroke(2.dp.toPx()))
                } else {
                    val r = CornerRadius(18.dp.toPx())
                    drawRoundRect(Color.Transparent, tl, hole, r, blendMode = BlendMode.Clear)
                    drawRoundRect(Color.White.copy(alpha = 0.9f), tl, hole, r, style = Stroke(2.dp.toPx()))
                }
            }
        }
        Text(tr("Drag to move, pinch to zoom"), color = Color.White.copy(alpha = 0.6f), style = MaterialTheme.typography.bodySmall, modifier = Modifier.align(Alignment.CenterHorizontally).padding(16.dp))
    }
}

@Composable
fun BackCircleRaw(onClick: () -> Unit) {
    androidx.compose.material3.FilledTonalIconButton(onClick = onClick, modifier = Modifier.size(48.dp)) {
        Icon(androidx.compose.material.icons.Icons.AutoMirrored.Rounded.ArrowBack, "Back")
    }
}
