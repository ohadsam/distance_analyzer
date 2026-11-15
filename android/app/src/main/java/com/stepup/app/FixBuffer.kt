package com.stepup.app

import java.util.Locale

/** Pure text format of the GPS fixes the background service records (one line per fix) and their JSON hand-over to the page. No Android types: JVM-tested. */
object FixBuffer {
    const val MAX_LINES = 20_000

    fun encode(lat: Double, lon: Double, t: Long, acc: Float): String = String.format(Locale.US, "%.6f,%.6f,%d,%.0f", lat, lon, t, acc)

    /** [lat, lon, t, accuracy] or null for a malformed or out-of-range line. */
    fun parse(line: String): DoubleArray? {
        val p = line.trim().split(',')
        if (p.size != 4) return null
        val lat = p[0].toDoubleOrNull() ?: return null
        val lon = p[1].toDoubleOrNull() ?: return null
        val t = p[2].toLongOrNull() ?: return null
        val acc = p[3].toDoubleOrNull() ?: return null
        if (!lat.isFinite() || !lon.isFinite() || !acc.isFinite() || Math.abs(lat) > 90 || Math.abs(lon) > 180 || t <= 0 || acc < 0) return null
        return doubleArrayOf(lat, lon, t.toDouble(), acc)
    }

    /** The newest MAX_LINES valid fixes as a JSON array of [lat, lon, t, acc]. */
    fun toJson(lines: List<String>): String {
        val out = StringBuilder("[")
        var first = true
        for (l in lines.takeLast(MAX_LINES)) {
            val f = parse(l) ?: continue
            if (!first) out.append(',')
            out.append(String.format(Locale.US, "[%.6f,%.6f,%d,%.0f]", f[0], f[1], f[2].toLong(), f[3]))
            first = false
        }
        return out.append(']').toString()
    }
}
