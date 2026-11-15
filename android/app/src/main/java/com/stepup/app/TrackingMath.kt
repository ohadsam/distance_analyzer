package com.stepup.app

/**
 * Adaptive GPS rate (JVM-tested). Running or walking needs a fix every second; standing at a traffic light or resting does not, and the GPS chip is
 * the biggest battery cost of a workout. After [STILL_FIXES] slow fixes in a row the interval grows to [SLOW_MS]; the first fix at walking speed (at or above [STILL_MPS]) brings back [FAST_MS] and
 * starts the count again ("in a row": a single moving fix interrupts it).
 */
object TrackingMath {
    const val FAST_MS = 1000L
    const val SLOW_MS = 4000L
    const val STILL_FIXES = 15
    const val STILL_MPS = 0.4f

    /** (interval for the next fixes, how many slow fixes in a row) after a fix at [speedMps]. */
    fun next(currentMs: Long, stillCount: Int, speedMps: Float): Pair<Long, Int> {
        if (speedMps >= STILL_MPS) return FAST_MS to 0
        val still = stillCount + 1
        return (if (still >= STILL_FIXES) SLOW_MS else currentMs) to still
    }
}
