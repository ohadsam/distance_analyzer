// Pure snapshot handed to the Android home-screen widgets: goals plus the texts already translated (Android has no translations of its own).
/** ctx: { goalSteps, status (effort.weekStatus), kind }; t: translator. Numbers are rounded, texts short. */
export function widgetSnapshot({ goalSteps, status, kind }, t) {
  const done = Math.round(status.done), plan = Math.round(status.plan.minutes);
  return { stepsGoal: Math.max(0, Math.round(goalSteps)), effortDone: done, effortPlan: plan, kind: kind === 'run' ? 'run' : 'walk',
    stepsTitle: t('wSteps'), effortTitle: t('wEffort'), effortSub: t(status.status === 'ahead' ? 'effAhead' : status.status === 'on' ? 'effOn' : 'effBehind'),
    quickTitle: t('qaMeasure'), quickHint: t(kind === 'run' ? 'run' : 'walk') };
}
