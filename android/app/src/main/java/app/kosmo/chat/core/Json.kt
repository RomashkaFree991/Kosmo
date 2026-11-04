package app.kosmo.chat.core

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.longOrNull

// Документы Kosmo — свободный JSON (как на сервере и на сайте), поэтому
// храним их как JsonObject и читаем через короткие помощники.

val JSON = Json { ignoreUnknownKeys = true; explicitNulls = false }

fun JsonObject.str(k: String): String? = (this[k] as? JsonPrimitive)?.takeIf { it !is JsonNull }?.contentOrNull
fun JsonObject.num(k: String): Long? = (this[k] as? JsonPrimitive)?.let { it.longOrNull ?: it.doubleOrNull?.toLong() }
fun JsonObject.dbl(k: String): Double? = (this[k] as? JsonPrimitive)?.doubleOrNull
fun JsonObject.bool(k: String): Boolean = (this[k] as? JsonPrimitive)?.booleanOrNull ?: false
fun JsonObject.obj(k: String): JsonObject? = this[k] as? JsonObject
fun JsonObject.arr(k: String): JsonArray = this[k] as? JsonArray ?: JsonArray(emptyList())
fun JsonObject.strings(k: String): List<String> = arr(k).mapNotNull { (it as? JsonPrimitive)?.contentOrNull }
fun JsonArray.objects(): List<JsonObject> = mapNotNull { it as? JsonObject }

fun JsonObject.with(vararg pairs: Pair<String, Any?>): JsonObject = JsonObject(this + pairs.associate { (k, v) -> k to v.toJson() })
fun JsonObject.without(vararg keys: String): JsonObject = JsonObject(this - keys.toSet())

fun jobj(vararg pairs: Pair<String, Any?>): JsonObject = buildJsonObject { pairs.forEach { (k, v) -> if (v != null) put(k, v.toJson()) } }

@Suppress("UNCHECKED_CAST")
fun Any?.toJson(): JsonElement = when (this) {
    null -> JsonNull
    is JsonElement -> this
    is String -> JsonPrimitive(this)
    is Number -> JsonPrimitive(this)
    is Boolean -> JsonPrimitive(this)
    is Map<*, *> -> JsonObject((this as Map<String, Any?>).mapValues { it.value.toJson() })
    is Iterable<*> -> JsonArray(this.map { it.toJson() })
    is Array<*> -> JsonArray(this.map { it.toJson() })
    else -> JsonPrimitive(toString())
}
