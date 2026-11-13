package com.distanceanalyzer.app

import android.webkit.JavascriptInterface

/**
 * The only door from the web app into Android. Exposed to JavaScript as `DistanceNative`.
 * The WebView only ever loads the bundled app origin (see MainActivity), and every argument must be validated here
 * (use BridgeLimits for sizes) before it touches anything else.
 */
class NativeBridge {
    @JavascriptInterface fun appVersion(): String = BuildConfig.VERSION_NAME
}
