package app.kosmo.chat.ui

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material.icons.automirrored.rounded.Backspace
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilledTonalIconButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
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
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.kosmo.chat.core.ApiException
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

private enum class Step { Email, Code, Pass, NewPass, RepeatPass, Name }

/**
 * Вход и регистрация — как на сайте: заставка с планетой, почта → код из
 * письма → код-пароль; новый аккаунт — код-пароль дважды, имя и @username.
 */
@Composable
fun AuthScreen(app: AppState) {
    var step by remember { mutableStateOf(Step.Email) }
    var email by remember { mutableStateOf("") }
    var ticket by remember { mutableStateOf("") }
    var newPass by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var shakeKey by remember { mutableIntStateOf(0) }
    val scope = rememberCoroutineScope()
    var introDone by remember { mutableStateOf(false) }

    fun fail(e: Throwable) {
        busy = false
        error = when ((e as? ApiException)?.code) {
            "bad_code", "wrong_code" -> "Wrong code"
            "wrong_passcode" -> "Wrong passcode"
            else -> e.message ?: "Something went wrong"
        }
        shakeKey++
    }

    BoxWithConstraints(Modifier.fillMaxSize().background(MaterialTheme.colorScheme.background)) {
        // Заставка: большая планета в центре, потом улетает наверх на своё место
        val h = maxHeight
        val fly = remember { Animatable(0f) }
        LaunchedEffect(Unit) {
            delay(1750)
            launch { fly.animateTo(1f, spring(dampingRatio = 0.78f, stiffness = 120f)) }
            delay(220)
            introDone = true
        }
        val big = minOf(288.dp, minOf(maxWidth, maxHeight) * 0.6f)
        val small = if (step == Step.Email) 120.dp else 84.dp
        val size = big + (small - big) * fly.value
        val topFinal = 72.dp
        val top = (h / 2 - big / 2) + (topFinal - (h / 2 - big / 2)) * fly.value
        PlanetLogo(
            Modifier.align(Alignment.TopCenter).statusBarsPadding().offset(y = top).size(size),
            intro = true,
        )

        AnimatedVisibility(introDone, enter = fadeIn(tween(500)) + slideInVertically(spring(dampingRatio = 0.8f, stiffness = 200f)) { it / 12 }) {
            Column(
                Modifier.fillMaxSize().safeDrawingPadding().imePadding().padding(horizontal = 24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Box(Modifier.fillMaxWidth().height(56.dp)) {
                    if (step != Step.Email) FilledTonalIconButton(
                        onClick = { error = null; step = if (step == Step.Name) Step.NewPass else if (step == Step.RepeatPass) Step.NewPass else Step.Email },
                        modifier = Modifier.align(Alignment.CenterStart).size(48.dp),
                    ) { Icon(Icons.AutoMirrored.Rounded.ArrowBack, "Back") }
                }
                Spacer(Modifier.height(if (step == Step.Email) 150.dp else 110.dp))
                val shake = remember { Animatable(0f) }
                LaunchedEffect(shakeKey) {
                    if (shakeKey == 0) return@LaunchedEffect
                    for (x in listOf(14f, -12f, 9f, -6f, 3f, 0f)) shake.animateTo(x, tween(55))
                }
                AnimatedContent(
                    targetState = step,
                    transitionSpec = { (slideInHorizontally { it / 3 } + fadeIn()) togetherWith (slideOutHorizontally { -it / 3 } + fadeOut()) },
                    label = "auth",
                    modifier = Modifier.graphicsLayer { translationX = shake.value * density },
                ) { s ->
                    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
                        when (s) {
                            Step.Email -> EmailStep(email, busy, error) { e ->
                                email = e.trim().lowercase(); busy = true; error = null
                                scope.launch {
                                    try { app.auth.sendCode(email); busy = false; step = Step.Code } catch (t: Throwable) { fail(t) }
                                }
                            }
                            Step.Code -> CodeStep(email, error) { code ->
                                busy = true; error = null
                                scope.launch {
                                    try {
                                        val (t, exists) = app.auth.verify(email, code)
                                        ticket = t; busy = false
                                        step = if (exists) Step.Pass else Step.NewPass
                                    } catch (t: Throwable) { fail(t) }
                                }
                            }
                            Step.Pass -> PassStep("Enter your passcode", error, busy) { p ->
                                busy = true; error = null
                                scope.launch {
                                    try { app.signedIn(app.auth.login(ticket, p)) } catch (t: Throwable) { fail(t) }
                                }
                            }
                            Step.NewPass -> PassStep("Create a passcode", error, busy, hint = "4 digits to open Kosmo on new devices") { p -> newPass = p; error = null; step = Step.RepeatPass }
                            Step.RepeatPass -> PassStep("Repeat the passcode", error, busy) { p ->
                                if (p != newPass) { error = "Passcodes don’t match"; shakeKey++ } else { error = null; step = Step.Name }
                            }
                            Step.Name -> NameStep(app, busy, error) { name, username ->
                                busy = true; error = null
                                scope.launch {
                                    try { app.signedIn(app.auth.register(ticket, newPass, name, username)) } catch (t: Throwable) { fail(t) }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun Title(text: String) = Text(text, style = MaterialTheme.typography.headlineMedium, textAlign = TextAlign.Center)

@Composable
private fun ErrorText(error: String?) {
    Text(error ?: "", color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 10.dp).alpha(if (error == null) 0f else 1f))
}

@Composable
private fun EmailStep(initial: String, busy: Boolean, error: String?, onNext: (String) -> Unit) {
    var email by remember { mutableStateOf(initial) }
    val ok = Regex("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$").matches(email.trim())
    Text("Kosmo", style = MaterialTheme.typography.headlineMedium.copy(fontSize = 34.sp))
    Spacer(Modifier.height(28.dp))
    OutlinedTextField(
        value = email, onValueChange = { email = it }, singleLine = true,
        placeholder = { Text("your@email.com") },
        shape = RoundedCornerShape(18.dp),
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email, imeAction = ImeAction.Go),
        keyboardActions = KeyboardActions(onGo = { if (ok && !busy) onNext(email) }),
        modifier = Modifier.fillMaxWidth(),
    )
    Spacer(Modifier.height(12.dp))
    Button(onClick = { onNext(email) }, enabled = ok && !busy, modifier = Modifier.fillMaxWidth().height(54.dp), shape = RoundedCornerShape(18.dp)) {
        if (busy) CircularProgressIndicator(Modifier.size(22.dp), strokeWidth = 2.5.dp, color = MaterialTheme.colorScheme.onPrimary) else Text("Continue", fontSize = 17.sp)
    }
    ErrorText(error)
    Spacer(Modifier.height(8.dp))
    Text("We’ll send a code to this email", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
}

/** Код из письма: 6 клеток, ввод — скрытым полем. */
@Composable
private fun CodeStep(email: String, error: String?, onCode: (String) -> Unit) {
    var code by remember { mutableStateOf("") }
    val focus = remember { FocusRequester() }
    LaunchedEffect(Unit) { focus.requestFocus() }
    LaunchedEffect(error) { if (error != null) code = "" }
    Title("Code sent to")
    Text(email, style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary, modifier = Modifier.padding(top = 6.dp))
    Spacer(Modifier.height(28.dp))
    BasicTextField(
        value = code,
        onValueChange = { v ->
            val d = v.filter(Char::isDigit).take(6)
            code = d
            if (d.length == 6) onCode(d)
        },
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.NumberPassword),
        modifier = Modifier.focusRequester(focus),
        textStyle = TextStyle(color = Color.Transparent),
        decorationBox = {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                repeat(6) { i ->
                    val ch = code.getOrNull(i)
                    val active = i == code.length
                    Box(
                        Modifier.size(width = 46.dp, height = 58.dp)
                            .background(MaterialTheme.colorScheme.surfaceContainerHigh, RoundedCornerShape(14.dp))
                            .border(if (active) 2.dp else 1.dp, if (active) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(14.dp)),
                        contentAlignment = Alignment.Center,
                    ) { Text(ch?.toString() ?: "", fontSize = 24.sp, fontWeight = FontWeight.SemiBold) }
                }
            }
        },
    )
    ErrorText(error)
}

/** Код-пароль: 4 точки и цифровая клавиатура, как на сайте. */
@Composable
fun PassStep(title: String, error: String?, busy: Boolean, hint: String? = null, onPass: (String) -> Unit) {
    var pass by remember { mutableStateOf("") }
    LaunchedEffect(error) { if (error != null) pass = "" }
    Title(title)
    if (hint != null) Text(hint, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 6.dp))
    Spacer(Modifier.height(24.dp))
    Row(horizontalArrangement = Arrangement.spacedBy(18.dp)) {
        repeat(4) { i ->
            val on = i < pass.length
            Box(Modifier.size(16.dp).background(if (on) MaterialTheme.colorScheme.primary else Color.Transparent, CircleShape).border(1.5.dp, if (on) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outline, CircleShape))
        }
    }
    ErrorText(error)
    Spacer(Modifier.height(12.dp))
    val keys = listOf("1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "<")
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        keys.chunked(3).forEach { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(22.dp)) {
                row.forEach { k ->
                    Box(
                        Modifier.size(76.dp).then(
                            if (k.isEmpty()) Modifier else Modifier.background(if (k == "<") Color.Transparent else MaterialTheme.colorScheme.surfaceContainerHigh, CircleShape)
                                .clickable(enabled = !busy, interactionSource = remember { MutableInteractionSource() }, indication = androidx.compose.material3.ripple(bounded = false, radius = 38.dp)) {
                                    if (k == "<") pass = pass.dropLast(1)
                                    else if (pass.length < 4) {
                                        pass += k
                                        if (pass.length == 4) onPass(pass)
                                    }
                                },
                        ),
                        contentAlignment = Alignment.Center,
                    ) {
                        if (k == "<") Icon(Icons.AutoMirrored.Rounded.Backspace, "Delete")
                        else if (k.isNotEmpty()) Text(k, fontSize = 30.sp)
                    }
                }
            }
        }
    }
    if (busy) CircularProgressIndicator(Modifier.padding(top = 16.dp).size(24.dp), strokeWidth = 2.5.dp)
}

@Composable
private fun NameStep(app: AppState, busy: Boolean, error: String?, onDone: (String, String) -> Unit) {
    var name by remember { mutableStateOf("") }
    var username by remember { mutableStateOf("") }
    var free by remember { mutableStateOf<Boolean?>(null) }
    LaunchedEffect(username) {
        free = null
        if (username.length < 3 || !Regex("^(?=.*[a-z])[a-z0-9]{3,32}$").matches(username)) return@LaunchedEffect
        delay(350)
        free = runCatching { app.auth.usernameFree(username) }.getOrNull()
    }
    val userOk = username.isEmpty() || (Regex("^(?=.*[a-z])[a-z0-9]{3,32}$").matches(username) && free != false)
    Title("Your name")
    Spacer(Modifier.height(20.dp))
    OutlinedTextField(name, { name = it.take(40) }, singleLine = true, placeholder = { Text("Name") }, shape = RoundedCornerShape(18.dp), modifier = Modifier.fillMaxWidth())
    Spacer(Modifier.height(10.dp))
    OutlinedTextField(
        username, { username = it.lowercase().filter { c -> c in 'a'..'z' || c in '0'..'9' }.take(32) }, singleLine = true,
        prefix = { Text("@") }, placeholder = { Text("username (optional)") }, shape = RoundedCornerShape(18.dp), modifier = Modifier.fillMaxWidth(),
        isError = !userOk,
        supportingText = {
            Text(
                when {
                    username.isEmpty() -> "Letters a–z and numbers, at least 3. You can skip it."
                    username.length < 3 -> "At least 3 characters"
                    !username.any { it in 'a'..'z' } -> "Add at least one letter"
                    free == false -> "@$username is taken"
                    free == true -> "@$username is available"
                    else -> "Checking…"
                },
            )
        },
    )
    Spacer(Modifier.height(10.dp))
    Button(onClick = { onDone(name.trim(), username) }, enabled = name.isNotBlank() && userOk && !busy, modifier = Modifier.fillMaxWidth().height(54.dp), shape = RoundedCornerShape(18.dp)) {
        if (busy) CircularProgressIndicator(Modifier.size(22.dp), strokeWidth = 2.5.dp, color = MaterialTheme.colorScheme.onPrimary) else Text("Sign up", fontSize = 17.sp)
    }
    ErrorText(error)
}

