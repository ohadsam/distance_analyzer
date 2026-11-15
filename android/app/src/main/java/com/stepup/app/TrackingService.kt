package com.stepup.app

import android.annotation.SuppressLint
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat

/**
 * Foreground service that keeps recording GPS fixes while a workout runs and the screen is off. The page starts and stops it (NativeBridge) and
 * drains the fixes. It records nothing else, never uploads anything, and stops itself after 12 hours as a safety net and slows the GPS while the person stands still.
 */
class TrackingService : Service() {
    private var manager: LocationManager? = null
    private val handler = Handler(Looper.getMainLooper())
    private var thread: HandlerThread? = null // location callbacks and the file writes stay off the main thread
    private val listener = object : LocationListener {
        override fun onLocationChanged(location: Location) {
            Tracking.append(applicationContext, location)
            adapt(location)
        }
        @Deprecated("Deprecated in Java") override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
        override fun onProviderEnabled(provider: String) {}
        override fun onProviderDisabled(provider: String) {}
    }

    private var interval = TrackingMath.FAST_MS
    private var still = 0
    private var previous: Location? = null

    /** Slows the GPS while the person stands still and speeds it up again as soon as they move (saves battery; the page copes with any gap between fixes). */
    @SuppressLint("MissingPermission")
    private fun adapt(location: Location) {
        val p = previous; previous = location
        val speed = if (location.hasSpeed()) location.speed else if (p != null && location.time > p.time) p.distanceTo(location) / ((location.time - p.time) / 1000f) else 0f
        val (next, count) = TrackingMath.next(interval, still, speed); still = count
        if (next == interval) return
        interval = next
        try { manager?.requestLocationUpdates(LocationManager.GPS_PROVIDER, interval, 0f, this.listener, thread?.looper) } catch (_: RuntimeException) { /* the service is stopping */ }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    @SuppressLint("MissingPermission")
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val title = intent?.getStringExtra("title")?.take(60) ?: "StepUp"
        val text = intent?.getStringExtra("text")?.take(120) ?: ""
        val n = notification(title, text)
        // always become a foreground service first (a start request must be answered), then act on it
        if (Build.VERSION.SDK_INT >= 29) startForeground(ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION) else startForeground(ID, n)
        if (intent?.action == ACTION_STOP) { stopForeground(STOP_FOREGROUND_REMOVE); stopSelf(); return START_NOT_STICKY }
        if (!Tracking.running) {
            Tracking.running = true
            try {
                manager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
                val th = HandlerThread("stepup-track").also { it.start() }
                thread = th
                interval = TrackingMath.FAST_MS; still = 0; previous = null
                manager?.requestLocationUpdates(LocationManager.GPS_PROVIDER, interval, 0f, listener, th.looper)
            } catch (_: SecurityException) { stopSelf() } catch (_: RuntimeException) { stopSelf() }
            handler.postDelayed({ stopSelf() }, MAX_MS)
        }
        return START_NOT_STICKY
    }

    override fun onDestroy() {
        try { manager?.removeUpdates(listener) } catch (_: RuntimeException) { /* already gone */ }
        handler.removeCallbacksAndMessages(null)
        thread?.quitSafely(); thread = null
        Tracking.running = false
        super.onDestroy()
    }

    private fun notification(title: String, text: String): Notification {
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= 26) nm.createNotificationChannel(NotificationChannel(CHANNEL, "StepUp", NotificationManager.IMPORTANCE_LOW))
        val open = PendingIntent.getActivity(this, 0, Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP), PendingIntent.FLAG_IMMUTABLE)
        return NotificationCompat.Builder(this, CHANNEL).setSmallIcon(android.R.drawable.ic_menu_mylocation).setContentTitle(title).setContentText(text)
            .setOngoing(true).setOnlyAlertOnce(true).setContentIntent(open).setCategory(NotificationCompat.CATEGORY_SERVICE).build()
    }

    companion object {
        const val ACTION_STOP = "com.stepup.app.TRACK_STOP"
        const val ID = 4101
        const val CHANNEL = "tracking"
        const val MAX_MS = 12L * 60 * 60 * 1000
    }
}
