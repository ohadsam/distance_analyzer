package com.stepup.app

/** Pure sizing helpers for the victory photo (JVM-tested): camera pictures are huge, the card needs about 1000 px. */
object PhotoMath {
    const val MAX_SIDE = 1080

    /** Largest power-of-two shrink that keeps the longer side at or above [max] (BitmapFactory.inSampleSize). */
    fun sampleSize(w: Int, h: Int, max: Int = MAX_SIDE): Int {
        var s = 1; val longest = maxOf(w, h)
        while (longest / (s * 2) >= max) s *= 2
        return s
    }

    /** The size with the longer side at most [max] (never enlarged), aspect kept, at least 1 px. */
    fun fitted(w: Int, h: Int, max: Int = MAX_SIDE): Pair<Int, Int> {
        val longest = maxOf(w, h); if (longest <= max || longest <= 0) return maxOf(1, w) to maxOf(1, h)
        val f = max.toDouble() / longest
        return maxOf(1, Math.round(w * f).toInt()) to maxOf(1, Math.round(h * f).toInt())
    }
}
