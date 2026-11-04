package app.kosmo.chat.ui

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.waitForUpOrCancellation
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.kosmo.chat.core.ApiException
import app.kosmo.chat.core.JSON
import app.kosmo.chat.core.SessionInfo
import app.kosmo.chat.core.jobj
import app.kosmo.chat.core.str
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.serialization.json.JsonObject
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener

private enum class Step { Email, Code, Pass, NewPass, RepeatPass, ResetPass, Name, Bio }

/* Цвета экрана входа — переменные сайта (--c-cell-bg, --c-btn-bg …) */
private data class AuthColors(val cellBg: Color, val cellBorder: Color, val cellActive: Color, val btnBg: Color, val btnFg: Color, val key: Color, val keyDown: Color, val success: Color)

@Composable
private fun authColors(): AuthColors {
    val look = LocalLook.current
    val cs = MaterialTheme.colorScheme
    return if (look.glass) AuthColors(
        cellBg = if (look.dark) Color(0xFF0B0B0C) else Color.White, cellBorder = look.ink.copy(alpha = 0.16f), cellActive = look.ink.copy(alpha = 0.6f),
        btnBg = if (look.dark) Color.White else Color.Black, btnFg = if (look.dark) Color.Black else Color.White,
        key = look.ink.copy(alpha = 0.11f), keyDown = look.ink.copy(alpha = 0.36f), success = Color(0xFF30D158),
    ) else AuthColors(
        cellBg = cs.primary.copy(alpha = 0.14f).compositeOverSafe(cs.surfaceContainerHighest), cellBorder = cs.outlineVariant, cellActive = cs.primary,
        btnBg = cs.primary, btnFg = cs.onPrimary,
        key = cs.primary.copy(alpha = 0.10f).compositeOverSafe(cs.surfaceContainerHigh), keyDown = cs.primaryContainer, success = cs.primary,
    )
}

private fun Color.compositeOverSafe(bg: Color): Color = androidx.compose.ui.graphics.Color(
    red = red * alpha + bg.red * (1 - alpha), green = green * alpha + bg.green * (1 - alpha), blue = blue * alpha + bg.blue * (1 - alpha), alpha = 1f,
)

/**
 * Вход и регистрация — как на сайте: заставка с планетой, почта → код из
 * письма → код-пароль; новый аккаунт — код-пароль дважды, имя и @username,
 * описание. «Forgot passcode?» — сброс кодом из письма. Вход по QR-коду.
 */
@Composable
fun AuthScreen(app: AppState, preview: String? = null) {
    var step by remember { mutableStateOf(preview?.let { p -> Step.entries.firstOrNull { it.name.equals(p, true) } } ?: Step.Email) }
    var forward by remember { mutableStateOf(true) }
    var email by remember { mutableStateOf(if (preview != null) "new@kosmo.test" else "") }
    var ticket by remember { mutableStateOf("") }
    var newPass by remember { mutableStateOf("") }
    var name by remember { mutableStateOf("") }
    var username by remember { mutableStateOf("") }
    var reset by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var shakeKey by remember { mutableIntStateOf(0) }
    var qr by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    var introDone by remember { mutableStateOf(preview != null) }
    val look = LocalLook.current

    fun go(s: Step, fwd: Boolean = true) { forward = fwd; error = null; step = s }
    fun fail(e: Throwable) {
        busy = false
        error = when ((e as? ApiException)?.code) {
            "bad_code", "wrong_code" -> "Wrong code"
            "wrong_passcode" -> "Wrong passcode"
            else -> e.message ?: "Something went wrong"
        }
        shakeKey++
    }
    fun back() = when (step) {
        Step.Code -> go(Step.Email, false)
        Step.Pass, Step.NewPass, Step.ResetPass -> go(Step.Email, false)
        Step.RepeatPass -> go(Step.NewPass, false)
        Step.Name -> go(Step.NewPass, false)
        Step.Bio -> go(Step.Name, false)
        Step.Email -> Unit
    }
    androidx.activity.compose.BackHandler(step != Step.Email) { back() }

    androidx.compose.runtime.CompositionLocalProvider(LocalNoAnim provides (preview != null)) {
    BoxWithConstraints(Modifier.fillMaxSize().background(if (look.glass) look.page else MaterialTheme.colorScheme.surfaceContainerLowest)) {
        // Заставка: большая планета в центре, потом встаёт на своё место над «Kosmo»
        val h = maxHeight
        val fly = remember { Animatable(if (preview != null) 1f else 0f) }
        LaunchedEffect(Unit) {
            if (preview != null) return@LaunchedEffect
            delay(1750)
            launch { fly.animateTo(1f, spring(dampingRatio = 0.78f, stiffness = 120f)) }
            delay(220)
            introDone = true
        }
        val big = minOf(288.dp, minOf(maxWidth, maxHeight) * 0.6f)
        if (!introDone || fly.value < 1f) {
            val size = big + (120.dp - big) * fly.value
            // место логотипа на экране почты: блок (120 + 8 + 41 + 32 + …) по центру экрана
            val topFinal = h / 2 - 312.dp
            val top = (h / 2 - big / 2) + (topFinal - (h / 2 - big / 2)) * fly.value
            PlanetLogo(Modifier.align(Alignment.TopCenter).offset(y = top).size(size), intro = true)
        }

        AnimatedVisibility(introDone, enter = fadeIn(tween(500))) {
            Box(Modifier.fillMaxSize().safeDrawingPadding().imePadding()) {
                val shake = remember { Animatable(0f) }
                LaunchedEffect(shakeKey) {
                    if (shakeKey == 0) return@LaunchedEffect
                    for (x in listOf(-7f, 7f, -7f, 7f, 0f)) shake.animateTo(x, tween(80))
                }
                AnimatedContent(
                    targetState = step,
                    transitionSpec = {
                        val dir = if (forward) 1 else -1
                        (slideInHorizontally(spring(dampingRatio = 0.86f, stiffness = 380f)) { dir * it / 4 } + fadeIn(tween(260))) togetherWith
                            (slideOutHorizontally(tween(260)) { -dir * it / 4 } + fadeOut(tween(200)))
                    },
                    label = "auth",
                    modifier = Modifier.fillMaxSize(),
                ) { s ->
                    // .stage: экран по центру, ширина до 400
                    Box(Modifier.fillMaxSize().verticalScroll(rememberScrollState()).padding(start = 16.dp, end = 16.dp, top = 24.dp, bottom = 100.dp), contentAlignment = Alignment.Center) {
                        Column(
                            Modifier.widthIn(max = 400.dp).fillMaxWidth().heightIn(min = 0.dp).graphicsLayer { translationX = shake.value * density },
                            horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center,
                        ) {
                            when (s) {
                                Step.Email -> EmailStep(email, busy, error, onQr = { qr = true }) { e ->
                                    email = e.trim().lowercase(); busy = true; error = null; reset = false
                                    scope.launch {
                                        try { app.auth.sendCode(email); busy = false; go(Step.Code) } catch (t: Throwable) { fail(t) }
                                    }
                                }
                                Step.Code -> CodeStep(email, error, title = if (reset) "Reset passcode" else "Enter code", resend = {
                                    scope.launch { runCatching { if (reset) app.auth.resetCode(email) else app.auth.sendCode(email) }.onFailure { app.toast = it.message } }
                                }) { code ->
                                    busy = true; error = null
                                    scope.launch {
                                        try {
                                            if (reset) {
                                                ticket = app.auth.resetVerify(email, code); busy = false; go(Step.ResetPass)
                                            } else {
                                                val (t, exists) = app.auth.verify(email, code)
                                                ticket = t; busy = false
                                                go(if (exists) Step.Pass else Step.NewPass)
                                            }
                                        } catch (t: Throwable) { fail(t) }
                                    }
                                }
                                Step.Pass -> PassStep("Enter passcode", error, busy, onForgot = {
                                    scope.launch {
                                        try { app.auth.resetCode(email); reset = true; go(Step.Code) } catch (t: Throwable) { app.toast = t.message }
                                    }
                                }) { p ->
                                    busy = true; error = null
                                    scope.launch {
                                        try { app.signedIn(app.auth.login(ticket, p)) } catch (t: Throwable) { fail(t) }
                                    }
                                }
                                Step.ResetPass -> PassStep("New passcode", error, busy) { p ->
                                    busy = true; error = null
                                    scope.launch {
                                        try { app.signedIn(app.auth.reset(ticket, p)) } catch (t: Throwable) { fail(t) }
                                    }
                                }
                                Step.NewPass -> PassStep("Create passcode", error, busy) { p -> newPass = p; go(Step.RepeatPass) }
                                Step.RepeatPass -> PassStep("Repeat passcode", error, busy) { p ->
                                    if (p != newPass) { error = "Passcodes don’t match"; shakeKey++ } else go(Step.Name)
                                }
                                Step.Name -> NameStep(app, name, username) { n, u -> name = n; username = u; go(Step.Bio) }
                                Step.Bio -> BioStep(name, username, busy, error) { bio ->
                                    busy = true; error = null
                                    scope.launch {
                                        try { app.signedIn(app.auth.register(ticket, newPass, name, username, bio)) } catch (t: Throwable) { fail(t) }
                                    }
                                }
                            }
                        }
                    }
                }
                // «назад» — круг слева сверху (.back-btn)
                AnimatedVisibility(step != Step.Email, enter = fadeIn() + scaleIn(initialScale = 0.8f), exit = fadeOut(), modifier = Modifier.padding(start = 16.dp, top = 72.dp)) {
                    if (look.glass) CircleBtn(WI.hdrBack, "Back") { back() }
                    else Box(Modifier.size(44.dp).clip(CircleShape).clickable { back() }, contentAlignment = Alignment.Center) { Icon(WI.hdrBack, tr("Back"), tint = look.text) }
                }
                // добавление ещё одного аккаунта: «Back to Kosmo» (#auth-cancel на сайте)
                val backTo = app.accounts.firstOrNull()
                if (backTo != null && step == Step.Email) Row(
                    Modifier.align(Alignment.TopStart).padding(16.dp).height(40.dp).chrome(look, CircleShape).clickable { app.switchAccount(backTo.str("uid")!!) }.padding(start = 10.dp, end = 16.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) { Icon(WI.hdrBack, null, modifier = Modifier.size(20.dp)); Text(tr("Back to Kosmo"), fontSize = 15.sp, fontWeight = FontWeight.SemiBold) }
            }
        }
    }
    }
    if (qr) QrLoginSheet(app, onClose = { qr = false }) { s -> qr = false; app.signedIn(s) }
}

private val LocalNoAnim = androidx.compose.runtime.staticCompositionLocalOf { false }

@Composable
internal fun Title(text: String) = Text(
    tr(text), fontSize = 28.sp, lineHeight = 34.sp, fontWeight = if (LocalLook.current.glass) FontWeight.Bold else FontWeight.Medium,
    letterSpacing = if (LocalLook.current.glass) (-0.56).sp else 0.sp, textAlign = TextAlign.Center, modifier = Modifier.padding(bottom = 28.dp),
)

@Composable
private fun ErrorText(error: String?) {
    Text(tr(error ?: ""), color = MaterialTheme.colorScheme.error, fontSize = 14.sp, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 10.dp).alpha(if (error == null) 0f else 1f))
}

/** .field: пилюля 58 высотой, фон --c-field-bg (стекло — с ободком). */
@Composable
private fun AuthField(
    value: String, onChange: (String) -> Unit, placeholder: String, modifier: Modifier = Modifier,
    leading: (@Composable () -> Unit)? = null, trailing: (@Composable () -> Unit)? = null, error: Boolean = false,
    keyboard: KeyboardOptions = KeyboardOptions.Default, onGo: (() -> Unit)? = null, singleLine: Boolean = true, height: androidx.compose.ui.unit.Dp = 58.dp,
) {
    val look = LocalLook.current
    val cs = MaterialTheme.colorScheme
    var focused by remember { mutableStateOf(false) }
    val sc by animateFloatAsState(if (focused && look.glass) 1.015f else 1f, spring(dampingRatio = 0.6f, stiffness = 400f), label = "f")
    val shape = RoundedCornerShape(if (look.glass) 29.dp else 28.dp)
    Row(
        modifier.fillMaxWidth().heightIn(min = height).scale(sc)
            .then(if (look.glass) Modifier.chrome(look, shape, fill = look.field) else Modifier.clip(shape).background(cs.surfaceContainerHigh))
            .border(if (error) 1.5.dp else if (!look.glass && focused) 2.dp else 1.dp, if (error) cs.error else if (look.glass) Color.Transparent else if (focused) cs.primary else cs.outlineVariant, shape)
            .padding(start = if (leading != null) 6.dp else 22.dp, end = 18.dp),
        verticalAlignment = if (singleLine) Alignment.CenterVertically else Alignment.Top,
    ) {
        leading?.invoke()
        Box(Modifier.weight(1f).padding(vertical = if (singleLine) 0.dp else 16.dp)) {
            if (value.isEmpty()) Text(tr(placeholder), color = look.text3, fontSize = 18.sp)
            BasicTextField(
                value, onChange, singleLine = singleLine,
                textStyle = TextStyle(color = look.text, fontSize = 18.sp, fontWeight = FontWeight.Medium, fontFamily = MaterialTheme.typography.bodyLarge.fontFamily),
                cursorBrush = SolidColor(look.accent),
                keyboardOptions = keyboard, keyboardActions = KeyboardActions(onGo = { onGo?.invoke() }, onDone = { onGo?.invoke() }),
                modifier = Modifier.fillMaxWidth().onFocusChanged { focused = it.isFocused },
            )
        }
        trailing?.invoke()
    }
}

/** .btn: пилюля 56, белая (стекло) / primary (Material); при нажатии проседает. */
@Composable
private fun AuthButton(text: String, enabled: Boolean = true, busy: Boolean = false, secondary: Boolean = false, icon: androidx.compose.ui.graphics.vector.ImageVector? = null, onClick: () -> Unit) {
    val look = LocalLook.current
    val c = authColors()
    val cs = MaterialTheme.colorScheme
    var down by remember { mutableStateOf(false) }
    val sc by animateFloatAsState(if (down && look.glass) 0.96f else 1f, spring(dampingRatio = 0.5f, stiffness = 600f), label = "b")
    val r by animateDpAsState(if (down && !look.glass) 16.dp else 28.dp, spring(dampingRatio = 0.7f, stiffness = 500f), label = "r")
    val shape = RoundedCornerShape(r)
    val bg = when { secondary -> if (look.glass) look.field else cs.secondaryContainer; !enabled -> if (look.glass) look.ink.copy(alpha = 0.3f) else cs.onSurface.copy(alpha = 0.12f); else -> c.btnBg }
    val fg = when { secondary -> if (look.glass) look.text else cs.onSecondaryContainer; !enabled -> if (look.glass) look.ink.copy(alpha = 0.6f) else cs.onSurface.copy(alpha = 0.38f); else -> c.btnFg }
    Row(
        Modifier.fillMaxWidth().height(56.dp).scale(sc)
            .then(if (secondary && look.glass) Modifier.chrome(look, shape, fill = bg) else Modifier.clip(shape).background(bg))
            .pointerInput(enabled, busy) {
                awaitEachGesture {
                    awaitFirstDown()
                    if (!enabled || busy) return@awaitEachGesture
                    down = true
                    val up = waitForUpOrCancellation()
                    down = false
                    if (up != null) onClick()
                }
            }.padding(horizontal = 24.dp),
        horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically,
    ) {
        if (busy) CircularProgressIndicator(Modifier.size(22.dp), strokeWidth = 2.5.dp, color = fg)
        else {
            if (icon != null) Icon(icon, null, tint = fg, modifier = Modifier.padding(end = 10.dp).size(22.dp))
            Text(tr(text), color = fg, fontSize = if (look.glass) 17.sp else 16.sp, fontWeight = if (look.glass) FontWeight.SemiBold else FontWeight.Medium)
        }
    }
}

private val MailIcon = stroke(P("M6 5h12a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3z"), P("M4 7l8 6 8-6"))
private val QrIcon = stroke(
    P("M5.1 3.5h3.3a1.6 1.6 0 0 1 1.6 1.6v3.3a1.6 1.6 0 0 1-1.6 1.6H5.1a1.6 1.6 0 0 1-1.6-1.6V5.1a1.6 1.6 0 0 1 1.6-1.6z"),
    P("M15.6 3.5h3.3a1.6 1.6 0 0 1 1.6 1.6v3.3a1.6 1.6 0 0 1-1.6 1.6h-3.3A1.6 1.6 0 0 1 14 8.4V5.1a1.6 1.6 0 0 1 1.6-1.6z"),
    P("M5.1 14h3.3a1.6 1.6 0 0 1 1.6 1.6v3.3a1.6 1.6 0 0 1-1.6 1.6H5.1a1.6 1.6 0 0 1-1.6-1.6v-3.3A1.6 1.6 0 0 1 5.1 14z"),
    P("M14.6 14h1.3a.6.6 0 0 1 .6.6v1.3a.6.6 0 0 1-.6.6h-1.3a.6.6 0 0 1-.6-.6v-1.3a.6.6 0 0 1 .6-.6zM18.6 18h1.3a.6.6 0 0 1 .6.6v1.3a.6.6 0 0 1-.6.6h-1.3a.6.6 0 0 1-.6-.6v-1.3a.6.6 0 0 1 .6-.6z"),
)

@Composable
private fun EmailStep(initial: String, busy: Boolean, error: String?, onQr: () -> Unit, onNext: (String) -> Unit) {
    val look = LocalLook.current
    var email by remember { mutableStateOf(initial) }
    var bad by remember { mutableStateOf(false) }
    val ok = Regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$").matches(email.trim())
    fun submit() { if (!ok) { bad = true; return }; if (!busy) onNext(email) }
    // логотип и «Kosmo» — на месте, куда прилетела заставка
    Box(Modifier.size(120.dp)) { PlanetLogo(Modifier.fillMaxSize()) }
    Spacer(Modifier.height(8.dp))
    Text("Kosmo", fontSize = 34.sp, lineHeight = 41.sp, fontWeight = if (look.glass) FontWeight.Bold else FontWeight.SemiBold, letterSpacing = if (look.glass) (-0.68).sp else 0.sp)
    Text(tr("Sign in or create an account with your email"), fontSize = 15.sp, color = look.text2, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 10.dp, bottom = 26.dp))
    Reveal(1) {
        AuthField(
            email, { email = it; bad = false }, "Email", error = bad || error != null,
            leading = { Icon(MailIcon, null, tint = look.text2, modifier = Modifier.padding(start = 12.dp, end = 8.dp).size(22.dp)) },
            keyboard = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Go), onGo = { submit() },
        )
    }
    Spacer(Modifier.height(12.dp))
    Reveal(2) { AuthButton("Continue", busy = busy) { submit() } }
    if (error != null) ErrorText(error)
    Reveal(3) {
        Column {
            // «or» между кнопками
            Row(Modifier.fillMaxWidth().padding(horizontal = 4.dp, vertical = 18.dp), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.weight(1f).height(0.5.dp).background(look.hairline))
                Text(tr("or"), fontSize = 13.sp, color = look.text3, modifier = Modifier.padding(horizontal = 12.dp))
                Box(Modifier.weight(1f).height(0.5.dp).background(look.hairline))
            }
            AuthButton("Log in with QR code", secondary = true, icon = QrIcon) { onQr() }
        }
    }
}

/** Появление по очереди после заставки (.reveal на сайте). */
@Composable
private fun Reveal(d: Int, content: @Composable () -> Unit) {
    val inspect = androidx.compose.ui.platform.LocalInspectionMode.current || LocalNoAnim.current
    val p = remember { Animatable(if (inspect) 1f else 0f) }
    LaunchedEffect(Unit) { if (p.value < 1f) { delay(d * 70L); p.animateTo(1f, spring(dampingRatio = 0.8f, stiffness = 180f)) } }
    Box(Modifier.graphicsLayer { alpha = p.value; translationY = (1 - p.value) * 24.dp.toPx(); scaleX = 0.97f + 0.03f * p.value; scaleY = scaleX }) { content() }
}

/** Код из письма: 6 ячеек (56×68, радиус 18), цифры всплывают; «Send again» через 60 с. */
@Composable
internal fun CodeStep(email: String, error: String?, title: String = "Code sent to", resend: (() -> Unit)? = null, onCode: (String) -> Unit) {
    val look = LocalLook.current
    val c = authColors()
    var code by remember { mutableStateOf("") }
    var focused by remember { mutableStateOf(false) }
    val focus = remember { FocusRequester() }
    LaunchedEffect(Unit) { runCatching { focus.requestFocus() } }
    LaunchedEffect(error) { if (error != null) code = "" }
    Title(title)
    if (resend != null) {
        Text(tr("We sent a code to") + " " + email, fontSize = 15.sp, color = look.text2, textAlign = TextAlign.Center)
        Text(tr("No email? Check the Spam folder"), fontSize = 13.sp, color = look.text3, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 2.dp, bottom = 18.dp))
    } else Text(email, fontSize = 18.sp, fontWeight = FontWeight.SemiBold, color = look.accent, modifier = Modifier.padding(bottom = 18.dp))
    BasicTextField(
        value = code,
        onValueChange = { v ->
            val d = v.filter(Char::isDigit).take(6)
            code = d
            if (d.length == 6) onCode(d)
        },
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
        modifier = Modifier.fillMaxWidth().focusRequester(focus).onFocusChanged { focused = it.isFocused },
        textStyle = TextStyle(color = Color.Transparent),
        cursorBrush = SolidColor(Color.Transparent),
        decorationBox = {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp, Alignment.CenterHorizontally)) {
                repeat(6) { i ->
                    val ch = code.getOrNull(i)
                    val active = focused && i == code.length
                    val sc by animateFloatAsState(if (active) 1.06f else 1f, spring(dampingRatio = 0.5f, stiffness = 500f), label = "c")
                    Box(
                        Modifier.weight(1f).widthIn(max = 56.dp).height(68.dp).scale(sc).clip(RoundedCornerShape(if (look.glass) 18.dp else 16.dp)).background(c.cellBg)
                            .border(1.dp, if (error != null) MaterialTheme.colorScheme.error else if (active) c.cellActive else c.cellBorder, RoundedCornerShape(if (look.glass) 18.dp else 16.dp)),
                        contentAlignment = Alignment.Center,
                    ) {
                        AnimatedContent(ch, transitionSpec = { (slideInVertically { it / 2 } + fadeIn()) togetherWith fadeOut(tween(120)) }, label = "d") { x ->
                            if (x != null) Text(x.toString(), fontSize = 30.sp, fontWeight = FontWeight.SemiBold)
                            else if (active) {
                                val blink = androidx.compose.animation.core.rememberInfiniteTransition(label = "caret")
                                val a by blink.animateFloat(1f, 0f, androidx.compose.animation.core.infiniteRepeatable(tween(500, easing = androidx.compose.animation.core.LinearEasing), androidx.compose.animation.core.RepeatMode.Reverse), label = "a")
                                Box(Modifier.width(2.dp).height(30.dp).alpha(if (a > 0.5f) 1f else 0f).background(look.accent))
                            }
                        }
                    }
                }
            }
        },
    )
    ErrorText(error)
    if (resend != null) {
        var left by remember { mutableIntStateOf(60) }
        LaunchedEffect(left) { if (left > 0) { delay(1000); left-- } }
        Text(
            if (left > 0) tr("Send again in") + " $left s" else tr("Send again"),
            fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = if (left > 0) look.text3 else look.accent,
            modifier = Modifier.padding(top = 8.dp).clip(CircleShape).clickable(enabled = left == 0) { resend(); left = 60 }.padding(horizontal = 12.dp, vertical = 8.dp),
        )
    }
}

/** Код-пароль: 4 ячейки 60×70 с точками и клавиатура как на iPhone (кнопки 80). */
@Composable
fun PassStep(title: String, error: String?, busy: Boolean, hint: String? = null, onForgot: (() -> Unit)? = null, onPass: (String) -> Unit) {
    val look = LocalLook.current
    val c = authColors()
    var pass by remember { mutableStateOf("") }
    LaunchedEffect(error) { if (error != null) { delay(420); pass = "" } }
    Title(title)
    Row(horizontalArrangement = Arrangement.spacedBy(14.dp)) {
        repeat(4) { i ->
            val on = i < pass.length
            val active = i == pass.length && !busy
            val sc by animateFloatAsState(if (active) 1.06f else 1f, spring(dampingRatio = 0.5f, stiffness = 500f), label = "p")
            val dot by animateFloatAsState(if (on) 1f else 0f, spring(dampingRatio = 0.45f, stiffness = 500f), label = "dot")
            val shape = RoundedCornerShape(if (look.glass) 20.dp else 18.dp)
            Box(
                Modifier.size(60.dp, 70.dp).scale(sc).clip(shape).background(c.cellBg)
                    .border(1.dp, if (error != null) MaterialTheme.colorScheme.error else if (active) c.cellActive else c.cellBorder, shape),
                contentAlignment = Alignment.Center,
            ) { Box(Modifier.size(16.dp).scale(dot).alpha(dot).clip(CircleShape).background(if (error != null) MaterialTheme.colorScheme.error else if (look.glass) look.text else MaterialTheme.colorScheme.primary)) }
        }
    }
    Text(tr(error ?: hint ?: ""), fontSize = 15.sp, color = if (error != null) MaterialTheme.colorScheme.error else look.text2, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 14.dp).heightIn(min = 20.dp))
    Spacer(Modifier.height(24.dp))
    val subs = mapOf("2" to "ABC", "3" to "DEF", "4" to "GHI", "5" to "JKL", "6" to "MNO", "7" to "PQRS", "8" to "TUV", "9" to "WXYZ")
    val keys = listOf("1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "<")
    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        keys.chunked(3).forEach { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(26.dp)) {
                row.forEach { k ->
                    if (k.isEmpty()) Spacer(Modifier.size(80.dp))
                    else {
                        var down by remember { mutableStateOf(false) }
                        val bg by androidx.compose.animation.animateColorAsState(if (down) c.keyDown else if (k == "<") Color.Transparent else c.key, if (down) tween(0) else tween(450), label = "k")
                        val sc by animateFloatAsState(if (down && k == "<") 0.88f else if (down && !look.glass) 0.96f else 1f, spring(dampingRatio = 0.5f, stiffness = 600f), label = "ks")
                        val r by animateDpAsState(if (down && !look.glass) 22.dp else 40.dp, spring(dampingRatio = 0.7f, stiffness = 500f), label = "kr")
                        val hidden = k == "<" && pass.isEmpty()
                        Column(
                            Modifier.size(80.dp).scale(sc).alpha(if (hidden) 0f else 1f).clip(RoundedCornerShape(r)).background(if (k == "<" && !down) Color.Transparent else bg)
                                .pointerInput(busy, pass, hidden) {
                                    awaitEachGesture {
                                        awaitFirstDown()
                                        if (busy || hidden) return@awaitEachGesture
                                        down = true
                                        val up = waitForUpOrCancellation()
                                        down = false
                                        if (up == null) return@awaitEachGesture
                                        if (k == "<") pass = pass.dropLast(1)
                                        else if (pass.length < 4) {
                                            pass += k
                                            if (pass.length == 4) onPass(pass)
                                        }
                                    }
                                },
                            horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center,
                        ) {
                            if (k == "<") Icon(DelIcon, tr("Delete"), tint = look.text2, modifier = Modifier.size(30.dp))
                            else {
                                Text(k, fontSize = if (look.glass) 34.sp else 32.sp, lineHeight = 34.sp, fontWeight = if (look.glass) FontWeight.Normal else FontWeight.Medium)
                                if (k != "0") Text(subs[k] ?: " ", fontSize = 10.sp, lineHeight = 12.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 1.4.sp, color = look.text2)
                            }
                        }
                    }
                }
            }
        }
    }
    if (onForgot != null) Text(
        tr("Forgot passcode?"), fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = look.accent,
        modifier = Modifier.padding(top = 18.dp).clip(CircleShape).clickable { onForgot() }.padding(horizontal = 12.dp, vertical = 8.dp),
    )
    if (busy) CircularProgressIndicator(Modifier.padding(top = 16.dp).size(24.dp), strokeWidth = 2.5.dp)
}

private val DelIcon = stroke(P("M9 5h10.5A1.5 1.5 0 0 1 21 6.5v11a1.5 1.5 0 0 1-1.5 1.5H9l-6-7z"), P("M12.5 9.5l5 5M17.5 9.5l-5 5"))

/** Пустая аватарка регистрации (.avatar.is-empty) с буквами имени. */
@Composable
private fun SetupAvatar(name: String) {
    val look = LocalLook.current
    if (name.isBlank()) Box(Modifier.size(104.dp).clip(CircleShape).background(if (look.glass) look.field else MaterialTheme.colorScheme.surfaceContainerHigh), contentAlignment = Alignment.Center) {
        Icon(WI.user, null, tint = look.text3, modifier = Modifier.size(44.dp))
    } else Avatar(name, null, 104.dp)
}

@Composable
private fun NameStep(app: AppState, name0: String, username0: String, onDone: (String, String) -> Unit) {
    val look = LocalLook.current
    var name by remember { mutableStateOf(name0) }
    var username by remember { mutableStateOf(username0) }
    var free by remember { mutableStateOf<Boolean?>(null) }
    var bad by remember { mutableStateOf(false) }
    val valid = Regex("^(?=.*[a-z])[a-z0-9]{3,32}$").matches(username)
    LaunchedEffect(username) {
        free = null
        if (!valid) return@LaunchedEffect
        delay(350)
        free = runCatching { app.auth.usernameFree(username) }.getOrNull()
    }
    val userOk = username.isEmpty() || (valid && free != false)
    val ready = name.isNotBlank() && userOk
    SetupAvatar(name)
    Spacer(Modifier.height(28.dp))
    AuthField(name, { name = it.take(40); bad = false }, "Name", error = bad, keyboard = KeyboardOptions(imeAction = ImeAction.Next))
    Spacer(Modifier.height(12.dp))
    AuthField(
        username, { username = it.lowercase().filter { c -> c in 'a'..'z' || c in '0'..'9' }.take(32) }, "username (optional)",
        error = username.isNotEmpty() && (username.length >= 3 && !valid || free == false),
        leading = { Text("@", color = look.text2, fontSize = 18.sp, fontWeight = FontWeight.Medium, modifier = Modifier.padding(start = 16.dp, end = 4.dp)) },
        trailing = {
            val okI = username.isNotEmpty() && valid && free == true
            val badI = username.isNotEmpty() && ((username.length >= 3 && !valid) || free == false)
            val s by animateFloatAsState(if (okI || badI) 1f else 0.4f, spring(dampingRatio = 0.5f, stiffness = 500f), label = "st")
            Box(Modifier.size(24.dp).scale(s).alpha(if (okI || badI) 1f else 0f), contentAlignment = Alignment.Center) {
                if (okI) Icon(WI.check, null, tint = Color(0xFF30D158), modifier = Modifier.size(20.dp))
                if (badI) Icon(WI.close, null, tint = MaterialTheme.colorScheme.error, modifier = Modifier.size(20.dp))
            }
        },
        keyboard = KeyboardOptions(keyboardType = KeyboardType.Ascii, imeAction = ImeAction.Go), onGo = { if (ready) onDone(name.trim(), username) },
    )
    Text(
        tr(when {
            username.isEmpty() -> ""
            username.length < 3 -> "At least 3 characters"
            !username.any { it in 'a'..'z' } -> "Add at least one letter"
            free == false -> "@$username is taken"
            free == true -> "@$username is available"
            else -> "Checking…"
        }),
        fontSize = 13.sp, color = if (free == false || (username.length >= 3 && !valid)) MaterialTheme.colorScheme.error else look.text2,
        modifier = Modifier.padding(top = 6.dp, bottom = 6.dp).heightIn(min = 16.dp),
    )
    AuthButton("Continue", enabled = ready) { if (name.isBlank()) bad = true else onDone(name.trim(), username) }
}

@Composable
private fun BioStep(name: String, username: String, busy: Boolean, error: String?, onDone: (String) -> Unit) {
    val look = LocalLook.current
    var bio by remember { mutableStateOf("") }
    SetupAvatar(name)
    Text(name, fontSize = 24.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 14.dp))
    if (username.isNotEmpty()) Text("@$username", fontSize = 15.sp, color = look.text2)
    Spacer(Modifier.height(28.dp))
    AuthField(
        bio, { bio = it.take(70) }, "Bio", singleLine = false, height = 112.dp,
        trailing = { Text("${70 - bio.length}", fontSize = 13.sp, color = look.text3, modifier = Modifier.padding(top = 16.dp)) },
    )
    Spacer(Modifier.height(12.dp))
    AuthButton("Sign up", busy = busy) { onDone(bio.trim()) }
    ErrorText(error)
}

/* ---------------- Вход по QR-коду ---------------- */

private const val QR_ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun QrLoginSheet(app: AppState, onClose: () -> Unit, onLinked: (SessionInfo) -> Unit) {
    val look = LocalLook.current
    var code by remember { mutableStateOf(newQrCode()) }
    // новый код каждые 2 минуты, как на сайте
    LaunchedEffect(code) { delay(120_000); code = newQrCode() }
    DisposableEffect(code) {
        val wsBase = app.api.base.replaceFirst("https://", "wss://").replaceFirst("http://", "ws://")
        val ws = app.api.http.newWebSocket(Request.Builder().url("$wsBase/ws").build(), object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) { webSocket.send(jobj("t" to "qr-wait", "code" to code).toString()) }
            override fun onMessage(webSocket: WebSocket, text: String) {
                val m = runCatching { JSON.parseToJsonElement(text) as JsonObject }.getOrNull() ?: return
                if (m.str("t") != "qr-login") return
                val s = SessionInfo(m.str("token") ?: return, m.str("uid") ?: return, m.str("sid"))
                app.scope.launch { onLinked(s) }
            }
        })
        onDispose { ws.close(1000, null) }
    }
    ModalBottomSheet(onClose, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true), containerColor = if (look.glass) Color(if (look.dark) 0xFF1C1C1E else 0xFFF2F2F7) else MaterialTheme.colorScheme.surfaceContainerLow) {
        Column(Modifier.fillMaxWidth().navigationBarsPadding().padding(horizontal = 24.dp).padding(bottom = 24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(tr("Log in with QR code"), fontSize = 20.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(bottom = 16.dp))
            val matrix = remember(code) {
                runCatching { com.google.zxing.qrcode.QRCodeWriter().encode("kosmo-login:$code", com.google.zxing.BarcodeFormat.QR_CODE, 0, 0, mapOf(com.google.zxing.EncodeHintType.ERROR_CORRECTION to com.google.zxing.qrcode.decoder.ErrorCorrectionLevel.M, com.google.zxing.EncodeHintType.MARGIN to 0)) }.getOrNull()
            }
            Box(Modifier.size(220.dp).clip(RoundedCornerShape(16.dp)).background(Color.White).padding(12.dp)) {
                if (matrix != null) Canvas(Modifier.fillMaxSize().aspectRatio(1f)) {
                    val n = matrix.width
                    val cell = size.width / n
                    for (y in 0 until n) for (x in 0 until n) if (matrix.get(x, y)) drawRect(Color.Black, Offset(x * cell, y * cell), Size(cell + 0.5f, cell + 0.5f))
                }
            }
            Text(tr("Code:") + " " + code.take(3) + "-" + code.drop(3), fontSize = 18.sp, fontWeight = FontWeight.SemiBold, letterSpacing = 2.sp, modifier = Modifier.padding(top = 14.dp))
            Column(Modifier.fillMaxWidth().padding(top = 16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                listOf("Open Kosmo on a device where you are signed in", "Profile → Sessions → Link a device", "Scan this QR code or type the code above").forEachIndexed { i, t ->
                    Text("${i + 1}. " + tr(t), fontSize = 15.sp, color = look.text2)
                }
            }
        }
    }
}

private fun newQrCode(): String {
    val r = java.security.SecureRandom()
    return (1..6).map { QR_ALPHA[r.nextInt(QR_ALPHA.length)] }.joinToString("")
}
