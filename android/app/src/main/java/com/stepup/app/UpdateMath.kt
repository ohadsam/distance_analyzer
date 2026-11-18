package com.stepup.app

/** Pure checks for the in-app update (no Android types, so it is JVM-tested): which address may be downloaded, the published checksum, progress. */
object UpdateMath {
    /** The biggest APK we accept (the real one is a few MB). */
    const val MAX_BYTES = 80L * 1024 * 1024

    // Only this project's release assets: the "latest" shortcut or one named release, and only the file stepup.apk.
    private val URL = Regex("^https://github\\.com/ohadsam/distance_analyzer/releases/(latest/download|download/[A-Za-z0-9._-]{1,60})/stepup\\.apk$")
    private val SHA = Regex("\\b[0-9a-fA-F]{64}\\b")

    fun validUrl(url: String?): Boolean = url != null && url.length < 200 && URL.matches(url)

    /** The address of the checksum file published next to the APK. */
    fun checksumUrl(apkUrl: String): String = "$apkUrl.sha256"

    /** The first 64-hex-digit word in the checksum file ("<hash>  stepup.apk"), lower case, or null. */
    fun parseSha256(text: String?): String? = text?.take(1000)?.let { SHA.find(it)?.value?.lowercase() }

    fun toHex(bytes: ByteArray): String = bytes.joinToString("") { "%02x".format(it) }

    /** 0..100, or -1 when the size is unknown. */
    fun percent(done: Long, total: Long): Int = if (total <= 0) -1 else (done * 100 / total).coerceIn(0, 100).toInt()
}
