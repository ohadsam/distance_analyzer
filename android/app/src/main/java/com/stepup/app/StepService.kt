package com.stepup.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat

/**
 * Counts steps all day. Since Android 9 an app in the background gets NO events from the step counter, so an alarm or a widget update can never read it:
 * the only dependable way is to keep one listener registered from a foreground service (type "health"), with a quiet minimal notification.
 * The sensor batches its readings in hardware (a long report latency), so this costs almost no battery; the newest value is folded into the day's total
 * (StepStore.record, which also redraws the steps widget) at most once every [FLUSH_MS]. The person can turn it off in Settings (StepStore.keepOn).
 */
class StepService : Service() {
    private val handler = Handler(Looper.getMainLooper())
    private var manager: SensorManager? = null
    private var latest = -1L
    private var queued = false
    private val flush = Runnable { queued = false; if (latest >= 0) StepStore.record(applicationContext, latest) }
    private val listener = object : SensorEventListener {
        override fun onSensorChanged(e: SensorEvent) {
            if (e.values.isEmpty()) return
            val first = latest < 0
            latest = e.values[0].toLong()
            if (first) StepStore.record(applicationContext, latest) // the first value is the baseline: show it at once
            else if (!queued) { queued = true; handler.postDelayed(flush, FLUSH_MS) }
        }
        override fun onAccuracyChanged(s: Sensor?, accuracy: Int) {}
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // a start request must be answered with startForeground first; without the steps permission the "health" type is refused, then we just stop
        try {
            val n = notification()
            if (Build.VERSION.SDK_INT >= 34) startForeground(ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_HEALTH) else startForeground(ID, n)
        } catch (_: RuntimeException) { stopSelf(); return START_NOT_STICKY }
        if (!StepStore.available(this) || !StepStore.keepOn(this)) { stopForeground(STOP_FOREGROUND_REMOVE); stopSelf(); return START_NOT_STICKY }
        if (manager == null) {
            val sm = getSystemService(Context.SENSOR_SERVICE) as SensorManager
            val sensor = sm.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)
            if (sensor == null) { stopForeground(STOP_FOREGROUND_REMOVE); stopSelf(); return START_NOT_STICKY }
            manager = sm
            sm.registerListener(listener, sensor, SensorManager.SENSOR_DELAY_NORMAL, LATENCY_US, handler)
        }
        return START_STICKY
    }

    override fun onDestroy() {
        manager?.unregisterListener(listener); manager = null
        handler.removeCallbacksAndMessages(null)
        if (queued && latest >= 0) StepStore.record(applicationContext, latest) // do not lose the last batch
        super.onDestroy()
    }

    private fun notification(): Notification {
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= 26) nm.createNotificationChannel(NotificationChannel(CHANNEL, getString(R.string.steps_channel), NotificationManager.IMPORTANCE_MIN))
        val open = PendingIntent.getActivity(this, 1, Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP), PendingIntent.FLAG_IMMUTABLE)
        return NotificationCompat.Builder(this, CHANNEL).setSmallIcon(android.R.drawable.ic_menu_mylocation).setContentTitle(getString(R.string.app_name)).setContentText(getString(R.string.steps_service_text))
            .setOngoing(true).setOnlyAlertOnce(true).setPriority(NotificationCompat.PRIORITY_MIN).setContentIntent(open).setCategory(NotificationCompat.CATEGORY_SERVICE).setShowWhen(false).build()
    }

    companion object {
        const val ID = 4102
        const val CHANNEL = "steps"
        const val FLUSH_MS = 60_000L
        const val LATENCY_US = 10 * 60 * 1_000_000 // the sensor may batch up to ten minutes of readings
    }
}
