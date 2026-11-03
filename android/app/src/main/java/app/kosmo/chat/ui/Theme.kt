package app.kosmo.chat.ui

import android.content.Context
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import com.materialkolor.PaletteStyle
import com.materialkolor.dynamicColorScheme
import com.materialkolor.hct.Hct

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

// Исходные цвета — те же, что SEEDS в web/js/color.js
val SEEDS = listOf(0xFF6750A4, 0xFF1A73E8, 0xFF006A6A, 0xFF00897B, 0xFF2E7D32, 0xFF7C5800, 0xFFE8710A, 0xFFB3261E, 0xFFD93F87, 0xFF8E24AA, 0xFF546E7A).map { Color(it) }
val COLOR_STYLES = listOf("tonal" to "Tonal spot", "vibrant" to "Vibrant", "content" to "Content", "fidelity" to "Fidelity", "neutral" to "Neutral", "mono" to "Monochrome")

/** Настройки вида (Профиль → Designs), как на сайте: стиль, тема, цвет. */
object Design {
    var glass by mutableStateOf(true)            // Liquid Glass / Material You
    var scheme by mutableStateOf("dark")         // dark / light / auto
    var seed by mutableStateOf(SEEDS[0])
    var colorStyle by mutableStateOf("tonal")
    private var ctx: Context? = null

    fun init(c: Context) {
        ctx = c
        val p = c.getSharedPreferences("kosmo", Context.MODE_PRIVATE)
        glass = p.getString("style", "glass") != "material"
        scheme = p.getString("scheme", "dark") ?: "dark"
        seed = Color(p.getInt("seed", SEEDS[0].toArgb()))
        colorStyle = p.getString("colorStyle", "tonal") ?: "tonal"
    }

    fun save() {
        ctx?.getSharedPreferences("kosmo", Context.MODE_PRIVATE)?.edit()
            ?.putString("style", if (glass) "glass" else "material")?.putString("scheme", scheme)
            ?.putInt("seed", seed.toArgb())?.putString("colorStyle", colorStyle)?.apply()
    }
}

/** Что нужно экранам помимо ColorScheme: стиль, акцент стекла, цвета «хрома». */
@Immutable
data class Look(
    val glass: Boolean,
    val dark: Boolean,
    val accent: Color,          // кнопки, свои пузыри, активная вкладка
    val onAccent: Color,
    val page: Color,            // фон страницы
    val chrome: Color,          // круги, пилюли, поле ввода
    val chromeBorder: Color,
    val bar: Color,             // нижняя панель
    val cell: Color,            // группы настроек, плашки
    val theirs: Color,          // чужие пузыри
    val text: Color,
    val text2: Color,
    val text3: Color,
    val ink: Color,             // «белила»: белый в тёмной теме, чёрный в светлой
)

val LocalLook = staticCompositionLocalOf { lookFor(true, true, SEEDS[0], null) }

private fun lookFor(glass: Boolean, dark: Boolean, seed: Color, cs: ColorScheme?): Look {
    // Liquid Glass: яркий акцент того же оттенка (как --glass-accent на сайте)
    val h = Hct.fromInt(seed.toArgb())
    val glassAccent = Color(Hct.from(h.hue, maxOf(56.0, h.chroma), if (dark) 60.0 else 50.0).toInt())
    val ink = if (dark) Color.White else Color.Black
    return if (glass) Look(
        glass = true, dark = dark, accent = glassAccent, onAccent = Color.White,
        page = if (dark) Color.Black else Color(0xFFF2F2F7),
        chrome = if (dark) Color(0xFF1C1C1E).copy(alpha = 0.82f) else Color.White.copy(alpha = 0.78f),
        chromeBorder = ink.copy(alpha = if (dark) 0.14f else 0.08f),
        bar = if (dark) Color(0xFF1C1C1E).copy(alpha = 0.86f) else Color.White.copy(alpha = 0.86f),
        cell = if (dark) Color(0xFF1C1C1E) else Color.White,
        theirs = if (dark) Color(0xFF262628) else Color.White,
        text = ink, text2 = if (dark) Color(0x99EBEBF5) else Color(0x993C3C43), text3 = if (dark) Color(0x4DEBEBF5) else Color(0x4D3C3C43),
        ink = ink,
    ) else Look(
        glass = false, dark = dark, accent = cs!!.primary, onAccent = cs.onPrimary,
        page = cs.surface, chrome = cs.secondaryContainer, chromeBorder = Color.Transparent,
        bar = cs.surfaceContainer, cell = cs.surfaceContainerHigh, theirs = cs.surfaceContainerHigh,
        text = cs.onSurface, text2 = cs.onSurfaceVariant, text3 = cs.outline, ink = ink,
    )
}

private val KosmoType = Typography().run {
    copy(
        headlineMedium = headlineMedium.copy(fontWeight = FontWeight.Bold, letterSpacing = (-0.3).sp),
        titleLarge = titleLarge.copy(fontWeight = FontWeight.SemiBold),
        titleMedium = titleMedium.copy(fontWeight = FontWeight.SemiBold),
        bodyLarge = TextStyle(fontSize = 16.sp, lineHeight = 22.sp),
    )
}

/**
 * Тема из исходного цвета (material-kolor — те же алгоритмы Material You,
 * что material-color-utilities на сайте). Liquid Glass — чёрный/серый фон
 * и яркий акцент; Material You — тональная схема целиком.
 */
@Composable
fun KosmoTheme(dark: Boolean? = null, content: @Composable () -> Unit) {
    val sys = isSystemInDarkTheme()
    val isDark = dark ?: when (Design.scheme) { "light" -> false; "auto" -> sys; else -> true }
    val style = when (Design.colorStyle) {
        "vibrant" -> PaletteStyle.Vibrant; "content" -> PaletteStyle.Content; "fidelity" -> PaletteStyle.Fidelity
        "neutral" -> PaletteStyle.Neutral; "mono" -> PaletteStyle.Monochrome; else -> PaletteStyle.TonalSpot
    }
    val glass = Design.glass
    val seed = Design.seed
    val base = remember(seed, isDark, style) { dynamicColorScheme(seedColor = seed, isDark = isDark, isAmoled = false, style = style) }
    val look = remember(glass, isDark, seed, base) { lookFor(glass, isDark, seed, base) }
    val scheme = if (glass) base.copy(
        primary = look.accent, onPrimary = Color.White,
        background = look.page, surface = look.page, onSurface = look.text, onBackground = look.text,
        onSurfaceVariant = look.text2, surfaceContainerLowest = look.page,
        surfaceContainerLow = if (isDark) Color(0xFF111113) else Color(0xFFF7F7FA),
        surfaceContainer = look.cell, surfaceContainerHigh = if (isDark) Color(0xFF242426) else Color(0xFFE9E9EE),
        surfaceContainerHighest = if (isDark) Color(0xFF2C2C2E) else Color(0xFFE0E0E6),
        secondaryContainer = if (isDark) Color(0xFF2C2C2E) else Color(0xFFE5E5EA), onSecondaryContainer = look.text,
        outline = look.text3, outlineVariant = look.ink.copy(alpha = 0.12f),
    ) else base
    MaterialTheme(colorScheme = scheme, typography = KosmoType) {
        // текст вне Surface — цвет текста темы (иначе чёрный по умолчанию)
        CompositionLocalProvider(LocalContentColor provides look.text, LocalLook provides look, content = content)
    }
}
