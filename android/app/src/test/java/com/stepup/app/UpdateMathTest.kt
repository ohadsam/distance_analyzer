package com.stepup.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class UpdateMathTest {
    private val base = "https://github.com/ohadsam/distance_analyzer/releases"
    @Test fun acceptsOnlyThisProjectsReleaseApk() {
        assertTrue(UpdateMath.validUrl("$base/latest/download/stepup.apk"))
        assertTrue(UpdateMath.validUrl("$base/download/build-129/stepup.apk"))
        assertFalse(UpdateMath.validUrl("$base/latest/download/other.apk"))
        assertFalse(UpdateMath.validUrl("http://github.com/ohadsam/distance_analyzer/releases/latest/download/stepup.apk"))
        assertFalse(UpdateMath.validUrl("https://github.com/someone/else/releases/latest/download/stepup.apk"))
        assertFalse(UpdateMath.validUrl("https://evil.example/ohadsam/distance_analyzer/releases/latest/download/stepup.apk"))
        assertFalse(UpdateMath.validUrl("$base/download/../../x/stepup.apk")); assertFalse(UpdateMath.validUrl("$base/latest/download/stepup.apk?x=1")); assertFalse(UpdateMath.validUrl(null))
    }
    @Test fun checksumFileIsNextToTheApk() { assertEquals("$base/latest/download/stepup.apk.sha256", UpdateMath.checksumUrl("$base/latest/download/stepup.apk")) }
    @Test fun parsesTheHashFromTheChecksumFile() {
        val h = "a".repeat(32) + "B".repeat(32)
        assertEquals(h.lowercase(), UpdateMath.parseSha256("$h  stepup.apk\n"))
        assertNull(UpdateMath.parseSha256("not a hash")); assertNull(UpdateMath.parseSha256("abc123")); assertNull(UpdateMath.parseSha256(null))
        assertNull(UpdateMath.parseSha256("f".repeat(63))); assertNull(UpdateMath.parseSha256("f".repeat(65)))
    }
    @Test fun hexIsLowerCaseTwoDigitsPerByte() { assertEquals("00ff10", UpdateMath.toHex(byteArrayOf(0, -1, 16))) }
    @Test fun percentIsClampedAndUnknownIsMinusOne() {
        assertEquals(50, UpdateMath.percent(50, 100)); assertEquals(100, UpdateMath.percent(200, 100)); assertEquals(0, UpdateMath.percent(0, 100)); assertEquals(-1, UpdateMath.percent(5, 0)); assertEquals(-1, UpdateMath.percent(5, -1))
    }
}
