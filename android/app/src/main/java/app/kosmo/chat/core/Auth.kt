package app.kosmo.chat.core

import kotlinx.serialization.json.JsonObject

data class SessionInfo(val token: String, val uid: String, val sid: String?)

/** Вход и регистрация: почта → код из письма → код-пароль (как на сайте). */
class Auth(private val api: Api, private val device: String) {
    private val dev get() = jobj("name" to device, "type" to "phone")

    suspend fun sendCode(email: String) { api.call("POST", "/api/auth/code", jobj("email" to email), auth = false) }

    /** → ticket и есть ли уже аккаунт с этой почтой */
    suspend fun verify(email: String, code: String): Pair<String, Boolean> {
        val r = api.call("POST", "/api/auth/verify", jobj("email" to email, "code" to code), auth = false)
        return (r.str("ticket") ?: throw ApiException(400, "bad_code", "Wrong code")) to r.bool("exists")
    }

    suspend fun login(ticket: String, passcode: String) =
        session(api.call("POST", "/api/auth/login", jobj("ticket" to ticket, "passcode" to passcode, "device" to dev), auth = false))

    suspend fun register(ticket: String, passcode: String, name: String, username: String, bio: String = "") =
        session(api.call("POST", "/api/auth/register", jobj("ticket" to ticket, "passcode" to passcode, "name" to name, "username" to username, "bio" to bio, "device" to dev), auth = false))

    /* Сброс код-пароля: код на почту → новый код-пароль (как «Forgot passcode?» на сайте) */
    suspend fun resetCode(email: String) { api.call("POST", "/api/auth/reset/code", jobj("email" to email), auth = false) }
    suspend fun resetVerify(email: String, code: String): String =
        api.call("POST", "/api/auth/reset/verify", jobj("email" to email, "code" to code), auth = false).str("ticket") ?: throw ApiException(400, "bad_code", "Wrong code")
    suspend fun reset(ticket: String, passcode: String) =
        session(api.call("POST", "/api/auth/reset", jobj("ticket" to ticket, "passcode" to passcode, "device" to dev), auth = false))

    suspend fun usernameFree(name: String): Boolean = api.call("GET", "/api/username/$name").bool("free")

    suspend fun logout(token: String? = null) { runCatching { api.call("POST", "/api/logout", as_ = token) } }

    private fun session(r: JsonObject) = SessionInfo(r.str("token")!!, r.str("uid")!!, r.str("sid"))
}
