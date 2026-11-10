package app.kosmo.chat.core

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull

// Патчи синхронизации — тот же формат, что web/js/patch.js и сервер:
// { col, id, op: 'put' | 'del', set?, unset?, msgs?: { up, del }, replace? }

object Patch {
    fun applyToDoc(col: String, doc: JsonObject?, p: JsonObject): JsonObject? {
        if (p.str("op") == "del") return null
        val id = p.str("id") ?: return doc
        val replace = p.bool("replace")
        val d = (if (replace) mutableMapOf() else (doc?.toMutableMap() ?: mutableMapOf()))
        var messages: MutableList<JsonObject>? = null
        if (col == "chats") messages = if (replace) mutableListOf() else doc?.arr("messages")?.objects()?.toMutableList() ?: mutableListOf()
        p.obj("set")?.let { set -> set.forEach { (k, v) -> d[k] = v } }
        p.strings("unset").forEach { d.remove(it) }
        if (col == "chats" && messages != null) {
            if (replace) p.obj("set")?.arr("messages")?.let { messages = it.objects().toMutableList() }
            val msgs = p.obj("msgs")
            val up = msgs?.arr("up")?.objects().orEmpty()
            if (up.isNotEmpty()) {
                val idx = messages!!.withIndex().associate { it.value.str("id") to it.index }.toMutableMap()
                for (m in up) {
                    val i = idx[m.str("id")]
                    if (i != null) messages!![i] = m else { idx[m.str("id")] = messages!!.size; messages!!.add(m) }
                }
                messages!!.sortBy { it.num("at") ?: 0 }
            }
            val del = msgs?.arr("del")?.mapNotNull { (it as? JsonPrimitive)?.contentOrNull }?.toSet().orEmpty()
            if (del.isNotEmpty()) messages = messages!!.filterNot { it.str("id") in del }.toMutableList()
            d["messages"] = JsonArray(messages!!)
        }
        d["id"] = JsonPrimitive(id)
        return JsonObject(d)
    }

    fun applyToMap(col: String, map: Map<String, JsonObject>, p: JsonObject): Map<String, JsonObject> {
        val id = p.str("id") ?: return map
        val next = applyToDoc(col, map[id], p)
        return if (next == null) map - id else map + (id to next)
    }

    fun applyToList(col: String, list: List<JsonObject>, p: JsonObject): List<JsonObject> {
        val id = p.str("id") ?: return list
        val cur = list.firstOrNull { it.str("id") == id }
        val next = applyToDoc(col, cur, p)
        val rest = list.filterNot { it.str("id") == id }
        val out = if (next != null) rest + next else rest
        return if (col == "feed") out.sortedByDescending { it.num("at") ?: 0 } else out.sortedBy { it.num("at") ?: 0 }
    }
}
