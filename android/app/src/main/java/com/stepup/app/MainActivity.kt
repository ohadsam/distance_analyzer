package com.stepup.app

import android.Manifest
import android.annotation.SuppressLint
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.view.WindowManager
import android.webkit.GeolocationPermissions
import android.webkit.WebChromeClient
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.webkit.WebViewAssetLoader
import org.json.JSONObject

/**
 * Hosts the web app. The UI is the same code the PWA runs; it is served from the APK's assets on a virtual https origin
 * (so IndexedDB, CSP and secure-context APIs behave exactly like on GitHub Pages) and nothing else is ever loaded in this WebView.
 */
class MainActivity : ComponentActivity() {
    private lateinit var web: WebView
    private var geoPending: Pair<String, GeolocationPermissions.Callback>? = null

    // The page asks for the location (workout tracking): only our own origin may, and Android's runtime permission is asked first.
    private val locationPermission = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { res ->
        val ok = res[Manifest.permission.ACCESS_FINE_LOCATION] == true || res[Manifest.permission.ACCESS_COARSE_LOCATION] == true
        geoPending?.let { (origin, cb) -> cb.invoke(origin, ok, false) }; geoPending = null
    }
    // Backup files: the system file dialogs (no storage permission needed). The JSON travels through these two fields, never through a path the page controls.
    private var pendingBackup = ""
    @Volatile private var pickedBackup = ""
    private val saveBackupFile = registerForActivityResult(ActivityResultContracts.CreateDocument("application/json")) { uri ->
        val data = pendingBackup; pendingBackup = ""
        // an empty field means this Activity was recreated while the dialog was open: never write (or claim) an empty file
        val ok = uri != null && data.isNotEmpty() && runCatching { contentResolver.openOutputStream(uri)!!.use { it.write(data.toByteArray(Charsets.UTF_8)) } }.isSuccess
        deliver(JSONObject().put("type", "backup-saved").put("ok", ok))
    }
    private val pickBackupFile = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri == null) deliver(JSONObject().put("type", "backup-picked").put("ok", false).put("reason", "cancel"))
        else Thread { // the read can be slow (a cloud-backed file): never on the UI thread
            val read = runCatching { contentResolver.openInputStream(uri)!!.use { s -> BackupMath.readLimited(s) } }
            pickedBackup = read.getOrNull() ?: ""
            val reason = if (read.isFailure) "error" else if (read.getOrNull() == null) "size" else if (pickedBackup.isEmpty()) "empty" else ""
            deliver(JSONObject().put("type", "backup-picked").put("ok", pickedBackup.isNotEmpty()).put("reason", reason))
        }.start()
    }
    fun startBackupSave(name: String, json: String) = runOnUiThread { pendingBackup = json; saveBackupFile.launch(BackupMath.safeName(name)) }
    fun startBackupPick() = runOnUiThread { pickBackupFile.launch(arrayOf("application/json", "text/plain")) }
    fun takeBackup(): String { val s = pickedBackup; pickedBackup = ""; return s }

    // The victory photo: the camera app writes to our cache through a FileProvider; we shrink it (rotation fixed) and hand the page a small JPEG.
    private var photoFile: java.io.File? = null
    @Volatile private var takenPhoto = ""
    private class FrontCamera : ActivityResultContracts.TakePicture() {
        override fun createIntent(context: android.content.Context, input: Uri): Intent =
            super.createIntent(context, input).putExtra("android.intent.extras.CAMERA_FACING", 1).putExtra("android.intent.extra.USE_FRONT_CAMERA", true)
    }
    private val takePictureFile = registerForActivityResult(FrontCamera()) { ok ->
        val f = photoFile; photoFile = null
        if (!ok || f == null) deliver(JSONObject().put("type", "photo-taken").put("ok", false))
        else Thread {
            takenPhoto = runCatching { shrinkPhoto(f) }.getOrDefault(""); f.delete()
            deliver(JSONObject().put("type", "photo-taken").put("ok", takenPhoto.isNotEmpty()))
        }.start()
    }
    private fun shrinkPhoto(f: java.io.File): String {
        val bounds = android.graphics.BitmapFactory.Options().apply { inJustDecodeBounds = true }
        android.graphics.BitmapFactory.decodeFile(f.absolutePath, bounds)
        val opts = android.graphics.BitmapFactory.Options().apply { inSampleSize = PhotoMath.sampleSize(bounds.outWidth, bounds.outHeight) }
        var bmp = android.graphics.BitmapFactory.decodeFile(f.absolutePath, opts) ?: return ""
        val (w, h) = PhotoMath.fitted(bmp.width, bmp.height)
        if (w != bmp.width) bmp = android.graphics.Bitmap.createScaledBitmap(bmp, w, h, true)
        val turn = when (android.media.ExifInterface(f.absolutePath).getAttributeInt(android.media.ExifInterface.TAG_ORIENTATION, 1)) { 6 -> 90f; 3 -> 180f; 8 -> 270f; else -> 0f }
        if (turn != 0f) bmp = android.graphics.Bitmap.createBitmap(bmp, 0, 0, bmp.width, bmp.height, android.graphics.Matrix().apply { postRotate(turn) }, true)
        val out = java.io.ByteArrayOutputStream(); bmp.compress(android.graphics.Bitmap.CompressFormat.JPEG, 85, out)
        return "data:image/jpeg;base64," + android.util.Base64.encodeToString(out.toByteArray(), android.util.Base64.NO_WRAP)
    }
    fun startPhoto() = runOnUiThread {
        val ok = runCatching {
            val dir = java.io.File(cacheDir, "photos").apply { mkdirs() }; val f = java.io.File(dir, "selfie.jpg"); photoFile = f
            takePictureFile.launch(androidx.core.content.FileProvider.getUriForFile(this, "$packageName.files", f))
        }.isSuccess
        if (!ok) deliver(JSONObject().put("type", "photo-taken").put("ok", false))
    }
    fun takenPhoto(): String { val s = takenPhoto; takenPhoto = ""; return s }
    /** Shares the record card picture (PNG, base64 from the page) with the system share sheet. */
    fun shareImage(b64: String) = Thread {
        runCatching {
            val bytes = android.util.Base64.decode(b64, android.util.Base64.DEFAULT); if (bytes.size > 6_000_000) return@runCatching
            val dir = java.io.File(cacheDir, "share").apply { mkdirs() }; val f = java.io.File(dir, "stepup-record.png"); f.writeBytes(bytes)
            val uri = androidx.core.content.FileProvider.getUriForFile(this, "$packageName.files", f)
            val send = Intent(Intent.ACTION_SEND).setType("image/png").putExtra(Intent.EXTRA_STREAM, uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            send.clipData = android.content.ClipData.newRawUri("", uri)
            runOnUiThread { runCatching { startActivity(Intent.createChooser(send, null)) } }
        }
    }.start()

    // One launcher for the other runtime permissions the page asks for (location for background tracking, notifications, step counter).
    private val permissions = registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { }
    fun ask(vararg wanted: String) = runOnUiThread {
        val need = wanted.filter { checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED }
        if (need.isNotEmpty()) permissions.launch(need.toTypedArray())
    }

    // The in-app route a tapped notification asked for ("#/reco"); the page picks it up once.
    @Volatile private var pendingHref = ""
    fun takeHref(): String { val h = pendingHref; pendingHref = ""; return h }
    private fun readHref(i: Intent?) { val h = i?.getStringExtra("href") ?: return; if (Regex("^#/[A-Za-z0-9/_-]{0,60}$").matches(h)) pendingHref = h }
    private fun hasLocation() = checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
        checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED

    @SuppressLint("SetJavaScriptEnabled", "AddJavascriptInterface")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val loader = WebViewAssetLoader.Builder().setDomain(HOST).addPathHandler("/", WebViewAssetLoader.AssetsPathHandler(this)).build()

        web = WebView(this).also { setContentView(it) }
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        web.settings.apply {
            javaScriptEnabled = true; domStorageEnabled = true // IndexedDB needs DOM storage
            allowFileAccess = false; allowContentAccess = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            cacheMode = WebSettings.LOAD_DEFAULT
            setSupportMultipleWindows(false)
        }
        web.addJavascriptInterface(NativeBridge(this), "StepUpNative")
        web.webChromeClient = object : WebChromeClient() {
            override fun onGeolocationPermissionsShowPrompt(origin: String, callback: GeolocationPermissions.Callback) {
                runOnUiThread {
                    if (Uri.parse(origin).host != HOST) { callback.invoke(origin, false, false); return@runOnUiThread }
                    if (hasLocation()) callback.invoke(origin, true, false)
                    else if (geoPending != null) callback.invoke(origin, false, false) // a question is already open: do not stack a second one
                    else { geoPending = origin to callback; locationPermission.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION)) }
                }
            }
        }
        web.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? = loader.shouldInterceptRequest(request.url)

            // Only our own origin may load here. Anything else goes to the real browser.
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                if (request.url.host == HOST) return false
                if (request.url.scheme == "https" || request.url.scheme == "mailto") runCatching { startActivity(Intent(Intent.ACTION_VIEW, request.url)) }
                return true
            }

            override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean { recreate(); return true }
        }
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() { if (web.canGoBack()) web.goBack() else { isEnabled = false; onBackPressedDispatcher.onBackPressed() } }
        })
        readHref(intent)
        if (savedInstanceState == null) web.loadUrl("https://$HOST/index.html") else web.restoreState(savedInstanceState)
    }

    override fun onSaveInstanceState(outState: Bundle) { super.onSaveInstanceState(outState); web.saveState(outState) }
    override fun onNewIntent(intent: Intent) { super.onNewIntent(intent); setIntent(intent); readHref(intent); if (pendingHref.isNotEmpty()) deliver(JSONObject().put("type", "href")) } // the app is already in front: tell the page now
    override fun onResume() { super.onResume(); web.onResume() }
    override fun onPause() { web.onPause(); super.onPause() }
    override fun onDestroy() { web.destroy(); super.onDestroy() }

    /** Keeps the screen on during a workout (the web Wake Lock API is not reliable in every WebView). */
    fun setKeepAwake(on: Boolean) = runOnUiThread {
        if (on) window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON) else window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }

    /** Native -> JS event: the page listens with `onNativeEvent` (js/native.js). */
    fun deliver(event: JSONObject) {
        runOnUiThread { web.evaluateJavascript("dispatchEvent(new CustomEvent('stepup-native',{detail:${event}}))", null) }
    }

    companion object { const val HOST = "appassets.androidplatform.net" }
}
