package com.stepup.app

import org.json.JSONObject

/**
 * Counts kilometres from the GPS fixes with the same rules as the page (fixes worse than 35 m are ignored, nothing faster than 12 m/s,
 * standing still adds neither distance nor time), so the background service can speak the kilometre times while the screen is off. Pure: JVM-tested.
 */
class SplitTracker {
    data class Split(val km: Int, val atMs: Long)

    var distM = 0.0; private set
    var movingMs = 0L; private set
    private var lat = Double.NaN; private var lon = Double.NaN; private var t = 0L

    /** Start (or restart after a pause) from what the page already counted. */
    fun reset(distanceM: Double, moving: Long) { distM = distanceM.coerceIn(0.0, 1.0e7); movingMs = moving.coerceIn(0L, 1L shl 40); lat = Double.NaN; lon = Double.NaN; t = 0L }

    fun add(la: Double, lo: Double, tMs: Long, acc: Float): List<Split> {
        if (acc > 35f) return emptyList()
        val out = ArrayList<Split>()
        if (!lat.isNaN() && tMs > t) {
            val dt = tMs - t
            val d = haversine(lat, lon, la, lo)
            val v = d / (dt / 1000.0)
            if (v <= 12.0 && v >= 0.5) {
                val before = distM
                distM += d; movingMs += dt
                var km = Math.floor(before / 1000.0).toInt() + 1
                while (km * 1000.0 <= distM) { val f = (km * 1000.0 - before) / d; out.add(Split(km, Math.round(movingMs - dt * (1 - f)))); km++ }
            }
        } else if (!lat.isNaN() && tMs <= t) return emptyList()
        lat = la; lon = lo; t = tMs
        return out
    }

    private fun haversine(a: Double, b: Double, c: Double, d: Double): Double {
        val r = 6_371_000.0; val p1 = Math.toRadians(a); val p2 = Math.toRadians(c)
        val dp = p2 - p1; val dl = Math.toRadians(d - b)
        val x = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2)
        return 2 * r * Math.asin(Math.sqrt(x))
    }
}

/** The settings the page hands to the service for speaking (validated, bounded). */
data class VoiceConfig(val on: Boolean, val lang: String, val template: String, val distM: Double, val movingMs: Long) {
    companion object {
        fun parse(json: String): VoiceConfig? {
            val o = try { JSONObject(json) } catch (_: Exception) { return null }
            val lang = if (o.optString("lang") == "he") "he" else "en"
            val tpl = o.optString("tpl").replace(Regex("[\\u0000-\\u001f]"), " ").trim().take(120)
            return VoiceConfig(o.optBoolean("on", false), lang, tpl, o.optDouble("dist", 0.0).let { if (it.isFinite()) it else 0.0 }, o.optLong("moving", 0L))
        }
    }
}

object SplitText {
    /** "Kilometre {n}: {min} minutes {sec} seconds" with the numbers filled in (unknown placeholders stay as they are). */
    fun fill(template: String, km: Int, atMs: Long): String =
        template.replace("{n}", km.toString()).replace("{min}", (atMs / 60_000).toString()).replace("{sec}", ((atMs / 1000) % 60).toString())
}
