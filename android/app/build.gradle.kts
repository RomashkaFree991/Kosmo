plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
    id("app.cash.paparazzi")
}

// адрес сервера Kosmo; другой — `./gradlew assembleRelease -PkosmoUrl=https://example.org`
val kosmoUrl = (findProperty("kosmoUrl") as String?) ?: "https://kosmochat.duckdns.org"

android {
    namespace = "app.kosmo.chat"
    compileSdk = 35

    defaultConfig {
        applicationId = "app.kosmo.chat"
        minSdk = 26
        targetSdk = 35
        versionCode = 2
        versionName = "2.0"
        buildConfigField("String", "KOSMO_URL", "\"$kosmoUrl\"")
        // звонки (WebRTC): только ARM-телефоны — так APK меньше
        ndk { abiFilters += listOf("arm64-v8a", "armeabi-v7a") }
    }

    // ключ подписи хранится вне репозитория: KOSMO_KEYSTORE + KOSMO_KEYSTORE_PASSWORD
    val ks = System.getenv("KOSMO_KEYSTORE")?.let { file(it) }?.takeIf { it.exists() }
    signingConfigs {
        if (ks != null) create("kosmo") {
            storeFile = ks
            storePassword = System.getenv("KOSMO_KEYSTORE_PASSWORD")
            keyAlias = "kosmo"
            keyPassword = System.getenv("KOSMO_KEYSTORE_PASSWORD")
        }
    }
    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            signingConfig = signingConfigs.findByName("kosmo") ?: signingConfigs.getByName("debug")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures { compose = true; buildConfig = true }
    testOptions { unitTests.isReturnDefaultValues = true }
}

dependencies {
    val bom = platform("androidx.compose:compose-bom:2024.12.01")
    implementation(bom)
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.activity:activity-compose:1.9.3")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.8.7")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.7")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.7.3")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("io.coil-kt:coil-compose:2.7.0")
    implementation("io.coil-kt:coil-video:2.7.0")
    implementation("io.getstream:stream-webrtc-android:1.3.8")
    implementation("com.materialkolor:material-kolor:2.0.2")
    val camerax = "1.4.1"
    implementation("androidx.camera:camera-camera2:$camerax")
    implementation("androidx.camera:camera-lifecycle:$camerax")
    implementation("androidx.camera:camera-video:$camerax")
    implementation("androidx.camera:camera-view:$camerax")

    testImplementation("junit:junit:4.13.2")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.9.0")
}
