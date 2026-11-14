package com.stepup.app

/** Pure size caps for anything arriving from the page (no Android types, so it is JVM-tested). */
object BridgeLimits {
    const val MAX_JSON = 200_000

    /** True when [s] is a non-null string within [max] characters. */
    fun within(s: String?, max: Int = MAX_JSON): Boolean = s != null && s.length <= max
}
