package app.kosmo.sms

import android.content.Context

// Настройки: адрес сервера, ключ шлюза и «включён ли шлюз» (для автозапуска)
class Prefs(context: Context) {
    private val sp = context.getSharedPreferences("kosmo_sms", Context.MODE_PRIVATE)

    var server: String
        get() = sp.getString("server", "") ?: ""
        set(v) = sp.edit().putString("server", v.trim()).apply()

    var key: String
        get() = sp.getString("key", "") ?: ""
        set(v) = sp.edit().putString("key", v.trim()).apply()

    var enabled: Boolean
        get() = sp.getBoolean("enabled", false)
        set(v) = sp.edit().putBoolean("enabled", v).apply()

    var sentTotal: Int
        get() = sp.getInt("sent_total", 0)
        set(v) = sp.edit().putInt("sent_total", v).apply()

    // kosmochat.duckdns.org → wss://kosmochat.duckdns.org/ws/gateway
    fun socketUrl(device: String): String {
        var s = server.trim().trimEnd('/')
        val secure = !s.startsWith("http://")
        s = s.removePrefix("https://").removePrefix("http://").substringBefore('/')
        val k = java.net.URLEncoder.encode(key, "UTF-8")
        val d = java.net.URLEncoder.encode(device, "UTF-8")
        return "${if (secure) "wss" else "ws"}://$s/ws/gateway?key=$k&device=$d"
    }
}
