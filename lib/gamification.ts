export type StudySerie = '9_fundamental' | '1_medio' | '2_medio' | '3_medio' | 'cursinho' | 'outro';
export type RegionBR = 'Norte' | 'Nordeste' | 'Centro-Oeste' | 'Sudeste' | 'Sul';

export interface UserProfile {
  name: string;
  email: string;
  region?: RegionBR;
  state?: string;
  city?: string;
  serie?: StudySerie;
  targetScore?: number;
  hardSubjects?: string[];
  streak?: number;
  lastLoginDate?: string;
  avatar?: string;
  totalXp?: number;
  longestStreak?: number;
}

export interface CompetencyScore {
  id: number;
  name: string;
  description: string;
  score: number;
  feedback: string;
}

export interface EssayCorrection {
  id: string;
  title: string;
  text: string;
  score: number;
  generalFeedback: string;
  competencies: CompetencyScore[];
  strengths: string[];
  weaknesses: string[];
  date: string;
}

export interface Question {
  id: string;
  area: 'Matemática' | 'Humanas' | 'Natureza' | 'Linguagens';
  statement: string;
  options: { letter: string; text: string }[];
  correctAnswer: string;
  explanation: string;
}

export interface SimuladoQuestion {
  id: string;
  statement: string;
  options: { letter: string; text: string; image?: string }[];
  correctAnswer: string;
  explanation: string;
  userAnswer?: string;
  image?: string;
}

export interface ActivityLog {
  id: string;
  type: string;
  title: string;
  description: string;
  date: string;
}

export interface WrongAnswer {
  subject: string;
  source: string;
  timestamp: number;
}

export interface GamificationStats {
  totalEssays: number;
  avgEssayScore: number;
  bestEssayScore: number;
  totalSimulados: number;
  avgSimuladoScore: number;
  bestSimuladoScore: number;
  currentStreak: number;
  longestStreak: number;
  totalXp: number;
  totalQuestionsAnswered: number;
  perfectSimulados: number;
}

export const XP_REWARDS = {
  ESSAY_CORRECTION: 50,
  SIMULADO_PASS: 30,
  SIMULADO_HIGH_SCORE: 80,
  SIMULADO_PERFECT: 200,
  STREAK_DAILY: 10,
  QUESTION_CORRECT: 5,
  LEARNING_CHAPTER: 40,
};

export const LEVEL_THRESHOLDS = [
  0, 100, 250, 500, 800, 1200, 1700, 2300, 3000, 3800,
  4700, 5700, 6800, 8000, 9500, 11000, 13000, 15000, 17500, 20000,
];

export const ACHIEVEMENTS = [
  { id: 'first_essay', title: 'Primeira Redação', description: 'Enviou sua primeira redação', icon: '✍️', condition: (s: GamificationStats) => s.totalEssays >= 1 },
  { id: 'essay_5', title: 'Escritor Dedicado', description: 'Enviou 5 redações', icon: '📝', condition: (s: GamificationStats) => s.totalEssays >= 5 },
  { id: 'essay_10', title: 'Mestre da Escrita', description: 'Enviou 10 redações', icon: '📚', condition: (s: GamificationStats) => s.totalEssays >= 10 },
  { id: 'essay_25', title: 'Pluma de Ouro', description: 'Enviou 25 redações', icon: '🪶', condition: (s: GamificationStats) => s.totalEssays >= 25 },
  { id: 'score_800', title: 'Nota Alta', description: '800+ em uma redação', icon: '🎯', condition: (s: GamificationStats) => s.bestEssayScore >= 800 },
  { id: 'score_900', title: 'Quase Perfeita', description: '900+ em uma redação', icon: '🌟', condition: (s: GamificationStats) => s.bestEssayScore >= 900 },
  { id: 'score_1000', title: 'Nota 1000', description: 'Nota máxima na redação', icon: '👑', condition: (s: GamificationStats) => s.bestEssayScore >= 1000 },
  { id: 'first_simulado', title: 'Primeiro Simulado', description: 'Completou 1º simulado', icon: '🧠', condition: (s: GamificationStats) => s.totalSimulados >= 1 },
  { id: 'simulado_5', title: 'Atleta Mental', description: '5 simulados', icon: '💪', condition: (s: GamificationStats) => s.totalSimulados >= 5 },
  { id: 'simulado_10', title: 'Veterano', description: '10 simulados', icon: '🎖️', condition: (s: GamificationStats) => s.totalSimulados >= 10 },
  { id: 'simulado_25', title: 'Máquina', description: '25 simulados', icon: '🏆', condition: (s: GamificationStats) => s.totalSimulados >= 25 },
  { id: 'perfect_simulado', title: '100% Acerto', description: 'Acertou tudo', icon: '💯', condition: (s: GamificationStats) => s.perfectSimulados >= 1 },
  { id: 'streak_3', title: 'Fogo Aceso', description: '3 dias seguidos', icon: '🔥', condition: (s: GamificationStats) => s.longestStreak >= 3 },
  { id: 'streak_7', title: 'Semana Perfeita', description: '7 dias seguidos', icon: '⚡', condition: (s: GamificationStats) => s.longestStreak >= 7 },
  { id: 'streak_14', title: 'Disciplina Total', description: '14 dias seguidos', icon: '🛡️', condition: (s: GamificationStats) => s.longestStreak >= 14 },
  { id: 'streak_30', title: 'Lenda do Estudo', description: '30 dias seguidos', icon: '🏅', condition: (s: GamificationStats) => s.longestStreak >= 30 },
  { id: 'xp_1000', title: 'Milhar de XP', description: '1000 XP', icon: '⭐', condition: (s: GamificationStats) => s.totalXp >= 1000 },
  { id: 'xp_5000', title: 'XP Máximo', description: '5000 XP', icon: '💎', condition: (s: GamificationStats) => s.totalXp >= 5000 },
  { id: 'xp_10000', title: 'Lenda do XP', description: '10000 XP', icon: '🌌', condition: (s: GamificationStats) => s.totalXp >= 10000 },
  { id: 'questions_10', title: 'Primeiro Passo', description: '10 questões', icon: '✅', condition: (s: GamificationStats) => s.totalQuestionsAnswered >= 10 },
  { id: 'questions_50', title: 'Estudante Dedicado', description: '50 questões', icon: '📖', condition: (s: GamificationStats) => s.totalQuestionsAnswered >= 50 },
  { id: 'questions_100', title: 'Centenário', description: '100 questões', icon: '🔥', condition: (s: GamificationStats) => s.totalQuestionsAnswered >= 100 },
  { id: 'questions_250', title: 'Máquina de Questões', description: '250 questões', icon: '⚙️', condition: (s: GamificationStats) => s.totalQuestionsAnswered >= 250 },
  { id: 'questions_500', title: 'Titã', description: '500 questões', icon: '🗿', condition: (s: GamificationStats) => s.totalQuestionsAnswered >= 500 },
  { id: 'simulado_80', title: 'Acima da Média', description: '80%+ em simulado', icon: '📊', condition: (s: GamificationStats) => s.bestSimuladoScore >= 80 },
  { id: 'simulado_90', title: 'Vestibulando Nato', description: '90%+ em simulado', icon: '🎓', condition: (s: GamificationStats) => s.bestSimuladoScore >= 90 },
  { id: 'simulado_50', title: 'Maratonista', description: '50 simulados', icon: '🏃', condition: (s: GamificationStats) => s.totalSimulados >= 50 },
  { id: 'essay_50', title: 'Autor Prolífico', description: '50 redações', icon: '✍️', condition: (s: GamificationStats) => s.totalEssays >= 50 },
  { id: 'avg_essay_700', title: 'Redator Consistente', description: 'Média 700+ (3+)', icon: '🎯', condition: (s: GamificationStats) => s.totalEssays >= 3 && s.avgEssayScore >= 700 },
];

export function calculateStreak(lastLoginDate?: string) {
  if (!lastLoginDate) return { newStreak: 1, isNewDay: true, streakBroken: false };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const last = new Date(lastLoginDate + 'T12:00:00');
  last.setHours(0, 0, 0, 0);
  const diffMs = today.getTime() - last.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return { newStreak: 0, isNewDay: false, streakBroken: false };
  if (diffDays === 1) return { newStreak: 1, isNewDay: true, streakBroken: false };
  return { newStreak: 1, isNewDay: true, streakBroken: true };
}

export function getLevelFromXp(xp: number) {
  let level = 0;
  for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) level = i;
    else break;
  }
  const currentThreshold = LEVEL_THRESHOLDS[level] || 0;
  const nextThreshold = LEVEL_THRESHOLDS[level + 1] || LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1] + 5000;
  const xpInLevel = xp - currentThreshold;
  const xpNeeded = nextThreshold - currentThreshold;
  const progress = xpNeeded > 0 ? Math.min((xpInLevel / xpNeeded) * 100, 100) : 100;
  return { level: level + 1, currentXp: xp, nextThreshold, progress };
}

export function getLevelTitle(level: number): string {
  if (level <= 2) return 'Calouro';
  if (level <= 5) return 'Estudante';
  if (level <= 8) return 'Disciplinado';
  if (level <= 12) return 'Experiente';
  if (level <= 15) return 'Mestre';
  if (level <= 18) return 'Lenda';
  return 'Apex Master';
}

export function computeGamificationStats(data: {
  essays: { score: number }[];
  simulados: { scorePercent: number }[];
  streak: number;
  longestStreak: number;
  totalXp: number;
  questionsAnswered?: number;
}): GamificationStats {
  const totalEssays = data.essays.length;
  const avgEssayScore = totalEssays > 0 ? Math.round(data.essays.reduce((a, e) => a + e.score, 0) / totalEssays) : 0;
  const bestEssayScore = totalEssays > 0 ? Math.max(...data.essays.map(e => e.score)) : 0;
  const totalSimulados = data.simulados.length;
  const avgSimuladoScore = totalSimulados > 0 ? Math.round(data.simulados.reduce((a, s) => a + s.scorePercent, 0) / totalSimulados) : 0;
  const bestSimuladoScore = totalSimulados > 0 ? Math.max(...data.simulados.map(s => s.scorePercent)) : 0;
  const perfectSimulados = data.simulados.filter(s => s.scorePercent === 100).length;
  return {
    totalEssays, avgEssayScore, bestEssayScore,
    totalSimulados, avgSimuladoScore, bestSimuladoScore,
    currentStreak: data.streak, longestStreak: data.longestStreak,
    totalXp: data.totalXp, totalQuestionsAnswered: data.questionsAnswered || 0,
    perfectSimulados,
  };
}

export function getAllAchievements(stats: GamificationStats) {
  return ACHIEVEMENTS.map(a => ({
    ...a,
    unlocked: a.condition(stats),
  }));
}
