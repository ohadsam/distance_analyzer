package com.stepup.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class SplitTrackerTest {
    // 0.00001 degree of latitude is about 1.11 m: a fix every 2 s at 0.0000054 degrees = about 3 m/s
    private fun walk(tr: SplitTracker, seconds: Int, startT: Long = 1_000_000L): List<SplitTracker.Split> {
        val all = ArrayList<SplitTracker.Split>(); var lat = 32.0
        for (i in 0..seconds step 2) { all.addAll(tr.add(lat, 34.8, startT + i * 1000L, 5f)); lat += 0.0000054 }
        return all
    }
    @Test fun reportsEachKilometreOnceWithTheInterpolatedTime() {
        val tr = SplitTracker(); val s = walk(tr, 700)
        assertEquals(listOf(1, 2), s.map { it.km })
        assertTrue("first km near 330-340 s, got ${s[0].atMs}", s[0].atMs in 320_000L..350_000L)
        assertTrue(s[1].atMs > s[0].atMs * 19 / 10)
    }
    @Test fun ignoresBadFixesAndStandingStill() {
        val tr = SplitTracker(); tr.add(32.0, 34.8, 1000, 5f)
        assertEquals(emptyList<SplitTracker.Split>(), tr.add(32.001, 34.8, 2000, 80f)) // too inaccurate
        assertEquals(emptyList<SplitTracker.Split>(), tr.add(32.5, 34.8, 3000, 5f))    // teleport: faster than 12 m/s
        tr.add(32.0, 34.8, 4000, 5f); tr.add(32.0, 34.80001, 9000, 5f)                  // standing still
        assertEquals(0.0, tr.distM, 0.0001); assertEquals(0L, tr.movingMs)
        assertEquals(emptyList<SplitTracker.Split>(), tr.add(32.0, 34.8, 9000, 5f))    // same time twice
    }
    @Test fun resumeContinuesFromWhatThePageCounted() {
        val tr = SplitTracker(); tr.reset(1900.0, 600_000L)
        val s = walk(tr, 100)
        assertNotNull(s.firstOrNull()); assertEquals(2, s[0].km); assertTrue(s[0].atMs > 600_000L)
    }
    @Test fun templateIsFilled() {
        assertEquals("Kilometre 3: 5 minutes 12 seconds", SplitText.fill("Kilometre {n}: {min} minutes {sec} seconds", 3, 312_000L))
        assertEquals("קילומטר 10: 0 דקות ו-59 שניות", SplitText.fill("קילומטר {n}: {min} דקות ו-{sec} שניות", 10, 59_999L))
    }
    @Test fun configIsValidatedAndBounded() {
        assertNull(VoiceConfig.parse("nope"))
        val c = VoiceConfig.parse("""{"on":true,"lang":"xx","tpl":"a{n}\u0007b${"c".repeat(300)}","dist":12.5,"moving":-5}""")!!
        assertEquals("en", c.lang); assertTrue(c.on); assertEquals(120, c.template.length); assertEquals(' ', c.template[4]); assertEquals(12.5, c.distM, 0.0001)
        assertEquals("he", VoiceConfig.parse("""{"lang":"he"}""")!!.lang)
        assertEquals(false, VoiceConfig.parse("{}")!!.on); assertEquals(0.0, VoiceConfig.parse("{}")!!.distM, 0.0)
        val tr = SplitTracker(); tr.reset(-5.0, -3L); assertEquals(0.0, tr.distM, 0.0); assertEquals(0L, tr.movingMs)
    }
}
