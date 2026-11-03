package app.kosmo.chat.ui

import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

// Цвета Kosmo: планета (голубой → фиолетовый), как на сайте
val PlanetA = Color(0xFF64D2FF)
val PlanetB = Color(0xFFBF5AF2)

// Градиенты аватарок — те же пары, что AVATAR_COLORS в web/js/core.js
val AvatarColors = listOf(
    Color(0xFFFF885E) to Color(0xFFFF516A), Color(0xFFFFCD6A) to Color(0xFFFFA85C),
    Color(0xFF82B1FF) to Color(0xFF665FFF), Color(0xFFA0DE7E) to Color(0xFF54CB68),
    Color(0xFF53EDD6) to Color(0xFF28C9B7), Color(0xFF72D5FD) to Color(0xFF2A9EF1),
    Color(0xFFE0A2F3) to Color(0xFFD669ED),
)

private val KosmoDark = darkColorScheme(
    primary = Color(0xFFCDBDFF), onPrimary = Color(0xFF34265F), primaryContainer = Color(0xFF4B3D77), onPrimaryContainer = Color(0xFFE8DDFF),
    secondary = Color(0xFFCBC2DB), secondaryContainer = Color(0xFF4A4458), onSecondaryContainer = Color(0xFFE8DEF8),
    tertiary = Color(0xFF8CCFF0), tertiaryContainer = Color(0xFF004D66),
    background = Color(0xFF000000), surface = Color(0xFF000000), onSurface = Color(0xFFE6E1E9),
    surfaceContainerLowest = Color(0xFF050507), surfaceContainerLow = Color(0xFF0E0E11), surfaceContainer = Color(0xFF131316),
    surfaceContainerHigh = Color(0xFF1C1C20), surfaceContainerHighest = Color(0xFF26262B), onSurfaceVariant = Color(0xFFCAC4D0),
    outline = Color(0xFF938F99), outlineVariant = Color(0xFF3A3840),
)
private val KosmoLight = lightColorScheme(primary = Color(0xFF6650A4), primaryContainer = Color(0xFFE9DDFF))

private val KosmoType = Typography().run {
    copy(
        headlineMedium = headlineMedium.copy(fontWeight = FontWeight.Bold, letterSpacing = (-0.3).sp),
        titleLarge = titleLarge.copy(fontWeight = FontWeight.SemiBold),
        titleMedium = titleMedium.copy(fontWeight = FontWeight.SemiBold),
        bodyLarge = TextStyle(fontSize = 16.sp, lineHeight = 22.sp),
    )
}

/** Material 3 с динамическими цветами (Android 12+); тёмная тема — чёрный фон, как у сайта. */
@Composable
fun KosmoTheme(dark: Boolean = isSystemInDarkTheme(), content: @Composable () -> Unit) {
    val ctx = LocalContext.current
    val dynamic = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
    val scheme = when {
        dynamic && dark -> dynamicDarkColorScheme(ctx).copy(background = Color.Black, surface = Color.Black)
        dynamic -> dynamicLightColorScheme(ctx)
        dark -> KosmoDark
        else -> KosmoLight
    }
    MaterialTheme(colorScheme = scheme, typography = KosmoType) {
        // текст вне Surface — светлый на тёмном фоне (иначе чёрный по умолчанию)
        androidx.compose.runtime.CompositionLocalProvider(androidx.compose.material3.LocalContentColor provides scheme.onBackground, content = content)
    }
}
