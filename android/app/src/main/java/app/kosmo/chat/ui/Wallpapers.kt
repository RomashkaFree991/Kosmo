package app.kosmo.chat.ui

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Canvas
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.PathMeasure
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.drawscope.translate
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.graphics.vector.PathParser
import com.materialkolor.hct.Hct
import com.materialkolor.scheme.SchemeTonalSpot
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.sin

/**
 * Обои — порт wallpaperHtml() из web/js/design.js: та же сцена 390×844
 * («cover» под экран), те же фигуры и тона палитры (--wp-bg, a, b, line, dot, dot2),
 * те же движения: клевер крутится, звёзды мерцают, луна идёт по орбите,
 * пятна света дрейфуют, пузыри всплывают, сияние переливается.
 */
val WALLPAPERS = listOf("custom" to "Your photo", "black" to "Black", "color" to "Color", "shapes" to "Cosmos", "aurora" to "Aurora", "dunes" to "Dunes", "bubbles" to "Bubbles", "nebula" to "Nebula", "waves" to "Waves", "glow" to "Glow")
val WP_FOR = mapOf("material" to listOf("color", "shapes", "waves", "glow", "black"), "glass" to listOf("black", "shapes", "aurora", "dunes", "bubbles", "nebula", "waves", "glow"))

private class WpColors(val bg: Color, val a: Color, val b: Color, val line: Color, val dot: Color, val dot2: Color, val container: Color)

/** Схема по выбранному стилю цвета (Designs → Color style), как applySeed() на сайте. */
fun styleScheme(seed: Color, dark: Boolean, style: String = Design.colorStyle): com.materialkolor.scheme.DynamicScheme {
    val h = Hct.fromInt(seed.toArgb())
    return when (style) {
        "vibrant" -> com.materialkolor.scheme.SchemeVibrant(h, dark, 0.0)
        "content" -> com.materialkolor.scheme.SchemeContent(h, dark, 0.0)
        "fidelity" -> com.materialkolor.scheme.SchemeFidelity(h, dark, 0.0)
        "neutral" -> com.materialkolor.scheme.SchemeNeutral(h, dark, 0.0)
        "mono" -> com.materialkolor.scheme.SchemeMonochrome(h, dark, 0.0)
        else -> SchemeTonalSpot(h, dark, 0.0)
    }
}

private fun wpColors(seed: Color, dark: Boolean, glass: Boolean, style: String): WpColors {
    val s = styleScheme(seed, dark, style)
    val p = s.primaryPalette; val t = s.tertiaryPalette; val n = s.neutralPalette
    val c = { i: Int -> Color(i) }
    val tones = if (dark) {
        if (glass) listOf(p.tone(4), p.tone(13), t.tone(13), n.tone(70), p.tone(45), n.tone(90)) else listOf(p.tone(12), p.tone(24), t.tone(26), n.tone(92), p.tone(62), n.tone(98))
    } else {
        if (glass) listOf(n.tone(96), p.tone(90), t.tone(92), n.tone(55), p.tone(65), n.tone(35)) else listOf(p.tone(94), p.tone(86), t.tone(88), n.tone(30), p.tone(55), n.tone(20))
    }
    return WpColors(c(tones[0]), c(tones[1]), c(tones[2]), c(tones[3]), c(tones[4]), c(tones[5]), c(p.tone(if (dark) 30 else 90)))
}

private val STAR by lazy { PathParser().parsePathString("M0-10C1.4-1.4 1.4-1.4 10 0 1.4 1.4 1.4 1.4 0 10-1.4 1.4-1.4 1.4-10 0-1.4-1.4-1.4-1.4 0-10Z").toPath() }
private fun svgPath(d: String) = PathParser().parsePathString(d).toPath()

/** Формы Material 3 (как shapePoints() на сайте): cookie7, clover… */
private fun shape(n: Int, amp: Float, cx: Float, cy: Float, rad: Float): Path {
    val pts = (0 until 200).map { i ->
        val tt = i / 200.0 * PI * 2 - PI / 2
        val r = 1 + amp * cos(n * tt)
        cos(tt) * r to sin(tt) * r
    }
    val mx = pts.maxOf { max(abs(it.first), abs(it.second)) }
    return Path().apply {
        pts.forEachIndexed { i, (x, y) -> val px = (cx + x / mx * rad).toFloat(); val py = (cy + y / mx * rad).toFloat(); if (i == 0) moveTo(px, py) else lineTo(px, py) }
        close()
    }
}

/** Текущие обои для стиля (Профиль → Designs → Background). */
@Composable
fun Wallpaper(modifier: Modifier = Modifier, kind: String? = null) {
    val look = LocalLook.current
    val k = kind ?: Design.wallpaper(look.glass)
    if (k == "black" || k == "custom") return
    val style = Design.colorStyle
    val cols = remember(Design.seed, look.dark, look.glass, style) { wpColors(Design.seed, look.dark, look.glass, style) }
    val anim = rememberInfiniteTransition(label = "wp")
    val spin by anim.animateFloat(0f, 360f, infiniteRepeatable(tween(90_000, easing = LinearEasing)), label = "spin")
    val tw by anim.animateFloat(0f, 1f, infiniteRepeatable(tween(4000, easing = LinearEasing)), label = "tw")
    val drift by anim.animateFloat(0f, 1f, infiniteRepeatable(tween(18_000), RepeatMode.Reverse), label = "drift")
    val moon by anim.animateFloat(0f, 1f, infiniteRepeatable(tween(22_000), RepeatMode.Reverse), label = "moon")
    val rise by anim.animateFloat(0f, 1f, infiniteRepeatable(tween(24_000, easing = LinearEasing)), label = "rise")
    val aur by anim.animateFloat(0f, 1f, infiniteRepeatable(tween(16_000), RepeatMode.Reverse), label = "aur")
    Canvas(modifier) {
        if (k == "color") { drawRect(cols.container); return@Canvas }
        // сцена 390×844 «покрывает» экран
        val sc = max(size.width / 390f, size.height / 844f)
        withTransform({ translate((size.width - 390 * sc) / 2, (size.height - 844 * sc) / 2); scale(sc, sc, Offset.Zero) }) {
            drawRect(cols.bg, size = Size(390f, 844f))
            fun star(x: Float, y: Float, r: Float, c: Color, delay: Float) {
                val ph = ((tw + delay / 4f) % 1f)
                val k2 = 1f - 0.25f * sin(ph * PI.toFloat()) // 50%: scale .75, opacity .25
                val a = 1f - 0.75f * sin(ph * PI.toFloat())
                withTransform({ translate(x, y); scale(r / 10f * k2, r / 10f * k2, Offset.Zero) }) { drawPath(STAR, c, alpha = a) }
            }
            fun glowBlob(x: Float, y: Float, w: Float, c: Color, dx: Float = 0f, dy: Float = 0f) {
                drawCircle(Brush.radialGradient(listOf(c, Color.Transparent), Offset(x + w / 2 + dx, y + w / 2 + dy), w / 2), w / 2, Offset(x + w / 2 + dx, y + w / 2 + dy))
            }
            when (k) {
                "shapes" -> {
                    rotate(-32f, Offset(70f, 120f)) { drawRoundRect(cols.a, Offset(-90f, 70f), Size(300f, 118f), androidx.compose.ui.geometry.CornerRadius(59f)) }
                    drawPath(shape(7, 0.065f, 74f, 610f, 40f), cols.b, alpha = 0.75f)
                    val orbit = svgPath("M-40 520C40 380 330 330 430 400")
                    drawPath(orbit, cols.line, alpha = 0.55f, style = Stroke(2.4f, cap = StrokeCap.Round, pathEffect = PathEffect.dashPathEffect(floatArrayOf(1f, 11f))))
                    rotate(-16f, Offset(290f, 720f)) { drawPath(svgPath("M120 720A170 34 0 0 1 460 720"), cols.line, alpha = 0.4f, style = Stroke(7f, cap = StrokeCap.Round)) }
                    drawCircle(cols.a, 118f, Offset(290f, 720f))
                    drawCircle(cols.bg, 20f, Offset(252f, 680f), alpha = 0.35f)
                    drawCircle(cols.bg, 12f, Offset(318f, 752f), alpha = 0.3f)
                    rotate(-16f, Offset(290f, 720f)) { drawPath(svgPath("M120 720A170 34 0 0 0 460 720"), cols.line, alpha = 0.65f, style = Stroke(7f, cap = StrokeCap.Round)) }
                    // клевер вращается
                    rotate(spin, Offset(318f, 250f)) { drawPath(shape(4, 0.24f, 318f, 250f, 74f), cols.b) }
                    // луна по орбите (15%…85% пути)
                    val pm = PathMeasure().apply { setPath(orbit, false) }
                    val pos = pm.getPosition(pm.length * (0.15f + 0.7f * moon))
                    drawCircle(cols.dot2, 10f, pos)
                    star(196f, 132f, 11f, cols.dot2, 0f); star(58f, 330f, 7f, cols.dot, 1.2f); star(350f, 470f, 9f, cols.dot2, 2.1f)
                    star(150f, 560f, 6f, cols.dot, 0.6f); star(250f, 40f, 6f, cols.dot, 2.8f); star(40f, 790f, 8f, cols.dot2, 1.7f)
                }
                "aurora" -> {
                    drawPath(svgPath("M0 780C90 760 160 790 240 770S350 750 390 760V844H0Z"), cols.a, alpha = 0.5f)
                    drawRect(Brush.verticalGradient(listOf(Color.Transparent, Color.Black.copy(alpha = 0.35f)), 0f, 844f), size = Size(390f, 844f))
                    fun band(x: Float, y: Float, w: Float, h: Float, c: Color, phase: Float) {
                        val p = ((aur + phase) % 1f)
                        val dx = -30f + 70f * p
                        withTransform({ translate(dx, 0f); scale(1f, 0.9f + 0.25f * p, Offset(x + w / 2, y + h / 2)) }) {
                            drawOval(Brush.radialGradient(listOf(c, Color.Transparent), Offset(x + w / 2, y + h / 2), w * 0.42f), Offset(x, y), Size(w, h), alpha = 0.45f + 0.4f * p)
                        }
                    }
                    band(-120f, 60f, 640f, 360f, cols.b, 0f); band(-160f, 180f, 700f, 320f, cols.dot, 0.33f); band(-100f, 300f, 600f, 300f, cols.a, 0.66f)
                    star(60f, 60f, 4f, cols.dot2, 0f); star(320f, 110f, 5f, cols.dot2, 1.4f); star(200f, 30f, 3f, cols.dot2, 2.2f); star(350f, 640f, 4f, cols.dot2, 0.8f)
                }
                "dunes" -> {
                    drawCircle(cols.dot, 54f, Offset(300f, 190f), alpha = 0.55f)
                    drawPath(svgPath("M0 470C80 420 170 450 240 430S360 400 390 420V844H0Z"), cols.a, alpha = 0.55f)
                    drawPath(svgPath("M0 560C70 520 150 560 220 535S340 500 390 520V844H0Z"), cols.b, alpha = 0.7f)
                    drawPath(svgPath("M0 650C90 610 160 660 250 630S350 600 390 615V844H0Z"), cols.a, alpha = 0.85f)
                    drawPath(svgPath("M0 740C80 700 180 760 260 725S360 700 390 712V844H0Z"), cols.b)
                    star(80f, 120f, 5f, cols.dot2, 0.3f); star(180f, 70f, 4f, cols.dot2, 1.6f)
                }
                "bubbles" -> {
                    fun bub(x: Float, y: Float, r: Float, c: Color, d: Float) {
                        val p = ((rise + (-d / 24f) + 1f) % 1f)
                        val dy = 160f - 920f * p
                        val a = when { p < 0.15f -> p / 0.15f; p > 0.85f -> (1 - p) / 0.15f; else -> 1f } * 0.55f
                        val center = Offset(x, y + dy)
                        drawCircle(Brush.radialGradient(listOf(lerp(c, Color.White, 0.45f), c), Offset(x - r * 0.3f, y + dy - r * 0.4f), r * 1.2f), r, center, alpha = a)
                    }
                    bub(70f, 700f, 46f, cols.a, 0f); bub(300f, 620f, 62f, cols.b, -6f); bub(190f, 420f, 30f, cols.dot, -3f); bub(330f, 260f, 24f, cols.a, -9f)
                    bub(50f, 300f, 34f, cols.b, -12f); bub(230f, 150f, 18f, cols.dot, -4f); bub(120f, 520f, 14f, cols.dot, -8f)
                }
                "nebula" -> {
                    for (i in 0 until 40) drawCircle(cols.dot2, (i % 3) * 0.6f + 0.6f, Offset(((i * 97) % 390).toFloat(), ((i * 211) % 844).toFloat()), alpha = 0.3f + (i % 5) * 0.12f)
                    glowBlob(-120f, 120f, 520f, cols.b, -40f * drift, 50f * drift)
                    glowBlob(60f, 420f, 480f, cols.dot, -40f * (1 - drift), 50f * (1 - drift))
                    glowBlob(160f, -80f, 360f, cols.a, -40f * drift, 50f * drift)
                    star(90f, 200f, 7f, cols.dot2, 0f); star(300f, 520f, 6f, cols.dot2, 1.3f); star(220f, 760f, 5f, cols.dot2, 2.4f)
                }
                "waves" -> {
                    drawPath(svgPath("M0 610C70 570 140 640 210 600S330 560 390 590V844H0Z"), cols.a)
                    drawPath(svgPath("M0 700C80 660 150 730 230 690S340 660 390 690V844H0Z"), cols.b, alpha = 0.9f)
                    drawPath(svgPath("M0 140C80 180 150 110 230 150S340 190 390 160V0H0Z"), cols.a, alpha = 0.7f)
                    star(320f, 300f, 8f, cols.dot, 0f); star(70f, 420f, 5f, cols.dot2, 1.5f); star(200f, 250f, 5f, cols.dot2, 2.6f)
                }
                else -> { // glow
                    glowBlob(60f, -80f, 520f, cols.a, -40f * drift, 50f * drift)
                    glowBlob(-240f, 400f, 600f, cols.b, -40f * (1 - drift), 50f * (1 - drift))
                }
            }
        }
    }
}

@Suppress("unused") private fun DrawScope.keep() = translate(0f, 0f) {}
