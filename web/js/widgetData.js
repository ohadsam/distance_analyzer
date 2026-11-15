// Pure snapshot handed to the Android home-screen widgets: goals plus the texts already translated (Android has no translations of its own).
const short = (s, n = 40) => (typeof s === 'string' ? s.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n) : '');
/** ctx: { goalSteps, status (effort.weekStatus), kind, last: {value, sub} | null, next: {value, sub} | null }; t: translator. Numbers are rounded, texts short. */
export function widgetSnapshot({ goalSteps, status, kind, last = null, next = null }, t) {
  const done = Math.round(status.done), plan = Math.round(status.plan.minutes);
  return { stepsGoal: Math.max(0, Math.round(goalSteps)), effortDone: done, effortPlan: plan, kind: kind === 'run' ? 'run' : 'walk',
    stepsTitle: t('wSteps'), effortTitle: t('wEffort'), effortSub: t(status.status === 'ahead' ? 'effAhead' : status.status === 'on' ? 'effOn' : 'effBehind'),
    quickTitle: t('qaMeasure'), quickHint: t(kind === 'run' ? 'run' : 'walk'),
    lastTitle: t('wLast'), lastValue: short(last?.value) || '–', lastSub: short(last?.sub, 60) || t('wLastNone'),
    nextTitle: t('wNext'), nextValue: short(next?.value) || '–', nextSub: short(next?.sub, 60) || t('wNextNone') };
}
