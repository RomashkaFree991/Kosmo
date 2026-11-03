package app.kosmo.chat.ui

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.ImageDecoder
import android.media.MediaPlayer
import android.media.MediaRecorder
import android.net.Uri
import android.os.Build
import android.widget.MediaController
import android.widget.VideoView
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.rememberTransformableState
import androidx.compose.foundation.gestures.transformable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.ArrowBack
import androidx.compose.material3.FilledTonalIconButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButtonDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import coil.compose.AsyncImage
import kotlinx.coroutines.flow.MutableStateFlow
import java.io.File
import java.io.FileOutputStream

/** Один проигрыватель голосовых и музыки на всё приложение. */
object Voice {
    data class State(val id: String? = null, val playing: Boolean = false, val pos: Float = 0f, val dur: Float = 0f)
    val state = MutableStateFlow(State())
    private var player: MediaPlayer? = null
    private val ticker = android.os.Handler(android.os.Looper.getMainLooper())
    private val tick = object : Runnable {
        override fun run() {
            val p = player ?: return
            runCatching { state.value = state.value.copy(pos = p.currentPosition / 1000f, dur = p.duration.coerceAtLeast(1) / 1000f) }
            if (state.value.playing) ticker.postDelayed(this, 100)
        }
    }

    fun toggle(id: String, url: String) {
        val s = state.value
        if (s.id == id && player != null) {
            val p = player!!
            if (p.isPlaying) { p.pause(); state.value = s.copy(playing = false) } else { p.start(); state.value = s.copy(playing = true); ticker.post(tick) }
            return
        }
        stop()
        state.value = State(id = id, playing = true)
        player = MediaPlayer().apply {
            setDataSource(url)
            setOnPreparedListener { it.start(); ticker.post(tick) }
            setOnCompletionListener { state.value = state.value.copy(playing = false, pos = 0f) }
            setOnErrorListener { _, _, _ -> state.value = State(); true }
            prepareAsync()
        }
    }

    fun seek(id: String, frac: Float) {
        val p = player ?: return
        if (state.value.id != id) return
        runCatching { p.seekTo((p.duration * frac).toInt()); state.value = state.value.copy(pos = p.duration * frac / 1000f) }
    }

    fun stop() {
        player?.runCatching { stop(); release() }
        player = null
        state.value = State()
    }
}

/** Запись голосового: AAC в MP4 (.m4a) — играет и в браузере, и на телефоне. */
class VoiceRecorder(private val ctx: Context) {
    private var rec: MediaRecorder? = null
    var file: File? = null
        private set
    private var started = 0L
    val amplitude get() = runCatching { rec?.maxAmplitude ?: 0 }.getOrDefault(0)

    fun start(): Boolean {
        val f = File(ctx.cacheDir, "voice-${System.currentTimeMillis()}.m4a")
        val r = if (Build.VERSION.SDK_INT >= 31) MediaRecorder(ctx) else @Suppress("DEPRECATION") MediaRecorder()
        return try {
            r.setAudioSource(MediaRecorder.AudioSource.MIC)
            r.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
            r.setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
            r.setAudioEncodingBitRate(64_000)
            r.setAudioSamplingRate(44_100)
            r.setOutputFile(f.absolutePath)
            r.prepare()
            r.start()
            rec = r; file = f; started = System.currentTimeMillis()
            true
        } catch (e: Exception) { r.release(); false }
    }

    /** → файл и длина в секундах; null — запись слишком короткая или не удалась */
    fun stop(): Pair<File, Double>? {
        val r = rec ?: return null
        rec = null
        val secs = (System.currentTimeMillis() - started) / 1000.0
        return try { r.stop(); r.release(); if (secs < 0.6) null else file!! to secs } catch (e: Exception) { r.release(); null }
    }

    fun cancel() { rec?.runCatching { stop(); release() }; rec = null; file?.delete() }
}

/** Фото из галереи → JPEG до 1600 px (как compressImage на сайте). */
fun compressPhoto(ctx: Context, uri: Uri, max: Int = 1600): Triple<File, Int, Int>? = runCatching {
    val src: Bitmap = if (Build.VERSION.SDK_INT >= 28) {
        ImageDecoder.decodeBitmap(ImageDecoder.createSource(ctx.contentResolver, uri)) { d, info, _ ->
            val w = info.size.width; val h = info.size.height
            val k = minOf(1f, max.toFloat() / maxOf(w, h))
            d.setTargetSize((w * k).toInt().coerceAtLeast(1), (h * k).toInt().coerceAtLeast(1))
            d.allocator = ImageDecoder.ALLOCATOR_SOFTWARE
        }
    } else {
        val b = ctx.contentResolver.openInputStream(uri)!!.use { BitmapFactory.decodeStream(it) }
        val k = minOf(1f, max.toFloat() / maxOf(b.width, b.height))
        Bitmap.createScaledBitmap(b, (b.width * k).toInt(), (b.height * k).toInt(), true)
    }
    val f = File(ctx.cacheDir, "photo-${System.currentTimeMillis()}.jpg")
    FileOutputStream(f).use { src.compress(Bitmap.CompressFormat.JPEG, 86, it) }
    Triple(f, src.width, src.height)
}.getOrNull()

/** Любой выбранный файл (видео, музыка) — копия в кэш, чтобы отправить. */
fun copyToCache(ctx: Context, uri: Uri, ext: String): File? = runCatching {
    val f = File(ctx.cacheDir, "file-${System.currentTimeMillis()}.$ext")
    ctx.contentResolver.openInputStream(uri)!!.use { input -> FileOutputStream(f).use { input.copyTo(it) } }
    f
}.getOrNull()

/** Просмотр фото: щипок — масштаб, двойное касание — приблизить/вернуть. */
@Composable
fun PhotoViewer(app: AppState, media: String) {
    var scale by remember { mutableFloatStateOf(1f) }
    var offset by remember { mutableStateOf(Offset.Zero) }
    val tf = rememberTransformableState { z, pan, _ ->
        scale = (scale * z).coerceIn(1f, 5f)
        offset = if (scale == 1f) Offset.Zero else offset + pan
    }
    Box(Modifier.fillMaxSize().background(Color.Black)) {
        AsyncImage(
            model = LocalMedia.current(media), contentDescription = null, contentScale = ContentScale.Fit,
            modifier = Modifier.fillMaxSize()
                .pointerInput(Unit) { detectTapGestures(onDoubleTap = { if (scale > 1f) { scale = 1f; offset = Offset.Zero } else scale = 2.5f }) }
                .transformable(tf)
                .graphicsLayer { scaleX = scale; scaleY = scale; translationX = offset.x; translationY = offset.y },
        )
        BackCircle(app, Modifier.safeDrawingPadding().padding(12.dp).align(Alignment.TopStart))
    }
}

@Composable
fun VideoViewer(app: AppState, media: String) {
    val url = LocalMedia.current(media)
    Box(Modifier.fillMaxSize().background(Color.Black)) {
        AndroidView(
            factory = { ctx ->
                VideoView(ctx).apply {
                    setMediaController(MediaController(ctx).also { it.setAnchorView(this) })
                    setVideoURI(Uri.parse(url))
                    setOnPreparedListener { start() }
                }
            },
            modifier = Modifier.align(Alignment.Center),
            onRelease = { it.stopPlayback() },
        )
        BackCircle(app, Modifier.safeDrawingPadding().padding(12.dp).align(Alignment.TopStart))
    }
}

@Composable
fun BackCircle(app: AppState, modifier: Modifier = Modifier, onClick: () -> Unit = { app.pop() }) {
    FilledTonalIconButton(onClick = onClick, modifier = modifier.size(48.dp), colors = IconButtonDefaults.filledTonalIconButtonColors()) {
        Icon(Icons.AutoMirrored.Rounded.ArrowBack, "Back")
    }
}
