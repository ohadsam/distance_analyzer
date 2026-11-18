package com.stepup.app

/** Pure rules about runtime permissions as the page shows them (no Android types, so it is JVM-tested). */
object PermMath {
    const val GRANTED = "granted"
    const val ASK = "ask"
    const val BLOCKED = "blocked"
    /** What the page may ask for by name. */
    val NAMES = setOf("location", "notifications", "activity", "battery", "install")

    fun known(name: String?): Boolean = name != null && name in NAMES

    /**
     * granted -> granted. Denied before and Android will not show its dialog again (no rationale to show) -> blocked: only the phone's settings can allow it.
     * Never asked, or asked once and the system still offers the dialog -> ask.
     */
    fun state(granted: Boolean, askedBefore: Boolean, rationale: Boolean): String =
        if (granted) GRANTED else if (askedBefore && !rationale) BLOCKED else ASK
}
