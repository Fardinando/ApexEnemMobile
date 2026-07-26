import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  useColorScheme,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, getColors, Spacing, FontSize, BorderRadius } from '../../lib/theme';
import { supabase } from '../../lib/supabase';
import {
  getLevelFromXp,
  getLevelTitle,
  ACHIEVEMENTS,
  GamificationStats,
} from '../../lib/gamification';

const SCREEN_WIDTH = Dimensions.get('window').width;
const GRID_COLUMNS = 3;
const GRID_ITEM_WIDTH = (SCREEN_WIDTH - Spacing.lg * 2 - Spacing.sm * (GRID_COLUMNS - 1)) / GRID_COLUMNS;

export default function PerfilScreen() {
  const colorScheme = useColorScheme();
  const colors = getColors(colorScheme);
  const [refreshing, setRefreshing] = useState(false);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [stats, setStats] = useState<GamificationStats>({
    totalEssays: 0,
    avgEssayScore: 0,
    bestEssayScore: 0,
    totalSimulados: 0,
    avgSimuladoScore: 0,
    bestSimuladoScore: 0,
    currentStreak: 0,
    longestStreak: 0,
    totalXp: 0,
    totalQuestionsAnswered: 0,
    perfectSimulados: 0,
  });

  const loadData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const user = session.user;
      setUserEmail(user.email || '');

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (profile) {
        setUserName(profile.name || user.email?.split('@')[0] || '');
      } else {
        setUserName(user.email?.split('@')[0] || '');
      }

      const [essays, simulados] = await Promise.all([
        supabase
          .from('essay_corrections')
          .select('score')
          .eq('user_id', user.id),
        supabase
          .from('simulado_history')
          .select('score_percent')
          .eq('user_id', user.id),
      ]);

      const essayScores = (essays.data || []).map((e: any) => e.score);
      const simuladoScores = (simulados.data || []).map((s: any) => s.score_percent);

      const totalEssays = essayScores.length;
      const avgEssayScore = totalEssays > 0
        ? Math.round(essayScores.reduce((a: number, b: number) => a + b, 0) / totalEssays)
        : 0;
      const bestEssayScore = totalEssays > 0 ? Math.max(...essayScores) : 0;

      const totalSimulados = simuladoScores.length;
      const avgSimuladoScore = totalSimulados > 0
        ? Math.round(simuladoScores.reduce((a: number, b: number) => a + b, 0) / totalSimulados)
        : 0;
      const bestSimuladoScore = totalSimulados > 0 ? Math.max(...simuladoScores) : 0;

      const totalXp = profile?.total_xp || 0;
      const currentStreak = profile?.streak || 0;
      const longestStreak = profile?.longest_streak || 0;
      const totalQuestionsAnswered = profile?.total_questions_answered || 0;

      setStats({
        totalEssays,
        avgEssayScore,
        bestEssayScore,
        totalSimulados,
        avgSimuladoScore,
        bestSimuladoScore,
        currentStreak,
        longestStreak,
        totalXp,
        totalQuestionsAnswered,
        perfectSimulados: 0,
      });
    } catch {
      // silent
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const level = getLevelFromXp(stats.totalXp);
  const levelTitle = getLevelTitle(level.level);
  const initials = userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const statItems = [
    { label: 'Redações', value: stats.totalEssays, icon: 'document-text-outline' as const },
    { label: 'Média Redação', value: stats.avgEssayScore, icon: 'trophy-outline' as const },
    { label: 'Simulados', value: stats.totalSimulados, icon: 'book-outline' as const },
    { label: 'Média Simulado', value: `${stats.avgSimuladoScore}%`, icon: 'stats-chart-outline' as const },
    { label: 'Sequência', value: stats.currentStreak, icon: 'flame-outline' as const },
    { label: 'Maior Sequência', value: stats.longestStreak, icon: 'trophy-outline' as const },
    { label: 'XP Total', value: stats.totalXp, icon: 'star-outline' as const },
  ];

  const achievements = ACHIEVEMENTS.map((a) => ({
    ...a,
    unlocked: a.condition(stats),
  }));

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.bg }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      <View style={[styles.header, { backgroundColor: colors.surface }]}>
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Text style={styles.avatarText}>{initials || '?'}</Text>
        </View>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
          {userName || 'Carregando...'}
        </Text>
        <Text style={[styles.email, { color: colors.textSecondary }]} numberOfLines={1}>
          {userEmail}
        </Text>

        <View style={[styles.levelBadge, { backgroundColor: colors.primaryLight }]}>
          <Ionicons name="star" size={16} color={colors.primary} />
          <Text style={[styles.levelText, { color: colors.primary }]}>
            Nv. {level.level} - {levelTitle}
          </Text>
        </View>

        <View style={styles.xpContainer}>
          <View style={[styles.xpBarBg, { backgroundColor: colors.border }]}>
            <View
              style={[
                styles.xpBarFill,
                { backgroundColor: colors.primary, width: `${level.progress}%` },
              ]}
            />
          </View>
          <Text style={[styles.xpLabel, { color: colors.textSecondary }]}>
            {stats.totalXp} XP
          </Text>
        </View>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Estatísticas</Text>
      <View style={styles.statsGrid}>
        {statItems.map((item) => (
          <View key={item.label} style={[styles.statCard, { backgroundColor: colors.surface }]}>
            <Ionicons name={item.icon} size={20} color={colors.primary} />
            <Text style={[styles.statValue, { color: colors.text }]}>{item.value}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{item.label}</Text>
          </View>
        ))}
      </View>

      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Conquistas ({achievements.filter((a) => a.unlocked).length}/{achievements.length})
      </Text>
      <View style={styles.achievementsGrid}>
        {achievements.map((a) => (
          <View
            key={a.id}
            style={[
              styles.achievementCard,
              { backgroundColor: colors.surface },
              !a.unlocked && styles.achievementLocked,
            ]}
          >
            <Text style={[styles.achievementIcon, !a.unlocked && styles.achievementIconLocked]}>
              {a.icon}
            </Text>
            <Text
              style={[styles.achievementTitle, { color: colors.text }, !a.unlocked && styles.textLocked]}
              numberOfLines={1}
            >
              {a.title}
            </Text>
            <Text
              style={[styles.achievementDesc, { color: colors.textSecondary }, !a.unlocked && styles.textLocked]}
              numberOfLines={2}
            >
              {a.description}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: FontSize.xxl,
    fontWeight: '700',
  },
  name: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  email: {
    fontSize: FontSize.sm,
    marginBottom: Spacing.md,
  },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  levelText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  xpContainer: {
    width: '100%',
    alignItems: 'center',
  },
  xpBarBg: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: Spacing.xs,
  },
  xpBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  xpLabel: {
    fontSize: FontSize.xs,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    marginBottom: Spacing.md,
    marginTop: Spacing.sm,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  statCard: {
    width: GRID_ITEM_WIDTH,
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  statValue: {
    fontSize: FontSize.xl,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: FontSize.xs,
    textAlign: 'center',
  },
  achievementsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  achievementCard: {
    width: GRID_ITEM_WIDTH,
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.xs,
  },
  achievementLocked: {
    opacity: 0.4,
  },
  achievementIcon: {
    fontSize: 28,
  },
  achievementIconLocked: {
    opacity: 0.4,
  },
  achievementTitle: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    textAlign: 'center',
  },
  achievementDesc: {
    fontSize: 10,
    textAlign: 'center',
  },
  textLocked: {
    opacity: 0.6,
  },
});
