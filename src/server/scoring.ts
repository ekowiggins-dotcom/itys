/**
 * Points are only ever earned, by being right. Nothing is spent or staked.
 *
 * A right pick scores 10 + 30 × (1 − share of pickers who said the same), so 10 to 40:
 * the fewer friends who saw it coming, the more it's worth. A wrong pick scores 0.
 * Calls with fewer than MIN_PICKERS pickers, called-off calls and cancelled calls count for nobody.
 *
 * Scores are derived data: they can always be rebuilt from calls + picks (see scoresForCall).
 */
export const MIN_PICKERS = 2;
export const BASE_POINTS = 10;
export const BONUS_POINTS = 30;

export function callPoints(sameAnswer: number, totalPickers: number) {
  if (totalPickers <= 0 || sameAnswer <= 0) return 0;
  const share = sameAnswer / totalPickers;
  return Math.round(BASE_POINTS + BONUS_POINTS * (1 - share));
}

export type ScoreRow = { userId: string; points: number; correct: boolean };

/** Everyone's score for a settled call. Empty if the call doesn't count. */
export function scoresForCall(result: string, picks: { userId: string; optionKey: string }[]): ScoreRow[] {
  if (picks.length < MIN_PICKERS) return [];
  const same = picks.filter((p) => p.optionKey === result).length;
  const points = callPoints(same, picks.length);
  return picks.map((p) => {
    const correct = p.optionKey === result;
    return { userId: p.userId, correct, points: correct ? points : 0 };
  });
}
