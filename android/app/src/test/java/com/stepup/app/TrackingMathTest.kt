package com.stepup.app

import org.junit.Assert.assertEquals
import org.junit.Test

class TrackingMathTest {
    @Test fun slowsDownAfterAWhileOfStandingStillAndRecoversOnMovement() {
        var interval = TrackingMath.FAST_MS; var count = 0
        repeat(TrackingMath.STILL_FIXES - 1) { val (i, c) = TrackingMath.next(interval, count, 0.1f); interval = i; count = c }
        assertEquals(TrackingMath.FAST_MS, interval)
        val (slow, c2) = TrackingMath.next(interval, count, 0.0f); assertEquals(TrackingMath.SLOW_MS, slow); assertEquals(TrackingMath.STILL_FIXES, c2)
        val (back, c3) = TrackingMath.next(slow, c2, 1.5f); assertEquals(TrackingMath.FAST_MS, back); assertEquals(0, c3)
    }
    @Test fun aSlowWalkDoesNotCountAsStandingStill() {
        var interval = TrackingMath.FAST_MS; var count = 0
        repeat(50) { val (i, c) = TrackingMath.next(interval, count, 0.6f); interval = i; count = c } // between 0.4 and 0.8 m/s: neither still nor clearly moving
        assertEquals(TrackingMath.FAST_MS, interval); assertEquals(0, count)
    }
}
