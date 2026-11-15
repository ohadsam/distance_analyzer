package com.stepup.app

import org.json.JSONObject

/** What the page tells the home-screen widgets: the goals and the already translated texts. Everything is bounded and validated (no Android types: JVM-tested). */
data class WidgetSnapshot(
    val stepsGoal: Int, val effortDone: Int, val effortPlan: Int, val kind: String,
    val stepsTitle: String, val effortTitle: String, val effortSub: String, val quickTitle: String, val quickHint: String,
    val lastTitle: String, val lastValue: String, val lastSub: String, val nextTitle: String, val nextValue: String, val nextSub: String,
)

object WidgetMath {
    private fun text(o: JSONObject, key: String, max: Int): String = o.optString(key).replace(Regex("[\\u0000-\\u001f]"), " ").trim().take(max)

    fun parse(json: String): WidgetSnapshot? {
        val o = try { JSONObject(json) } catch (_: Exception) { return null }
        val kind = if (o.optString("kind") == "run") "run" else "walk"
        return WidgetSnapshot(
            stepsGoal = o.optInt("stepsGoal", 0).coerceIn(0, 100_000), effortDone = o.optInt("effortDone", 0).coerceIn(0, 100_000), effortPlan = o.optInt("effortPlan", 0).coerceIn(0, 100_000), kind = kind,
            stepsTitle = text(o, "stepsTitle", 40), effortTitle = text(o, "effortTitle", 40), effortSub = text(o, "effortSub", 60), quickTitle = text(o, "quickTitle", 40), quickHint = text(o, "quickHint", 60),
            lastTitle = text(o, "lastTitle", 40), lastValue = text(o, "lastValue", 40), lastSub = text(o, "lastSub", 60), nextTitle = text(o, "nextTitle", 40), nextValue = text(o, "nextValue", 40), nextSub = text(o, "nextSub", 60),
        )
    }

    /** 0..100, never more (a goal passed shows a full bar), 0 when there is no goal. */
    fun percent(done: Long, goal: Long): Int = if (goal <= 0 || done <= 0) 0 else minOf(100L, done * 100 / goal).toInt()

    /** Digits grouped with a comma: 12345 -> "12,345" (locale-neutral on purpose: it is a number on a widget). */
    fun grouped(n: Long): String = n.toString().reversed().chunked(3).joinToString(",").reversed()
}
