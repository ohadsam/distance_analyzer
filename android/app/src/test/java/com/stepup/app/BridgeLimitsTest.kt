package com.stepup.app

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class BridgeLimitsTest {
    @Test fun acceptsWithinLimit() { assertTrue(BridgeLimits.within("{}")); assertTrue(BridgeLimits.within("a".repeat(10), 10)) }
    @Test fun rejectsTooLongOrNull() { assertFalse(BridgeLimits.within("a".repeat(11), 10)); assertFalse(BridgeLimits.within(null)) }
}
