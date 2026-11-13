# The web bridge is called by name from JavaScript.
-keepclassmembers class com.distanceanalyzer.app.NativeBridge {
    @android.webkit.JavascriptInterface <methods>;
}
-keepattributes *Annotation*
