package app.kosmo.chat.ui

import androidx.compose.ui.layout.positionInParent
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.rounded.ChevronRight
import androidx.compose.material.icons.rounded.Check
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.ripple
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.DpOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.graphics.drawscope.rotate
import dev.chrisbanes.haze.hazeChild
import kotlinx.coroutines.launch

// «Хром» Kosmo — круглые кнопки, пилюли-заголовки, нижняя панель, группы
// настроек, переключатели, меню. Liquid Glass и Material You, как на сайте.

/** Состояние размытия «под стеклом» (Haze): контент экрана — источник, хром — стекло. */
val LocalHaze = androidx.compose.runtime.staticCompositionLocalOf<dev.chrisbanes.haze.HazeState?> { null }

/**
 * Стекло как на сайте (.glass): фон --c-field-bg, saturate(180%) blur(28px) того, что под
 * ним, светлая линия сверху (inset 0 1px) и ободок 135°: ярче слева сверху и справа снизу.
 * Material You — тональная подложка.
 */
@Composable
fun Modifier.chrome(look: Look, shape: Shape = CircleShape, fill: Color? = null): Modifier {
    if (!look.glass) return this.clip(shape).background(fill ?: look.chrome, shape)
    val haze = LocalHaze.current
    val ink = look.ink
    return this.clip(shape)
        .then(if (haze != null) Modifier.hazeChild(haze, shape = shape, style = dev.chrisbanes.haze.HazeStyle(backgroundColor = look.page, tint = dev.chrisbanes.haze.HazeTint(fill ?: look.chrome), blurRadius = 28.dp, noiseFactor = 0f)) else Modifier.background(fill ?: look.chrome, shape))
        .border(1.dp, Brush.linearGradient(0f to ink.copy(alpha = 0.45f), 0.3f to ink.copy(alpha = 0.08f), 0.6f to ink.copy(alpha = 0.04f), 1f to ink.copy(alpha = 0.26f)), shape)
}

/** Круглая кнопка 48 dp: стекло или Material (при нажатии круг становится скруглённым квадратом). */
@Composable
fun CircleBtn(icon: ImageVector, label: String, modifier: Modifier = Modifier, accent: Boolean = false, enabled: Boolean = true, fill: Color? = null, onClick: () -> Unit) {
    val look = LocalLook.current
    val src = remember { MutableInteractionSource() }
    val pressed by src.collectIsPressedAsState()
    val corner by animateDpAsState(if (!look.glass && pressed) 16.dp else 24.dp, spring(dampingRatio = 0.6f, stiffness = 500f), label = "c")
    val scale by animateFloatAsState(if (look.glass && pressed) 1.08f else 1f, spring(dampingRatio = 0.5f, stiffness = 600f), label = "s")
    val shape = RoundedCornerShape(corner)
    Box(
        modifier.size(48.dp).scale(scale)
            .then(if (accent) Modifier.clip(shape).background(look.accent, shape) else Modifier.chrome(look, shape, fill))
            .clickable(interactionSource = src, indication = ripple(), enabled = enabled, onClick = onClick)
            .graphicsLayer { alpha = if (enabled) 1f else 0.35f },
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon, tr(label), tint = if (accent) look.onAccent else if (look.glass) look.text else MaterialTheme.colorScheme.onSecondaryContainer, modifier = Modifier.size(22.dp))
    }
}

@Composable
fun BackBtn(app: AppState, onClick: () -> Unit = { app.pop() }) = CircleBtn(WI.hdrBack, "Back", onClick = onClick)

/** Пилюля с заголовком (и подзаголовком) посередине шапки. */
@Composable
fun RowScope.TitlePill(title: String, sub: String? = null, subAccent: Boolean = false, subLock: Boolean = false, titleIcon: ImageVector? = null, badge: (@Composable () -> Unit)? = null, onClick: (() -> Unit)? = null) {
    val look = LocalLook.current
    Column(
        Modifier.weight(1f).height(48.dp)
            .then(if (look.glass) Modifier.chrome(look, RoundedCornerShape(24.dp)) else Modifier.clip(RoundedCornerShape(24.dp)).background(MaterialTheme.colorScheme.surfaceContainerHigh))
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier),
        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(horizontal = 14.dp)) {
            if (titleIcon != null) Icon(titleIcon, null, tint = look.text2, modifier = Modifier.padding(end = 4.dp).size(16.dp))
            Text(tr(title), fontSize = if (look.glass) 17.sp else 18.sp, lineHeight = 20.sp, fontWeight = if (look.glass) FontWeight.SemiBold else FontWeight.Medium, maxLines = 1, overflow = TextOverflow.Ellipsis)
            badge?.invoke()
        }
        if (sub != null) Row(verticalAlignment = Alignment.CenterVertically) {
            if (subLock && !subAccent) Icon(LockMini, null, tint = look.text2, modifier = Modifier.padding(end = 4.dp).size(11.dp))
            Text(tr(sub), fontSize = 12.sp, lineHeight = 14.sp, fontWeight = FontWeight.Medium, color = if (subAccent) look.accent else look.text2, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }
}

/** Шапка экрана: [левый круг] [пилюля] [правый круг], как на сайте. */
@Composable
fun Header(content: @Composable RowScope.() -> Unit) {
    Row(
        Modifier.fillMaxWidth().statusBarsPadding().padding(start = 16.dp, end = 16.dp, top = 10.dp, bottom = 10.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp), content = content,
    )
}

/** Замок перед статусом: переписка хранится на сервере зашифрованной. */
val LockMini by lazy { stroke(P("M7.5 10.5h9a2.5 2.5 0 0 1 2.5 2.5v4.5a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 5 17.5V13a2.5 2.5 0 0 1 2.5-2.5Z", fill = true), P("M8 10.5V8a4 4 0 0 1 8 0v2.5", sw = 2.4f)) }

@Composable
fun CircleSpacer() = Spacer(Modifier.size(48.dp))

/* ---------------------------------------------------------------------------
   Нижняя панель
   --------------------------------------------------------------------------- */
data class TabItem(val label: String, val icon: ImageVector, val iconOn: ImageVector, val badge: Int = 0, val custom: (@Composable (Boolean) -> Unit)? = null)

/**
 * Liquid Glass: плавающая стеклянная пилюля; «линза» перетекает к выбранной
 * вкладке на пружине, её можно тащить пальцем (как glisse на сайте).
 * Material You: плавающая панель, у выбранной вкладки — пилюля с подписью.
 */
@Composable
fun TabBar(items: List<TabItem>, selected: Int, modifier: Modifier = Modifier, onSelect: (Int) -> Unit) {
    val look = LocalLook.current
    if (look.glass) GlassTabBar(items, selected, modifier, onSelect) else MaterialTabBar(items, selected, modifier, onSelect)
}

@Composable
private fun GlassTabBar(items: List<TabItem>, selected: Int, modifier: Modifier, onSelect: (Int) -> Unit) {
    val look = LocalLook.current
    val density = LocalDensity.current
    val scope = rememberCoroutineScope()
    BoxWithConstraints(modifier.widthIn(max = 440.dp).fillMaxWidth().height(66.dp)) {
        val inner = maxWidth - 8.dp
        val slot = inner / items.size
        val slotPx = with(density) { slot.toPx() }
        val x = remember { Animatable(selected * slotPx) }
        var dragging by remember { mutableStateOf(false) }
        val lift by animateFloatAsState(if (dragging) 1.12f else 1f, spring(dampingRatio = 0.55f, stiffness = 500f), label = "lift")
        LaunchedEffect(selected, slotPx) { if (!dragging) x.animateTo(selected * slotPx, spring(dampingRatio = 0.62f, stiffness = 380f)) }
        Box(
            Modifier.fillMaxWidth().height(66.dp)
                .shadow(28.dp, CircleShape, ambientColor = Color.Black.copy(alpha = 0.5f), spotColor = Color.Black.copy(alpha = 0.5f))
                .chrome(look, CircleShape, fill = look.bar)
                .pointerInput(items.size, slotPx) {
                    detectHorizontalDragGestures(
                        onDragStart = { o -> dragging = true; scope.launch { x.snapTo((o.x - 4.dp.toPx() - slotPx / 2).coerceIn(0f, slotPx * (items.size - 1))) } },
                        onDragEnd = {
                            dragging = false
                            val i = ((x.value + slotPx / 2) / slotPx).toInt().coerceIn(0, items.lastIndex)
                            onSelect(i)
                            scope.launch { x.animateTo(i * slotPx, spring(dampingRatio = 0.62f, stiffness = 380f)) }
                        },
                        onDragCancel = { dragging = false },
                    ) { ch, d -> ch.consume(); scope.launch { x.snapTo((x.value + d).coerceIn(0f, slotPx * (items.size - 1))) } }
                }
                .padding(4.dp),
        ) {
            // линза
            Box(
                Modifier.offset { androidx.compose.ui.unit.IntOffset(x.value.toInt(), 0) }.width(slot).fillMaxHeight()
                    .scale(lift, 1f / lift.coerceAtLeast(1f) * (if (dragging) 1.04f else 1f))
                    .shadow(if (dragging) 22.dp else 18.dp, CircleShape, ambientColor = Color.Black.copy(alpha = 0.24f), spotColor = Color.Black.copy(alpha = 0.24f))
                    .clip(CircleShape)
                    .background(if (look.dark) look.ink.copy(alpha = if (dragging) 0.06f else 0.09f) else Color.White.copy(alpha = 0.55f))
                    .border(1.dp, look.ink.copy(alpha = if (dragging) 0.28f else 0.24f), CircleShape)
                    // блики по краю линзы: светлее слева сверху, слабее справа снизу
                    .border(1.5.dp, Brush.linearGradient(0f to Color.White.copy(alpha = 0.5f), 0.35f to Color.Transparent, 0.7f to Color.Transparent, 1f to Color.White.copy(alpha = 0.22f)), CircleShape),
            )
            Row(Modifier.fillMaxWidth().fillMaxHeight()) {
                items.forEachIndexed { i, t ->
                    val on = i == selected
                    Column(
                        Modifier.weight(1f).fillMaxHeight().clip(CircleShape).pointerInput(i) { detectTapGestures { onSelect(i) } },
                        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center,
                    ) {
                        Box {
                            if (t.custom != null) t.custom.invoke(on) else Icon(if (on) t.iconOn else t.icon, null, tint = if (on) look.accent else look.text2, modifier = Modifier.size(25.dp))
                            if (t.badge > 0) Badge(t.badge, Modifier.align(Alignment.TopEnd).offset(x = 10.dp, y = (-4).dp))
                        }
                        Text(tr(t.label), fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = if (on) look.accent else look.text2, modifier = Modifier.padding(top = 3.dp))
                    }
                }
            }
        }
    }
}

@Composable
private fun MaterialTabBar(items: List<TabItem>, selected: Int, modifier: Modifier, onSelect: (Int) -> Unit) {
    val cs = MaterialTheme.colorScheme
    Row(
        modifier.widthIn(max = 440.dp).height(68.dp).shadow(6.dp, RoundedCornerShape(34.dp)).clip(RoundedCornerShape(34.dp)).background(cs.surfaceContainer).padding(horizontal = 10.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceAround,
    ) {
        items.forEachIndexed { i, t ->
            val on = i == selected
            val pad by animateDpAsState(if (on) 16.dp else 12.dp, spring(dampingRatio = 0.7f, stiffness = 400f), label = "p")
            Row(
                Modifier.height(48.dp).clip(RoundedCornerShape(24.dp)).background(if (on) cs.secondaryContainer else Color.Transparent)
                    .clickable { onSelect(i) }.padding(horizontal = pad),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box {
                    if (t.custom != null) t.custom.invoke(on) else Icon(if (on) t.iconOn else t.icon, null, tint = if (on) cs.onSecondaryContainer else cs.onSurfaceVariant)
                    if (t.badge > 0) Badge(t.badge, Modifier.align(Alignment.TopEnd).offset(x = 8.dp, y = (-6).dp))
                }
                androidx.compose.animation.AnimatedVisibility(on) {
                    Text(tr(t.label), fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = cs.onSecondaryContainer, modifier = Modifier.padding(start = 8.dp))
                }
            }
        }
    }
}

@Composable
fun Badge(n: Int, modifier: Modifier = Modifier) {
    val look = LocalLook.current
    Box(
        modifier.heightIn(min = 18.dp).widthIn(min = 18.dp).clip(CircleShape)
            .background(if (look.glass) Color(0xFFFF3B30) else MaterialTheme.colorScheme.error).padding(horizontal = 5.dp),
        contentAlignment = Alignment.Center,
    ) { Text(if (n > 99) "99+" else "$n", color = if (look.glass) Color.White else MaterialTheme.colorScheme.onError, fontSize = 11.sp, fontWeight = FontWeight.Bold) }
}

/* ---------------------------------------------------------------------------
   Группы настроек, строки, переключатели, сегменты
   --------------------------------------------------------------------------- */
@Composable
fun SectionLabel(text: String) {
    // .section-label: 13/600 серым (стекло), 14/600 primary (Material)
    val look = LocalLook.current
    if (look.glass) Text(tr(text), fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = look.text2, modifier = Modifier.padding(start = 22.dp, end = 22.dp, top = 14.dp, bottom = 8.dp))
    else Text(tr(text), fontSize = 14.sp, lineHeight = 20.sp, fontWeight = FontWeight.SemiBold, color = MaterialTheme.colorScheme.primary, modifier = Modifier.padding(start = 32.dp, end = 32.dp, top = 18.dp, bottom = 8.dp))
}

@Composable
fun Group(modifier: Modifier = Modifier, pad: Boolean = false, content: @Composable ColumnScope.() -> Unit) {
    // pad — .group-pad: отступ 16, между строками 10 (строки переключателей и выбора)
    val look = LocalLook.current
    val shape = RoundedCornerShape(if (look.glass) 26.dp else if (pad) 24.dp else 28.dp)
    Column(
        modifier.fillMaxWidth().padding(horizontal = 16.dp).clip(shape).background(if (look.glass || pad) look.cell else MaterialTheme.colorScheme.surfaceContainer)
            .then(if (pad) Modifier.padding(16.dp) else Modifier),
        verticalArrangement = if (pad) Arrangement.spacedBy(10.dp) else Arrangement.Top, content = content,
    )
}

/**
 * Строка группы настроек: в стекле — белый значок Phosphor на цветном квадрате 32 dp (как iOS),
 * в Material — значок Material Symbols на primary-container. Между строками — тонкая линия.
 */
@Composable
fun GroupRow(icon: ImageVector, text: String, tint: Color = LocalLook.current.accent, value: String? = null, danger: Boolean = false, chevron: Boolean = true, msIcon: ImageVector? = null, first: Boolean = false, solid: Boolean = true, onClick: () -> Unit) {
    val look = LocalLook.current
    val cs = MaterialTheme.colorScheme
    Box {
        // Material: строки — отдельные плашки 64 с зазором 2 (как .group-row-btn в m3.css)
        if (!look.glass && !first) Box(Modifier.fillMaxWidth().height(2.dp).background(look.page))
        Row(Modifier.fillMaxWidth().padding(top = if (!look.glass && !first) 2.dp else 0.dp).heightIn(min = if (look.glass) 56.dp else 64.dp).clickable(onClick = onClick).padding(horizontal = 16.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier.size(32.dp).clip(if (look.glass) RoundedCornerShape(10.dp) else CircleShape)
                    .background(if (look.glass) (if (danger) Color(0xFFFF453A).copy(alpha = if (solid) 1f else 0.16f) else if (solid) tint else look.accent.copy(alpha = 0.22f)) else if (danger) cs.errorContainer else if (solid) cs.primaryContainer else cs.secondaryContainer),
                contentAlignment = Alignment.Center,
            ) { Icon(if (look.glass) icon else msIcon ?: icon, null, tint = if (look.glass) (if (solid) Color.White else if (danger) Color(0xFFFF453A) else look.accent) else if (danger) cs.onErrorContainer else if (solid) cs.onPrimaryContainer else cs.onSecondaryContainer, modifier = Modifier.size(19.dp)) }
            Text(tr(text), Modifier.weight(1f).padding(start = 14.dp), color = if (danger) cs.error else look.text, fontSize = 17.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            if (value != null) Text(tr(value), color = look.text2, fontSize = 17.sp, modifier = Modifier.padding(end = 4.dp, start = 8.dp), maxLines = 1)
            if (chevron && !danger) Icon(WI.chevron, null, tint = look.text3, modifier = Modifier.size(18.dp))
        }
        if (!first && look.glass) Box(Modifier.fillMaxWidth().padding(start = 62.dp).height(0.5.dp).background(look.hairline))
    }
}

@Composable
fun SwitchRow(title: String, checked: Boolean, sub: String? = null, onChange: (Boolean) -> Unit) {
    val look = LocalLook.current
    Row(Modifier.fillMaxWidth().heightIn(min = 50.dp).clickable(interactionSource = null, indication = null) { onChange(!checked) }.padding(horizontal = 4.dp), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f).padding(end = 12.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(tr(title), fontSize = 16.sp)
            if (sub != null) Text(tr(sub), fontSize = 13.sp, lineHeight = 17.sp, color = look.text2)
        }
        Switch(
            checked, onChange,
            colors = if (look.glass) SwitchDefaults.colors(checkedTrackColor = look.accent, checkedThumbColor = Color.White, uncheckedTrackColor = look.ink.copy(alpha = 0.16f), uncheckedThumbColor = Color.White, uncheckedBorderColor = Color.Transparent) else SwitchDefaults.colors(),
        )
    }
}

/** Сегменты: стеклянный бегунок или Material segmented buttons. */
@OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
@Composable
fun Segs(options: List<Pair<String, String>>, selected: String, modifier: Modifier = Modifier, connected: Boolean = false, onSelect: (String) -> Unit) {
    val look = LocalLook.current
    if (look.glass) {
        val idx = options.indexOfFirst { it.first == selected }.coerceAtLeast(0)
        BoxWithConstraints(modifier.clip(RoundedCornerShape(12.dp)).background(look.ink.copy(alpha = 0.08f)).padding(3.dp)) {
            val w = maxWidth / options.size
            val x by animateDpAsState(w * idx, spring(dampingRatio = 0.62f, stiffness = 380f), label = "seg")
            Box(Modifier.offset(x = x).width(w).height(34.dp).clip(RoundedCornerShape(9.dp)).background(look.ink.copy(alpha = if (look.dark) 0.16f else 0.0f)).background(if (look.dark) Color.Transparent else Color.White).border(0.8.dp, look.ink.copy(alpha = 0.18f), RoundedCornerShape(9.dp)))
            Row {
                options.forEach { (id, label) ->
                    Box(Modifier.width(w).height(34.dp).clip(RoundedCornerShape(9.dp)).clickable { onSelect(id) }, contentAlignment = Alignment.Center) {
                        Text(tr(label), fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = if (id == selected) look.text else look.text2, maxLines = 1)
                    }
                }
            }
        }
    } else if (!connected) {
        // Material: .segs — ряд чипов, выбранный с галочкой на secondary-container
        androidx.compose.foundation.layout.FlowRow(modifier, horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            options.forEach { (id, label) -> MChip(label, id == selected) { onSelect(id) } }
        }
    } else {
        Row(modifier.clip(CircleShape).border(1.dp, MaterialTheme.colorScheme.outline, CircleShape)) {
            options.forEachIndexed { i, (id, label) ->
                val on = id == selected
                Row(
                    Modifier.weight(1f).height(40.dp).background(if (on) MaterialTheme.colorScheme.secondaryContainer else Color.Transparent).clickable { onSelect(id) },
                    horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically,
                ) {
                    if (on) Icon(Icons.Rounded.Check, null, Modifier.size(16.dp))
                    Text(tr(label), fontSize = 14.sp, fontWeight = FontWeight.Medium, modifier = Modifier.padding(start = if (on) 4.dp else 0.dp), maxLines = 1)
                }
                if (i < options.lastIndex) Box(Modifier.width(1.dp).height(40.dp).background(MaterialTheme.colorScheme.outline))
            }
        }
    }
}

/** Сегменты по ширине текста (.segs на сайте: отступ 3, кнопки 12 по бокам). */
@Composable
fun FitSegs(options: List<Pair<String, String>>, selected: String, onSelect: (String) -> Unit) {
    val look = LocalLook.current
    val density = androidx.compose.ui.platform.LocalDensity.current
    val xs = remember(options) { mutableStateListOf(*Array(options.size) { 0.dp }) }
    val ws = remember(options) { mutableStateListOf(*Array(options.size) { 0.dp }) }
    val idx = options.indexOfFirst { it.first == selected }.coerceAtLeast(0)
    val x by animateDpAsState(xs[idx], spring(dampingRatio = 0.62f, stiffness = 380f), label = "fx")
    val w by animateDpAsState(ws[idx], spring(dampingRatio = 0.62f, stiffness = 380f), label = "fw")
    Box(Modifier.clip(RoundedCornerShape(12.dp)).background(look.ink.copy(alpha = 0.08f)).padding(3.dp)) {
        if (w > 0.dp) Box(Modifier.offset(x = x).width(w).height(32.dp).clip(RoundedCornerShape(9.dp)).background(if (look.dark) look.ink.copy(alpha = 0.16f) else Color.White).border(0.8.dp, look.ink.copy(alpha = 0.18f), RoundedCornerShape(9.dp)))
        Row(horizontalArrangement = Arrangement.spacedBy(2.dp)) {
            options.forEachIndexed { i, (id, label) ->
                Box(
                    Modifier.height(32.dp).clip(RoundedCornerShape(9.dp))
                        .then(if (w == 0.dp && i == idx) Modifier.background(if (look.dark) look.ink.copy(alpha = 0.16f) else Color.White).border(0.8.dp, look.ink.copy(alpha = 0.18f), RoundedCornerShape(9.dp)) else Modifier)
                        .clickable { onSelect(id) }
                        .onGloballyPositioned { c -> with(density) { xs[i] = c.positionInParent().x.toDp(); ws[i] = c.size.width.toDp() } }
                        .padding(horizontal = 12.dp),
                    contentAlignment = Alignment.Center,
                ) { Text(tr(label), fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = if (id == selected) look.text else look.text2, maxLines = 1) }
            }
        }
    }
}

/** Чип выбора Material (.seg-btn): 36 высотой, радиус 10 → 18 у выбранного. */
@Composable
fun MChip(label: String, on: Boolean, onClick: () -> Unit) {
    val cs = MaterialTheme.colorScheme
    val r by animateDpAsState(if (on) 18.dp else 10.dp, spring(dampingRatio = 0.6f, stiffness = 500f), label = "chip")
    Row(
        Modifier.height(36.dp).clip(RoundedCornerShape(r)).background(if (on) cs.secondaryContainer else Color.Transparent)
            .then(if (on) Modifier else Modifier.border(1.dp, cs.outlineVariant, RoundedCornerShape(r)))
            .clickable(onClick = onClick).padding(start = if (on) 10.dp else 16.dp, end = 16.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (on) Icon(Icons.Rounded.Check, null, tint = cs.onSecondaryContainer, modifier = Modifier.padding(end = 6.dp).size(18.dp))
        Text(tr(label), fontSize = 14.sp, lineHeight = 20.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 0.1.sp, color = if (on) cs.onSecondaryContainer else cs.onSurfaceVariant, maxLines = 1)
    }
}

/** Строка выбора: подпись слева, сегменты справа (как choice-row на сайте). */
@Composable
fun ChoiceRow(title: String, options: List<Pair<String, String>>, selected: String, sub: String? = null, wide: Boolean = false, onSelect: (String) -> Unit) {
    val look = LocalLook.current
    if (!look.glass) Column(Modifier.fillMaxWidth().padding(horizontal = 4.dp, vertical = 14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        // Material: подпись сверху, чипы ровным рядом под ней
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(tr(title), fontSize = 16.sp, lineHeight = 24.sp, fontWeight = FontWeight.Medium)
            if (sub != null) Text(tr(sub), fontSize = 13.sp, lineHeight = 17.sp, color = look.text2)
        }
        Segs(options, selected, Modifier.fillMaxWidth(), onSelect = onSelect)
    } else if (wide) Column(Modifier.fillMaxWidth().padding(horizontal = 4.dp, vertical = 6.dp)) {
        Text(tr(title), fontSize = 16.sp)
        if (sub != null) Text(tr(sub), fontSize = 13.sp, color = look.text2)
        Segs(options, selected, Modifier.fillMaxWidth().padding(top = 10.dp), onSelect = onSelect)
    } else Row(Modifier.fillMaxWidth().heightIn(min = 50.dp).padding(horizontal = 4.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(tr(title), fontSize = 16.sp)
            if (sub != null) Text(tr(sub), fontSize = 13.sp, lineHeight = 17.sp, color = look.text2)
        }
        FitSegs(options, selected, onSelect)
    }
}

/* ---------------------------------------------------------------------------
   Меню (стеклянное / Material)
   --------------------------------------------------------------------------- */
data class MenuItem(val icon: ImageVector, val text: String, val tint: Color? = null, val danger: Boolean = false, val onClick: () -> Unit)

@Composable
fun KosmoMenu(expanded: Boolean, onDismiss: () -> Unit, items: List<MenuItem>, offset: DpOffset = DpOffset(0.dp, 6.dp), header: (@Composable () -> Unit)? = null) {
    val look = LocalLook.current
    DropdownMenu(
        expanded, onDismiss, offset = offset,
        shape = RoundedCornerShape(if (look.glass) 22.dp else 16.dp),
        containerColor = if (look.glass) (if (look.dark) Color(0xFF232325).copy(alpha = 0.96f) else Color.White.copy(alpha = 0.96f)) else MaterialTheme.colorScheme.surfaceContainer,
        modifier = Modifier.widthIn(min = 200.dp),
    ) {
        header?.invoke()
        items.forEach { m ->
            DropdownMenuItem(
                text = { Text(tr(m.text), color = if (m.danger) MaterialTheme.colorScheme.error else look.text, fontSize = 16.sp) },
                onClick = { onDismiss(); m.onClick() },
                leadingIcon = {
                    if (m.tint != null) Box(Modifier.size(28.dp).clip(RoundedCornerShape(8.dp)).background(m.tint), contentAlignment = Alignment.Center) { Icon(m.icon, null, tint = Color.White, modifier = Modifier.size(18.dp)) }
                    else Icon(m.icon, null, tint = if (m.danger) MaterialTheme.colorScheme.error else look.text)
                },
            )
        }
    }
}

/** Чип папки (.folder на сайте). */
@Composable
fun Chip(text: String, on: Boolean, count: Int = 0, onClick: () -> Unit) {
    val look = LocalLook.current
    val cs = MaterialTheme.colorScheme
    val shape = if (look.glass) CircleShape else RoundedCornerShape(10.dp)
    val fg = if (on) (if (look.glass) Color.White else cs.onSecondaryContainer) else look.text2
    Row(
        Modifier.height(34.dp).clip(shape)
            .background(if (on) (if (look.glass) look.accent else cs.secondaryContainer) else if (look.glass) look.ink.copy(alpha = 0.07f) else cs.surfaceContainerHigh)
            .clickable(onClick = onClick).padding(horizontal = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(tr(text), fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = fg)
        if (count > 0) Box(Modifier.padding(start = 6.dp).height(18.dp).widthIn(min = 18.dp).clip(RoundedCornerShape(9.dp)).background(look.ink.copy(alpha = 0.22f)).padding(horizontal = 5.dp), contentAlignment = Alignment.Center) {
            Text("$count", fontSize = 11.sp, color = fg)
        }
    }
}

/** Значок «официальный» — планета с галочкой, как cosmicBadge() на сайте. */
@Composable
fun CosmicBadge(kind: String = "official", size: androidx.compose.ui.unit.Dp = 18.dp, modifier: Modifier = Modifier) {
    val stops = when (kind) {
        "owner" -> listOf(Color(0xFFFFE066), Color(0xFFFF9F0A), Color(0xFFFF5E3A))
        "premium" -> listOf(Color(0xFFFF7AD9), Color(0xFFB15CFF), Color(0xFF5B8CFF))
        else -> listOf(Color(0xFF5AC8FA), Color(0xFF7D5CFF), Color(0xFFBF5AF2))
    }
    androidx.compose.foundation.Canvas(modifier.size(size)) {
        val k = this.size.width / 24f
        withTransform({ scale(k, k, androidx.compose.ui.geometry.Offset.Zero) }) {
            val ring = Brush.horizontalGradient(listOf(Color.White.copy(alpha = 0.95f), Color.White.copy(alpha = 0.35f)), 0.9f, 23.1f)
            val tl = androidx.compose.ui.geometry.Offset(0.9f, 8.7f); val sz = androidx.compose.ui.geometry.Size(22.2f, 6.6f)
            rotate(-24f, androidx.compose.ui.geometry.Offset(12f, 12f)) { drawArc(ring, 180f, 180f, false, tl, sz, style = androidx.compose.ui.graphics.drawscope.Stroke(1.3f, cap = androidx.compose.ui.graphics.StrokeCap.Round)) }
            drawCircle(Brush.linearGradient(listOf(stops[0], stops[1], stops[2]), androidx.compose.ui.geometry.Offset(3.6f, 3.6f), androidx.compose.ui.geometry.Offset(20.4f, 20.4f)), 8.4f, androidx.compose.ui.geometry.Offset(12f, 12f))
            rotate(-24f, androidx.compose.ui.geometry.Offset(12f, 12f)) { drawArc(ring, 0f, 180f, false, tl, sz, style = androidx.compose.ui.graphics.drawscope.Stroke(1.3f, cap = androidx.compose.ui.graphics.StrokeCap.Round)) }
            val check = androidx.compose.ui.graphics.Path().apply { moveTo(8.5f, 12.1f); lineTo(10.9f, 14.5f); lineTo(15.5f, 9.6f) }
            drawPath(check, Color.White, style = androidx.compose.ui.graphics.drawscope.Stroke(2f, cap = androidx.compose.ui.graphics.StrokeCap.Round, join = androidx.compose.ui.graphics.StrokeJoin.Round))
            drawCircle(Color.White, 1.05f, androidx.compose.ui.geometry.Offset(20.4f, 4f))
            drawCircle(Color.White, 0.75f, androidx.compose.ui.geometry.Offset(3.4f, 19.6f))
        }
    }
}

/** Большая кнопка (белая в стекле / Material filled). */
@Composable
fun BigButton(text: String, modifier: Modifier = Modifier, secondary: Boolean = false, danger: Boolean = false, enabled: Boolean = true, icon: ImageVector? = null, onClick: () -> Unit) {
    val look = LocalLook.current
    val bg = when {
        danger -> MaterialTheme.colorScheme.error.copy(alpha = 0.16f)
        secondary -> if (look.glass) look.ink.copy(alpha = 0.1f) else MaterialTheme.colorScheme.secondaryContainer
        look.glass -> look.ink
        else -> MaterialTheme.colorScheme.primary
    }
    val fg = when {
        danger -> MaterialTheme.colorScheme.error
        secondary -> look.text
        look.glass -> look.page
        else -> MaterialTheme.colorScheme.onPrimary
    }
    Box(
        modifier.fillMaxWidth().height(52.dp)
            .then(if (secondary && look.glass) Modifier.chrome(look, RoundedCornerShape(26.dp)) else Modifier.clip(RoundedCornerShape(26.dp)).background(bg))
            .clickable(enabled = enabled, onClick = onClick).graphicsLayer { alpha = if (enabled) 1f else 0.4f },
        contentAlignment = Alignment.Center,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            if (icon != null) Icon(icon, null, tint = fg, modifier = Modifier.padding(end = 8.dp).size(20.dp))
            Text(tr(text), color = fg, fontSize = 17.sp, fontWeight = FontWeight.SemiBold)
        }
    }
}

@Suppress("unused") private val keepFloat = mutableFloatStateOf(0f)
@Suppress("unused") private fun keepDp(d: Dp) = d

