package app.kosmo.chat.core

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.JsonObject
import okhttp3.Call
import okhttp3.Callback
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okio.BufferedSink
import okio.source
import java.io.File
import java.io.IOException
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

class ApiException(val status: Int, val code: String?, message: String?) : Exception(message ?: code ?: "Error $status")

/** REST сервера Kosmo: те же адреса, что использует сайт (web/js/api.js). */
class Api(val base: String, private val token: () -> String?) {
    val http: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .writeTimeout(120, TimeUnit.SECONDS)
        .pingInterval(25, TimeUnit.SECONDS)
        .build()

    private val jsonType = "application/json".toMediaType()

    fun mediaUrl(id: String) = "$base/media/$id"

    suspend fun call(method: String, path: String, body: JsonObject? = null, auth: Boolean = true, as_: String? = null): JsonObject {
        val b = Request.Builder().url(base + path)
        if (auth) (as_ ?: token())?.let { b.header("Authorization", "Bearer $it") }
        val rb = body?.toString()?.toRequestBody(jsonType) ?: if (method == "GET" || method == "DELETE") null else "{}".toRequestBody(jsonType)
        b.method(method, rb)
        val res = try { b.build().await(http) } catch (e: IOException) { throw ApiException(0, "offline", "No connection to the server") }
        return res.use { r ->
            val text = withContext(Dispatchers.IO) { r.body?.string().orEmpty() }
            val data = runCatching { JSON.parseToJsonElement(text) as JsonObject }.getOrDefault(JsonObject(emptyMap()))
            if (!r.isSuccessful) throw ApiException(r.code, data.str("error"), data.str("message"))
            data
        }
    }

    /** Загрузка файла: POST /api/media → id. Прогресс 0..1. */
    suspend fun upload(file: File, mime: String, progress: (Float) -> Unit = {}): String {
        val body = object : RequestBody() {
            override fun contentType() = mime.toMediaType()
            override fun contentLength() = file.length()
            override fun writeTo(sink: BufferedSink) {
                val total = file.length().coerceAtLeast(1)
                var sent = 0L
                file.source().use { src ->
                    val buf = okio.Buffer()
                    while (true) {
                        val n = src.read(buf, 64 * 1024)
                        if (n == -1L) break
                        sink.write(buf, n)
                        sent += n
                        progress(sent.toFloat() / total)
                    }
                }
            }
        }
        val req = Request.Builder().url("$base/api/media").header("Authorization", "Bearer ${token()}").post(body).build()
        val res = try { req.await(http) } catch (e: IOException) { throw ApiException(0, "offline", "No connection to the server") }
        return res.use { r ->
            val data = runCatching { JSON.parseToJsonElement(withContext(Dispatchers.IO) { r.body?.string().orEmpty() }) as JsonObject }.getOrNull()
            if (!r.isSuccessful) throw ApiException(r.code, data?.str("error"), data?.str("message") ?: "Upload failed")
            data?.str("id") ?: throw ApiException(r.code, "bad_reply", "Upload failed")
        }
    }
}

suspend fun Request.await(client: OkHttpClient): Response = suspendCancellableCoroutine { cont ->
    val call = client.newCall(this)
    cont.invokeOnCancellation { call.cancel() }
    call.enqueue(object : Callback {
        override fun onFailure(call: Call, e: IOException) { if (cont.isActive) cont.resumeWithException(e) }
        override fun onResponse(call: Call, response: Response) { cont.resume(response) }
    })
}
