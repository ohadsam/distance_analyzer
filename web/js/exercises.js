// Warm-up before a run or walk, cool-down and stretches after it. Pure data + plans (no DOM): which exercises, how long each, and how long to walk to cool down.
// The pictures of the exercises are the illustrator's looping strips (web/art/exercises/<id>.webp) once delivered; until then the screens show the character's stretch pose.
export const SECONDS = { wu_march: 40, wu_leg_swing: 40, wu_high_knees: 30, wu_butt_kicks: 30, wu_walking_lunge: 40, wu_hip_circles: 30, wu_arm_circles: 30, wu_ankle_rolls: 30, wu_side_steps: 30, wu_calf_raises: 30, wu_torso_twist: 30, wu_skips: 30,
  cd_walk: 120, cd_quad: 40, cd_hamstring: 40, cd_calf: 40, cd_hip_flexor: 40, cd_glute: 40, cd_it_band: 30, cd_adductor: 30, cd_shoulder: 20, cd_chest: 20, cd_back_fold: 30, cd_breathing: 30 };
export const IDS = Object.keys(SECONDS);
const PLAN = {
  warmup: { run: ['wu_march', 'wu_leg_swing', 'wu_high_knees', 'wu_butt_kicks', 'wu_walking_lunge', 'wu_hip_circles', 'wu_ankle_rolls', 'wu_skips'], walk: ['wu_march', 'wu_hip_circles', 'wu_arm_circles', 'wu_ankle_rolls', 'wu_calf_raises', 'wu_torso_twist'] },
  cooldown: { run: ['cd_walk', 'cd_quad', 'cd_hamstring', 'cd_calf', 'cd_hip_flexor', 'cd_glute', 'cd_back_fold', 'cd_breathing'], walk: ['cd_calf', 'cd_hamstring', 'cd_quad', 'cd_breathing'] },
};
/** The easy walk to cool down after a run (minutes): longer for a longer or harder run. Walks need no cool-down walk. */
export function coolDownMinutes(distM, kind = 'run', paceSec = 0) {
  if (kind !== 'run' || !(distM >= 500)) return 0;
  const km = distM / 1000, base = km < 2 ? 3 : km < 5 ? 5 : km < 10 ? 7 : km < 15 ? 10 : 12;
  return base + (paceSec > 0 && paceSec < 300 && km >= 3 ? 2 : 0); // a hard run (faster than 5:00 per km, over 3 km) earns two more minutes
}
/** The session: [{ id, seconds }] for 'warmup' | 'cooldown' and 'run' | 'walk'; the cool-down walk lasts `walkMin` minutes. */
export function sessionOf(kindOfSession, kind = 'run', { walkMin = 0 } = {}) {
  const ids = (PLAN[kindOfSession] || PLAN.warmup)[kind === 'walk' ? 'walk' : 'run'];
  return ids.map((id) => ({ id, seconds: id === 'cd_walk' ? Math.max(60, (walkMin || 2) * 60) : SECONDS[id] }));
}
export const totalSeconds = (s) => s.reduce((n, x) => n + x.seconds, 0);
export const isExercise = (id) => Object.hasOwn(SECONDS, id);
