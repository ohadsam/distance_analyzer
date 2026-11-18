package com.stepup.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PermMathTest {
    @Test fun grantedWins() { assertEquals("granted", PermMath.state(true, true, false)); assertEquals("granted", PermMath.state(true, false, false)) }
    @Test fun neverAskedIsAsk() { assertEquals("ask", PermMath.state(false, false, false)) }
    @Test fun deniedOnceWithRationaleIsStillAsk() { assertEquals("ask", PermMath.state(false, true, true)) }
    @Test fun deniedAndNoRationaleIsBlocked() { assertEquals("blocked", PermMath.state(false, true, false)) }
    @Test fun onlyKnownNamesPass() { assertTrue(PermMath.known("location")); assertTrue(PermMath.known("install")); assertFalse(PermMath.known("camera")); assertFalse(PermMath.known("")); assertFalse(PermMath.known(null)) }
}
