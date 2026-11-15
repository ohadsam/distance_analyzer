package com.stepup.app

import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class FixBufferTest {
    @Test fun roundTrip() {
        val f = FixBuffer.parse(FixBuffer.encode(32.123456, 34.8, 1_790_000_000_000L, 4.6f))!!
        assertArrayEquals(doubleArrayOf(32.123456, 34.8, 1_790_000_000_000.0, 5.0), f, 1e-6)
    }
    @Test fun rejectsGarbage() {
        for (bad in listOf("", "a,b,c,d", "1,2,3", "91,0,5,3", "0,181,5,3", "NaN,1,5,3", "1,1,0,3", "1,1,5,-1", "1,1,x,3")) assertNull(bad, FixBuffer.parse(bad))
    }
    @Test fun jsonSkipsBadLinesAndKeepsOrder() {
        val a = FixBuffer.encode(1.0, 2.0, 10, 3f); val b = FixBuffer.encode(1.5, 2.5, 20, 6f)
        assertEquals("[[1.000000,2.000000,10,3],[1.500000,2.500000,20,6]]", FixBuffer.toJson(listOf(a, "junk", b)))
        assertEquals("[]", FixBuffer.toJson(emptyList()))
    }
    @Test fun boundedToNewestLines() {
        val lines = (1..FixBuffer.MAX_LINES + 5).map { FixBuffer.encode(1.0, 2.0, it.toLong(), 3f) }
        val json = FixBuffer.toJson(lines)
        assertEquals(FixBuffer.MAX_LINES, json.split("],[").size)
        assertEquals(true, json.contains(",6,3]") && !json.contains(",5,3]"))
    }
}
