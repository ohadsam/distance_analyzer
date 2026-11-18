package com.stepup.app

import android.annotation.SuppressLint
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInfo
import android.content.pm.PackageInstaller
import android.content.pm.PackageManager
import android.content.pm.Signature
import android.os.Build
import androidx.core.content.pm.PackageInfoCompat
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

/**
 * In-app update: downloads the release APK from this project's GitHub release, checks its SHA-256 against the published .sha256 file and that it is this
 * app (same package, same signing key, a higher version code), then hands it to Android's installer as an UPDATE of the installed app (data stays).
 * Progress and the outcome reach the page as `{type: "update", state, pct, reason}` events. The page may only start it with an address UpdateMath accepts.
 */
object Updater {
    @Volatile var running = false
    @Volatile var sink: ((JSONObject) -> Unit)? = null
    private class Fail(val reason: String) : Exception(reason)

    fun report(state: String, pct: Int = -1, reason: String = "") { sink?.invoke(JSONObject().put("type", "update").put("state", state).put("pct", pct).put("reason", reason)) }

    fun start(ctx: Context, url: String) {
        if (running) return
        running = true
        Thread {
            try { perform(ctx, url) }
            catch (e: Fail) { report("error", reason = e.reason) }
            catch (e: Exception) { report("error", reason = "failed") }
            finally { running = false }
        }.start()
    }

    private fun open(url: String): HttpURLConnection = (URL(url).openConnection() as HttpURLConnection).apply {
        connectTimeout = 15_000; readTimeout = 30_000; instanceFollowRedirects = true; setRequestProperty("User-Agent", "StepUp-updater")
    }

    @Suppress("DEPRECATION")
    private fun signers(info: PackageInfo): Set<Signature> =
        (if (Build.VERSION.SDK_INT >= 28) info.signingInfo?.apkContentsSigners else info.signatures)?.toSet() ?: emptySet()

    @SuppressLint("InlinedApi")
    private fun perform(ctx: Context, url: String) {
        if (!UpdateMath.validUrl(url)) throw Fail("url")
        val pm = ctx.packageManager
        if (!pm.canRequestPackageInstalls()) { report("need-permission"); return }
        val want = UpdateMath.parseSha256(readSmall(UpdateMath.checksumUrl(url))) ?: throw Fail("checksum") // the published checksum first: no checksum, no download
        report("downloading", 0)
        val dir = File(ctx.cacheDir, "updates").apply { mkdirs(); listFiles()?.forEach { it.delete() } }
        val apk = File(dir, "stepup-update.apk"); val md = MessageDigest.getInstance("SHA-256")
        val c = open(url)
        try {
            if (c.responseCode != 200) throw Fail("http")
            val total = c.contentLengthLong
            if (total > UpdateMath.MAX_BYTES) throw Fail("size")
            c.inputStream.use { input -> apk.outputStream().use { out ->
                val buf = ByteArray(64 * 1024); var done = 0L; var last = -1
                while (true) {
                    val n = input.read(buf); if (n < 0) break
                    done += n; if (done > UpdateMath.MAX_BYTES) throw Fail("size")
                    md.update(buf, 0, n); out.write(buf, 0, n)
                    val p = UpdateMath.percent(done, total); if (p >= 0 && p != last && p % 4 == 0) { last = p; report("downloading", p) }
                }
            } }
        } finally { c.disconnect() }

        report("verifying")
        if (!UpdateMath.toHex(md.digest()).equals(want, ignoreCase = true)) throw Fail("checksum")
        @Suppress("DEPRECATION") val flags = if (Build.VERSION.SDK_INT >= 28) PackageManager.GET_SIGNING_CERTIFICATES else PackageManager.GET_SIGNATURES
        val info = pm.getPackageArchiveInfo(apk.absolutePath, flags) ?: throw Fail("invalid")
        if (info.packageName != ctx.packageName) throw Fail("package")
        val mine = pm.getPackageInfo(ctx.packageName, flags)
        if (PackageInfoCompat.getLongVersionCode(info) <= PackageInfoCompat.getLongVersionCode(mine)) throw Fail("same")
        if (signers(info).isEmpty() || signers(info) != signers(mine)) throw Fail("signature")

        report("installing")
        val installer = pm.packageInstaller
        val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL).apply {
            setAppPackageName(ctx.packageName)
            if (Build.VERSION.SDK_INT >= 31) setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED)
        }
        val id = installer.createSession(params)
        installer.openSession(id).use { session ->
            apk.inputStream().use { input -> session.openWrite("stepup.apk", 0, apk.length()).use { out -> input.copyTo(out); session.fsync(out) } }
            val result = PendingIntent.getBroadcast(ctx, id, Intent(ctx, InstallReceiver::class.java).setPackage(ctx.packageName), PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE)
            session.commit(result.intentSender)
        }
    }

    /** A small text file (the checksum), at most 2 KB. */
    private fun readSmall(url: String): String {
        val c = open(url)
        try {
            if (c.responseCode != 200) throw Fail("checksum")
            val buf = ByteArray(2048); var n = 0
            c.inputStream.use { s -> while (n < buf.size) { val r = s.read(buf, n, buf.size - n); if (r < 0) break; n += r } }
            return String(buf, 0, n, Charsets.UTF_8)
        } finally { c.disconnect() }
    }
}

/** The installer's answer: asks for the person's confirmation when Android wants it, and tells the page how it ended (on success the app restarts as the new version). */
class InstallReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        when (intent.getIntExtra(PackageInstaller.EXTRA_STATUS, -1)) {
            PackageInstaller.STATUS_PENDING_USER_ACTION -> {
                Updater.report("confirm")
                @Suppress("DEPRECATION") val ask: Intent? = if (Build.VERSION.SDK_INT >= 33) intent.getParcelableExtra(Intent.EXTRA_INTENT, Intent::class.java) else intent.getParcelableExtra(Intent.EXTRA_INTENT)
                ask?.let { runCatching { ctx.startActivity(it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) } }
            }
            PackageInstaller.STATUS_SUCCESS -> Updater.report("done")
            else -> Updater.report("error", reason = "install")
        }
    }
}
