package app.kosmo.chat.ui

import android.annotation.SuppressLint
import androidx.camera.core.CameraSelector
import androidx.camera.core.MirrorMode
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.video.FileOutputOptions
import androidx.camera.video.Quality
import androidx.camera.video.QualitySelector
import androidx.camera.video.Recorder
import androidx.camera.video.Recording
import androidx.camera.video.VideoCapture
import androidx.camera.video.VideoRecordEvent
import androidx.camera.view.PreviewView
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.rounded.Send
import androidx.compose.material.icons.rounded.Cameraswitch
import androidx.compose.material.icons.rounded.Close
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import kotlinx.coroutines.delay
import java.io.File

private const val MAX_SECONDS = 60

/**
 * Запись кружка: фронтальная камера в круге, кольцо прогресса до 60 секунд.
 * Зеркало записи совпадает с превью, поэтому смена камеры не «переворачивает» кадр.
 */
@SuppressLint("MissingPermission")
@Composable
fun RoundRecorder(app: AppState) {
    val ctx = LocalContext.current
    val owner = LocalLifecycleOwner.current
    var front by remember { mutableStateOf(true) }
    var recording by remember { mutableStateOf<Recording?>(null) }
    var started by remember { mutableLongStateOf(0L) }
    var now by remember { mutableLongStateOf(0L) }
    val capture = remember {
        VideoCapture.Builder(Recorder.Builder().setQualitySelector(QualitySelector.from(Quality.SD)).build())
            .setMirrorMode(MirrorMode.MIRROR_MODE_ON_FRONT_ONLY).build()
    }
    val previewView = remember { PreviewView(ctx).apply { scaleType = PreviewView.ScaleType.FILL_CENTER; implementationMode = PreviewView.ImplementationMode.COMPATIBLE } }
    var file by remember { mutableStateOf<File?>(null) }
    var send by remember { mutableStateOf(false) }

    LaunchedEffect(front) {
        val provider = ProcessCameraProvider.getInstance(ctx).get()
        val preview = Preview.Builder().build().also { it.surfaceProvider = previewView.surfaceProvider }
        runCatching {
            provider.unbindAll()
            provider.bindToLifecycle(owner, if (front) CameraSelector.DEFAULT_FRONT_CAMERA else CameraSelector.DEFAULT_BACK_CAMERA, preview, capture)
        }.onFailure { app.toast = "Camera is not available"; app.pop() }
    }
    DisposableEffect(Unit) { onDispose { recording?.stop(); runCatching { ProcessCameraProvider.getInstance(ctx).get().unbindAll() } } }

    fun start() {
        val f = File(ctx.cacheDir, "round-${System.currentTimeMillis()}.mp4")
        file = f
        recording = capture.output.prepareRecording(ctx, FileOutputOptions.Builder(f).build()).withAudioEnabled()
            .start(ContextCompat.getMainExecutor(ctx)) { e ->
                if (e is VideoRecordEvent.Finalize) {
                    val secs = ((System.currentTimeMillis() - started) / 1000.0).coerceAtMost(MAX_SECONDS.toDouble())
                    if (send && !e.hasError() && secs >= 1) { app.roundResult = f to secs; app.pop() }
                    else if (send) { app.toast = "Video message is too short"; recording = null }
                }
            }
        started = System.currentTimeMillis()
        app.kosmo.typing(app.openChatId ?: "", "round")
    }
    LaunchedEffect(recording) {
        while (recording != null) {
            now = System.currentTimeMillis()
            if ((now - started) / 1000 >= MAX_SECONDS) { send = true; recording?.stop() }
            delay(100)
        }
    }

    Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.92f))) {
        Column(Modifier.fillMaxSize().safeDrawingPadding().padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Spacer(Modifier.height(40.dp))
            val secs = if (recording != null) ((now - started) / 1000).toInt() else 0
            Text(if (recording != null) fmtDur(secs) else tr("Tap the button to record"), color = Color.White, fontSize = 17.sp)
            Spacer(Modifier.height(24.dp))
            Box(Modifier.size(300.dp), contentAlignment = Alignment.Center) {
                AndroidView({ previewView }, Modifier.size(280.dp).clip(CircleShape))
                val p = if (recording != null) ((now - started) / 1000f / MAX_SECONDS).coerceIn(0f, 1f) else 0f
                Canvas(Modifier.size(300.dp)) {
                    drawArc(Color.White.copy(alpha = 0.2f), 0f, 360f, false, style = Stroke(5.dp.toPx()), topLeft = Offset(4.dp.toPx(), 4.dp.toPx()), size = Size(size.width - 8.dp.toPx(), size.height - 8.dp.toPx()))
                    drawArc(Color(0xFFFF453A), -90f, 360f * p, false, style = Stroke(5.dp.toPx(), cap = StrokeCap.Round), topLeft = Offset(4.dp.toPx(), 4.dp.toPx()), size = Size(size.width - 8.dp.toPx(), size.height - 8.dp.toPx()))
                }
            }
            Spacer(Modifier.weight(1f))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly, verticalAlignment = Alignment.CenterVertically) {
                CircleBtn(Icons.Rounded.Close, "Cancel") { send = false; recording?.stop(); file?.delete(); app.pop() }
                Box(
                    Modifier.size(76.dp).clip(CircleShape).background(if (recording != null) Color(0xFFFF453A) else Color.White)
                        .clickable { if (recording == null) start() else { send = true; recording?.stop() } },
                    contentAlignment = Alignment.Center,
                ) {
                    if (recording != null) androidx.compose.material3.Icon(Icons.AutoMirrored.Rounded.Send, tr("Send"), tint = Color.White, modifier = Modifier.size(32.dp))
                    else Box(Modifier.size(28.dp).clip(CircleShape).background(Color(0xFFFF453A)))
                }
                CircleBtn(Icons.Rounded.Cameraswitch, "Switch camera", enabled = recording == null) { front = !front }
            }
        }
    }
}

