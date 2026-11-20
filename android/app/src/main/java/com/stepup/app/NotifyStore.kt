package com.stepup.app

import android.Manifest
import android.annotation.SuppressLint
import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

/** Stores the notifications the web app planned and wakes the phone for the next one (inexact alarm that may fire in Doze; no exact-alarm permission). */
object NotifyStore {
    private const val PREFS = "notify"
    private const val CHANNEL = "reminders"

    fun allowed(ctx: Context): Boolean =
        (Build.VERSION.SDK_INT < 33 || ctx.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED) && NotificationManagerCompat.from(ctx).areNotificationsEnabled()

    fun load(ctx: Context): List<Planned> = NotifyMath.parse(ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("list", "[]") ?: "[]", System.currentTimeMillis())

    fun replace(ctx: Context, json: String) {
        if (json.length > 60_000) return
        val list = NotifyMath.parse(json, System.currentTimeMillis())
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("list", NotifyMath.toJson(list)).apply()
        arm(ctx, list)
    }

    private fun pending(ctx: Context): PendingIntent =
        PendingIntent.getBroadcast(ctx, 21, Intent(ctx, NotifyReceiver::class.java).setAction(NotifyReceiver.ACTION), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)

    /** (Re)arms the alarm for the earliest planned notification that is still ahead. */
    fun arm(ctx: Context, list: List<Planned> = load(ctx)) {
        val am = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        am.cancel(pending(ctx))
        val next = NotifyMath.next(list, System.currentTimeMillis()) ?: return
        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next.at, pending(ctx))
    }

    @SuppressLint("MissingPermission") // checked in allowed()
    fun fireDue(ctx: Context) {
        val now = System.currentTimeMillis()
        val list = load(ctx)
        if (allowed(ctx)) {
            val nm = ctx.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            if (Build.VERSION.SDK_INT >= 26) nm.createNotificationChannel(NotificationChannel(CHANNEL, "StepUp", NotificationManager.IMPORTANCE_DEFAULT))
            for (p in NotifyMath.due(list, now)) {
                val open = PendingIntent.getActivity(ctx, p.id.hashCode(), Intent(ctx, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_NEW_TASK).putExtra("href", p.href), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
                val n = NotificationCompat.Builder(ctx, CHANNEL).setSmallIcon(android.R.drawable.ic_menu_mylocation).setContentTitle(p.title).setContentText(p.body).setStyle(NotificationCompat.BigTextStyle().bigText(p.body)).setAutoCancel(true).setContentIntent(open).build()
                NotificationManagerCompat.from(ctx).notify(p.id.hashCode(), n)
            }
        }
        val rest = NotifyMath.remaining(list, now)
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("list", NotifyMath.toJson(rest)).apply()
        arm(ctx, rest)
    }
}

/** Wakes at the planned time: shows what is due and arms the next one. */
class NotifyReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) { if (intent.action == ACTION) NotifyStore.fireDue(context) }
    companion object { const val ACTION = "com.stepup.app.NOTIFY" }
}

/** Alarms do not survive a reboot or an app update: arm them again. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val pending = goAsync()
        NotifyStore.fireDue(context) // shows what came due while the phone was off, then arms the next one
        StepStore.arm(context)
        StepStore.ensureService(context) // boot / update: Android lets this start the steps service
        Widgets.updateAll(context) // the widgets are blank after a restart or an update until something redraws them
        StepStore.sample(context) { pending.finish() }
    }
}
