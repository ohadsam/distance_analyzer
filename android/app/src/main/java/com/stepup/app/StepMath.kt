package com.stepup.app

/** Pure arithmetic of the all-day step count from the phone's cumulative step sensor (steps since boot). No Android types: JVM-tested. */
object StepMath {
    /** lastRaw = the previous sensor value (-1 = none yet), day = "YYYY-MM-DD" of [steps], steps = the day's total so far. */
    data class State(val lastRaw: Long, val day: String, val steps: Long)

    /**
     * Applies a new sensor reading taken on [day]. The first reading only sets the baseline (steps before it are unknown). A reading lower than
     * the previous one means the phone rebooted (the counter restarted), so the new value itself is the progress. Progress since the last reading
     * belongs to [day]; a reading on a new day starts that day's total.
     */
    fun apply(s: State, raw: Long, day: String): State {
        if (raw < 0) return s
        if (s.lastRaw < 0) return State(raw, day, if (s.day == day) s.steps else 0)
        val delta = if (raw >= s.lastRaw) raw - s.lastRaw else raw
        return State(raw, day, if (s.day == day) s.steps + delta else delta)
    }
}
