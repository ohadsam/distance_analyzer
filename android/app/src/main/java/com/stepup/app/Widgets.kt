package com.stepup.app

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews

/** Home-screen widgets: steps today (live from the step counter), weekly effort (from the page's snapshot) and "measure now". */
object Widgets {
    private const val PREFS = "widgets"

    fun save(ctx: Context, json: String) {
        if (WidgetMath.parse(json) == null) return
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString("snapshot", json).apply()
        updateAll(ctx)
    }

    private fun snapshot(ctx: Context): WidgetSnapshot? = WidgetMath.parse(ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString("snapshot", "") ?: "")

    /** A tap opens the app on this in-app route (MainActivity reads the "href" extra). */
    private fun open(ctx: Context, code: Int, href: String): PendingIntent =
        PendingIntent.getActivity(ctx, code, Intent(ctx, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_NEW_TASK).putExtra("href", href), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)

    fun updateAll(ctx: Context) {
        val am = AppWidgetManager.getInstance(ctx)
        push(ctx, am, StepsWidget::class.java, R.layout.widget_steps) { fillSteps(ctx, it) }
        push(ctx, am, EffortWidget::class.java, R.layout.widget_effort) { fillEffort(ctx, it) }
        push(ctx, am, QuickWidget::class.java, R.layout.widget_quick) { fillQuick(ctx, it) }
        push(ctx, am, LastWidget::class.java, R.layout.widget_text) { fillLast(ctx, it) }
        push(ctx, am, NextWidget::class.java, R.layout.widget_text) { fillNext(ctx, it) }
    }

    private fun push(ctx: Context, am: AppWidgetManager, cls: Class<*>, layout: Int, fill: (RemoteViews) -> Unit) {
        val ids = am.getAppWidgetIds(ComponentName(ctx, cls))
        if (ids.isEmpty()) return
        val views = RemoteViews(ctx.packageName, layout)
        fill(views)
        am.updateAppWidget(ids, views)
    }

    private fun fillSteps(ctx: Context, v: RemoteViews) {
        val s = snapshot(ctx)
        val today = StepStore.today(ctx)
        v.setTextViewText(R.id.title, s?.stepsTitle?.ifEmpty { null } ?: ctx.getString(R.string.widget_steps_label))
        v.setTextViewText(R.id.value, WidgetMath.grouped(today))
        v.setProgressBar(R.id.bar, 100, WidgetMath.percent(today, (s?.stepsGoal ?: 0).toLong()), false)
        v.setTextViewText(R.id.sub, if (s != null && s.stepsGoal > 0) WidgetMath.grouped(s.stepsGoal.toLong()) else "")
        v.setOnClickPendingIntent(R.id.widget_root, open(ctx, 31, "#/d/steps"))
    }

    private fun fillEffort(ctx: Context, v: RemoteViews) {
        val s = snapshot(ctx)
        v.setTextViewText(R.id.title, s?.effortTitle?.ifEmpty { null } ?: ctx.getString(R.string.widget_effort_label))
        v.setTextViewText(R.id.value, if (s != null) "${s.effortDone} / ${s.effortPlan}" else "–")
        v.setProgressBar(R.id.bar, 100, WidgetMath.percent((s?.effortDone ?: 0).toLong(), (s?.effortPlan ?: 0).toLong()), false)
        v.setTextViewText(R.id.sub, s?.effortSub ?: "")
        v.setOnClickPendingIntent(R.id.widget_root, open(ctx, 32, "#/d/effort"))
    }

    private fun fillLast(ctx: Context, v: RemoteViews) {
        val s = snapshot(ctx)
        v.setTextViewText(R.id.title, s?.lastTitle?.ifEmpty { null } ?: ctx.getString(R.string.widget_last_label))
        v.setTextViewText(R.id.value, s?.lastValue?.ifEmpty { null } ?: "–")
        v.setTextViewText(R.id.sub, s?.lastSub ?: "")
        v.setOnClickPendingIntent(R.id.widget_root, open(ctx, 34, "#/history"))
    }

    private fun fillNext(ctx: Context, v: RemoteViews) {
        val s = snapshot(ctx)
        v.setTextViewText(R.id.title, s?.nextTitle?.ifEmpty { null } ?: ctx.getString(R.string.widget_next_label))
        v.setTextViewText(R.id.value, s?.nextValue?.ifEmpty { null } ?: "–")
        v.setTextViewText(R.id.sub, s?.nextSub ?: "")
        v.setOnClickPendingIntent(R.id.widget_root, open(ctx, 35, "#/plan"))
    }

    private fun fillQuick(ctx: Context, v: RemoteViews) {
        val s = snapshot(ctx)
        v.setTextViewText(R.id.value, s?.quickTitle?.ifEmpty { null } ?: ctx.getString(R.string.widget_quick_label))
        v.setTextViewText(R.id.sub, s?.quickHint ?: "")
        v.setOnClickPendingIntent(R.id.widget_root, open(ctx, 33, "#/workout/${s?.kind ?: "walk"}/go"))
    }
}

class StepsWidget : AppWidgetProvider() { override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) { StepStore.sample(context) { Widgets.updateAll(context) } } }
class EffortWidget : AppWidgetProvider() { override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) { Widgets.updateAll(context) } }
class QuickWidget : AppWidgetProvider() { override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) { Widgets.updateAll(context) } }
class LastWidget : AppWidgetProvider() { override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) { Widgets.updateAll(context) } }
class NextWidget : AppWidgetProvider() { override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) { Widgets.updateAll(context) } }
