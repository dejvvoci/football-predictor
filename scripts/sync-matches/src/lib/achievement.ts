export const ACHIEVEMENT_IDS = {
  FIRST_CORRECT:   'first_correct',
  FIRST_EXACT:     'first_exact',
  STREAK_3:        'streak_3',
  STREAK_5:        'streak_5',
  STREAK_10:       'streak_10',
  PREDICTIONS_50:  'predictions_50',
  UNDERDOG:        'underdog',
  POINTS_100:      'points_100',
} as const;

export interface UserProgress {
  currentStreak: number;
  bestStreak: number;
  totalPoints: number;
  totalCorrect: number;
  totalPredictions: number;
  achievements: string[];
}

/** Computes which achievements should be awarded based on current progress */
export function computeNewAchievements(
  progress: UserProgress,
  isCorrect: boolean,
  isExact: boolean,
  outcomeOdds: number
): string[] {
  const earned = [...progress.achievements];
  const add = (id: string) => { if (!earned.includes(id)) earned.push(id); };

  if (isCorrect)                        add(ACHIEVEMENT_IDS.FIRST_CORRECT);
  if (isExact)                          add(ACHIEVEMENT_IDS.FIRST_EXACT);
  if (progress.currentStreak >= 3)      add(ACHIEVEMENT_IDS.STREAK_3);
  if (progress.currentStreak >= 5)      add(ACHIEVEMENT_IDS.STREAK_5);
  if (progress.currentStreak >= 10)     add(ACHIEVEMENT_IDS.STREAK_10);
  if (progress.totalPredictions >= 50)  add(ACHIEVEMENT_IDS.PREDICTIONS_50);
  if (isCorrect && outcomeOdds >= 4.0)  add(ACHIEVEMENT_IDS.UNDERDOG);
  if (progress.totalPoints >= 100)      add(ACHIEVEMENT_IDS.POINTS_100);

  return earned;
}