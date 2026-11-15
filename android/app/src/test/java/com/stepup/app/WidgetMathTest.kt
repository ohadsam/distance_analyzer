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
        val wk = WidgetMath.parse("""{"weekMin":[5000,-3,20],"weekToday":9,"weekLabels":["S","M","Tuesday"]}""")!!
        assertEquals(listOf(1000, 0, 20, 0, 0, 0, 0), wk.weekMin); assertEquals(6, wk.weekToday); assertEquals("Tue", wk.weekLabels[2]); assertEquals("", wk.weekLabels[6])
        assertEquals(List(7) { 0 }, bad.weekMin)
        assertEquals(1_700_000_000_000L, WidgetMath.parse("""{"weekStart":1700000000000,"weekDesc":"Sun 5 min"}""")!!.weekStart); assertEquals(0L, bad.weekStart)
        assertNull(WidgetMath.parse("not json"))
    }
    @Test fun percentIsBounded() { assertEquals(0, WidgetMath.percent(5, 0)); assertEquals(50, WidgetMath.percent(4000, 8000)); assertEquals(100, WidgetMath.percent(9000, 8000)); assertEquals(0, WidgetMath.percent(-3, 8000)) }
    @Test fun groupsDigits() { assertEquals("0", WidgetMath.grouped(0)); assertEquals("999", WidgetMath.grouped(999)); assertEquals("12,345", WidgetMath.grouped(12345)); assertEquals("1,234,567", WidgetMath.grouped(1234567)) }
    @Test fun todayIndexFollowsTheWeekAndExpires() {
        val day = 86_400_000L; val start = 20_000L * day // a day boundary in UTC
        assertEquals(0, WidgetMath.todayIndex(start, start + 5_000, 0)); assertEquals(3, WidgetMath.todayIndex(start, start + 3 * day + 1, 0)); assertEquals(6, WidgetMath.todayIndex(start, start + 6 * day + 86_000_000, 0))
        assertNull(WidgetMath.todayIndex(start, start + 7 * day, 0)); assertNull(WidgetMath.todayIndex(start, start - 1, 0)); assertNull(WidgetMath.todayIndex(0, start, 0))
        assertEquals(6, WidgetMath.todayIndex(start - 2 * 3_600_000L, start + 6 * day - 3_600_000L, 2 * 3_600_000L)) // local midnight is two hours before the UTC one
    }
}
