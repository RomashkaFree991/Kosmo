package app.kosmo.chat

import android.os.Build
import android.webkit.WebView
import androidx.activity.SystemBarStyle
import androidx.activity.enableEdgeToEdge
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleOut
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView

private val Planet = Color(0xFF64D2FF)
private val Ring = Color(0xFFBF5AF2)

@Composable
fun KosmoApp(activity: MainActivity, web: WebView) {
    val ctx = LocalContext.current
    val scheme = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) dynamicDarkColorScheme(ctx) else darkColorScheme(primary = Ring)
    val page = Color(activity.pageColor)

    // системные панели — под фон сайта: светлая тема → тёмные значки
    LaunchedEffect(activity.pageColor) {
        val light = page.luminance() > 0.5f
        val style = if (light) SystemBarStyle.light(page.toArgb(), page.toArgb()) else SystemBarStyle.dark(android.graphics.Color.TRANSPARENT)
        activity.enableEdgeToEdge(statusBarStyle = style, navigationBarStyle = style)
    }

    MaterialTheme(colorScheme = scheme) {
        Box(
            Modifier
                .fillMaxSize()
                .background(page)
                .windowInsetsPadding(WindowInsets.safeDrawing),   // вырезы, панели и клавиатура
        ) {
            AndroidView(factory = { web }, modifier = Modifier.fillMaxSize())

            AnimatedVisibility(
                visible = activity.loading && !activity.failed,
                enter = fadeIn(tween(0)),
                exit = fadeOut(tween(260)) + scaleOut(spring(dampingRatio = 0.8f, stiffness = 380f), targetScale = 1.06f),
            ) { Splash() }

            AnimatedVisibility(visible = activity.failed, enter = fadeIn(), exit = fadeOut()) {
                Offline(onRetry = activity::retry)
            }
        }
    }
}

@Composable
private fun PlanetLogo(modifier: Modifier = Modifier) {
    val t = rememberInfiniteTransition(label = "orbit")
    val tilt by t.animateFloat(-18f, -10f, infiniteRepeatable(tween(1600), RepeatMode.Reverse), label = "tilt")
    Canvas(modifier) {
        val r = size.minDimension * 0.24f
        val c = Offset(size.width / 2, size.height / 2)
        rotate(tilt, c) {
            drawOval(Ring, topLeft = Offset(c.x - r * 2.1f, c.y - r * 0.7f), size = Size(r * 4.2f, r * 1.4f), style = Stroke(width = r * 0.22f))
        }
        drawCircle(Planet, radius = r, center = c)
        // передняя часть кольца поверх планеты
        rotate(tilt, c) {
            drawArc(Ring, startAngle = 10f, sweepAngle = 160f, useCenter = false,
                topLeft = Offset(c.x - r * 2.1f, c.y - r * 0.7f), size = Size(r * 4.2f, r * 1.4f), style = Stroke(width = r * 0.22f))
        }
    }
}

@Composable
private fun Splash() {
    val t = rememberInfiniteTransition(label = "pulse")
    val s by t.animateFloat(0.96f, 1.04f, infiniteRepeatable(tween(900), RepeatMode.Reverse), label = "s")
    Box(Modifier.fillMaxSize().background(Color.Black), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            PlanetLogo(Modifier.size(140.dp).scale(s))
            Spacer(Modifier.height(12.dp))
            Text("Kosmo", color = Color.White, fontSize = 30.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun Offline(onRetry: () -> Unit) {
    Box(
        Modifier.fillMaxSize().background(MaterialTheme.colorScheme.surface).padding(32.dp),
        contentAlignment = Alignment.Center,
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
            PlanetLogo(Modifier.size(120.dp))
            Text("No connection", style = MaterialTheme.typography.headlineSmall, color = MaterialTheme.colorScheme.onSurface)
            Text(
                "Kosmo can’t reach the server. Check your internet and try again.",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(4.dp))
            Button(onClick = onRetry) { Text("Try again") }
        }
    }
}
