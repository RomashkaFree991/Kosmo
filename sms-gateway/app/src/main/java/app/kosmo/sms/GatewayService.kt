package app.kosmo.sms

import android.app.Activity
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.telephony.SmsManager
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.TimeUnit

data class GatewayState(
    val running: Boolean = false,
    val online: Boolean = false,
    val status: String = "Остановлен",
    val sent: Int = 0,
    val log: List<String> = emptyList(),
)

// Держит соединение с сервером Kosmo и отправляет коды со своей SIM-карты
class GatewayService : Service() {

    companion object {
        private const val CHANNEL = "gateway"
        private const val NOTIFY_ID = 1
        private const val ACTION_SENT = "app.kosmo.sms.SENT"
        const val ACTION_STOP = "app.kosmo.sms.STOP"

        private val _state = MutableStateFlow(GatewayState())
        val state: StateFlow<GatewayState> = _state

        fun start(context: Context) {
            Prefs(context).enabled = true
            ContextCompat.startForegroundService(context, Intent(context, GatewayService::class.java))
        }

        fun stop(context: Context) {
            Prefs(context).enabled = false
            context.startService(Intent(context, GatewayService::class.java).setAction(ACTION_STOP))
        }
    }

    private val client = OkHttpClient.Builder()
        .pingInterval(25, TimeUnit.SECONDS)
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .connectTimeout(15, TimeUnit.SECONDS)
        .build()
    private val main = Handler(Looper.getMainLooper())
    private var socket: WebSocket? = null
    private var attempt = 0
    private var running = false
    private var requestCode = 0
    private lateinit var prefs: Prefs
    private var wakeLock: PowerManager.WakeLock? = null
    private val reconnect = Runnable { connect() }

    // результат отправки SMS → ответ серверу
    private val sentReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            val id = intent.getStringExtra("id") ?: return
            val to = intent.getStringExtra("to") ?: ""
            if (resultCode == Activity.RESULT_OK) {
                prefs.sentTotal = prefs.sentTotal + 1
                ack(id, true, null)
                log("✓ Код отправлен на $to")
                _state.update { it.copy(sent = prefs.sentTotal) }
            } else {
                val why = when (resultCode) {
                    SmsManager.RESULT_ERROR_NO_SERVICE -> "нет сети"
                    SmsManager.RESULT_ERROR_RADIO_OFF -> "режим полёта"
                    SmsManager.RESULT_ERROR_NULL_PDU -> "ошибка SMS"
                    else -> "ошибка $resultCode"
                }
                ack(id, false, why)
                log("✗ Не отправлено на $to: $why")
            }
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        prefs = Prefs(this)
        ContextCompat.registerReceiver(this, sentReceiver, IntentFilter(ACTION_SENT), ContextCompat.RECEIVER_NOT_EXPORTED)
        val nm = getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(NotificationChannel(CHANNEL, "SMS-шлюз", NotificationManager.IMPORTANCE_LOW))
        _state.update { it.copy(sent = prefs.sentTotal) }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            shutdown()
            return START_NOT_STICKY
        }
        val type = if (Build.VERSION.SDK_INT >= 34) ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE else 0
        ServiceCompat.startForeground(this, NOTIFY_ID, notification("Подключение…"), type)
        if (!running) {
            running = true
            wakeLock = getSystemService(PowerManager::class.java)
                .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "kosmo:gateway").apply { acquire() }
            _state.update { it.copy(running = true) }
            connect()
        }
        return START_STICKY
    }

    private fun connect() {
        if (!running) return
        socket?.cancel()
        if (prefs.server.isBlank() || prefs.key.isBlank()) {
            setStatus(false, "Укажите сервер и ключ")
            return
        }
        setStatus(false, "Подключение…")
        val device = "${Build.MANUFACTURER} ${Build.MODEL}".trim()
        val req = try {
            Request.Builder().url(prefs.socketUrl(device)).build()
        } catch (e: IllegalArgumentException) {
            setStatus(false, "Неверный адрес сервера")
            return
        }
        socket = client.newWebSocket(req, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                attempt = 0
                setStatus(true, "В сети — коды отправляются")
                log("Подключено к ${prefs.server}")
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                val msg = runCatching { JSONObject(text) }.getOrNull() ?: return
                if (msg.optString("t") == "sms") {
                    main.post { sendSms(msg.optString("id"), msg.optString("to"), msg.optString("text")) }
                }
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) = lost(webSocket, null)

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                lost(webSocket, if (response?.code == 401) "Неверный ключ" else null)
            }
        })
    }

    private fun lost(ws: WebSocket, reason: String?) {
        if (ws !== socket || !running) return
        val delay = minOf(60_000L, 2_000L shl minOf(attempt++, 5))
        setStatus(false, (reason ?: "Нет связи с сервером") + " · повтор через ${delay / 1000} с")
        main.removeCallbacks(reconnect)
        main.postDelayed(reconnect, delay)
    }

    private fun sendSms(id: String, to: String, text: String) {
        if (id.isEmpty() || !to.matches(Regex("^\\+?[0-9]{6,16}$")) || text.isEmpty()) {
            ack(id, false, "bad request")
            return
        }
        try {
            val sms = if (Build.VERSION.SDK_INT >= 31) getSystemService(SmsManager::class.java) else @Suppress("DEPRECATION") SmsManager.getDefault()
            val parts = sms.divideMessage(text)
            val sent = PendingIntent.getBroadcast(
                this, requestCode++,
                Intent(ACTION_SENT).setPackage(packageName).putExtra("id", id).putExtra("to", to),
                PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_ONE_SHOT,
            )
            if (parts.size <= 1) {
                sms.sendTextMessage(to, null, text, sent, null)
            } else {
                val intents = ArrayList<PendingIntent?>(parts.map { null })
                intents[intents.size - 1] = sent
                @Suppress("UNCHECKED_CAST")
                sms.sendMultipartTextMessage(to, null, parts, intents as ArrayList<PendingIntent>, null)
            }
        } catch (e: SecurityException) {
            ack(id, false, "нет разрешения на SMS")
            log("✗ Нет разрешения на отправку SMS")
        } catch (e: Exception) {
            ack(id, false, e.message ?: "error")
            log("✗ ${e.message}")
        }
    }

    private fun ack(id: String, ok: Boolean, error: String?) {
        val m = JSONObject().put("t", "ack").put("id", id).put("ok", ok)
        if (error != null) m.put("error", error)
        socket?.send(m.toString())
    }

    private fun setStatus(online: Boolean, text: String) {
        _state.update { it.copy(online = online, status = text) }
        getSystemService(NotificationManager::class.java).notify(NOTIFY_ID, notification(text))
    }

    private fun log(line: String) {
        val time = SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date())
        _state.update { it.copy(log = (listOf("$time  $line") + it.log).take(30)) }
    }

    private fun notification(text: String): Notification {
        val open = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE,
        )
        return NotificationCompat.Builder(this, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat)
            .setContentTitle("Kosmo SMS")
            .setContentText(text)
            .setContentIntent(open)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .build()
    }

    private fun shutdown() {
        running = false
        main.removeCallbacks(reconnect)
        socket?.close(1000, "stop")
        socket = null
        wakeLock?.let { if (it.isHeld) it.release() }
        _state.update { it.copy(running = false, online = false, status = "Остановлен") }
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onDestroy() {
        running = false
        main.removeCallbacks(reconnect)
        socket?.cancel()
        wakeLock?.let { if (it.isHeld) it.release() }
        runCatching { unregisterReceiver(sentReceiver) }
        _state.update { it.copy(running = false, online = false) }
        super.onDestroy()
    }
}
