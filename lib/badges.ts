/**
 * Badges — computed from existing close-outs, no new table.
 *
 * The Hooked-layer spec lists six v1 milestones. Each one is derivable from
 * the user's close_outs rows, so unlock state is stateless: call
 * computeUnlocked(closeOuts) and get a Set<BadgeId>.
 *
 * The "unlock flash" moment is triggered at close-out time by computing the
 * set *before* and *after* the insert and diffing. The diff is piggybacked
 * on the redirect URL as ?badge=<id>, and the result page shows the modal.
 */

export type BadgeId =
  | "first_close"
  | "dead_eye"
  | "gut_check"
  | "sandbagger"
  | "closer"
  | "talk_to_dashboard";

export type Badge = {
  id: BadgeId;
  name: string;
  icon: string;
  /** Shown in the unlock modal and on the dashboard strip (unlocked state). */
  copy: string;
  /** Shown on the dashboard strip when the badge is still locked. */
  hint: string;
};

export const BADGE_ORDER: BadgeId[] = [
  "first_close",
  "dead_eye",
  "gut_check",
  "sandbagger",
  "closer",
  "talk_to_dashboard",
];

export const BADGES: Record<BadgeId, Badge> = {
  first_close: {
    id: "first_close",
    name: "First close",
    icon: "✦",
    copy: "First job closed out. The feedback loop is live.",
    hint: "Close out your first job to unlock",
  },
  dead_eye: {
    id: "dead_eye",
    name: "Dead Eye",
    icon: "◎",
    copy: "3 quotes inside 5%. You're dialed in.",
    hint: "3 close-outs within ±5% of quote",
  },
  gut_check: {
    id: "gut_check",
    name: "Gut Check",
    icon: "◆",
    copy: "You predicted it 3 times. That's calibration.",
    hint: "3 correct 'watching for' predictions",
  },
  sandbagger: {
    id: "sandbagger",
    name: "Sandbagger",
    icon: "▲",
    copy: "You quoted high and won the job. Confidence looks good on you.",
    hint: "3 close-outs ≥10% under quote",
  },
  closer: {
    id: "closer",
    name: "Closer",
    icon: "●",
    copy: "10 jobs closed. The dashboard earned its keep.",
    hint: "10 total close-outs",
  },
  talk_to_dashboard: {
    id: "talk_to_dashboard",
    name: "Talk to the dashboard",
    icon: "★",
    copy: "25 closed. You know your business now.",
    hint: "25 total close-outs",
  },
};

export type MinCloseOut = {
  computed_variance_pct: number;
  was_watching_correct: boolean | null;
};

export function computeUnlocked(closeOuts: MinCloseOut[]): Set<BadgeId> {
  const unlocked = new Set<BadgeId>();
  const total = closeOuts.length;

  if (total >= 1) unlocked.add("first_close");

  const deadEyeCount = closeOuts.filter(
    (c) => Math.abs(c.computed_variance_pct) <= 5
  ).length;
  if (deadEyeCount >= 3) unlocked.add("dead_eye");

  const gutCheckCount = closeOuts.filter(
    (c) => c.was_watching_correct === true
  ).length;
  if (gutCheckCount >= 3) unlocked.add("gut_check");

  const sandbaggerCount = closeOuts.filter(
    (c) => c.computed_variance_pct <= -10
  ).length;
  if (sandbaggerCount >= 3) unlocked.add("sandbagger");

  if (total >= 10) unlocked.add("closer");
  if (total >= 25) unlocked.add("talk_to_dashboard");

  return unlocked;
}

export function isBadgeId(v: string): v is BadgeId {
  return (BADGE_ORDER as string[]).includes(v);
}
