package app.kosmo.sms

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

// После перезагрузки телефона или обновления приложения шлюз включается сам
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (Prefs(context).enabled) GatewayService.start(context)
    }
}
