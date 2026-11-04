package app.kosmo.chat.core

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import java.util.UUID

/** Всё, что клиент знает о сервере: та же модель, что у сайта. */
data class Data(
    val me: String? = null,
    val accounts: Map<String, JsonObject> = emptyMap(),
    val chats: Map<String, JsonObject> = emptyMap(),
    val feed: List<JsonObject> = emptyList(),
    val stories: List<JsonObject> = emptyList(),
    val pending: Set<String> = emptySet(),   // свои сообщения, ещё не подтверждённые сервером
    val loaded: Boolean = false,
) {
    val user: JsonObject? get() = me?.let { accounts[it] }
}

sealed interface KosmoEvent {
    data class Signal(val from: String, val data: JsonObject) : KosmoEvent
    data class Typing(val chat: String, val from: String, val kind: String) : KosmoEvent
    data class Error(val message: String) : KosmoEvent
    data object SessionEnded : KosmoEvent
}

/**
 * Синхронизация с сервером: снимок GET /api/sync, живые патчи по WebSocket /ws,
 * свои изменения — POST /api/sync. Повторяет web/js/api.js.
 */
class Kosmo(val api: Api, private val scope: CoroutineScope, private val token: () -> String?) {
    val data = MutableStateFlow(Data())
    val online = MutableStateFlow(false)
    val events = MutableSharedFlow<KosmoEvent>(extraBufferCapacity = 64)

    private var ws: WebSocket? = null
    private var connId: String? = null
    private var retry = 0
    private var closedByUs = false
    private var reconnectJob: Job? = null
    private val queue = ArrayDeque<JsonObject>()
    private val sendLock = Mutex()
    private val remoteLock = Mutex()

    val me: String get() = data.value.me ?: error("not signed in")

    /* ---------- Снимок ---------- */
    suspend fun load() {
        val snap = api.call("GET", "/api/sync")
        val accounts = snap.obj("accounts")?.mapValues { it.value as JsonObject } ?: emptyMap()
        var chats = snap.obj("chats")?.mapValues { it.value as JsonObject } ?: emptyMap()
        // ещё не дошедшие до сервера сообщения не пропадают при перезагрузке
        val cur = data.value
        if (cur.pending.isNotEmpty()) {
            chats = chats.toMutableMap().also { out ->
                for ((cid, lc) in cur.chats) {
                    val waiting = lc.arr("messages").objects().filter { it.str("id") in cur.pending }
                    if (waiting.isEmpty()) continue
                    val sc = out[cid] ?: lc.with("messages" to JsonArray(emptyList()))
                    val have = sc.arr("messages").objects().mapNotNull { it.str("id") }.toSet()
                    val merged = (sc.arr("messages").objects() + waiting.filter { it.str("id") !in have }).sortedBy { it.num("at") ?: 0 }
                    out[cid] = sc.with("messages" to JsonArray(merged))
                }
            }
        }
        data.value = cur.copy(
            me = snap.str("me"),
            accounts = accounts,
            chats = chats,
            feed = snap.arr("feed").objects(),
            stories = snap.arr("stories").objects(),
            loaded = true,
        )
    }

    /* ---------- WebSocket ---------- */
    fun connect() {
        val t = token() ?: return
        closedByUs = false
        ws?.cancel()
        val wsBase = api.base.replaceFirst("https://", "wss://").replaceFirst("http://", "ws://")
        val req = Request.Builder().url("$wsBase/ws?token=$t").build()
        ws = api.http.newWebSocket(req, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                if (webSocket != ws) return
                retry = 0
                online.value = true
                scope.launch { flush() }
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                if (webSocket != ws) return
                val msg = runCatching { JSON.parseToJsonElement(text) as JsonObject }.getOrNull() ?: return
                when (msg.str("t")) {
                    "conn" -> connId = msg.str("id")
                    "patch" -> msg.obj("patch")?.let { p -> scope.launch { remoteLock.withLock { applyRemote(p) } } }
                    "signal" -> {
                        val from = msg.str("from") ?: return
                        val d = msg.obj("data") ?: return
                        events.tryEmit(KosmoEvent.Signal(from, d))
                    }
                    "typing" -> events.tryEmit(KosmoEvent.Typing(msg.str("chat") ?: return, msg.str("from") ?: return, msg.str("kind") ?: "text"))
                    "logout" -> events.tryEmit(KosmoEvent.SessionEnded)
                }
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) = lost(webSocket, code)
            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) = lost(webSocket, response?.code ?: 0)
        })
    }

    private fun lost(sock: WebSocket, code: Int) {
        if (sock != ws) return
        ws = null
        online.value = false
        if (closedByUs || code == 4001) return
        // переподключение с догрузкой пропущенного
        val wait = minOf(15_000L, 1000L shl minOf(retry++, 4))
        reconnectJob?.cancel()
        reconnectJob = scope.launch {
            delay(wait)
            if (token() == null || ws != null) return@launch
            runCatching { load() }
            connect()
        }
    }

    fun disconnect() {
        closedByUs = true
        reconnectJob?.cancel()
        ws?.close(1000, null)
        ws = null
        online.value = false
    }

    /** Приложение вернулось на экран: проверить связь и догрузить пропущенное. */
    fun wake() {
        if (token() == null) return
        if (ws == null) scope.launch { runCatching { load() }; connect() }
        else ws?.send("""{"t":"ping"}""")
    }

    private fun applyRemote(p: JsonObject) {
        data.update { d ->
            when (p.str("col")) {
                "accounts" -> d.copy(accounts = Patch.applyToMap("accounts", d.accounts, p))
                "chats" -> d.copy(chats = Patch.applyToMap("chats", d.chats, p))
                "feed" -> d.copy(feed = Patch.applyToList("feed", d.feed, p))
                "stories" -> d.copy(stories = Patch.applyToList("stories", d.stories, p))
                else -> d
            }
        }
    }

    /* ---------- Свои изменения: сначала на экран, потом на сервер ---------- */
    fun commit(p: JsonObject) {
        applyRemote(p)
        val mine = myMsgIds(p)
        if (mine.isNotEmpty()) data.update { it.copy(pending = it.pending + mine) }
        synchronized(queue) { queue.addLast(p) }
        scope.launch { flush() }
    }

    private fun myMsgIds(p: JsonObject): List<String> =
        if (p.str("col") != "chats") emptyList()
        else p.obj("msgs")?.arr("up")?.objects()?.filter { it.str("from") == data.value.me }?.mapNotNull { it.str("id") }.orEmpty()

    private suspend fun flush() {
        sendLock.withLock {
            while (true) {
                val batch = synchronized(queue) { List(minOf(queue.size, 100)) { queue.removeFirst() } }
                if (batch.isEmpty()) return
                try {
                    val res = api.call("POST", "/api/sync", jobj("patches" to JsonArray(batch), "conn" to connId))
                    val failed = res.arr("results").objects().filter { !it.bool("ok") }
                    if (failed.isNotEmpty()) {
                        events.tryEmit(KosmoEvent.Error(failed.first().str("message") ?: "Could not save the change"))
                        runCatching { load() }
                    }
                    val ids = batch.flatMap { myMsgIds(it) }.toSet()
                    if (ids.isNotEmpty()) data.update { it.copy(pending = it.pending - ids) }
                } catch (e: ApiException) {
                    if (e.status == 0 || e.status >= 500) {
                        // нет связи — повторим позже, сообщения остаются «с часиками»
                        synchronized(queue) { batch.asReversed().forEach { queue.addFirst(it) } }
                        scope.launch { delay(3000); flush() }
                        return
                    }
                    if (e.status == 401) events.tryEmit(KosmoEvent.SessionEnded)
                    events.tryEmit(KosmoEvent.Error(e.message ?: "Error"))
                    val ids = batch.flatMap { myMsgIds(it) }.toSet()
                    data.update { it.copy(pending = it.pending - ids) }
                }
            }
        }
    }

    /* ---------- Операции ---------- */
    fun newId(): String = UUID.randomUUID().toString()
    fun dmId(a: String, b: String) = listOf(a, b).sorted().joinToString("_")

    /** Отправить сообщение. Если чата ещё нет (первое сообщение), он создаётся тем же патчем. */
    fun sendMessage(chatId: String, members: List<String>, fields: JsonObject, saved: Boolean = false): JsonObject {
        val now = System.currentTimeMillis()
        val m = jobj("id" to newId(), "at" to now, "from" to me, "kind" to "text").let { JsonObject(it + fields) }
        val exists = data.value.chats.containsKey(chatId)
        val set = if (exists) null else jobj(
            "members" to members,
            "read" to mapOf(me to now),
            "createdAt" to now,
            "saved" to (if (saved) true else null),
            "secret" to (if (chatId.startsWith("secret_")) true else null),
        )
        commit(jobj("col" to "chats", "id" to chatId, "op" to "put", "set" to set, "msgs" to jobj("up" to listOf(m))))
        return m
    }

    fun editMessage(chatId: String, m: JsonObject) =
        commit(jobj("col" to "chats", "id" to chatId, "op" to "put", "msgs" to jobj("up" to listOf(m))))

    fun deleteMessage(chatId: String, id: String) =
        commit(jobj("col" to "chats", "id" to chatId, "op" to "put", "msgs" to jobj("del" to listOf(id))))

    fun markRead(chatId: String) {
        val c = data.value.chats[chatId] ?: return
        val last = c.arr("messages").objects().lastOrNull { it.str("from") != me }?.num("at") ?: return
        val mine = c.obj("read")?.num(me) ?: 0
        if (mine >= last) return
        val read = JsonObject((c.obj("read") ?: JsonObject(emptyMap())) + (me to JsonPrimitive(System.currentTimeMillis())))
        commit(jobj("col" to "chats", "id" to chatId, "op" to "put", "set" to jobj("read" to read)))
    }

    fun updateMe(set: JsonObject) = commit(jobj("col" to "accounts", "id" to me, "op" to "put", "set" to set))

    fun signal(to: String, payload: JsonObject) {
        ws?.send(jobj("t" to "signal", "to" to to, "data" to payload).toString())
    }

    fun typing(chat: String, kind: String = "text") {
        ws?.send(jobj("t" to "typing", "chat" to chat, "kind" to kind).toString())
    }
}
