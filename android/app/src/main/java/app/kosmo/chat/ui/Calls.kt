package app.kosmo.chat.ui

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.media.AudioManager
import android.media.RingtoneManager
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.VolumeUp
import androidx.compose.material.icons.rounded.Call
import androidx.compose.material.icons.rounded.CallEnd
import androidx.compose.material.icons.rounded.Mic
import androidx.compose.material.icons.rounded.MicOff
import androidx.compose.material.icons.rounded.Videocam
import androidx.compose.material.icons.rounded.VideocamOff
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import app.kosmo.chat.core.KosmoEvent
import app.kosmo.chat.core.arr
import app.kosmo.chat.core.bool
import app.kosmo.chat.core.jobj
import app.kosmo.chat.core.num
import app.kosmo.chat.core.obj
import app.kosmo.chat.core.objects
import app.kosmo.chat.core.str
import app.kosmo.chat.core.strings
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import org.webrtc.AudioTrack
import org.webrtc.Camera2Enumerator
import org.webrtc.CameraVideoCapturer
import org.webrtc.DefaultVideoDecoderFactory
import org.webrtc.DefaultVideoEncoderFactory
import org.webrtc.EglBase
import org.webrtc.IceCandidate
import org.webrtc.MediaConstraints
import org.webrtc.MediaStream
import org.webrtc.PeerConnection
import org.webrtc.PeerConnectionFactory
import org.webrtc.RtpReceiver
import org.webrtc.RtpTransceiver
import org.webrtc.SdpObserver
import org.webrtc.SessionDescription
import org.webrtc.SurfaceTextureHelper
import org.webrtc.SurfaceViewRenderer
import org.webrtc.VideoTrack
import java.util.UUID
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

/**
 * Голосовые и видеозвонки по WebRTC — тот же протокол сигналов, что у сайта
 * (web/js/calls.js): ring → accept → offer/answer → ice, taken, busy, decline,
 * end, restart. Поэтому приложение звонит и сайту, и другому приложению.
 */
class Calls(private val ctx: Context, private val app: AppState, private val scope: CoroutineScope) {
    data class Ui(
        val id: String, val peer: String, val video: Boolean, val outgoing: Boolean,
        val status: String, val active: Boolean = false, val incoming: Boolean = false,
        val muted: Boolean = false, val speaker: Boolean = false, val camOff: Boolean = false,
        val started: Long = 0, val remoteVideo: Boolean = false,
    )

    var ui by mutableStateOf<Ui?>(null)
        internal set
    /** Нужны разрешения: экран звонка спросит и вызовет [permissionsResult]. */
    var askPermissions by mutableStateOf<List<String>?>(null)
        private set
    private var afterPermissions: ((Boolean) -> Unit)? = null

    private val tab = UUID.randomUUID().toString()
    private val lock = Mutex()
    val egl: EglBase by lazy { EglBase.create() }
    private var factory: PeerConnectionFactory? = null
    private var pc: PeerConnection? = null
    private var callerTab: String? = null
    private val queue = mutableListOf<IceCandidate>()
    private var localAudio: AudioTrack? = null
    var localVideo: VideoTrack? = null
        private set
    var remoteTrack by mutableStateOf<VideoTrack?>(null)
        private set
    private var capturer: CameraVideoCapturer? = null
    private var surfaceHelper: SurfaceTextureHelper? = null
    private var ringTimeout: Job? = null
    private var watchdog: Job? = null
    private var restarts = 0
    private var ringtone: android.media.Ringtone? = null
    private val audio by lazy { ctx.getSystemService(Context.AUDIO_SERVICE) as AudioManager }

    init {
        scope.launch {
            app.kosmo.events.collect { e -> if (e is KosmoEvent.Signal) lock.withLock { onSignal(e.from, e.data) } }
        }
    }

    private fun post(msg: JsonObject, to: String? = ui?.peer) {
        to ?: return
        app.kosmo.signal(to, JsonObject(msg + ("tab" to JsonPrimitive(tab))))
    }

    private fun need(video: Boolean) = buildList {
        add(Manifest.permission.RECORD_AUDIO)
        if (video) add(Manifest.permission.CAMERA)
    }.filter { ContextCompat.checkSelfPermission(ctx, it) != PackageManager.PERMISSION_GRANTED }

    private fun withPermissions(video: Boolean, then: (Boolean) -> Unit) {
        val missing = need(video)
        if (missing.isEmpty()) { then(true); return }
        afterPermissions = then
        askPermissions = missing
    }

    fun permissionsResult(granted: Boolean) {
        askPermissions = null
        afterPermissions?.invoke(granted)
        afterPermissions = null
    }

    /* ---------- Исходящий ---------- */
    fun start(peer: String, video: Boolean) {
        if (ui != null) { app.toast = "You are already in a call"; return }
        val me = app.kosmo.data.value.me ?: return
        withPermissions(video) { ok ->
            if (!ok) { app.toast = "Allow the microphone to make calls"; return@withPermissions }
            val id = UUID.randomUUID().toString()
            ui = Ui(id, peer, video, outgoing = true, status = "Calling…", speaker = video)
            post(jobj("type" to "ring", "callId" to id, "from" to me, "to" to peer, "video" to video), peer)
            ringTimeout = scope.launch { delay(30_000); if (ui?.id == id && ui?.active != true) finish("missed", log = true) }
            if (!app.kosmo.online.value) { app.toast = "No connection to the server"; scope.launch { delay(1500); finish("missed", log = true) } }
        }
    }

    /* ---------- Входящий ---------- */
    private fun incoming(msg: JsonObject) {
        val me = app.kosmo.data.value.me ?: return
        if (msg.str("to") != me) return
        val from = msg.str("from") ?: return
        if (ui != null) { post(jobj("type" to "busy", "callId" to msg.str("callId")), from); return }
        if (app.kosmo.data.value.user?.obj("privacy")?.strings("blocked")?.contains(from) == true) { post(jobj("type" to "decline", "callId" to msg.str("callId")), from); return }
        callerTab = msg.str("tab")
        val video = msg.bool("video")
        ui = Ui(msg.str("callId") ?: return, from, video, outgoing = false, incoming = true, status = if (video) "Incoming video call" else "Incoming call", speaker = video)
        ring(true)
    }

    fun accept() {
        val u = ui ?: return
        ring(false)
        withPermissions(u.video) { ok ->
            if (!ok) { decline(); return@withPermissions }
            ui = u.copy(incoming = false, status = "Connecting…")
            scope.launch(Dispatchers.Default) {
                lock.withLock { setupPeer(u.video) }
                post(jobj("type" to "accept", "callId" to u.id, "to" to callerTab))
            }
        }
    }

    fun decline() {
        val u = ui ?: return
        post(jobj("type" to "decline", "callId" to u.id))
        finish(null, log = false, silent = true)
    }

    fun end() {
        val u = ui ?: return
        finish(if (u.active) "ended" else "missed", log = u.outgoing)
    }

    fun toggleMute() { ui = ui?.let { it.copy(muted = !it.muted) }; localAudio?.setEnabled(ui?.muted != true) }
    fun toggleSpeaker() { ui = ui?.let { it.copy(speaker = !it.speaker) }; route() }
    fun toggleCamera() {
        val track = localVideo ?: run { app.toast = "Video is off for this call"; return }
        ui = ui?.let { it.copy(camOff = !it.camOff) }
        track.setEnabled(ui?.camOff != true)
    }
    fun flipCamera() { capturer?.switchCamera(null) }

    /* ---------- WebRTC ---------- */
    private suspend fun iceServers(): List<PeerConnection.IceServer> = try {
        app.api.call("GET", "/api/ice").arr("iceServers").objects().map { s ->
            val urls = (s["urls"] as? kotlinx.serialization.json.JsonArray)?.map { (it as JsonPrimitive).content } ?: listOfNotNull(s.str("urls"))
            PeerConnection.IceServer.builder(urls).setUsername(s.str("username") ?: "").setPassword(s.str("credential") ?: "").createIceServer()
        }
    } catch (e: Exception) {
        listOf(PeerConnection.IceServer.builder("stun:stun.l.google.com:19302").createIceServer())
    }

    private fun factory(): PeerConnectionFactory {
        factory?.let { return it }
        PeerConnectionFactory.initialize(PeerConnectionFactory.InitializationOptions.builder(ctx).createInitializationOptions())
        return PeerConnectionFactory.builder()
            .setVideoEncoderFactory(DefaultVideoEncoderFactory(egl.eglBaseContext, true, true))
            .setVideoDecoderFactory(DefaultVideoDecoderFactory(egl.eglBaseContext))
            .createPeerConnectionFactory().also { factory = it }
    }

    private suspend fun setupPeer(video: Boolean) {
        val f = factory()
        val cfg = PeerConnection.RTCConfiguration(iceServers()).apply { sdpSemantics = PeerConnection.SdpSemantics.UNIFIED_PLAN }
        val callId = ui?.id
        val conn = f.createPeerConnection(cfg, object : PeerConnection.Observer {
            override fun onIceCandidate(c: IceCandidate) {
                post(jobj("type" to "ice", "callId" to callId, "candidate" to jobj("candidate" to c.sdp, "sdpMid" to c.sdpMid, "sdpMLineIndex" to c.sdpMLineIndex)))
            }
            override fun onIceConnectionChange(s: PeerConnection.IceConnectionState) {
                scope.launch(Dispatchers.Main) {
                    when (s) {
                        PeerConnection.IceConnectionState.CONNECTED, PeerConnection.IceConnectionState.COMPLETED -> connected()
                        PeerConnection.IceConnectionState.FAILED -> recover()
                        PeerConnection.IceConnectionState.DISCONNECTED -> scope.launch {
                            delay(5000)
                            if (pc?.iceConnectionState() == PeerConnection.IceConnectionState.DISCONNECTED) recover()
                        }
                        else -> {}
                    }
                }
            }
            override fun onTrack(t: RtpTransceiver) {
                val track = t.receiver.track()
                if (track is VideoTrack) scope.launch(Dispatchers.Main) { remoteTrack = track; ui = ui?.copy(remoteVideo = true) }
            }
            override fun onAddTrack(r: RtpReceiver, s: Array<out MediaStream>) {}
            override fun onSignalingChange(s: PeerConnection.SignalingState) {}
            override fun onIceConnectionReceivingChange(b: Boolean) {}
            override fun onIceGatheringChange(s: PeerConnection.IceGatheringState) {}
            override fun onIceCandidatesRemoved(c: Array<out IceCandidate>) {}
            override fun onAddStream(s: MediaStream) {}
            override fun onRemoveStream(s: MediaStream) {}
            override fun onDataChannel(d: org.webrtc.DataChannel) {}
            override fun onRenegotiationNeeded() {}
        }) ?: return
        pc = conn
        val audioSource = f.createAudioSource(MediaConstraints())
        localAudio = f.createAudioTrack("a0", audioSource).also { conn.addTrack(it, listOf("kosmo")) }
        if (video) {
            val enumerator = Camera2Enumerator(ctx)
            val front = enumerator.deviceNames.firstOrNull { enumerator.isFrontFacing(it) } ?: enumerator.deviceNames.firstOrNull()
            if (front != null) {
                val cap = enumerator.createCapturer(front, null)
                val helper = SurfaceTextureHelper.create("cam", egl.eglBaseContext)
                val src = f.createVideoSource(false)
                cap.initialize(helper, ctx, src.capturerObserver)
                cap.startCapture(640, 480, 30)
                capturer = cap; surfaceHelper = helper
                localVideo = f.createVideoTrack("v0", src).also { conn.addTrack(it, listOf("kosmo")) }
            }
        } else {
            conn.addTransceiver(org.webrtc.MediaStreamTrack.MediaType.MEDIA_TYPE_VIDEO, RtpTransceiver.RtpTransceiverInit(RtpTransceiver.RtpTransceiverDirection.RECV_ONLY))
        }
        withContext(Dispatchers.Main) {
            audio.mode = AudioManager.MODE_IN_COMMUNICATION
            route()
        }
        watchdog = scope.launch { delay(30_000); if (ui?.id == callId && ui?.active != true) fail() }
    }

    private fun route() {
        @Suppress("DEPRECATION")
        audio.isSpeakerphoneOn = ui?.speaker == true
    }

    private fun connected() {
        val u = ui ?: return
        watchdog?.cancel()
        if (u.active) { ui = u.copy(status = ""); return }
        ringTimeout?.cancel()
        ui = u.copy(active = true, started = System.currentTimeMillis(), status = "")
    }

    private fun recover() {
        val u = ui ?: return
        val conn = pc ?: return
        if (restarts >= 2) { fail(); return }
        restarts++
        ui = u.copy(status = if (u.active) "Reconnecting…" else "Connecting…")
        if (!u.outgoing) { post(jobj("type" to "restart", "callId" to u.id)); return }
        scope.launch(Dispatchers.Default) {
            lock.withLock {
                runCatching {
                    val offer = conn.awaitCreate(true, MediaConstraints().apply { mandatory.add(MediaConstraints.KeyValuePair("IceRestart", "true")) })
                    conn.awaitSetLocal(offer)
                    post(jobj("type" to "offer", "callId" to u.id, "sdp" to jobj("type" to "offer", "sdp" to offer.description)))
                }.onFailure { fail() }
            }
        }
    }

    private fun fail() {
        val u = ui ?: return
        ui = u.copy(status = "Couldn’t connect")
        app.toast = "Couldn’t connect the call. Check the internet on both phones."
        scope.launch { delay(1200); finish(if (u.active) "ended" else "missed", log = u.outgoing, keepText = true) }
    }

    private suspend fun flushIce() { queue.forEach { pc?.addIceCandidate(it) }; queue.clear() }

    /* ---------- Сигналы: строго по очереди ---------- */
    private suspend fun onSignal(from: String, msg: JsonObject) {
        val type = msg.str("type")
        if (type == "ring") { if (msg.str("from") == from) withContext(Dispatchers.Main) { incoming(msg) }; return }
        val u = ui ?: return
        if (from != u.peer || msg.str("callId") != u.id || msg.str("tab") == tab) return
        when (type) {
            "accept" -> {
                if (!u.outgoing || u.active || pc != null) return
                ringTimeout?.cancel()
                withContext(Dispatchers.Main) { ui = u.copy(status = "Connecting…") }
                post(jobj("type" to "taken", "callId" to u.id, "tabOk" to msg.str("tab")))
                setupPeer(u.video)
                val conn = pc ?: return
                val offer = conn.awaitCreate(true, MediaConstraints())
                conn.awaitSetLocal(offer)
                post(jobj("type" to "offer", "callId" to u.id, "sdp" to jobj("type" to "offer", "sdp" to offer.description)))
            }
            "taken" -> if (!u.outgoing && msg.str("tabOk") != tab) withContext(Dispatchers.Main) { finish(null, log = false, silent = true) }
            "restart" -> if (u.outgoing) withContext(Dispatchers.Main) { recover() }
            "offer" -> {
                val conn = pc ?: return
                if (u.outgoing) return
                conn.awaitSetRemote(SessionDescription(SessionDescription.Type.OFFER, msg.obj("sdp")?.str("sdp") ?: return))
                val answer = conn.awaitCreate(false, MediaConstraints())
                conn.awaitSetLocal(answer)
                post(jobj("type" to "answer", "callId" to u.id, "sdp" to jobj("type" to "answer", "sdp" to answer.description)))
                flushIce()
            }
            "answer" -> {
                val conn = pc ?: return
                if (!u.outgoing) return
                conn.awaitSetRemote(SessionDescription(SessionDescription.Type.ANSWER, msg.obj("sdp")?.str("sdp") ?: return))
                flushIce()
            }
            "ice" -> {
                val c = msg.obj("candidate") ?: return
                val cand = IceCandidate(c.str("sdpMid") ?: "0", (c.num("sdpMLineIndex") ?: 0).toInt(), c.str("candidate") ?: return)
                val conn = pc
                if (conn?.remoteDescription != null) conn.addIceCandidate(cand) else queue.add(cand)
            }
            "decline" -> withContext(Dispatchers.Main) { finish("declined", log = u.outgoing) }
            "busy" -> withContext(Dispatchers.Main) { ui = u.copy(status = "Line busy"); delay(1200); finish("busy", log = true) }
            "end" -> withContext(Dispatchers.Main) { finish(if (u.active) "ended" else "missed", log = u.outgoing) }
        }
    }

    /* ---------- Завершение и запись в чат (пишет звонивший) ---------- */
    private fun finish(status: String?, log: Boolean, silent: Boolean = false, keepText: Boolean = false) {
        val u = ui ?: return
        ringTimeout?.cancel(); watchdog?.cancel()
        ring(false)
        if (!silent) post(jobj("type" to "end", "callId" to u.id))
        runCatching { capturer?.stopCapture() }
        capturer?.dispose(); capturer = null
        surfaceHelper?.dispose(); surfaceHelper = null
        localVideo?.dispose(); localVideo = null
        localAudio?.dispose(); localAudio = null
        pc?.dispose(); pc = null
        queue.clear(); restarts = 0
        remoteTrack = null
        audio.mode = AudioManager.MODE_NORMAL
        @Suppress("DEPRECATION")
        audio.isSpeakerphoneOn = false
        val duration = if (u.started > 0) ((System.currentTimeMillis() - u.started) / 1000) else 0
        if (!silent && !keepText) ui = u.copy(status = when (status) { "missed" -> "No answer"; "declined" -> "Declined"; "busy" -> "Line busy"; else -> "Call ended" }, active = false)
        scope.launch { delay(if (silent) 0 else 900); if (ui?.id == u.id) ui = null }
        if (log && status != null) {
            val me = app.kosmo.data.value.me ?: return
            app.kosmo.sendMessage(app.kosmo.dmId(me, u.peer), listOf(me, u.peer), jobj("kind" to "call", "video" to u.video, "status" to status, "duration" to duration))
        }
    }

    private fun ring(on: Boolean) {
        if (on) {
            ringtone = RingtoneManager.getRingtone(ctx, RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE))?.also { runCatching { it.play() } }
            val v = ctx.getSystemService(Vibrator::class.java)
            if (Build.VERSION.SDK_INT >= 26) v?.vibrate(VibrationEffect.createWaveform(longArrayOf(0, 400, 300, 400, 1200), 0))
        } else {
            runCatching { ringtone?.stop() }
            ringtone = null
            ctx.getSystemService(Vibrator::class.java)?.cancel()
        }
    }
}

private suspend fun PeerConnection.awaitCreate(offer: Boolean, c: MediaConstraints): SessionDescription = suspendCancellableCoroutine { cont ->
    val obs = object : SdpObserver {
        override fun onCreateSuccess(d: SessionDescription) { cont.resume(d) }
        override fun onCreateFailure(e: String?) { cont.resumeWithException(IllegalStateException(e)) }
        override fun onSetSuccess() {}
        override fun onSetFailure(e: String?) {}
    }
    if (offer) createOffer(obs, c) else createAnswer(obs, c)
}

private suspend fun PeerConnection.awaitSetLocal(d: SessionDescription) = awaitSet { setLocalDescription(it, d) }
private suspend fun PeerConnection.awaitSetRemote(d: SessionDescription) = awaitSet { setRemoteDescription(it, d) }
private suspend fun awaitSet(block: (SdpObserver) -> Unit): Unit = suspendCancellableCoroutine { cont ->
    block(object : SdpObserver {
        override fun onCreateSuccess(d: SessionDescription) {}
        override fun onCreateFailure(e: String?) {}
        override fun onSetSuccess() { cont.resume(Unit) }
        override fun onSetFailure(e: String?) { cont.resumeWithException(IllegalStateException(e)) }
    })
}

/** Экран звонка поверх всего приложения. */
@Composable
fun CallOverlay(app: AppState) {
    val calls = app.calls
    val ask = calls.askPermissions
    val perm = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { r -> calls.permissionsResult(r.values.all { it }) }
    LaunchedEffect(ask) { if (ask != null) perm.launch(ask.toTypedArray()) }
    val u = calls.ui
    AnimatedVisibility(u != null, enter = fadeIn(), exit = fadeOut()) {
        u ?: return@AnimatedVisibility
        val peer = app.kosmo.data.value.accounts[u.peer]
        Box(Modifier.fillMaxSize().background(Brush.verticalGradient(listOf(Color(0xFF1B1340), Color(0xFF050509))))) {
            val remote = calls.remoteTrack
            if (remote != null && u.video) AndroidView(
                factory = { c -> SurfaceViewRenderer(c).apply { init(calls.egl.eglBaseContext, null); setEnableHardwareScaler(true); remote.addSink(this) } },
                modifier = Modifier.fillMaxSize(),
                onRelease = { v -> runCatching { remote.removeSink(v) }; v.release() },
            )
            val local = calls.localVideo
            if (local != null && u.active) AndroidView(
                factory = { c -> SurfaceViewRenderer(c).apply { init(calls.egl.eglBaseContext, null); setMirror(true); setZOrderMediaOverlay(true); local.addSink(this) } },
                modifier = Modifier.safeDrawingPadding().padding(16.dp).size(110.dp, 150.dp).clip(RoundedCornerShape(18.dp)).align(Alignment.TopEnd),
                onRelease = { v -> runCatching { local.removeSink(v) }; v.release() },
            )
            Column(Modifier.fillMaxSize().safeDrawingPadding().padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                if (!(u.video && remote != null)) {
                    androidx.compose.foundation.layout.Spacer(Modifier.padding(top = 60.dp))
                    val t = rememberInfiniteTransition(label = "wave")
                    val s by t.animateFloat(1f, 1.18f, infiniteRepeatable(tween(1100), RepeatMode.Reverse), label = "s")
                    Box(contentAlignment = Alignment.Center) {
                        if (!u.active) Box(Modifier.size(150.dp).scale(s).background(Color.White.copy(alpha = 0.08f), CircleShape))
                        UserAvatar(peer, 130.dp)
                    }
                }
                Text(peer?.str("name") ?: "Kosmo", color = Color.White, fontSize = 30.sp, modifier = Modifier.padding(top = 20.dp))
                var now by remember { mutableLongStateOf(System.currentTimeMillis()) }
                LaunchedEffect(u.active) { while (u.active) { now = System.currentTimeMillis(); delay(500) } }
                Text(
                    if (u.active && u.status.isEmpty()) fmtDur((now - u.started) / 1000) else u.status,
                    color = Color.White.copy(alpha = 0.75f), fontSize = 17.sp, modifier = Modifier.padding(top = 6.dp),
                )
                androidx.compose.foundation.layout.Spacer(Modifier.weight(1f))
                if (u.incoming) Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                    CallButton(Icons.Rounded.CallEnd, "Decline", Color(0xFFFF453A)) { calls.decline() }
                    CallButton(if (u.video) Icons.Rounded.Videocam else Icons.Rounded.Call, "Accept", Color(0xFF30D158)) { calls.accept() }
                } else Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                    CallButton(Icons.AutoMirrored.Rounded.VolumeUp, "Speaker", if (u.speaker) Color.White else Color.White.copy(alpha = 0.18f), if (u.speaker) Color.Black else Color.White) { calls.toggleSpeaker() }
                    CallButton(if (u.camOff || !u.video) Icons.Rounded.VideocamOff else Icons.Rounded.Videocam, "Video", Color.White.copy(alpha = 0.18f)) { calls.toggleCamera() }
                    CallButton(if (u.muted) Icons.Rounded.MicOff else Icons.Rounded.Mic, if (u.muted) "Unmute" else "Mute", if (u.muted) Color.White else Color.White.copy(alpha = 0.18f), if (u.muted) Color.Black else Color.White) { calls.toggleMute() }
                    CallButton(Icons.Rounded.CallEnd, "End", Color(0xFFFF453A)) { calls.end() }
                }
            }
        }
    }
}

@Composable
private fun CallButton(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, bg: Color, fg: Color = Color.White, onClick: () -> Unit) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        FilledIconButton(onClick, Modifier.size(64.dp), colors = IconButtonDefaults.filledIconButtonColors(containerColor = bg, contentColor = fg)) { Icon(icon, label, Modifier.size(28.dp)) }
        Text(label, color = Color.White.copy(alpha = 0.8f), style = MaterialTheme.typography.labelMedium, modifier = Modifier.padding(top = 6.dp))
    }
}
