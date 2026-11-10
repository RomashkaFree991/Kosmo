package app.kosmo.chat.ui

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import app.kosmo.chat.MainActivity
import app.kosmo.chat.R
import app.kosmo.chat.core.Data
import app.kosmo.chat.core.KosmoEvent
import app.kosmo.chat.core.arr
import app.kosmo.chat.core.bool
import app.kosmo.chat.core.obj
import app.kosmo.chat.core.objects
import app.kosmo.chat.core.str
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

/**
 * Уведомления о новых сообщениях и звонках. Пока Kosmo свёрнут, служба
 * [KosmoService] держит соединение с сервером — так сообщения приходят и в фоне
 * (push через Firebase на сервере Kosmo не настроен).
 */
class Notifier(private val ctx: Context, private val app: AppState, scope: CoroutineScope) {
    var foreground = true
    private val nm: NotificationManager? = runCatching { ctx.getSystemService(NotificationManager::class.java) }.getOrNull()
    private var seen = HashSet<String>()
    private var primed = false

    init {
        if (Build.VERSION.SDK_INT >= 26 && nm != null) runCatching {
            nm?.createNotificationChannel(NotificationChannel("messages", tr("Messages"), NotificationManager.IMPORTANCE_HIGH))
            nm?.createNotificationChannel(NotificationChannel("calls", tr("Calls"), NotificationManager.IMPORTANCE_HIGH))
            nm?.createNotificationChannel(NotificationChannel("online", tr("Connection"), NotificationManager.IMPORTANCE_MIN).apply { setShowBadge(false) })
        }
        scope.launch { app.kosmo.data.collect { d -> onData(d) } }
        scope.launch {
            app.kosmo.events.collect { e ->
                if (e is KosmoEvent.Signal && e.data.str("type") == "ring" && !foreground) call(e.from, e.data.bool("video"))
            }
        }
    }

    private fun allowed() = Build.VERSION.SDK_INT < 33 || ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

    private fun onData(d: Data) {
        val me = d.me ?: return
        val ids = HashSet<String>()
        val fresh = mutableListOf<Pair<String, kotlinx.serialization.json.JsonObject>>()
        for (c in d.chats.values) {
            for (m in c.arr("messages").objects()) {
                val id = m.str("id") ?: continue
                ids.add(id)
                if (primed && id !in seen && m.str("from") != me && m.str("kind") != "join") fresh.add(c.str("id")!! to m)
            }
        }
        seen = ids
        if (!primed) { primed = d.loaded; return }
        val notify = d.user?.obj("settings")?.obj("notify")
        if (app.dndUntil() > 0) return   // «Не беспокоить»
        for ((chatId, m) in fresh) {
            val c = d.chats[chatId] ?: continue
            if (d.muted(c)) continue
            if (foreground && app.openChatId == chatId && app.stack.lastOrNull() is Screen.Chat) continue
            val kind = if (isChannel(c)) "channels" else if (isRoom(c)) "groups" else "private"
            if (notify?.get(kind)?.toString() == "false") continue
            if (foreground) continue   // на экране — счётчик и список обновятся сами
            val who = d.accounts[m.str("from")]?.str("name") ?: "Kosmo"
            val title = if (isRoom(c)) d.chatTitle(c) else who
            val text = if (notify?.get("preview")?.toString() == "false") tr("New message") else (if (isRoom(c)) "$who: " else "") + tr(d.previewText(m))
            show(chatId.hashCode(), title, text, chatId)
        }
    }

    private fun intent(chatId: String?) = PendingIntent.getActivity(
        ctx, chatId?.hashCode() ?: 0,
        Intent(ctx, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP).putExtra("chat", chatId),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    private fun show(id: Int, title: String, text: String, chatId: String?) {
        if (!allowed()) return
        nm?.notify(id, NotificationCompat.Builder(ctx, "messages").setSmallIcon(R.drawable.ic_stat).setContentTitle(title).setContentText(text)
            .setStyle(NotificationCompat.BigTextStyle().bigText(text)).setAutoCancel(true).setContentIntent(intent(chatId))
            .setPriority(NotificationCompat.PRIORITY_HIGH).setCategory(NotificationCompat.CATEGORY_MESSAGE).build())
    }

    private fun call(from: String, video: Boolean) {
        if (!allowed()) return
        val who = app.kosmo.data.value.accounts[from]?.str("name") ?: "Kosmo"
        val pi = intent(null)
        nm?.notify(777, NotificationCompat.Builder(ctx, "calls").setSmallIcon(R.drawable.ic_stat).setContentTitle(who)
            .setContentText(tr(if (video) "Incoming video call" else "Incoming call")).setCategory(NotificationCompat.CATEGORY_CALL)
            .setPriority(NotificationCompat.PRIORITY_MAX).setFullScreenIntent(pi, true).setContentIntent(pi).setAutoCancel(true).setTimeoutAfter(30_000).build())
    }

    fun cancelCall() = nm?.cancel(777)
    fun clear(chatId: String) = nm?.cancel(chatId.hashCode())

    fun test() {
        if (!allowed()) { app.toast = "Allow notifications in Android settings"; return }
        show(1, "Kosmo", tr("Notifications work!"), null)
    }
}

/** Служба «Kosmo на связи»: держит WebSocket, пока приложение свёрнуто. */
class KosmoService : Service() {
    override fun onBind(intent: Intent?): IBinder? = null
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val n = NotificationCompat.Builder(this, "online").setSmallIcon(R.drawable.ic_stat).setContentTitle("Kosmo")
            .setContentText(tr("Connected — new messages will arrive")).setPriority(NotificationCompat.PRIORITY_MIN).setOngoing(true)
            .setContentIntent(PendingIntent.getActivity(this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE)).build()
        runCatching {
            ServiceCompat.startForeground(this, 1001, n, if (Build.VERSION.SDK_INT >= 34) ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE else 0)
        }
        return START_STICKY
    }

    companion object {
        fun start(ctx: Context) = runCatching { ContextCompat.startForegroundService(ctx, Intent(ctx, KosmoService::class.java)) }
        fun stop(ctx: Context) = runCatching { ctx.stopService(Intent(ctx, KosmoService::class.java)) }
    }
}

