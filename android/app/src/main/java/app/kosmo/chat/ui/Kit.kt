package app.kosmo.chat.ui

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
import kotlinx.coroutines.launch

// «Хром» Kosmo — круглые кнопки, пилюли-заголовки, нижняя панель, группы
// настроек, переключатели, меню. Liquid Glass и Material You, как на сайте.

/** Стеклянная (или тональная Material) подложка. */
fun Modifier.chrome(look: Look, shape: Shape = CircleShape): Modifier =
    if (look.glass) this.clip(shape).background(look.chrome, shape)
        .background(Brush.verticalGradient(listOf(look.ink.copy(alpha = 0.06f), Color.Transparent)), shape)
        .border(0.8.dp, Brush.verticalGradient(listOf(look.ink.copy(alpha = if (look.dark) 0.22f else 0.12f), look.ink.copy(alpha = 0.05f))), shape)
    else this.clip(shape).background(look.chrome, shape)

/** Круглая кнопка 48 dp: стекло или Material (при нажатии круг становится скруглённым квадратом). */
@Composable
fun CircleBtn(icon: ImageVector, label: String, modifier: Modifier = Modifier, accent: Boolean = false, enabled: Boolean = true, onClick: () -> Unit) {
    val look = LocalLook.current
    val src = remember { MutableInteractionSource() }
    val pressed by src.collectIsPressedAsState()
    val corner by animateDpAsState(if (!look.glass && pressed) 16.dp else 24.dp, spring(dampingRatio = 0.6f, stiffness = 500f), label = "c")
    val scale by animateFloatAsState(if (look.glass && pressed) 1.08f else 1f, spring(dampingRatio = 0.5f, stiffness = 600f), label = "s")
    val shape = RoundedCornerShape(corner)
    Box(
        modifier.size(48.dp).scale(scale)
            .then(if (accent) Modifier.clip(shape).background(look.accent, shape) else Modifier.chrome(look, shape))
            .clickable(interactionSource = src, indication = ripple(), enabled = enabled, onClick = onClick)
            .graphicsLayer { alpha = if (enabled) 1f else 0.35f },
        contentAlignment = Alignment.Center,
    ) {
        Icon(icon, tr(label), tint = if (accent) look.onAccent else if (look.glass) look.text else MaterialTheme.colorScheme.onSecondaryContainer, modifier = Modifier.size(22.dp))
    }
}

@Composable
fun BackBtn(app: AppState, onClick: () -> Unit = { app.pop() }) = CircleBtn(Icons.AutoMirrored.Rounded.ArrowBack, "Back", onClick = onClick)

/** Пилюля с заголовком (и подзаголовком) посередине шапки. */
@Composable
fun RowScope.TitlePill(title: String, sub: String? = null, subAccent: Boolean = false, onClick: (() -> Unit)? = null) {
    val look = LocalLook.current
    Column(
        Modifier.weight(1f).height(48.dp)
            .then(if (look.glass) Modifier.chrome(look, RoundedCornerShape(24.dp)) else Modifier.clip(RoundedCornerShape(24.dp)).background(MaterialTheme.colorScheme.surfaceContainerHigh))
            .then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier),
        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center,
    ) {
        Text(tr(title), fontSize = if (sub != null) 16.sp else 17.sp, fontWeight = if (look.glass) FontWeight.SemiBold else FontWeight.Medium, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(horizontal = 14.dp))
        if (sub != null) Text(tr(sub), fontSize = 12.sp, color = if (subAccent) look.accent else look.text2, maxLines = 1, overflow = TextOverflow.Ellipsis)
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
                .shadow(24.dp, CircleShape, ambientColor = Color.Black, spotColor = Color.Black)
                .clip(CircleShape).background(look.bar)
                .border(0.8.dp, Brush.verticalGradient(listOf(look.ink.copy(alpha = if (look.dark) 0.2f else 0.1f), look.ink.copy(alpha = 0.04f))), CircleShape)
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
                    .clip(CircleShape)
                    .background(look.ink.copy(alpha = if (dragging) 0.06f else 0.09f))
                    .background(Brush.linearGradient(listOf(Color.White.copy(alpha = if (look.dark) 0.12f else 0.5f), Color.Transparent, Color.White.copy(alpha = 0.05f))))
                    .border(1.dp, look.ink.copy(alpha = 0.24f), CircleShape),
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
    Text(tr(text), style = MaterialTheme.typography.labelLarge, color = LocalLook.current.text2, modifier = Modifier.padding(start = 20.dp, top = 18.dp, bottom = 8.dp))
}

@Composable
fun Group(modifier: Modifier = Modifier, content: @Composable ColumnScope.() -> Unit) {
    val look = LocalLook.current
    Column(modifier.fillMaxWidth().padding(horizontal = 16.dp).clip(RoundedCornerShape(if (look.glass) 22.dp else 28.dp)).background(look.cell), content = content)
}

/** Строка группы: цветной значок, текст, значение, стрелка. */
@Composable
fun GroupRow(icon: ImageVector, text: String, tint: Color = LocalLook.current.accent, value: String? = null, danger: Boolean = false, chevron: Boolean = true, onClick: () -> Unit) {
    val look = LocalLook.current
    Row(Modifier.fillMaxWidth().clickable(onClick = onClick).padding(horizontal = 14.dp, vertical = 11.dp), verticalAlignment = Alignment.CenterVertically) {
        val c = if (danger) MaterialTheme.colorScheme.error else tint
        Box(
            Modifier.size(32.dp).clip(if (look.glass) RoundedCornerShape(10.dp) else CircleShape)
                .background(if (look.glass) c.copy(alpha = 0.16f) else MaterialTheme.colorScheme.secondaryContainer),
            contentAlignment = Alignment.Center,
        ) { Icon(icon, null, tint = if (look.glass || danger) c else MaterialTheme.colorScheme.onSecondaryContainer, modifier = Modifier.size(19.dp)) }
        Text(tr(text), Modifier.weight(1f).padding(start = 12.dp), color = if (danger) MaterialTheme.colorScheme.error else look.text, fontSize = 16.sp)
        if (value != null) Text(tr(value), color = look.text2, fontSize = 15.sp, modifier = Modifier.padding(end = 4.dp), maxLines = 1)
        if (chevron && !danger) Icon(Icons.Rounded.ChevronRight, null, tint = look.text3, modifier = Modifier.size(20.dp))
    }
}

@Composable
fun SwitchRow(title: String, checked: Boolean, sub: String? = null, onChange: (Boolean) -> Unit) {
    val look = LocalLook.current
    Row(Modifier.fillMaxWidth().clickable { onChange(!checked) }.padding(horizontal = 16.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f).padding(end = 12.dp)) {
            Text(tr(title), fontSize = 16.sp)
            if (sub != null) Text(tr(sub), fontSize = 13.sp, color = look.text2, modifier = Modifier.padding(top = 2.dp))
        }
        Switch(
            checked, onChange,
            colors = if (look.glass) SwitchDefaults.colors(checkedTrackColor = Color(0xFF30D158), checkedThumbColor = Color.White, uncheckedTrackColor = look.ink.copy(alpha = 0.16f), uncheckedThumbColor = Color.White, uncheckedBorderColor = Color.Transparent) else SwitchDefaults.colors(),
        )
    }
}

/** Сегменты: стеклянный бегунок или Material segmented buttons. */
@Composable
fun Segs(options: List<Pair<String, String>>, selected: String, modifier: Modifier = Modifier, onSelect: (String) -> Unit) {
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

/** Строка выбора: подпись слева, сегменты справа (как choice-row на сайте). */
@Composable
fun ChoiceRow(title: String, options: List<Pair<String, String>>, selected: String, sub: String? = null, wide: Boolean = false, onSelect: (String) -> Unit) {
    val look = LocalLook.current
    if (wide) Column(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp)) {
        Text(tr(title), fontSize = 16.sp)
        if (sub != null) Text(tr(sub), fontSize = 13.sp, color = look.text2)
        Segs(options, selected, Modifier.fillMaxWidth().padding(top = 10.dp), onSelect)
    } else Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f).padding(end = 10.dp)) {
            Text(tr(title), fontSize = 16.sp)
            if (sub != null) Text(tr(sub), fontSize = 12.sp, color = look.text2)
        }
        Segs(options, selected, Modifier.width((options.size * 84).dp), onSelect)
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

/** Чип папки / фильтра. */
@Composable
fun Chip(text: String, on: Boolean, count: Int = 0, onClick: () -> Unit) {
    val look = LocalLook.current
    Row(
        Modifier.height(34.dp).clip(CircleShape)
            .background(if (on) look.accent else if (look.glass) look.ink.copy(alpha = 0.08f) else MaterialTheme.colorScheme.surfaceContainerHigh)
            .clickable(onClick = onClick).padding(horizontal = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(tr(text), fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = if (on) look.onAccent else look.text2)
        if (count > 0) Box(Modifier.padding(start = 6.dp).size(18.dp).clip(CircleShape).background(if (on) look.onAccent.copy(alpha = 0.25f) else look.ink.copy(alpha = 0.12f)), contentAlignment = Alignment.Center) {
            Text("$count", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = if (on) look.onAccent else look.text2)
        }
    }
}

/** Большая кнопка (белая в стекле / Material filled). */
@Composable
fun BigButton(text: String, modifier: Modifier = Modifier, secondary: Boolean = false, danger: Boolean = false, enabled: Boolean = true, onClick: () -> Unit) {
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
        modifier.fillMaxWidth().height(52.dp).clip(RoundedCornerShape(if (look.glass) 26.dp else 26.dp)).background(bg).clickable(enabled = enabled, onClick = onClick).graphicsLayer { alpha = if (enabled) 1f else 0.4f },
        contentAlignment = Alignment.Center,
    ) { Text(tr(text), color = fg, fontSize = 17.sp, fontWeight = FontWeight.SemiBold) }
}

@Suppress("unused") private val keepFloat = mutableFloatStateOf(0f)
@Suppress("unused") private fun keepDp(d: Dp) = d

/**
 * Обои Material You — как «Shapes» на сайте: фон в тонах палитры, большая
 * планета с кольцом, «печеньки»-звёзды, точки и пунктирная орбита.
 */
@Composable
fun MaterialWallpaper(modifier: Modifier = Modifier) {
    val cs = MaterialTheme.colorScheme
    val look = LocalLook.current
    if (look.glass) return
    androidx.compose.foundation.Canvas(modifier) {
        val w = size.width; val h = size.height
        drawRect(androidx.compose.ui.graphics.lerp(cs.surface, cs.primaryContainer, if (look.dark) 0.35f else 0.25f))
        // орбита пунктиром
        drawArc(
            cs.onSurface.copy(alpha = 0.35f), 200f, 120f, false,
            topLeft = androidx.compose.ui.geometry.Offset(-w * 0.3f, h * 0.32f), size = androidx.compose.ui.geometry.Size(w * 1.8f, h * 0.5f),
            style = androidx.compose.ui.graphics.drawscope.Stroke(3f, pathEffect = androidx.compose.ui.graphics.PathEffect.dashPathEffect(floatArrayOf(2f, 14f)), cap = androidx.compose.ui.graphics.StrokeCap.Round),
        )
        // планета с кольцом
        val pc = androidx.compose.ui.geometry.Offset(w * 0.62f, h * 0.88f)
        val pr = w * 0.33f
        drawCircle(cs.primaryContainer.copy(alpha = 0.9f), pr, pc)
        drawCircle(cs.primary.copy(alpha = 0.25f), pr * 0.22f, androidx.compose.ui.geometry.Offset(pc.x - pr * 0.35f, pc.y - pr * 0.3f))
        drawOval(cs.onSurface.copy(alpha = 0.5f), androidx.compose.ui.geometry.Offset(pc.x - pr * 1.6f, pc.y - pr * 0.25f), androidx.compose.ui.geometry.Size(pr * 3.2f, pr * 0.55f), style = androidx.compose.ui.graphics.drawscope.Stroke(6f))
        // «печеньки» (скруглённые многоугольники)
        fun cookie(cx: Float, cy: Float, r: Float, n: Int, c: Color) {
            val path = androidx.compose.ui.graphics.Path()
            val steps = 120
            for (i in 0..steps) {
                val a = i / steps.toFloat() * 2 * Math.PI
                val rr = r * (1 + 0.12f * kotlin.math.cos(n * a).toFloat())
                val x = cx + rr * kotlin.math.cos(a).toFloat(); val y = cy + rr * kotlin.math.sin(a).toFloat()
                if (i == 0) path.moveTo(x, y) else path.lineTo(x, y)
            }
            drawPath(path, c)
        }
        cookie(w * 0.82f, h * 0.2f, w * 0.13f, 4, cs.tertiaryContainer.copy(alpha = 0.9f))
        cookie(w * 0.12f, h * 0.62f, w * 0.08f, 9, cs.tertiaryContainer.copy(alpha = 0.8f))
        // звёзды-искры и точки
        fun sparkle(x: Float, y: Float, s: Float) {
            val p = androidx.compose.ui.graphics.Path().apply {
                moveTo(x, y - s); quadraticTo(x, y, x + s, y); quadraticTo(x, y, x, y + s); quadraticTo(x, y, x - s, y); quadraticTo(x, y, x, y - s); close()
            }
            drawPath(p, cs.onSurface.copy(alpha = 0.9f))
        }
        sparkle(w * 0.5f, h * 0.14f, 14f); sparkle(w * 0.86f, h * 0.5f, 18f); sparkle(w * 0.3f, h * 0.36f, 10f)
        listOf(0.15f to 0.3f, 0.7f to 0.42f, 0.4f to 0.6f, 0.9f to 0.7f, 0.2f to 0.85f).forEach { (x, y) -> drawCircle(cs.onSurface.copy(alpha = 0.6f), 3f, androidx.compose.ui.geometry.Offset(w * x, h * y)) }
    }
}
