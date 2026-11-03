package app.kosmo.chat.ui

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.graphics.drawscope.withTransform
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Логотип-планета Kosmo — точная копия SVG с сайта (viewBox 120×120):
 * планета r=27 с градиентом и объёмом, два наклонных кольца (−18°),
 * задние половины колец под планетой, передние — поверх. Свечение позади.
 * intro = true — заставка как на сайте: планета «выпрыгивает», затем
 * рисуются передние половины колец, потом задние.
 */
@Composable
fun PlanetLogo(modifier: Modifier = Modifier, intro: Boolean = false, a: Color = PlanetA, b: Color = PlanetB) {
    val body = remember { Animatable(if (intro) 0f else 1f) }
    val frontOuter = remember { Animatable(if (intro) 0f else 1f) }
    val frontInner = remember { Animatable(if (intro) 0f else 1f) }
    val backOuter = remember { Animatable(if (intro) 0f else 1f) }
    val backInner = remember { Animatable(if (intro) 0f else 1f) }
    val glow = remember { Animatable(if (intro) 0f else 1f) }
    val draw = CubicBezierEasing(0.65f, 0f, 0.35f, 1f)
    if (intro) {
      LaunchedEffect(Unit) {
        launch { glow.animateTo(1f, tween(1400)) }
        launch { body.animateTo(1f, spring(dampingRatio = 0.55f, stiffness = 260f)) }
        launch { delay(450); frontOuter.animateTo(1f, tween(650, easing = draw)) }
        launch { delay(600); frontInner.animateTo(1f, tween(650, easing = draw)) }
        launch { delay(1000); backOuter.animateTo(1f, tween(650, easing = draw)) }
        launch { delay(1150); backInner.animateTo(1f, tween(650, easing = draw)) }
      }
    }
    // планета мягко «парит», как на сайте (float 6s)
    val t = rememberInfiniteTransition(label = "float")
    val float by t.animateFloat(0f, 1f, infiniteRepeatable(tween(3000), RepeatMode.Reverse), label = "y")

    Canvas(modifier) {
        val k = size.minDimension / 120f
        val ox = (size.width - 120f * k) / 2f
        val oy = (size.height - 120f * k) / 2f - float * 5f * k * (if (intro) 0f else 1f)
        withTransform({ translate(ox, oy); scale(k, k, Offset.Zero) }) {
            // свечение
            val g = glow.value
            val gScale = if (g < 0.6f) 0.4f + g / 0.6f else 1.4f - (g - 0.6f) / 0.4f * 0.4f
            val gAlpha = if (g < 0.6f) g / 0.6f * 0.8f else 0.8f - (g - 0.6f) / 0.4f * 0.45f
            drawCircle(
                Brush.radialGradient(listOf(b.copy(alpha = gAlpha), Color.Transparent), center = Offset(60f, 60f), radius = 48f * gScale),
                radius = 48f * gScale, center = Offset(60f, 60f),
            )
            val ring = Brush.linearGradient(listOf(a, b), start = Offset(4f, 60f), end = Offset(116f, 60f))
            rotate(-18f, Offset(60f, 60f)) {
                // задние половины: сверху, от правого края к левому
                arc(ring, 56f, 15f, 3f, 0.95f, start = 0f, sweep = -180f * backOuter.value)
                arc(ring, 46f, 11.5f, 1.6f, 0.5f, start = 0f, sweep = -180f * backInner.value)
            }
            // сама планета: градиент + объём
            val s = body.value
            if (s > 0.001f) withTransform({ rotate(-40f * (1f - s), Offset(60f, 60f)); scale(s, s, Offset(60f, 60f)) }) {
                drawCircle(
                    Brush.linearGradient(listOf(a, b), start = Offset(33f + 54f * 0.15f, 33f + 54f * 0.1f), end = Offset(33f + 54f * 0.85f, 33f + 54f * 0.95f)),
                    radius = 27f, center = Offset(60f, 60f), alpha = s.coerceIn(0f, 1f),
                )
                drawCircle(
                    Brush.radialGradient(
                        0f to Color.White.copy(alpha = 0.55f), 0.45f to Color.White.copy(alpha = 0f), 1f to Color.Black.copy(alpha = 0.45f),
                        center = Offset(33f + 54f * 0.35f, 33f + 54f * 0.3f), radius = 54f * 0.75f,
                    ),
                    radius = 27f, center = Offset(60f, 60f), alpha = s.coerceIn(0f, 1f),
                )
            }
            rotate(-18f, Offset(60f, 60f)) {
                // передние половины: снизу, от левого края к правому
                arc(ring, 56f, 15f, 3f, 0.95f, start = 180f, sweep = -180f * frontOuter.value)
                arc(ring, 46f, 11.5f, 1.6f, 0.5f, start = 180f, sweep = -180f * frontInner.value)
            }
        }
    }
}

private fun DrawScope.arc(brush: Brush, rx: Float, ry: Float, w: Float, alpha: Float, start: Float, sweep: Float) {
    if (kotlin.math.abs(sweep) < 0.5f) return
    drawArc(
        brush, startAngle = start, sweepAngle = sweep, useCenter = false,
        topLeft = Offset(60f - rx, 60f - ry), size = Size(rx * 2, ry * 2), alpha = alpha,
        style = Stroke(width = w, cap = StrokeCap.Round),
    )
}
