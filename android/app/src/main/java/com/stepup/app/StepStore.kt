package com.stepup.app

import android.Manifest
import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/** All-day steps from the phone's step counter: the readings are folded into per-day totals (StepMath) and kept in app-private storage. */
object StepStore {
    private const val PREFS = "steps"
    private const val KEEP_DAYS = 45

    fun available(ctx: Context): Boolean {
        val sm = ctx.getSystemService(Context.SENSOR_SERVICE) as SensorManager
        if (sm.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) == null) return false
        return Build.VERSION.SDK_INT < 29 || ctx.checkSelfPermission(Manifest.permission.ACTIVITY_RECOGNITION) == PackageManager.PERMISSION_GRANTED
    }

    private fun today(): String = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())

    @Synchronized fun record(ctx: Context, raw: Long) {
        val p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val boot = System.currentTimeMillis() - SystemClock.elapsedRealtime()
        val s = StepMath.apply(StepMath.State(p.getLong("lastRaw", -1), p.getString("day", "") ?: "", p.getLong("steps", 0), p.getLong("boot", 0)), raw, today(), boot)
        val days = try { JSONObject(p.getString("days", "{}") ?: "{}") } catch (_: Exception) { JSONObject() }
        days.put(s.day, s.steps)
        val keys = days.keys().asSequence().toList().sorted()
        for (k in keys.dropLast(KEEP_DAYS)) days.remove(k)
        p.edit().putLong("lastRaw", s.lastRaw).putString("day", s.day).putLong("steps", s.steps).putLong("boot", s.boot).putString("days", days.toString()).apply()
        Widgets.updateAll(ctx, StepsWidget::class.java) // only the steps widget follows a new reading
    }

    /** Steps counted today so far (0 when there is no reading yet). */
    fun today(ctx: Context): Long { val p = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE); return if (p.getString("day", "") == today()) p.getLong("steps", 0) else 0 }

    fun days(ctx: Context): String = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("days", "{}") ?: "{}"

    /** Reads the sensor once (it may report only on change, so wait up to 4 s) and records it. [done] runs on the main thread when finished. */
    fun sample(ctx: Context, done: () -> Unit = {}) {
        val app = ctx.applicationContext
        val sm = app.getSystemService(Context.SENSOR_SERVICE) as SensorManager
        val sensor = sm.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)
        if (sensor == null || !available(app)) { done(); return }
        val handler = Handler(Looper.getMainLooper())
        var finished = false
        lateinit var listener: SensorEventListener
        fun finish() { if (finished) return; finished = true; sm.unregisterListener(listener); handler.removeCallbacksAndMessages(null); done() }
        listener = object : SensorEventListener {
            override fun onSensorChanged(e: SensorEvent) { if (e.values.isNotEmpty()) record(app, e.values[0].toLong()); finish() }
            override fun onAccuracyChanged(s: Sensor?, accuracy: Int) {}
        }
        sm.registerListener(listener, sensor, SensorManager.SENSOR_DELAY_NORMAL, 0, handler) // no batching delay
        sm.flush(listener) // ask for the latest value now (the counter otherwise reports only when it changes)
        handler.postDelayed({ finish() }, 4000)
    }

    /** A sample about every 15 minutes while the phone is on (inexact non-waking alarm: no extra permission; it fires as soon as the phone wakes). Re-armed after a reboot or an update by BootReceiver, and when a steps widget is added. */
    fun arm(ctx: Context) {
        if (!available(ctx)) { disarm(ctx); return } // no sensor or no permission: no alarm
        val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val pi = PendingIntent.getBroadcast(ctx, 11, Intent(ctx, StepReceiver::class.java).setAction(StepReceiver.ACTION), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        am.setInexactRepeating(AlarmManager.RTC, System.currentTimeMillis() + 60_000, AlarmManager.INTERVAL_FIFTEEN_MINUTES, pi)
    }

    fun disarm(ctx: Context) {
        val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        am.cancel(PendingIntent.getBroadcast(ctx, 11, Intent(ctx, StepReceiver::class.java).setAction(StepReceiver.ACTION), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT))
    }
}

/** Fires about every 15 minutes: takes one step reading, then lets the system go back to sleep. */
class StepReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != ACTION) return
        if (!StepStore.available(context)) { StepStore.disarm(context); return } // the permission was revoked
        val pending = goAsync()
        StepStore.sample(context) { pending.finish() }
    }
    companion object { const val ACTION = "com.stepup.app.STEP_SAMPLE" }
}
