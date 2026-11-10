package app.kosmo.chat.ui

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.graphics.vector.group
import androidx.compose.ui.unit.dp

/** Часть значка: контур (как svg.i на сайте: толщина 2, скруглённые концы) или заливка. */
class P(val d: String, val fill: Boolean = false, val sw: Float = 2f, val noStroke: Boolean = false)

/** Значок в стиле сайта: viewBox 24×24, обводка currentColor. */
fun stroke(vararg parts: P): ImageVector = ImageVector.Builder(defaultWidth = 24.dp, defaultHeight = 24.dp, viewportWidth = 24f, viewportHeight = 24f).apply {
    parts.forEach { p ->
        addPath(
            PathParser().parsePathString(p.d).toNodes(),
            fill = if (p.fill) SolidColor(Color.Black) else null,
            stroke = if (p.fill && p.noStroke || p.fill) null else SolidColor(Color.Black),
            strokeLineWidth = p.sw, strokeLineCap = StrokeCap.Round, strokeLineJoin = StrokeJoin.Round,
        )
    }
}.build()

/** Залитый значок (Phosphor 256×256, Material Symbols 0 −960 960 960). */
fun fillIcon(vw: Float, vh: Float, shiftY: Float, vararg ds: String): ImageVector =
    ImageVector.Builder(defaultWidth = 24.dp, defaultHeight = 24.dp, viewportWidth = vw, viewportHeight = vh).apply {
        group(translationY = shiftY) {
            ds.forEach { addPath(PathParser().parsePathString(it).toNodes(), fill = SolidColor(Color.Black)) }
        }
    }.build()
