package com.stepup.app

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class NotifyMathTest {
    private val now = 1_800_000_000_000L
    private fun item(id: String, at: Long, title: String = "T", href: String = "#/reco") = """{"id":"$id","at":$at,"title":"$title","body":"b","href":"$href"}"""

    @Test fun validatesAndSorts() {
        val json = "[" + listOf(item("b", now + 2000), item("a", now + 1000), item("bad id!", now + 10), item("old", now - NotifyMath.LATE_MS - 1), item("far", now + NotifyMath.HORIZON_MS + 1), item("e", now + 5, ""), item("a", now + 7)).joinToString(",") + "]"
        assertEquals(listOf("a", "b"), NotifyMath.parse(json, now).map { it.id })
    }
    @Test fun hrefMustBeAnInAppRoute() {
        val p = NotifyMath.parse("[" + item("x", now + 1, href = "https://evil.example") + "," + item("y", now + 2, href = "#/workout/walk") + "]", now)
        assertEquals(listOf("", "#/workout/walk"), p.map { it.href })
    }
    @Test fun garbageAndBounds() {
        assertEquals(emptyList<Planned>(), NotifyMath.parse("not json", now)); assertEquals(emptyList<Planned>(), NotifyMath.parse("{}", now))
        val many = "[" + (1..300).joinToString(",") { item("i$it", now + it) } + "]"
        assertEquals(NotifyMath.MAX, NotifyMath.parse(many, now).size)
        assertEquals(80, NotifyMath.parse("[" + item("t", now + 1, "x".repeat(500)) + "]", now)[0].title.length)
    }
    @Test fun dueNextRemaining() {
        val list = NotifyMath.parse("[" + item("past", now - 60_000) + "," + item("soon", now + 1000) + "," + item("later", now + 9000) + "]", now)
        assertEquals(listOf("past"), NotifyMath.due(list, now).map { it.id }); assertEquals("soon", NotifyMath.next(list, now)?.id)
        assertEquals(listOf("soon", "later"), NotifyMath.remaining(list, now).map { it.id }); assertNull(NotifyMath.next(emptyList(), now))
    }
    @Test fun roundTrip() { val l = NotifyMath.parse("[" + item("a", now + 1) + "]", now); assertEquals(l, NotifyMath.parse(NotifyMath.toJson(l), now)) }
}
