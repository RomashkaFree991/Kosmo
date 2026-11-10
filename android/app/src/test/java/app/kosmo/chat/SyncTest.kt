package app.kosmo.chat

import app.kosmo.chat.core.Api
import app.kosmo.chat.core.Auth
import app.kosmo.chat.core.Kosmo
import app.kosmo.chat.core.arr
import app.kosmo.chat.core.jobj
import app.kosmo.chat.core.obj
import app.kosmo.chat.core.objects
import app.kosmo.chat.core.strings
import app.kosmo.chat.core.with
import app.kosmo.chat.core.str
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.withTimeout
import org.junit.Assume.assumeTrue
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/**
 * Живой тест против локального сервера Kosmo (TEST_NUMBERS=1: код 000000 для …@kosmo.test).
 * Запуск: KOSMO_TEST_URL=http://127.0.0.1:4010 ./gradlew testDebugUnitTest
 */
class SyncTest {
    private val url = System.getenv("KOSMO_TEST_URL")

    private suspend fun account(email: String, name: String): Pair<Kosmo, String> {
        var token: String? = null
        val api = Api(url!!) { token }
        val auth = Auth(api, "Kosmo test")
        auth.sendCode(email)
        val (ticket, exists) = auth.verify(email, "000000")
        val s = if (exists) auth.login(ticket, "1234") else auth.register(ticket, "1234", name, "")
        token = s.token
        val k = Kosmo(api, CoroutineScope(SupervisorJob() + Dispatchers.IO)) { token }
        k.load()
        k.connect()
        return k to s.uid
    }

    @Test
    fun messagesTravelBothWays() = runBlocking {
        assumeTrue(url != null)
        val (a, aid) = account("ka${System.nanoTime()}@kosmo.test", "Anna")
        val (b, bid) = account("kb${System.nanoTime()}@kosmo.test", "Boris")
        withTimeout(5000) { while (!a.online.value || !b.online.value) delay(50) }
        b.load()   // профиль Анны появился после её регистрации
        val chat = a.dmId(aid, bid)
        a.sendMessage(chat, listOf(aid, bid), jobj("text" to "Привет из Kotlin"))
        assertTrue("pending while sending", a.data.value.pending.isNotEmpty() || a.data.value.chats[chat] != null)
        withTimeout(5000) { while (b.data.value.chats[chat]?.arr("messages")?.objects()?.any { it.str("text") == "Привет из Kotlin" } != true) delay(50) }
        withTimeout(5000) { while (a.data.value.pending.isNotEmpty()) delay(50) }
        b.sendMessage(chat, listOf(aid, bid), jobj("text" to "ответ"))
        withTimeout(5000) { while (a.data.value.chats[chat]?.arr("messages")?.objects()?.any { it.str("text") == "ответ" } != true) delay(50) }
        // после перезагрузки снимка всё на месте
        a.load()
        assertEquals(2, a.data.value.chats[chat]!!.arr("messages").objects().size)
        // загрузка файла
        val f = File.createTempFile("kosmo", ".jpg").apply { writeBytes(ByteArray(2048) { it.toByte() }) }
        val id = a.api.upload(f, "image/jpeg")
        assertEquals(32, id.length)
        a.disconnect(); b.disconnect()
    }

    /** Автор и собеседник отмечают пункты одновременно — ничьи галочки не пропадают. */
    @Test
    fun todoMarksFromBothSurvive() = runBlocking {
        assumeTrue(url != null)
        val (a, aid) = account("ta${System.nanoTime()}@kosmo.test", "Anna")
        val (b, bid) = account("tb${System.nanoTime()}@kosmo.test", "Boris")
        withTimeout(5000) { while (!a.online.value || !b.online.value) delay(50) }
        b.load()
        val chat = a.dmId(aid, bid)
        val items = listOf("1", "2", "3").map { jobj("id" to it, "text" to "item $it", "by" to aid, "done" to emptyList<String>()) }
        val m = a.sendMessage(chat, listOf(aid, bid), jobj("kind" to "todo", "todo" to jobj("title" to "Trip", "open" to true, "items" to items)))
        val mid = m.str("id")!!
        fun todo(k: Kosmo) = k.data.value.chats[chat]?.arr("messages")?.objects()?.firstOrNull { it.str("id") == mid }?.obj("todo")
        fun mark(k: Kosmo, me: String, item: String) {
            val cur = k.data.value.chats[chat]!!.arr("messages").objects().first { it.str("id") == mid }
            val t = cur.obj("todo")!!
            val next = t.arr("items").objects().map { if (it.str("id") == item) it.with("done" to (it.strings("done") + me)) else it }
            k.editMessage(chat, cur.with("todo" to t.with("items" to kotlinx.serialization.json.JsonArray(next))))
        }
        withTimeout(5000) { while (todo(b) == null) delay(50) }
        // у Анны устаревшая копия: галочка Бориса до неё ещё не дошла
        a.disconnect()
        mark(b, bid, "2")
        delay(1500)
        mark(a, aid, "1")
        delay(1500)
        a.load(); a.connect()
        fun ok(k: Kosmo): Boolean {
            val its = todo(k)?.arr("items")?.objects() ?: return false
            return its.first { it.str("id") == "1" }.strings("done") == listOf(aid) && its.first { it.str("id") == "2" }.strings("done") == listOf(bid)
        }
        withTimeout(5000) { while (!ok(a) || !ok(b)) delay(50) }
        a.load(); b.load()
        assertTrue(ok(a) && ok(b))
        a.disconnect(); b.disconnect()
    }
}
