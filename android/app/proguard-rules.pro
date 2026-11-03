# мост JS → Kotlin: методы вызываются из страницы по имени
-keepclassmembers class app.kosmo.chat.WebBridge {
    @android.webkit.JavascriptInterface <methods>;
}
