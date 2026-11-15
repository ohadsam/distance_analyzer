package com.stepup.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class WidgetMathTest {
    @Test fun parsesAndBounds() {
        val s = WidgetMath.parse("""{"stepsGoal":8000,"effortDone":120,"effortPlan":180,"kind":"run","stepsTitle":"Steps today","effortTitle":"Weekly effort","effortSub":"120 of 180 min","quickTitle":"Measure now","quickHint":"Run"}""")!!
        assertEquals(8000, s.stepsGoal); assertEquals("run", s.kind); assertEquals("Steps today", s.stepsTitle)
        val bad = WidgetMath.parse("""{"stepsGoal":-5,"effortDone":99999999,"kind":"swim","stepsTitle":"x${"y".repeat(100)}"}""")!!
        assertEquals(0, bad.stepsGoal); assertEquals(100_000, bad.effortDone); assertEquals("walk", bad.kind); assertEquals(40, bad.stepsTitle.length)
        assertEquals("", bad.lastValue)
        val full = WidgetMath.parse("""{"lastValue":"5.00 km","lastSub":"30:00 · 6:00 /km","nextValue":"Easy 30 min","nextSub":"Sun"}""")!!
        assertEquals("5.00 km", full.lastValue); assertEquals("Easy 30 min", full.nextValue)
        assertNull(WidgetMath.parse("not json"))
    }
    @Test fun percentIsBounded() { assertEquals(0, WidgetMath.percent(5, 0)); assertEquals(50, WidgetMath.percent(4000, 8000)); assertEquals(100, WidgetMath.percent(9000, 8000)); assertEquals(0, WidgetMath.percent(-3, 8000)) }
    @Test fun groupsDigits() { assertEquals("0", WidgetMath.grouped(0)); assertEquals("999", WidgetMath.grouped(999)); assertEquals("12,345", WidgetMath.grouped(12345)); assertEquals("1,234,567", WidgetMath.grouped(1234567)) }
}
