package com.stepup.app

import org.junit.Assert.assertEquals
import org.junit.Test

class StepMathTest {
    private val fresh = StepMath.State(-1, "", 0)
    @Test fun firstReadingIsOnlyABaseline() { val s = StepMath.apply(fresh, 5000, "2026-11-15"); assertEquals(0L, s.steps); assertEquals(5000L, s.lastRaw) }
    @Test fun progressAddsUp() {
        var s = StepMath.apply(fresh, 5000, "2026-11-15"); s = StepMath.apply(s, 5400, "2026-11-15"); s = StepMath.apply(s, 6000, "2026-11-15")
        assertEquals(1000L, s.steps)
    }
    @Test fun rebootRestartsTheCounter() {
        var s = StepMath.apply(fresh, 9000, "2026-11-15"); s = StepMath.apply(s, 9500, "2026-11-15"); s = StepMath.apply(s, 120, "2026-11-15")
        assertEquals(620L, s.steps)
    }
    @Test fun newDayStartsANewTotal() {
        var s = StepMath.apply(fresh, 1000, "2026-11-15"); s = StepMath.apply(s, 3000, "2026-11-15"); s = StepMath.apply(s, 3300, "2026-11-16")
        assertEquals("2026-11-16", s.day); assertEquals(300L, s.steps)
    }
    @Test fun ignoresInvalidReadings() { val s = StepMath.apply(fresh, 100, "d"); assertEquals(s, StepMath.apply(s, -5, "d")) }
}
