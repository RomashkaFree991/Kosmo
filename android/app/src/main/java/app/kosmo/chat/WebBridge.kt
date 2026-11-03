package app.kosmo.chat

import android.graphics.Color
import android.webkit.JavascriptInterface

/** Мост для страницы: сайт сообщает цвет фона, приложение красит под него системные панели. */
class WebBridge(private val activity: MainActivity) {

    @JavascriptInterface
    fun theme(css: String) {
        val color = parseCss(css) ?: return
        activity.runOnUiThread { activity.pageColor = color }
    }

    // "rgb(12, 12, 14)" / "rgba(0, 0, 0, 1)" → Color
    private fun parseCss(css: String): Int? {
        val n = Regex("""[\d.]+""").findAll(css).map { it.value.toFloat() }.toList()
        if (n.size < 3) return null
        return Color.rgb(n[0].toInt(), n[1].toInt(), n[2].toInt())
    }
}
