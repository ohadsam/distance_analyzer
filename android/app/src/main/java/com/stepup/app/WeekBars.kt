package com.stepup.app

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF

/** Draws the week's seven bars (device-tested only: no JVM test, the numbers it uses are bounded in WidgetMath). */
object WeekBars {
    private const val W = 560
    private const val H = 190

    fun draw(ctx: Context, mins: List<Int>, today: Int, labels: List<String>): Bitmap {
        val bmp = Bitmap.createBitmap(W, H, Bitmap.Config.ARGB_8888)
        val c = Canvas(bmp)
        val accent = ctx.getColor(R.color.widget_accent); val muted = ctx.getColor(R.color.widget_muted)
        val bar = Paint(Paint.ANTI_ALIAS_FLAG); val text = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = muted; textSize = 30f; textAlign = Paint.Align.CENTER }
        val top = 8f; val base = H - 40f; val slot = W / 7f; val bw = slot * 0.56f
        val max = maxOf(30, mins.maxOrNull() ?: 0).toFloat()
        for (i in 0 until 7) {
            val h = if (mins[i] <= 0) 6f else maxOf(10f, (mins[i] / max) * (base - top))
            val x = i * slot + (slot - bw) / 2f
            bar.color = if (i == today) accent else (accent and 0x00FFFFFF) or 0x66000000
            c.drawRoundRect(RectF(x, base - h, x + bw, base), 12f, 12f, bar)
            text.isFakeBoldText = i == today; text.color = if (i == today) accent else muted
            c.drawText(labels.getOrElse(i) { "" }, x + bw / 2f, H - 8f, text)
        }
        return bmp
    }
}
