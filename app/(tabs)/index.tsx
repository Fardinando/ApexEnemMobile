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
} from '../../lib/gamification';
import { Colors, Spacing, FontSize, BorderRadius } from '../../lib/theme';

interface StatCard {
  label: string;
  value: string;
  icon: string;
  color: string;
}

interface RecentActivity {
  id: string;
  type: string;
  title: string;
  date: string;
}

export default function DashboardScreen() {
  const colorScheme = useColorScheme();
  const colors = colorScheme === 'dark' ? Colors.dark : Colors.light;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userName, setUserName] = useState('Estudante');
  const [stats, setStats] = useState<StatCard[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);

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

      const gamStats = computeGamificationStats({
        essays: essays.map((e: any) => ({ score: e.score || 0 })),
        simulados: simulados.map((s: any) => ({ scorePercent: s.score_percent || s.scorePercent || 0 })),
        streak: profile?.streak || 0,
        longestStreak: profile?.longestStreak || profile?.longest_streak || 0,
        totalXp: profile?.totalXp || profile?.total_xp || 0,
        questionsAnswered: profile?.questionsAnswered || profile?.questions_answered || 0,
      });

      const levelInfo = getLevelFromXp(gamStats.totalXp);
      const levelTitle = getLevelTitle(levelInfo.level);

      setStats([
        { label: 'XP Total', value: gamStats.totalXp.toLocaleString('pt-BR'), icon: 'star', color: colors.warning },
        { label: 'Nível', value: `${levelInfo.level} - ${levelTitle}`, icon: 'trophy', color: colors.primary },
        { label: 'Streak', value: `${gamStats.currentStreak} dias`, icon: 'flame', color: colors.danger },
        { label: 'Redações', value: String(gamStats.totalEssays), icon: 'document-text', color: colors.accent },
        { label: 'Simulados', value: String(gamStats.totalSimulados), icon: 'school', color: colors.success },
      ]);

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

      activities.sort((a, b) => {
        if (!a.date) return 1;
        if (!b.date) return -1;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });

      setRecentActivity(activities.slice(0, 5));
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [colors]);

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

  const quickActions = [
    { label: 'Corrigir Redação', icon: 'create-outline' as const, screen: '/(tabs)/redacao' },
    { label: 'Fazer Simulado', icon: 'clipboard-outline' as const, screen: '/(tabs)/simulados' },
    { label: 'Estudar Agora', icon: 'bulb-outline' as const, screen: '/(tabs)/estudos' },
  ];

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
      <View style={[styles.header, { backgroundColor: colors.surface }]}>
        <View>
          <Text style={[styles.greeting, { color: colors.textSecondary }]}>Olá,</Text>
          <Text style={[styles.userName, { color: colors.text }]}>{userName}</Text>
        </View>
        <View style={[styles.avatarCircle, { backgroundColor: colors.primaryLight }]}>
          <Text style={[styles.avatarText, { color: colors.primary }]}>{userName.charAt(0).toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Seus Progressos</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statsRow}>
          {stats.map((stat, i) => (
            <View key={i} style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.statIconWrap, { backgroundColor: stat.color + '18' }]}>
                <Ionicons name={stat.icon as any} size={18} color={stat.color} />
              </View>
              <Text style={[styles.statValue, { color: colors.text }]} numberOfLines={1}>{stat.value}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]} numberOfLines={1}>{stat.label}</Text>
            </View>
          ))}
        </ScrollView>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Ações Rápidas</Text>
        <View style={styles.actionsRow}>
          {quickActions.map((action, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.actionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
              activeOpacity={0.7}
              onPress={() => router.push(action.screen)}
            >
              <View style={[styles.actionIconWrap, { backgroundColor: colors.primary + '15' }]}>
                <Ionicons name={action.icon} size={22} color={colors.primary} />
              </View>
              <Text style={[styles.actionLabel, { color: colors.text }]} numberOfLines={2}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={[styles.section, { marginBottom: Spacing.xxl }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Atividade Recente</Text>
        {recentActivity.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="time-outline" size={32} color={colors.tabInactive} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Nenhuma atividade ainda</Text>
            <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>Comece enviando uma redação ou fazendo um simulado</Text>
          </View>
        ) : (
          recentActivity.map((activity) => (
            <View
              key={activity.id}
              style={[styles.activityCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={[styles.activityDot, { backgroundColor: activity.type === 'essay' ? colors.accent : colors.success }]} />
              <View style={styles.activityInfo}>
                <Text style={[styles.activityTitle, { color: colors.text }]} numberOfLines={1}>{activity.title}</Text>
                <Text style={[styles.activityDate, { color: colors.textSecondary }]}>{formatDate(activity.date)}</Text>
              </View>
              <Ionicons
                name={activity.type === 'essay' ? 'document-text-outline' : 'school-outline'}
                size={18}
                color={colors.textSecondary}
              />
            </View>
          ))
        )}
      </View>
    </ScrollView>
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
    paddingBottom: 24,
  },
  header: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingHorizontal: Spacing.xl,
    paddingTop: 60,
    paddingBottom: Spacing.xl,
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
  section: {
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.xl,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600' as const,
    marginBottom: Spacing.md,
  },
  statsRow: {
    paddingRight: Spacing.md,
    gap: Spacing.sm,
  },
  statCard: {
    minWidth: 110,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  statIconWrap: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.sm,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginBottom: Spacing.sm,
  },
  statValue: {
    fontSize: FontSize.lg,
    fontWeight: '700' as const,
  },
  statLabel: {
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: 'row' as const,
    gap: Spacing.sm,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center' as const,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  actionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginBottom: Spacing.sm,
  },
  actionLabel: {
    fontSize: FontSize.xs,
    fontWeight: '600' as const,
    textAlign: 'center' as const,
  },
  emptyCard: {
    alignItems: 'center' as const,
    padding: Spacing.xxl,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  emptyText: {
    fontSize: FontSize.md,
    fontWeight: '600' as const,
  },
  emptySubtext: {
    fontSize: FontSize.sm,
    textAlign: 'center' as const,
  },
  activityCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    padding: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  activityInfo: {
    flex: 1,
  },
  activityTitle: {
    fontSize: FontSize.sm,
    fontWeight: '500' as const,
  },
  activityDate: {
    fontSize: FontSize.xs,
    marginTop: 2,
  },
};
