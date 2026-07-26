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
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, getColors, Spacing, FontSize, BorderRadius } from '../lib/theme';
import { supabase } from '../lib/supabase';
import {
  getLevelFromXp,
  getLevelTitle,
  ACHIEVEMENTS,
  GamificationStats,
} from '../lib/gamification';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_PADDING = 24;
const CONTENT_PADDING = Spacing.lg;
const STAT_COLS = 2;
const STAT_GAP = Spacing.sm;
const STAT_WIDTH = (SCREEN_WIDTH - CONTENT_PADDING * 2 - CARD_PADDING * 2 - STAT_GAP * (STAT_COLS - 1)) / STAT_COLS;
const ACHIEVE_COLS = 3;
const ACHIEVE_GAP = Spacing.sm;
const ACHIEVE_WIDTH = (SCREEN_WIDTH - CONTENT_PADDING * 2 - CARD_PADDING * 2 - ACHIEVE_GAP * (ACHIEVE_COLS - 1)) / ACHIEVE_COLS;

const COMP_NAMES = ['Norma Culta', 'Compreensão', 'Argumentação', 'Linguagem', 'Intervenção'];
const COMP_COLORS = ['#2563EB', '#4F46E5', '#7C3AED', '#F59E0B', '#10B981'];

export default function PerfilScreen() {
  const colorScheme = useColorScheme();
  const colors = getColors(colorScheme);
  const [refreshing, setRefreshing] = useState(false);
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [userState, setUserState] = useState('');
  const [userCity, setUserCity] = useState('');
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
  const [compValues, setCompValues] = useState([0, 0, 0, 0, 0]);
  const [strengths, setStrengths] = useState<[string, { count: number; avgScore: number }][]>([]);
  const [weaknesses, setWeaknesses] = useState<[string, { count: number; avgScore: number }][]>([]);

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
        setUserState(profile.state || '');
        setUserCity(profile.city || '');
      } else {
        setUserName(user.email?.split('@')[0] || '');
      }

      const [essaysResult, simuladosResult] = await Promise.all([
        supabase
          .from('essay_corrections')
          .select('*')
          .eq('user_id', user.id),
        supabase
          .from('simulado_history')
          .select('*')
          .eq('user_id', user.id),
      ]);

      const essays = essaysResult.data || [];
      const simulados = simuladosResult.data || [];

      const essayScores = essays.map((e: any) => e.score);
      const simuladoScores = simulados.map((s: any) => s.score_percent);

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

      const computedCompValues = totalEssays > 0
        ? [1, 2, 3, 4, 5].map((id) => {
            let sum = 0;
            essays.forEach((e: any) => {
              const comp = (e.competencies || []).find((c: any) => c.id === id);
              sum += comp ? comp.score : 0;
            });
            return Math.round(sum / totalEssays);
          })
        : [0, 0, 0, 0, 0];
      setCompValues(computedCompValues);

      const subjectBreakdown: Record<string, { count: number; avgScore: number }> = {};
      simulados.forEach((s: any) => {
        const subject = s.subject || s.area || 'Geral';
        if (!subjectBreakdown[subject]) subjectBreakdown[subject] = { count: 0, avgScore: 0 };
        subjectBreakdown[subject].count++;
        subjectBreakdown[subject].avgScore += s.score_percent || 0;
      });
      Object.keys(subjectBreakdown).forEach((k) => {
        subjectBreakdown[k].avgScore = Math.round(subjectBreakdown[k].avgScore / subjectBreakdown[k].count);
      });

      const sortedStrengths = Object.entries(subjectBreakdown)
        .filter(([, data]) => data.avgScore >= 70)
        .sort((a, b) => b[1].avgScore - a[1].avgScore);
      const sortedWeaknesses = Object.entries(subjectBreakdown)
        .filter(([, data]) => data.avgScore < 50)
        .sort((a, b) => a[1].avgScore - b[1].avgScore);

      setStrengths(sortedStrengths);
      setWeaknesses(sortedWeaknesses);
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
    { label: 'XP Total', value: String(stats.totalXp), icon: 'star-outline' as const, iconColor: '#F59E0B', iconBg: '#FEF3C7' },
    { label: 'Sequência', value: `${stats.currentStreak} dias`, icon: 'flame-outline' as const, iconColor: '#F97316', iconBg: '#FED7AA' },
    { label: 'Redações', value: String(stats.totalEssays), icon: 'document-text-outline' as const, iconColor: '#2563EB', iconBg: '#DBEAFE' },
    { label: 'Simulados', value: String(stats.totalSimulados), icon: 'book-outline' as const, iconColor: '#7C3AED', iconBg: '#EDE9FE' },
    { label: 'Questões', value: String(stats.totalQuestionsAnswered), icon: 'checkmark-circle-outline' as const, iconColor: '#10B981', iconBg: '#D1FAE5' },
    { label: 'Nível', value: `Nv. ${level.level}`, icon: 'trophy-outline' as const, iconColor: '#4F46E5', iconBg: '#E0E7FF' },
  ];

  const achievements = ACHIEVEMENTS.map((a) => ({
    ...a,
    unlocked: a.condition(stats),
  }));
  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.bg }]}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.identityCenter}>
          <LinearGradient
            colors={['#3B82F6', '#4F46E5']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.avatarGradient}
          >
            <Text style={styles.avatarInitial}>{initials || '?'}</Text>
          </LinearGradient>

          <Text style={[styles.identityName, { color: colors.text }]} numberOfLines={1}>
            {userName || 'Carregando...'}
          </Text>
          <View style={styles.identityEmailRow}>
            <Ionicons name="mail-outline" size={12} color={colors.textSecondary} />
            <Text style={[styles.identityEmail, { color: colors.textSecondary }]} numberOfLines={1}>
              {userEmail}
            </Text>
          </View>

          {userState ? (
            <View style={styles.identityLocationRow}>
              <Ionicons name="location-outline" size={12} color={colors.primary} />
              <Text style={[styles.identityLocation, { color: colors.textSecondary }]}>
                {userCity ? `${userCity}, ` : ''}{userState}
              </Text>
            </View>
          ) : null}

          <View style={[styles.identityDivider, { backgroundColor: colors.border }]} />
          <View style={styles.xpHeaderRow}>
            <Text style={[styles.xpHeaderLabel, { color: colors.textSecondary }]}>
              {stats.totalXp} XP
            </Text>
            <Text style={[styles.xpHeaderLabel, { color: colors.textSecondary }]}>
              {level.nextThreshold} XP
            </Text>
          </View>
          <View style={[styles.xpBarBg, { backgroundColor: colorScheme === 'dark' ? '#0f172a' : '#E2E8F0' }]}>
            <LinearGradient
              colors={['#3B82F6', '#4F46E5']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.xpBarFill, { width: `${level.progress}%` }]}
            />
          </View>
          <Text style={[styles.xpProgressLabel, { color: colors.textSecondary }]}>
            Progresso para próximo nível
          </Text>
        </View>
      </View>

      <LinearGradient
        colors={['#2563EB', '#1D4ED8']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.levelBadge}
      >
        <Ionicons name="star" size={18} color="#FFFFFF" />
        <View style={styles.levelBadgeTextCol}>
          <Text style={styles.levelBadgeSub}>NÍVEL</Text>
          <Text style={styles.levelBadgeMain}>Nv. {level.level} — {levelTitle}</Text>
        </View>
      </LinearGradient>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.sectionHeaderRow}>
          <Ionicons name="trending-up" size={16} color="#10B981" />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Estatísticas</Text>
        </View>
        <View style={styles.statsGrid}>
          {statItems.map((item) => (
            <View key={item.label} style={[styles.statItem, { backgroundColor: colorScheme === 'dark' ? '#0f172a' : '#F8FAFC', borderColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.06)' : '#E2E8F0' }]}>
              <View style={[styles.statIconBg, { backgroundColor: item.iconBg }]}>
                <Ionicons name={item.icon} size={14} color={item.iconColor} />
              </View>
              <Text style={[styles.statValue, { color: colors.text }]}>{item.value}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]} numberOfLines={1}>
                {item.label}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.sectionHeaderRow}>
          <Ionicons name="bar-chart" size={16} color="#7C3AED" />
          <View>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Análise de Competências</Text>
            <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>
              Habilidades do ENEM por competência
            </Text>
          </View>
        </View>
        {stats.totalEssays === 0 ? (
          <View style={[styles.emptyState, { borderColor: colors.border }]}>
            <Ionicons name="bar-chart-outline" size={28} color={colors.textTertiary} />
            <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>Radar vazio</Text>
            <Text style={[styles.emptyDesc, { color: colors.textTertiary }]}>
              Envie uma redação para mapear seu gráfico de competências.
            </Text>
          </View>
        ) : (
          <View style={styles.compList}>
            {COMP_NAMES.map((name, i) => {
              const pct = Math.min((compValues[i] / 200) * 100, 100);
              return (
                <View key={i} style={styles.compRow}>
                  <View style={styles.compHeader}>
                    <Text style={[styles.compName, { color: colors.text }]} numberOfLines={1}>
                      {name}
                    </Text>
                    <Text style={[styles.compScore, { color: COMP_COLORS[i] }]}>
                      {compValues[i]}
                    </Text>
                  </View>
                  <View style={[styles.compBarBg, { backgroundColor: colorScheme === 'dark' ? '#0f172a' : '#E2E8F0' }]}>
                    <View
                      style={[styles.compBarFill, { backgroundColor: COMP_COLORS[i], width: `${pct}%` }]}
                    />
                  </View>
                </View>
              );
            })}
            <Text style={[styles.compFooter, { color: colors.textSecondary }]}>
              Meta: Equilibrar e expandir rumo a 200 pts
            </Text>
          </View>
        )}
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.achieveHeader}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="trophy" size={16} color="#F59E0B" />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Conquistas</Text>
          </View>
          <View style={[styles.achieveBadge, { backgroundColor: colorScheme === 'dark' ? 'rgba(245,158,11,0.15)' : '#FEF3C7' }]}>
            <Text style={[styles.achieveBadgeText, { color: '#D97706' }]}>
              {unlockedCount} / {achievements.length}
            </Text>
          </View>
        </View>
        <View style={styles.achievementsGrid}>
          {achievements.map((a) => (
            <View
              key={a.id}
              style={[
                styles.achieveItem,
                { backgroundColor: colorScheme === 'dark' ? '#0f172a' : '#F8FAFC', borderColor: colorScheme === 'dark' ? 'rgba(255,255,255,0.06)' : '#E2E8F0' },
                !a.unlocked && styles.achieveItemLocked,
              ]}
            >
              <Text style={styles.achieveIcon}>{a.unlocked ? a.icon : '🔒'}</Text>
              <Text
                style={[styles.achieveTitle, { color: colors.text }]}
                numberOfLines={2}
              >
                {a.title}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.sectionHeaderRow}>
          <Ionicons name="pulse" size={16} color="#2563EB" />
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Pontos Fortes & Melhorias</Text>
        </View>
        {strengths.length === 0 && weaknesses.length === 0 ? (
          <View style={[styles.emptyState, { borderColor: colors.border }]}>
            <Ionicons name="bar-chart-outline" size={28} color={colors.textTertiary} />
            <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>Sem dados suficientes</Text>
            <Text style={[styles.emptyDesc, { color: colors.textTertiary }]}>
              Complete mais simulados para ver seus pontos fortes e fracos.
            </Text>
          </View>
        ) : (
          <View style={styles.swContainer}>
            <View style={styles.swColumn}>
              <View style={styles.swHeader}>
                <Ionicons name="trending-up" size={12} color="#10B981" />
                <Text style={[styles.swHeaderText, { color: '#10B981' }]}>PONTOS FORTES (&gt;70%)</Text>
              </View>
              {strengths.length === 0 ? (
                <Text style={[styles.swEmpty, { color: colors.textTertiary }]}>
                  Nenhuma matéria acima de 70% ainda.
                </Text>
              ) : (
                strengths.map(([subject, data]) => (
                  <View key={subject} style={[styles.swItem, { backgroundColor: colorScheme === 'dark' ? 'rgba(16,185,129,0.08)' : '#ECFDF5', borderColor: colorScheme === 'dark' ? 'rgba(16,185,129,0.2)' : '#A7F3D0' }]}>
                    <View style={styles.swItemHeader}>
                      <Text style={[styles.swItemName, { color: '#059669' }]} numberOfLines={1}>{subject}</Text>
                      <Text style={[styles.swItemScore, { color: '#10B981' }]}>{data.avgScore}%</Text>
                    </View>
                    <View style={[styles.swBarBg, { backgroundColor: colorScheme === 'dark' ? 'rgba(16,185,129,0.15)' : '#A7F3D0' }]}>
                      <LinearGradient
                        colors={['#34D399', '#059669']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[styles.swBarFill, { width: `${data.avgScore}%` }]}
                      />
                    </View>
                    <Text style={[styles.swItemCount, { color: '#10B981' }]}>
                      {data.count} simulado{data.count > 1 ? 's' : ''}
                    </Text>
                  </View>
                ))
              )}
            </View>

            <View style={styles.swColumn}>
              <View style={styles.swHeader}>
                <Ionicons name="trending-down" size={12} color="#EF4444" />
                <Text style={[styles.swHeaderText, { color: '#EF4444' }]}>MELHORIAS (&lt;50%)</Text>
              </View>
              {weaknesses.length === 0 ? (
                <Text style={[styles.swEmpty, { color: colors.textTertiary }]}>
                  Nenhuma matéria abaixo de 50%. Continue assim!
                </Text>
              ) : (
                weaknesses.map(([subject, data]) => (
                  <View key={subject} style={[styles.swItem, { backgroundColor: colorScheme === 'dark' ? 'rgba(239,68,68,0.08)' : '#FEF2F2', borderColor: colorScheme === 'dark' ? 'rgba(239,68,68,0.2)' : '#FECACA' }]}>
                    <View style={styles.swItemHeader}>
                      <View style={styles.swItemNameRow}>
                        <Ionicons name="warning" size={10} color="#EF4444" />
                        <Text style={[styles.swItemName, { color: '#DC2626' }]} numberOfLines={1}>{subject}</Text>
                      </View>
                      <Text style={[styles.swItemScore, { color: '#EF4444' }]}>{data.avgScore}%</Text>
                    </View>
                    <View style={[styles.swBarBg, { backgroundColor: colorScheme === 'dark' ? 'rgba(239,68,68,0.15)' : '#FECACA' }]}>
                      <LinearGradient
                        colors={['#F87171', '#DC2626']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[styles.swBarFill, { width: `${data.avgScore}%` }]}
                      />
                    </View>
                    <Text style={[styles.swItemCount, { color: '#EF4444' }]}>
                      {data.count} simulado{data.count > 1 ? 's' : ''}
                    </Text>
                  </View>
                ))
              )}
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: CONTENT_PADDING,
    paddingBottom: 40,
  },
  card: {
    borderRadius: BorderRadius.card,
    borderWidth: 1,
    padding: CARD_PADDING,
    marginBottom: Spacing.lg,
  },
  identityCenter: {
    alignItems: 'center',
  },
  avatarGradient: {
    width: 80,
    height: 80,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  avatarInitial: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '700',
  },
  identityName: {
    fontSize: FontSize.xl,
    fontWeight: '800',
    marginBottom: 2,
    textAlign: 'center',
  },
  identityEmailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: Spacing.sm,
  },
  identityEmail: {
    fontSize: FontSize.sm,
  },
  identityLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: Spacing.md,
  },
  identityLocation: {
    fontSize: FontSize.xs,
  },
  identityDivider: {
    height: 1,
    width: '100%',
    marginBottom: Spacing.md,
  },
  xpHeaderRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  xpHeaderLabel: {
    fontSize: 9,
    fontWeight: '600',
  },
  xpBarBg: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  xpBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  xpProgressLabel: {
    fontSize: 9,
  },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  levelBadgeTextCol: {
    flex: 1,
  },
  levelBadgeSub: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
  },
  levelBadgeMain: {
    color: '#FFFFFF',
    fontSize: FontSize.md,
    fontWeight: '700',
    marginTop: 1,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontWeight: '800',
  },
  sectionSub: {
    fontSize: FontSize.xs,
    marginTop: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: STAT_GAP,
  },
  statItem: {
    width: STAT_WIDTH,
    alignItems: 'center',
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: 4,
  },
  statIconBg: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statValue: {
    fontSize: FontSize.base,
    fontWeight: '700',
    marginTop: 2,
  },
  statLabel: {
    fontSize: FontSize.xs,
    textAlign: 'center',
  },
  compList: {
    gap: Spacing.md,
  },
  compRow: {
    gap: 6,
  },
  compHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  compName: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    flex: 1,
  },
  compScore: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  compBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  compBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  compFooter: {
    fontSize: FontSize.xs,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: BorderRadius.lg,
    gap: Spacing.xs,
  },
  emptyTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  emptyDesc: {
    fontSize: FontSize.xs,
    textAlign: 'center',
    paddingHorizontal: Spacing.lg,
    lineHeight: 16,
  },
  achieveHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  achieveBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  achieveBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  achievementsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ACHIEVE_GAP,
  },
  achieveItem: {
    width: ACHIEVE_WIDTH,
    alignItems: 'center',
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    gap: 4,
  },
  achieveItemLocked: {
    opacity: 0.4,
  },
  achieveIcon: {
    fontSize: 24,
  },
  achieveTitle: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    textAlign: 'center',
  },
  swContainer: {
    gap: Spacing.lg,
  },
  swColumn: {
    gap: Spacing.sm,
  },
  swHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.xs,
  },
  swHeaderText: {
    fontSize: FontSize.xs,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  swEmpty: {
    fontSize: FontSize.xs,
    fontStyle: 'italic',
    paddingLeft: Spacing.lg,
  },
  swItem: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: 6,
  },
  swItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  swItemNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  swItemName: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    flex: 1,
  },
  swItemScore: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  swBarBg: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  swBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  swItemCount: {
    fontSize: 9,
  },
});
