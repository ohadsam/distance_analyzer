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
    private var tts: TextToSpeech? = null
    @Volatile private var ready = false

    fun config(json: String) {
        val c = VoiceConfig.parse(json) ?: return
        cfg = c; synchronized(tracker) { tracker.reset(c.distM, c.movingMs) }
    }

    /** Called for every recorded fix (always: the count must stay right while the screen is on). */
    fun onFix(ctx: Context, l: Location) {
        val splits = synchronized(tracker) { tracker.add(l.latitude, l.longitude, l.time, if (l.hasAccuracy()) l.accuracy else 50f) }
        val c = cfg
        if (!c.on || foreground || c.template.isEmpty()) return
        for (s in splits) say(ctx, SplitText.fill(c.template, s.km, s.atMs), c.lang)
    }

    private fun say(ctx: Context, text: String, lang: String) {
        val engine = tts ?: TextToSpeech(ctx.applicationContext) { status ->
            ready = status == TextToSpeech.SUCCESS
            if (ready) tts?.language = Locale(lang)
        }.also { tts = it }
        if (!ready) return // the engine is still starting: this one is skipped, the next kilometre is spoken
        engine.language = Locale(lang)
        engine.speak(text, TextToSpeech.QUEUE_ADD, null, "split")
    }

    fun shutdown() { tts?.stop(); tts?.shutdown(); tts = null; ready = false }
}
