import { useEffect, useState, useCallback } from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  useColorScheme,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { supabase, getProfile, fetchEssays, fetchSimulados } from '../../lib/supabase';
import {
  getLevelFromXp,
  getLevelTitle,
  computeGamificationStats,
  getAllAchievements,
  GamificationStats,
} from '../../lib/gamification';
import { getColors, ThemeColors, BorderRadius, Spacing, FontSize } from '../../lib/theme';

interface RecentActivity {
  id: string;
  type: 'essay' | 'simulado' | 'streak';
  title: string;
  date: string;
}

export default function DashboardScreen() {
  const colorScheme = useColorScheme();
  const colors = getColors(colorScheme);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userName, setUserName] = useState('Estudante');
  const [gamStats, setGamStats] = useState<GamificationStats | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [achievements, setAchievements] = useState<{ id: string; title: string; icon: string; unlocked: boolean }[]>([]);

  const loadData = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const profile = await getProfile(user.id);
      if (profile?.name) setUserName(profile.name.split(' ')[0]);

      const [essays, simulados] = await Promise.all([
        fetchEssays(user.id),
        fetchSimulados(user.id),
      ]);

      const gs = computeGamificationStats({
        essays: essays.map((e: any) => ({ score: e.score || 0 })),
        simulados: simulados.map((s: any) => ({ scorePercent: s.score_percent || s.scorePercent || 0 })),
        streak: profile?.streak || 0,
        longestStreak: profile?.longestStreak || profile?.longest_streak || 0,
        totalXp: profile?.totalXp || profile?.total_xp || 0,
        questionsAnswered: profile?.questionsAnswered || profile?.questions_answered || 0,
      });

      setGamStats(gs);
      setAchievements(getAllAchievements(gs));

      const activities: RecentActivity[] = [];

      essays.slice(0, 3).forEach((e: any) => {
        activities.push({
          id: e.id || String(Math.random()),
          type: 'essay',
          title: `Redação: ${e.title || 'Sem título'} — Nota ${e.score || 0}`,
          date: e.created_at || e.date || '',
        });
      });

      simulados.slice(0, 3).forEach((s: any) => {
        activities.push({
          id: s.id || String(Math.random()),
          type: 'simulado',
          title: `Simulado — ${s.score_percent || s.scorePercent || 0}%`,
          date: s.created_at || s.date || '',
        });
      });

      if ((profile?.streak || 0) > 0) {
        activities.push({
          id: 'streak',
          type: 'streak',
          title: `Sequência de ${profile.streak} dias`,
          date: new Date().toISOString(),
        });
      }

      activities.sort((a, b) => {
        if (!a.date) return 1;
        if (!b.date) return -1;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });

      setRecentActivity(activities.slice(0, 6));
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMin = Math.floor(diffMs / 60000);
      if (diffMin < 1) return 'Agora';
      if (diffMin < 60) return `${diffMin}min atrás`;
      const diffH = Math.floor(diffMin / 60);
      if (diffH < 24) return `${diffH}h atrás`;
      const diffD = Math.floor(diffH / 24);
      if (diffD === 1) return 'Ontem';
      if (diffD < 7) return `${diffD} dias atrás`;
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    } catch {
      return '';
    }
  };

  const levelInfo = gamStats ? getLevelFromXp(gamStats.totalXp) : null;
  const xpProgress = levelInfo ? levelInfo.progress / 100 : 0;
  const totalAchievements = achievements.length;
  const unlockedAchievements = achievements.filter((a) => a.unlocked).slice(0, 6);

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.bg }]}
      contentContainerStyle={styles.contentContainer}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.bg }]}>
        <View>
          <Text style={[styles.greeting, { color: colors.textSecondary }]}>Olá,</Text>
          <Text style={[styles.userName, { color: colors.text }]}>{userName}</Text>
        </View>
        <View style={[styles.avatarCircle, { backgroundColor: colors.primaryLight }]}>
          <Text style={[styles.avatarText, { color: colors.primary }]}>{userName.charAt(0).toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.body}>
        {/* Streak Card */}
        <View style={[styles.streakCard]}>
          <View style={styles.streakRow}>
            <View style={styles.streakLeft}>
              <Text style={styles.streakFire}>🔥</Text>
              <Text style={styles.streakDias}>{gamStats?.currentStreak || 0} dias</Text>
              <Text style={styles.streakSub}>Sequência atual</Text>
            </View>
            {levelInfo && (
              <View style={styles.levelBadgeOuter}>
                <Text style={styles.levelBadgeText}>Nv. {levelInfo.level}</Text>
              </View>
            )}
          </View>
          <View style={styles.streakBarBg}>
            <View style={[styles.streakBarFill, { width: `${Math.max(xpProgress * 100, 2)}%` }]} />
          </View>
          <Text style={styles.streakXpLabel}>{gamStats?.totalXp || 0} XP</Text>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGridCard}>
          <View style={styles.statsGrid}>
            <StatCell
              icon="star"
              value={gamStats?.totalXp.toLocaleString('pt-BR') || '0'}
              label="XP Total"
              bg="#dbeafe"
              fg="#2563EB"
              darkBg="rgba(59,130,246,0.15)"
              darkFg="#60a5fa"
              isDark={colorScheme === 'dark'}
            />
            <StatCell
              icon="document-text"
              value={String(gamStats?.totalEssays || 0)}
              label="Redações"
              bg="#ede9fe"
              fg="#7c3aed"
              darkBg="rgba(124,58,237,0.15)"
              darkFg="#a78bfa"
              isDark={colorScheme === 'dark'}
            />
            <StatCell
              icon="school"
              value={String(gamStats?.totalSimulados || 0)}
              label="Simulados"
              bg="#d1fae5"
              fg="#10b981"
              darkBg="rgba(16,185,129,0.15)"
              darkFg="#34d399"
              isDark={colorScheme === 'dark'}
            />
            <StatCell
              icon="help-circle"
              value={String(gamStats?.totalQuestionsAnswered || 0)}
              label="Questões"
              bg="#fef3c7"
              fg="#f59e0b"
              darkBg="rgba(245,158,11,0.15)"
              darkFg="#fbbf24"
              isDark={colorScheme === 'dark'}
            />
          </View>
        </View>

        {/* Activity Timeline */}
        <View style={[styles.bentoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.sectionHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Atividade Recente</Text>
          </View>
          {recentActivity.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="time-outline" size={28} color={colors.textTertiary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Nenhuma atividade ainda</Text>
            </View>
          ) : (
            <View style={styles.timeline}>
              {recentActivity.map((activity, i) => {
                const dotColor =
                  activity.type === 'essay'
                    ? '#2563EB'
                    : activity.type === 'simulado'
                    ? '#4f46e5'
                    : '#f59e0b';
                return (
                  <View key={activity.id} style={styles.timelineEntry}>
                    <View style={styles.timelineDotCol}>
                      <View style={[styles.timelineDot, { backgroundColor: dotColor }]} />
                      {i < recentActivity.length - 1 && (
                        <View style={[styles.timelineLine, { backgroundColor: colors.border }]} />
                      )}
                    </View>
                    <View style={styles.timelineContent}>
                      <Text style={[styles.timelineTitle, { color: colors.text }]} numberOfLines={1}>
                        {activity.title}
                      </Text>
                      <Text style={[styles.timelineDate, { color: colors.textSecondary }]}>
                        {formatDate(activity.date)}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Achievements Preview */}
        <View style={[styles.bentoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.sectionHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Conquistas</Text>
          </View>
          {unlockedAchievements.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="trophy-outline" size={28} color={colors.textTertiary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Nenhuma conquista ainda</Text>
            </View>
          ) : (
            <>
              <View style={styles.achievementsGrid}>
                {unlockedAchievements.map((a) => (
                  <View key={a.id} style={[styles.achievementItem, { backgroundColor: colors.surfaceLow }]}>
                    <Text style={styles.achievementIcon}>{a.icon}</Text>
                  </View>
                ))}
              </View>
              <TouchableOpacity activeOpacity={0.7} onPress={() => router.push('/(tabs)/gamificacao')}>
                <Text style={[styles.viewAllLink, { color: colors.primary }]}>+ ver todas ({totalAchievements})</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

function StatCell({
  icon,
  value,
  label,
  bg,
  fg,
  darkBg,
  darkFg,
  isDark,
}: {
  icon: string;
  value: string;
  label: string;
  bg: string;
  fg: string;
  darkBg: string;
  darkFg: string;
  isDark: boolean;
}) {
  return (
    <View style={styles.statCell}>
      <View style={[styles.statIconWrap, { backgroundColor: isDark ? darkBg : bg }]}>
        <Ionicons name={icon as any} size={16} color={isDark ? darkFg : fg} />
      </View>
      <Text style={[styles.statValue, { color: isDark ? '#f3effc' : '#1b1b24' }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: isDark ? '#94a3b8' : '#64748b' }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = {
  centered: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 8,
  },
  greeting: {
    fontSize: FontSize.md,
  },
  userName: {
    fontSize: FontSize.xxl,
    fontWeight: '700' as const,
    marginTop: 2,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  avatarText: {
    fontSize: FontSize.xl,
    fontWeight: '700' as const,
  },
  body: {
    paddingHorizontal: 20,
    marginTop: 20,
    gap: 20,
  },
  streakCard: {
    borderRadius: 24,
    padding: 24,
    backgroundColor: '#F59E0B',
    overflow: 'hidden' as const,
  },
  streakRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'flex-start' as const,
  },
  streakLeft: {
    flex: 1,
  },
  streakFire: {
    fontSize: 28,
    marginBottom: 4,
  },
  streakDias: {
    fontSize: 30,
    fontWeight: '800' as const,
    color: '#FFFFFF',
  },
  streakSub: {
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  levelBadgeOuter: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  levelBadgeText: {
    color: '#FFFFFF',
    fontSize: FontSize.sm,
    fontWeight: '700' as const,
  },
  streakBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginTop: 16,
    overflow: 'hidden' as const,
  },
  streakBarFill: {
    height: '100%' as const,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  streakXpLabel: {
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 6,
  },
  statsGridCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
  },
  statsGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 12,
  },
  statCell: {
    width: '47%' as any,
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 14,
  },
  statIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700' as const,
  },
  statLabel: {
    fontSize: 10,
    marginTop: 2,
  },
  bentoCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
  },
  sectionHeader: {
    borderBottomWidth: 1,
    paddingBottom: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700' as const,
  },
  emptyState: {
    alignItems: 'center' as const,
    paddingVertical: 20,
    gap: 8,
  },
  emptyText: {
    fontSize: FontSize.sm,
  },
  timeline: {
    gap: 0,
  },
  timelineEntry: {
    flexDirection: 'row' as const,
    minHeight: 48,
  },
  timelineDotCol: {
    width: 20,
    alignItems: 'center' as const,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 4,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginTop: 4,
    marginBottom: -4,
  },
  timelineContent: {
    flex: 1,
    paddingBottom: 16,
  },
  timelineTitle: {
    fontSize: FontSize.sm,
    fontWeight: '600' as const,
  },
  timelineDate: {
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  achievementsGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 12,
  },
  achievementItem: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  achievementIcon: {
    fontSize: 22,
  },
  viewAllLink: {
    fontSize: FontSize.sm,
    fontWeight: '600' as const,
    marginTop: 16,
    textAlign: 'center' as const,
  },
};
