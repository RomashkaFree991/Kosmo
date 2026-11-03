package app.kosmo.chat

import app.kosmo.chat.core.Patch
import app.kosmo.chat.core.arr
import app.kosmo.chat.core.jobj
import app.kosmo.chat.core.objects
import app.kosmo.chat.ui.avatarIndex
import org.junit.Assert.assertEquals
import org.junit.Test

class ModelTest {
    /** Цвет аватарки совпадает с сайтом (avatarStyle в web/js/core.js). */
    @Test fun avatarColorsMatchWeb() {
        assertEquals(listOf(2, 4, 1, 0, 5), listOf("Anna", "Boris", "Кирилл Петров", "🙂 Joe", "Kosmo").map(::avatarIndex))
    }

    @Test fun patchMergesMessagesInOrder() {
        val c = Patch.applyToDoc("chats", null, jobj("col" to "chats", "id" to "a_b", "op" to "put", "set" to jobj("members" to listOf("a", "b")), "msgs" to jobj("up" to listOf(jobj("id" to "2", "at" to 20), jobj("id" to "1", "at" to 10)))))!!
        assertEquals(listOf("1", "2"), c.arr("messages").objects().map { it["id"].toString().trim('"') })
        val d = Patch.applyToDoc("chats", c, jobj("col" to "chats", "id" to "a_b", "op" to "put", "msgs" to jobj("del" to listOf("1"))))!!
        assertEquals(1, d.arr("messages").size)
    }
}
