package com.stepup.app

/**
 * Adaptive GPS rate (JVM-tested). Running or walking needs a fix every second; standing at a traffic light or resting does not, and the GPS chip is
 * the biggest battery cost of a workout. After [STILL_FIXES] slow fixes in a row the interval grows to [SLOW_MS]; the first fix that moves again
 * brings back [FAST_MS].
 */
object TrackingMath {
    const val FAST_MS = 1000L
    const val SLOW_MS = 4000L
    const val STILL_FIXES = 15
    const val STILL_MPS = 0.4f
    const val MOVING_MPS = 0.8f

    /** (interval for the next fixes, how many slow fixes in a row) after a fix at [speedMps]. */
    fun next(currentMs: Long, stillCount: Int, speedMps: Float): Pair<Long, Int> {
        if (speedMps >= MOVING_MPS) return FAST_MS to 0
        val still = if (speedMps < STILL_MPS) stillCount + 1 else stillCount
        return (if (still >= STILL_FIXES) SLOW_MS else currentMs) to still
    }
}
