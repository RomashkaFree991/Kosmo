# WebRTC: классы вызываются из нативного кода по имени — не трогать
-keep class org.webrtc.** { *; }
-dontwarn org.webrtc.**
# OkHttp / Okio
-dontwarn okhttp3.internal.platform.**
-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**
-dontwarn org.openjsse.**
