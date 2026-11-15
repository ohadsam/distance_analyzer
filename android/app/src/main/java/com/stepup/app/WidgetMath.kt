package com.stepup.app

import org.json.JSONObject

/** What the page tells the home-screen widgets: the goals and the already translated texts. Everything is bounded and validated (no Android types: JVM-tested). */
data class WidgetSnapshot(
    val stepsGoal: Int, val effortDone: Int, val effortPlan: Int, val kind: String,
    val stepsTitle: String, val effortTitle: String, val effortSub: String, val quickTitle: String, val quickHint: String,
    val lastTitle: String, val lastValue: String, val lastSub: String, val nextTitle: String, val nextValue: String, val nextSub: String,
    val weekTitle: String, val weekMin: List<Int>, val weekToday: Int, val weekLabels: List<String>, val weekStart: Long, val weekDesc: String,
)

object WidgetMath {
    private fun text(o: JSONObject, key: String, max: Int): String = o.optString(key).replace(Regex("[\\u0000-\\u001f]"), " ").trim().take(max)

    /** Seven day values (minutes), each 0..1000; anything missing or odd is 0. */
    private fun week(o: JSONObject): List<Int> { val a = o.optJSONArray("weekMin"); return List(7) { i -> (a?.optInt(i, 0) ?: 0).coerceIn(0, 1000) } }
    private fun labels(o: JSONObject): List<String> { val a = o.optJSONArray("weekLabels"); return List(7) { i -> (a?.optString(i, "") ?: "").replace(Regex("[\\u0000-\\u001f]"), " ").trim().take(3) } }

    fun parse(json: String): WidgetSnapshot? {
        val o = try { JSONObject(json) } catch (_: Exception) { return null }
        val kind = if (o.optString("kind") == "run") "run" else "walk"
        return WidgetSnapshot(
            stepsGoal = o.optInt("stepsGoal", 0).coerceIn(0, 100_000), effortDone = o.optInt("effortDone", 0).coerceIn(0, 100_000), effortPlan = o.optInt("effortPlan", 0).coerceIn(0, 100_000), kind = kind,
            stepsTitle = text(o, "stepsTitle", 40), effortTitle = text(o, "effortTitle", 40), effortSub = text(o, "effortSub", 60), quickTitle = text(o, "quickTitle", 40), quickHint = text(o, "quickHint", 60),
            lastTitle = text(o, "lastTitle", 40), lastValue = text(o, "lastValue", 40), lastSub = text(o, "lastSub", 60), nextTitle = text(o, "nextTitle", 40), nextValue = text(o, "nextValue", 40), nextSub = text(o, "nextSub", 60),
            weekTitle = text(o, "weekTitle", 40), weekMin = week(o), weekToday = o.optInt("weekToday", 0).coerceIn(0, 6), weekLabels = labels(o), weekStart = o.optLong("weekStart", 0L).coerceIn(0L, 4_102_444_800_000L), weekDesc = text(o, "weekDesc", 240),
        )
    }

    /**
     * Which bar is today, from the day the snapshot's week began: 0..6 while that week is still running, or null once it is over
     * (the widget then shows an empty week instead of last week's bars). [offsetMs] is the time zone's offset at [nowMs].
     */
    fun todayIndex(weekStartMs: Long, nowMs: Long, offsetMs: Long): Int? {
        if (weekStartMs <= 0L) return null
        val d = Math.floorDiv(nowMs + offsetMs, 86_400_000L) - Math.floorDiv(weekStartMs + offsetMs, 86_400_000L)
        return if (d in 0..6) d.toInt() else null
    }

    /** 0..100, never more (a goal passed shows a full bar), 0 when there is no goal. */
    fun percent(done: Long, goal: Long): Int = if (goal <= 0 || done <= 0) 0 else minOf(100L, done * 100 / goal).toInt()

    /** Digits grouped with a comma: 12345 -> "12,345" (locale-neutral on purpose: it is a number on a widget). */
    fun grouped(n: Long): String = n.toString().reversed().chunked(3).joinToString(",").reversed()
}
