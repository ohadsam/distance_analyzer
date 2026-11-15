package com.stepup.app

import java.io.InputStream

/** Pure helpers for the backup files (JVM-tested): a bounded read and a safe file name. */
object BackupMath {
    const val MAX_BYTES = 20_000_000

    /** The text of the stream, or null when it is longer than [max] bytes (nothing bigger is ever kept in memory). */
    fun readLimited(s: InputStream, max: Int = MAX_BYTES): String? {
        val buf = java.io.ByteArrayOutputStream(); val chunk = ByteArray(8192); var total = 0
        while (true) {
            val n = s.read(chunk); if (n < 0) break
            total += n; if (total > max) return null
            buf.write(chunk, 0, n)
        }
        return buf.toString(Charsets.UTF_8.name())
    }

    /** Letters, digits, dot, dash and underscore only; never empty, at most 60 characters. */
    fun safeName(name: String): String = name.replace(Regex("[^A-Za-z0-9._-]"), "_").take(60).ifEmpty { "stepup-backup.json" }
}
