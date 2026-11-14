# The web bridge is called by name from JavaScript.
-keepclassmembers class com.stepup.app.NativeBridge {
    @android.webkit.JavascriptInterface <methods>;
}
-keepattributes *Annotation*
