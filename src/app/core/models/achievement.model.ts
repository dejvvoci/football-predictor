export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
}

export const ALL_ACHIEVEMENTS: Achievement[] = [
  { id: 'first_correct',    icon: '🎯', title: 'Great Start!',   description: 'First correct prediction' },
  { id: 'first_exact',      icon: '💎', title: 'Sniper',           description: 'First time correct score prediction' },
  { id: 'streak_3',         icon: '🔥', title: 'Streak',      description: '3 correct predictions in a row' },
  { id: 'streak_5',         icon: '⚡', title: 'Golden Streak',      description: '5 correct predictions in row' },
  { id: 'streak_10',        icon: '👑', title: 'Undefeated',      description: '10 correct predictions in row' },
  { id: 'predictions_50',   icon: '🏅', title: 'Veteran',           description: '50 total predictions' },
  { id: 'underdog',         icon: '😤', title: 'Underdog believer', description: 'Found the winner with an odd above 4.0' },
  { id: 'points_100',       icon: '🏆', title: 'Champion',           description: '100 total points' },
];

/** Kthen Achievement-et e plota nga lista e ID-ve të ruajtura te Firestore */
export function resolveAchievements(ids: string[]): Achievement[] {
  return ALL_ACHIEVEMENTS.filter((a) => ids.includes(a.id));
}
