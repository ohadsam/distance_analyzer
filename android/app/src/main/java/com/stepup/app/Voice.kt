package com.stepup.app

import android.content.Context
import android.location.Location
import android.speech.tts.TextToSpeech
import java.util.Locale

/** Speaks the kilometre times from the background service while the screen is off (the page speaks them while it is on). Opt-in: the page switches it on. */
object Voice {
    @Volatile var foreground = true
    @Volatile private var cfg = VoiceConfig(false, "en", "", 0.0, 0L)
    private val tracker = SplitTracker()
    @Volatile private var engine: Engine? = null
    private var failedAt = 0L

    /** One speech engine with its own "ready" flag (a stale callback of an old engine can never mark a new one ready). */
    private class Engine(ctx: Context, private val lang: String) {
        @Volatile var ready = false
        @Volatile var failed = false
        private var tts: TextToSpeech? = null
        init {
            tts = TextToSpeech(ctx.applicationContext) { status ->
                if (status == TextToSpeech.SUCCESS) { tts?.language = Locale(lang); ready = true } else failed = true
            }
        }
        fun speak(text: String, lang: String) { val t = tts ?: return; if (!ready) return; t.language = Locale(lang); t.speak(text, TextToSpeech.QUEUE_ADD, null, "split") }
        fun shutdown() { ready = false; tts?.stop(); tts?.shutdown(); tts = null }
    }

    /** Called when the page sets the voice up (tracking starts or the switch changes). Starts the engine at once so the first kilometre can already be spoken. */
    @Synchronized fun config(ctx: Context, json: String) {
        val c = VoiceConfig.parse(json) ?: return
        cfg = c; synchronized(tracker) { tracker.reset(c.distM, c.movingMs) }
        if (c.on) ensureEngine(ctx, c.lang) else { engine?.shutdown(); engine = null }
    }

    private fun ensureEngine(ctx: Context, lang: String) {
        val e = engine
        if (e != null && !e.failed) return
        if (e != null) { e.shutdown(); engine = null; if (System.currentTimeMillis() - failedAt < 60_000) return } // a failed start is retried at most once a minute
        failedAt = System.currentTimeMillis()
        engine = Engine(ctx, lang)
    }

    /** Called for every recorded fix (always: the count must stay right while the screen is on). */
    fun onFix(ctx: Context, l: Location) {
        val splits = synchronized(tracker) { tracker.add(l.latitude, l.longitude, l.time, if (l.hasAccuracy()) l.accuracy else 50f) }
        val c = cfg
        if (!c.on || foreground || c.template.isEmpty() || splits.isEmpty()) return
        ensureEngine(ctx, c.lang)
        val e = engine ?: return
        for (s in splits) e.speak(SplitText.fill(c.template, s.km, s.atMs), c.lang)
    }

    @Synchronized fun shutdown() { engine?.shutdown(); engine = null }
}
