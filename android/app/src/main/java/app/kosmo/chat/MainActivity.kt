package app.kosmo.chat

import android.Manifest
import android.annotation.SuppressLint
import android.app.DownloadManager
import android.content.ActivityNotFoundException
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.os.Environment
import android.webkit.CookieManager
import android.webkit.GeolocationPermissions
import android.webkit.PermissionRequest
import android.webkit.URLUtil
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.core.content.ContextCompat

/**
 * Kosmo для Android: нативная оболочка на Kotlin + Jetpack Compose.
 * Интерфейс мессенджера — тот же, что на сайте (WebView), поэтому всё, что
 * появляется на сайте, сразу есть и в приложении без обновления APK.
 * Нативная часть: заставка и экран «нет сети» на Compose, системные
 * разрешения (камера, микрофон, геолокация), выбор файлов из галереи,
 * загрузки, кнопка «Назад» и цвет системных панелей под тему сайта.
 */
class MainActivity : ComponentActivity() {

    private lateinit var web: WebView
    private val base: Uri = Uri.parse(BuildConfig.KOSMO_URL)

    // состояние для Compose-слоя поверх WebView
    var loading by mutableStateOf(true)
    var failed by mutableStateOf(false)
    var pageColor by mutableIntStateOf(Color.BLACK)

    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private var pendingWebPermission: PermissionRequest? = null
    private var pendingGeo: Pair<String, GeolocationPermissions.Callback>? = null

    private val pickFiles = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { r ->
        fileCallback?.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(r.resultCode, r.data))
        fileCallback = null
    }

    private val askMedia = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { granted ->
        val req = pendingWebPermission ?: return@registerForActivityResult
        pendingWebPermission = null
        val ok = req.resources.filter { res ->
            when (res) {
                PermissionRequest.RESOURCE_VIDEO_CAPTURE -> granted[Manifest.permission.CAMERA] ?: has(Manifest.permission.CAMERA)
                PermissionRequest.RESOURCE_AUDIO_CAPTURE -> granted[Manifest.permission.RECORD_AUDIO] ?: has(Manifest.permission.RECORD_AUDIO)
                else -> false
            }
        }
        if (ok.isEmpty()) req.deny() else req.grant(ok.toTypedArray())
    }

    private val askGeo = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { granted ->
        val (origin, cb) = pendingGeo ?: return@registerForActivityResult
        pendingGeo = null
        cb.invoke(origin, granted.values.any { it }, false)
    }

    private fun has(p: String) = ContextCompat.checkSelfPermission(this, p) == PackageManager.PERMISSION_GRANTED

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.dark(Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.dark(Color.TRANSPARENT),
        )
        super.onCreate(savedInstanceState)

        web = WebView(this).apply {
            setBackgroundColor(Color.BLACK)
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                databaseEnabled = true
                mediaPlaybackRequiresUserGesture = false
                allowFileAccess = false
                allowContentAccess = true
                mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
                setSupportZoom(false)
                builtInZoomControls = false
                textZoom = 100
                userAgentString = "$userAgentString KosmoAndroid/${BuildConfig.VERSION_NAME}"
            }
            CookieManager.getInstance().setAcceptCookie(true)
            addJavascriptInterface(WebBridge(this@MainActivity), "KosmoAndroid")
            webViewClient = KosmoClient()
            webChromeClient = KosmoChrome()
            setDownloadListener { url, _, disposition, mime, _ -> download(url, disposition, mime) }
        }
        if (savedInstanceState != null) web.restoreState(savedInstanceState) else web.loadUrl(startUrl(intent))

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                // сначала сайт закрывает своё (лист, панель, чат); если нечего — выходим
                web.evaluateJavascript("(window.kosmoBack && window.kosmoBack()) ? 1 : 0") { r ->
                    if (r == "1") return@evaluateJavascript
                    if (web.canGoBack()) web.goBack() else moveTaskToBack(true)
                }
            }
        })

        setContent { KosmoApp(this, web) }
    }

    // ссылки-приглашения kosmochat.duckdns.org/... открываются прямо в приложении
    private fun startUrl(i: Intent?): String {
        val d = i?.data
        return if (d != null && d.host == base.host) d.toString() else base.toString()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        val d = intent.data
        if (d != null && d.host == base.host) web.loadUrl(d.toString())
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        web.saveState(outState)
    }

    override fun onResume() { super.onResume(); web.onResume() }
    override fun onPause() { web.onPause(); CookieManager.getInstance().flush(); super.onPause() }
    override fun onDestroy() { web.destroy(); super.onDestroy() }

    fun retry() {
        failed = false
        loading = true
        web.reload()
    }

    private fun download(url: String, disposition: String?, mime: String?) {
        if (!url.startsWith("https://")) {
            Toast.makeText(this, "Save it from the photo or file viewer", Toast.LENGTH_SHORT).show()
            return
        }
        val name = URLUtil.guessFileName(url, disposition, mime)
        val req = DownloadManager.Request(Uri.parse(url))
            .setMimeType(mime)
            .addRequestHeader("Cookie", CookieManager.getInstance().getCookie(url) ?: "")
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name)
        getSystemService(DownloadManager::class.java).enqueue(req)
        Toast.makeText(this, "Downloading $name", Toast.LENGTH_SHORT).show()
    }

    private inner class KosmoClient : WebViewClient() {
        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
            val u = request.url
            if (u.host == base.host && u.scheme == "https") return false
            // чужие ссылки — во внешнем браузере / приложении
            try { startActivity(Intent(Intent.ACTION_VIEW, u)) } catch (_: ActivityNotFoundException) { }
            return true
        }

        override fun onPageFinished(view: WebView, url: String) {
            if (!failed) loading = false
            // цвет системных панелей — под фон сайта (тёмная/светлая тема, Material)
            view.evaluateJavascript(
                """
                (function () {
                  if (window.__kosmoBars) return;
                  window.__kosmoBars = 1;
                  var send = function () {
                    try { KosmoAndroid.theme(getComputedStyle(document.body).backgroundColor || ''); } catch (e) {}
                  };
                  new MutationObserver(send).observe(document.documentElement, { attributes: true });
                  send();
                })();
                """.trimIndent(), null,
            )
        }

        override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
            if (request.isForMainFrame) { failed = true; loading = false }
        }
    }

    private inner class KosmoChrome : WebChromeClient() {
        // камера и микрофон для звонков, кружков и голосовых
        override fun onPermissionRequest(request: PermissionRequest) {
            if (request.origin.host != base.host) { request.deny(); return }
            val need = buildList {
                if (PermissionRequest.RESOURCE_VIDEO_CAPTURE in request.resources) add(Manifest.permission.CAMERA)
                if (PermissionRequest.RESOURCE_AUDIO_CAPTURE in request.resources) add(Manifest.permission.RECORD_AUDIO)
            }
            runOnUiThread {
                if (need.all { has(it) }) {
                    request.grant(request.resources.filter {
                        it == PermissionRequest.RESOURCE_VIDEO_CAPTURE || it == PermissionRequest.RESOURCE_AUDIO_CAPTURE
                    }.toTypedArray())
                } else {
                    pendingWebPermission = request
                    askMedia.launch(need.toTypedArray())
                }
            }
        }

        // геолокация для «Поделиться местоположением»
        override fun onGeolocationPermissionsShowPrompt(origin: String, callback: GeolocationPermissions.Callback) {
            if (Uri.parse(origin).host != base.host) { callback.invoke(origin, false, false); return }
            if (has(Manifest.permission.ACCESS_FINE_LOCATION) || has(Manifest.permission.ACCESS_COARSE_LOCATION)) {
                callback.invoke(origin, true, false)
            } else {
                pendingGeo = origin to callback
                askGeo.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION))
            }
        }

        // выбор фото, видео, музыки и файлов
        override fun onShowFileChooser(view: WebView, callback: ValueCallback<Array<Uri>>, params: FileChooserParams): Boolean {
            fileCallback?.onReceiveValue(null)
            fileCallback = callback
            return try {
                val pick = params.createIntent().apply {
                    if (params.mode == FileChooserParams.MODE_OPEN_MULTIPLE) putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
                }
                pickFiles.launch(pick)
                true
            } catch (_: ActivityNotFoundException) {
                fileCallback = null
                false
            }
        }

        override fun onProgressChanged(view: WebView, newProgress: Int) {
            if (newProgress >= 100 && !failed) loading = false
        }
    }
}
