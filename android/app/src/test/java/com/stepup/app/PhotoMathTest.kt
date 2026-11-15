package com.stepup.app

import org.junit.Assert.assertEquals
import org.junit.Test

class PhotoMathTest {
    @Test fun sampleSizeShrinksByPowersOfTwoButKeepsEnoughPixels() {
        assertEquals(1, PhotoMath.sampleSize(800, 600)); assertEquals(1, PhotoMath.sampleSize(1500, 1000)); assertEquals(2, PhotoMath.sampleSize(4000, 3000)); assertEquals(4, PhotoMath.sampleSize(8000, 6000))
    }
    @Test fun fittedKeepsAspectAndNeverEnlarges() {
        assertEquals(1080 to 810, PhotoMath.fitted(4000, 3000)); assertEquals(810 to 1080, PhotoMath.fitted(3000, 4000)); assertEquals(640 to 480, PhotoMath.fitted(640, 480)); assertEquals(1 to 1, PhotoMath.fitted(0, 0))
    }
}
