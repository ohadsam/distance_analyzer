package com.stepup.app

import android.content.Context
import android.location.Location
import java.io.File

/** Where the background service writes the GPS fixes and the page picks them up (drain = read everything and clear). */
object Tracking {
    @Volatile var running = false
    /** True from the moment the page asked for tracking until it asked to stop (the service may not be up yet). */
    @Volatile var requested = false
    private const val FILE = "fixes.txt"
    private const val MAX_BYTES = 2_000_000L
    private fun file(ctx: Context) = File(ctx.filesDir, FILE)

    @Synchronized fun append(ctx: Context, l: Location) {
        val f = file(ctx)
        if (f.length() > MAX_BYTES) f.delete() // a runaway buffer (the page never drained): start over rather than fill the phone
        f.appendText(FixBuffer.encode(l.latitude, l.longitude, l.time, if (l.hasAccuracy()) l.accuracy else 50f) + "\n")
    }

    @Synchronized fun drain(ctx: Context): String {
        val f = file(ctx)
        if (!f.exists()) return "[]"
        val lines = f.readLines()
        f.delete()
        return FixBuffer.toJson(lines)
    }

    @Synchronized fun clear(ctx: Context) { file(ctx).delete() }
}
