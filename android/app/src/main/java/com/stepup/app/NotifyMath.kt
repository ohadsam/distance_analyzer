package com.stepup.app

import org.json.JSONArray
import org.json.JSONObject

/** One notification the web app planned: fires at [at] (epoch ms) even when the app is closed. */
data class Planned(val id: String, val at: Long, val title: String, val body: String, val href: String)

/** Pure validation and selection of planned notifications (no Android types: JVM-tested). Everything from the page is untrusted and bounded. */
object NotifyMath {
    const val MAX = 100
    const val HORIZON_MS = 14L * 24 * 3600 * 1000
    const val LATE_MS = 6L * 3600 * 1000 // a notification missed by less than this (phone off, Doze) is still shown
    private val ID = Regex("^[A-Za-z0-9_-]{1,64}$")
    private val HREF = Regex("^#/[A-Za-z0-9/_-]{0,60}$")

    fun parse(json: String, now: Long): List<Planned> {
        val arr = try { JSONArray(json) } catch (_: Exception) { return emptyList() }
        val out = ArrayList<Planned>()
        for (i in 0 until minOf(arr.length(), MAX * 2)) {
            val o = arr.optJSONObject(i) ?: continue
            val id = o.optString("id")
            val at = o.optLong("at", 0)
            val title = o.optString("title").replace(Regex("[\\u0000-\\u001f]"), " ").trim().take(80)
            val body = o.optString("body").replace(Regex("[\\u0000-\\u001f]"), " ").trim().take(160)
            val href = o.optString("href")
            if (!ID.matches(id) || title.isEmpty() || at < now - LATE_MS || at > now + HORIZON_MS) continue
            out.add(Planned(id, at, title, body, if (HREF.matches(href)) href else ""))
        }
        return out.sortedBy { it.at }.distinctBy { it.id }.take(MAX)
    }

    fun toJson(list: List<Planned>): String {
        val arr = JSONArray()
        for (p in list) arr.put(JSONObject().put("id", p.id).put("at", p.at).put("title", p.title).put("body", p.body).put("href", p.href))
        return arr.toString()
    }

    /** Notifications that are due (time reached, not older than LATE_MS). */
    fun due(list: List<Planned>, now: Long): List<Planned> = list.filter { it.at <= now && it.at >= now - LATE_MS }

    /** The earliest one still ahead. */
    fun next(list: List<Planned>, now: Long): Planned? = list.filter { it.at > now }.minByOrNull { it.at }

    /** What stays after the due ones were shown. */
    fun remaining(list: List<Planned>, now: Long): List<Planned> = list.filter { it.at > now }
}
