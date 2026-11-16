// "Your data" answers for the global search (pure): the longest and fastest workouts, totals, this week and month, streak, records, challenge.
// Each fact is a search item { id, type: 'fact', title, text, href }; `text` carries the words people may type in both languages.
import { totals, weekStart, streak, monthSeries, paceSec } from './stats.js';
import { recordFlags } from './records.js';
import { challengeStatus, challengeTarget } from './challenge.js';

/** env: { t, both(key), fmtKm, fmtDate, fmtPaceUnit, fmtClock, lang, challengeN }. */
export function buildFacts(rows, now, env) {
  const { t, both, fmtKm, fmtDate, fmtPaceUnit, fmtClock, lang } = env, out = [];
  const add = (id, key, value, href, extra = '', ts = 0) => out.push({ id: `fact:${id}`, type: 'fact', title: `${t(key)}: ${value}`, text: `${both(key)} ${extra}`, href, ts });
  if (!rows.length) return out;
  const all = totals(rows);
  add('total-km', 'factTotalKm', fmtKm(all.distanceM), '#/history', 'total distance overall all time sum כל הזמן סך הכול מרחק');
  add('count', 'factCount', String(all.n), '#/history', 'how many workouts number of workouts count כמה אימונים מספר');
  add('total-time', 'factTotalTime', fmtClock(all.movingMs), '#/history', 'total time hours moving זמן כולל שעות');
  const last = rows.reduce((a, b) => (b.startedAt > a.startedAt ? b : a), rows[0]);
  add('last', 'factLast', `${fmtKm(last.distanceM)} · ${fmtDate(last.startedAt, lang)}`, `#/w/${last.startedAt}`, 'latest most recent last workout האחרון אחרון', last.startedAt);
  for (const kind of ['run', 'walk']) {
    const ks = rows.filter((w) => w.kind === kind); if (!ks.length) continue;
    const kw = kind === 'run' ? 'run running ריצה רץ' : 'walk walking הליכה הולך';
    const far = ks.reduce((a, b) => (b.distanceM > a.distanceM ? b : a), ks[0]);
    add(`longest-${kind}`, kind === 'run' ? 'factLongestRun' : 'factLongestWalk', `${fmtKm(far.distanceM)} · ${fmtDate(far.startedAt, lang)}`, `#/w/${far.startedAt}`, `${kw} longest farthest record distance biggest הארוך ביותר רחוק שיא מרחק`, far.startedAt);
    const fast = ks.filter((w) => w.distanceM >= 1000 && paceSec(w) > 0).sort((a, b) => paceSec(a) - paceSec(b))[0];
    if (fast) add(`fastest-${kind}`, kind === 'run' ? 'factFastestRun' : 'factFastestWalk', `${fmtPaceUnit(paceSec(fast))} · ${fmtDate(fast.startedAt, lang)}`, `#/w/${fast.startedAt}`, `${kw} fastest best pace speed quickest personal best המהיר ביותר קצב שיא`, fast.startedAt);
  }
  const wk = rows.filter((w) => weekStart(w.startedAt) === weekStart(now)), wt = totals(wk);
  add('week', 'factWeek', `${wt.n} · ${fmtKm(wt.distanceM)}`, '#/d/effort', 'this week weekly so far השבוע שבועי');
  const [cur] = monthSeries(rows, now, 1).slice(-1);
  add('month', 'factMonth', `${cur.n} · ${fmtKm(cur.distanceM)}`, '#/d/month', 'this month monthly החודש חודשי');
  const best = monthSeries(rows, now, 12).reduce((a, b) => (b.distanceM > a.distanceM ? b : a));
  if (best.distanceM > 0) add('best-month', 'factBestMonth', `${new Date(best.t).toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-GB', { month: 'long', year: 'numeric' })} · ${fmtKm(best.distanceM)}`, '#/d/month', 'best month busiest החודש הטוב ביותר');
  const s = streak(rows, now); if (s) add('streak', 'factStreak', String(s), '#/d/consistency', 'streak days in a row consecutive consistency רצף ימים רצופים עקביות');
  const flags = recordFlags(rows); if (flags.size) add('records', 'factRecords', String(flags.size), '#/history', 'records personal bests pr trophy שיאים שיאים אישיים');
  const ch = challengeStatus(rows, now, challengeTarget(env.challengeN)); if (ch.target) add('challenge', 'factChallenge', `${ch.done}/${ch.target}`, '#/d/challenge', 'weekly challenge goal progress אתגר שבועי יעד התקדמות');
  return out;
}
