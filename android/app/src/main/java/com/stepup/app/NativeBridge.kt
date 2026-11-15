package com.stepup.app

import android.Manifest
import android.content.Context
import android.content.Intent
import android.os.Build
import android.webkit.JavascriptInterface
import androidx.core.content.ContextCompat

/**
 * The only door from the web app into Android. Exposed to JavaScript as `StepUpNative`.
 * The WebView only ever loads the bundled app origin (see MainActivity), and every argument is validated here (BridgeLimits, NotifyMath, FixBuffer).
 */
class NativeBridge(private val activity: MainActivity) {
    private val ctx: Context = activity.applicationContext

    @JavascriptInterface fun appVersion(): String = BuildConfig.VERSION_NAME

    /** Boolean only: nothing from the page is trusted beyond this one flag. */
    @JavascriptInterface fun keepAwake(on: Boolean) { activity.setKeepAwake(on) }

    // ---- background tracking: a foreground service records GPS fixes while the screen is off; the page drains them ----
    @JavascriptInterface fun trackAvailable(): Boolean = true

    /** Starts the service when the location permission is granted (and asks for it otherwise: false, the page tries again). Title/text are shown in its notification. */
    @JavascriptInterface fun trackStart(title: String, text: String): Boolean {
        val granted = ctx.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == android.content.pm.PackageManager.PERMISSION_GRANTED
        if (!granted) { activity.ask(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION, *notificationPermission()); return false }
        if (!BridgeLimits.within(title, 60) || !BridgeLimits.within(text, 120)) return false
        if (!Tracking.running && !Tracking.requested) { Tracking.clear(ctx); Tracking.requested = true; ContextCompat.startForegroundService(ctx, Intent(ctx, TrackingService::class.java).putExtra("title", title).putExtra("text", text)) }
        return true
    }
    /** Stops through the service itself (it answers its start request first), so a quick pause right after the start cannot crash it. The buffer is kept: the page drains it. */
    @JavascriptInterface fun trackStop() { if (!Tracking.requested) return; Tracking.requested = false; ContextCompat.startForegroundService(ctx, Intent(ctx, TrackingService::class.java).setAction(TrackingService.ACTION_STOP)) }
    @JavascriptInterface fun trackDrain(): String = Tracking.drain(ctx)

    /** Android's share sheet with a short plain text (validated; nothing else can be shared from the page). */
    @JavascriptInterface fun share(text: String): Boolean {
        if (text.isBlank() || !BridgeLimits.within(text, 600)) return false
        activity.runOnUiThread { runCatching { activity.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text), null)) } }
        return true
    }

    // ---- backup files (system file dialogs) ----
    @JavascriptInterface fun saveBackup(json: String, name: String): Boolean {
        if (json.isBlank() || !BridgeLimits.within(json, BackupMath.MAX_BYTES) || !BridgeLimits.within(name, 80)) return false
        activity.startBackupSave(name, json); return true
    }
    @JavascriptInterface fun pickBackup(): Boolean { activity.startBackupPick(); return true }
    @JavascriptInterface fun takeBackup(): String = activity.takeBackup()

    // ---- all-day steps from the step counter ----
    @JavascriptInterface fun stepsAvailable(): Boolean = StepStore.available(ctx)
    @JavascriptInterface fun stepsSample() { activity.runOnUiThread { if (StepStore.available(ctx)) { StepStore.arm(ctx); StepStore.sample(ctx) } } }
    @JavascriptInterface fun stepsDays(): String = StepStore.days(ctx)
    @JavascriptInterface fun requestActivity() { if (Build.VERSION.SDK_INT >= 29) activity.ask(Manifest.permission.ACTIVITY_RECOGNITION); StepStore.arm(ctx) }

    /** Goals and texts for the home-screen widgets (validated in WidgetMath). */
    @JavascriptInterface fun setWidgetData(json: String) { if (BridgeLimits.within(json, 6000)) Widgets.save(ctx, json) }

    // ---- notifications that fire while the app is closed ----
    @JavascriptInterface fun notificationsAllowed(): Boolean = NotifyStore.allowed(ctx)
    @JavascriptInterface fun requestNotifications() { activity.ask(*notificationPermission()) }
    @JavascriptInterface fun setNotifications(json: String) { if (BridgeLimits.within(json, 60_000)) NotifyStore.replace(ctx, json) }
    /** The in-app route a tapped notification asked for (once). */
    @JavascriptInterface fun takePendingHref(): String = activity.takeHref()

    private fun notificationPermission(): Array<String> = if (Build.VERSION.SDK_INT >= 33) arrayOf(Manifest.permission.POST_NOTIFICATIONS) else emptyArray()
}
