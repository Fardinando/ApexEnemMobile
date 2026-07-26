import { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  useColorScheme,
  Alert,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getColors, Spacing, FontSize, BorderRadius } from '../../lib/theme';
import { fetchEnemQuestions } from '../../lib/api';
import { saveSimulado, getProfile, upsertProfile } from '../../lib/supabase';
import { supabase } from '../../lib/supabase';
import { useFocusEffect } from 'expo-router';

const SUBJECTS = [
  { key: 'Geral', label: 'Geral' },
  { key: 'Matemática', label: 'Matemática' },
  { key: 'Humanas', label: 'Humanas' },
  { key: 'Natureza', label: 'Natureza' },
  { key: 'Linguagens', label: 'Linguagens' },
];

const COUNTS = [5, 10, 20];

const YEAR_OPTIONS = [2022, 2021, 2020, 2019, 2018];

type Screen = 'config' | 'quiz' | 'results';

interface Question {
  id: string;
  enem_area: string;
  statement: string;
  alternatives: string[];
  alternatives_object?: Record<string, string>;
  correct_answer: string;
}

export default function SimuladosScreen() {
  const colorScheme = useColorScheme();
  const colors = getColors(colorScheme);

  const [screen, setScreen] = useState<Screen>('config');
  const [subject, setSubject] = useState('Geral');
  const [count, setCount] = useState(10);
  const [year, setYear] = useState(2022);
  const [loading, setLoading] = useState(false);

  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [elapsedTime, setElapsedTime] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [resultScore, setResultScore] = useState(0);
  const [resultBreakdown, setResultBreakdown] = useState<Record<string, { correct: number; total: number }>>({});

  useFocusEffect(
    useCallback(() => {
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }, [])
  );

  function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  function normalizeAlternatives(q: Question): string[] {
    if (q.alternatives_object) {
      const keys = ['A', 'B', 'C', 'D', 'E'];
      return keys.map(k => (q.alternatives_object || {})[k] || '');
    }
    return q.alternatives || [];
  }

  async function startSimulado() {
    setLoading(true);
    try {
      let allQuestions: Question[] = [];
      const perSubjectCount = subject === 'Geral' ? Math.ceil(count / 4) + 2 : count + 5;

      if (subject === 'Geral') {
        const areas = ['Matemática', 'Humanas', 'Natureza', 'Linguagens'];
        const promises = areas.map(area => fetchEnemQuestions(year, Math.ceil(count / 4) + 2, 0));
        const results = await Promise.allSettled(promises);
        for (const r of results) {
          if (r.status === 'fulfilled') {
            const data = r.value;
            const qs = data.questions || data.data || (Array.isArray(data) ? data : []);
            allQuestions.push(...qs);
          }
        }
      } else {
        const data = await fetchEnemQuestions(year, perSubjectCount, 0);
        const qs = data.questions || data.data || (Array.isArray(data) ? data : []);
        allQuestions.push(...qs);
      }

      if (subject !== 'Geral') {
        allQuestions = allQuestions.filter(
          (q: Question) =>
            q.enem_area?.toLowerCase().includes(subject.toLowerCase()) ||
            q.enem_area?.toLowerCase() === subject.toLowerCase()
        );
      }

      if (allQuestions.length === 0) {
        Alert.alert('Sem questões', 'Nenhuma questão encontrada para os filtros selecionados.');
        setLoading(false);
        return;
      }

      const shuffled = allQuestions.sort(() => Math.random() - 0.5);
      const selected = shuffled.slice(0, count);

      setQuestions(selected);
      setCurrentIndex(0);
      setAnswers({});
      setElapsedTime(0);
      setScreen('quiz');

      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setElapsedTime(prev => prev + 1);
      }, 1000);
    } catch (e: any) {
      Alert.alert('Erro', e.message || 'Falha ao carregar questões.');
    } finally {
      setLoading(false);
    }
  }

  function selectAnswer(questionIndex: number, answer: string) {
    setAnswers(prev => ({ ...prev, [questionIndex]: answer }));
  }

  function nextQuestion() {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      finishSimulado();
    }
  }

  function prevQuestion() {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }

  async function finishSimulado() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    let correct = 0;
    const breakdown: Record<string, { correct: number; total: number }> = {};

    questions.forEach((q, i) => {
      const area = q.enem_area || 'Outro';
      if (!breakdown[area]) breakdown[area] = { correct: 0, total: 0 };
      breakdown[area].total++;

      const userAnswer = answers[i];
      const normalized = normalizeAlternatives(q);
      const correctIndex = q.correct_answer?.trim().toUpperCase();
      const correctLetter = correctIndex && !isNaN(Number(correctIndex))
        ? String.fromCharCode(64 + Number(correctIndex))
        : correctIndex;

      if (userAnswer === correctLetter) {
        correct++;
        breakdown[area].correct++;
      }
    });

    const scorePercent = Math.round((correct / questions.length) * 100);
    setResultScore(scorePercent);
    setResultBreakdown(breakdown);
    setScreen('results');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await saveSimulado({
          user_id: session.user.id,
          subject,
          year,
          total_questions: questions.length,
          correct_answers: correct,
          score_percent: scorePercent,
          answers,
          time_seconds: elapsedTime,
          created_at: new Date().toISOString(),
        });

        const profile = await getProfile(session.user.id);
        if (profile) {
          await upsertProfile({
            id: session.user.id,
            totalXp: (profile.totalXp || 0) + correct * 10,
          });
        }
      }
    } catch {}
  }

  function renderConfig() {
    return (
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.centeredCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.configTitle, { color: colors.text }]}>Configurar Simulado</Text>

          <Text style={[styles.configSectionLabel, { color: colors.textSecondary }]}>Área</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {SUBJECTS.map(s => (
              <TouchableOpacity
                key={s.key}
                style={[
                  styles.chip,
                  subject === s.key
                    ? { backgroundColor: '#2563EB' }
                    : { backgroundColor: colors.surface, borderColor: '#E2E8F0', borderWidth: 1 },
                ]}
                onPress={() => setSubject(s.key)}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: subject === s.key ? '#FFFFFF' : '#64748b' },
                  ]}
                >
                  {s.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={[styles.configSectionLabel, { color: colors.textSecondary }]}>Edição (Ano)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {YEAR_OPTIONS.map(y => (
              <TouchableOpacity
                key={y}
                style={[
                  styles.chip,
                  year === y
                    ? { backgroundColor: '#2563EB' }
                    : { backgroundColor: colors.surface, borderColor: '#E2E8F0', borderWidth: 1 },
                ]}
                onPress={() => setYear(y)}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: year === y ? '#FFFFFF' : '#64748b' },
                  ]}
                >
                  {y}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={[styles.configSectionLabel, { color: colors.textSecondary }]}>Quantidade</Text>
          <View style={styles.chipRow}>
            {COUNTS.map(c => (
              <TouchableOpacity
                key={c}
                style={[
                  styles.chip,
                  styles.countChip,
                  count === c
                    ? { backgroundColor: '#2563EB' }
                    : { backgroundColor: colors.surface, borderColor: '#E2E8F0', borderWidth: 1 },
                ]}
                onPress={() => setCount(c)}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: count === c ? '#FFFFFF' : '#64748b' },
                  ]}
                >
                  {c}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.startButton, { opacity: loading ? 0.7 : 1 }]}
            onPress={startSimulado}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="play" size={20} color="#fff" />
                <Text style={styles.startButtonText}>Iniciar Simulado</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  function renderQuiz() {
    const q = questions[currentIndex];
    if (!q) return null;

    const alternatives = normalizeAlternatives(q);
    const labels = ['A', 'B', 'C', 'D', 'E'];
    const selected = answers[currentIndex];
    const progressPct = ((currentIndex + 1) / questions.length) * 100;

    return (
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={[styles.quizHeader, { backgroundColor: colors.surface, borderBottomColor: '#E2E8F0' }]}>
          <TouchableOpacity onPress={() => {
            Alert.alert(
              'Sair do simulado',
              'Tem certeza? Seu progresso será perdido.',
              [
                { text: 'Cancelar', style: 'cancel' },
                {
                  text: 'Sair',
                  style: 'destructive',
                  onPress: () => {
                    if (timerRef.current) clearInterval(timerRef.current);
                    setScreen('config');
                  },
                },
              ]
            );
          }}>
            <Ionicons name="close" size={24} color="#ef4444" />
          </TouchableOpacity>

          <View style={styles.timerContainer}>
            <Ionicons name="time" size={16} color={colors.primary} />
            <Text style={[styles.timerText, { color: colors.text }]}>{formatTime(elapsedTime)}</Text>
          </View>

          <Text style={[styles.progressText, { color: '#64748b' }]}>
            {currentIndex + 1}/{questions.length}
          </Text>
        </View>

        <View style={styles.progressBarOuter}>
          <View
            style={[
              styles.progressBarInner,
              { width: `${progressPct}%` },
            ]}
          />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.quizScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.questionCard, { backgroundColor: colors.surface, borderColor: '#E2E8F0' }]}>
            {q.enem_area && (
              <View style={styles.areaTag}>
                <Text style={styles.areaTagText}>{q.enem_area}</Text>
              </View>
            )}

            <Text style={[styles.questionText, { color: colors.text }]}>{q.statement}</Text>

            <View style={styles.optionsContainer}>
              {alternatives.map((alt, i) => {
                const label = labels[i];
                const isSelected = selected === label;

                return (
                  <TouchableOpacity
                    key={label}
                    style={[
                      styles.optionCard,
                      isSelected
                        ? { backgroundColor: '#eff6ff', borderColor: '#2563EB' }
                        : { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' },
                    ]}
                    onPress={() => selectAnswer(currentIndex, label)}
                  >
                    <View
                      style={[
                        styles.optionLetter,
                        isSelected
                          ? { backgroundColor: '#2563EB' }
                          : { backgroundColor: '#F1F5F9' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.optionLetterText,
                          { color: isSelected ? '#FFFFFF' : '#64748b' },
                        ]}
                      >
                        {label}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.optionText,
                        { color: isSelected ? colors.text : colors.text },
                      ]}
                    >
                      {alt}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </ScrollView>

        <View style={[styles.dotsContainer, { backgroundColor: colors.surface, borderTopColor: '#E2E8F0' }]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dotsScroll}
          >
            {questions.map((_, i) => {
              const isCurrent = i === currentIndex;
              const isAnswered = answers[i] !== undefined;
              return (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.dot,
                    isCurrent
                      ? { backgroundColor: '#2563EB' }
                      : isAnswered
                        ? { backgroundColor: '#dbeafe' }
                        : { backgroundColor: '#F1F5F9' },
                  ]}
                  onPress={() => setCurrentIndex(i)}
                >
                  <Text
                    style={[
                      styles.dotText,
                      { color: isCurrent ? '#FFFFFF' : isAnswered ? '#2563EB' : '#64748b' },
                    ]}
                  >
                    {i + 1}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <TouchableOpacity
            style={[styles.nextButton, { backgroundColor: '#2563EB' }]}
            onPress={nextQuestion}
          >
            <Text style={styles.nextButtonText}>
              {currentIndex === questions.length - 1 ? 'Finalizar' : 'Próxima'}
            </Text>
            <Ionicons
              name={currentIndex === questions.length - 1 ? 'checkmark' : 'chevron-forward'}
              size={18}
              color="#fff"
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  function renderResults() {
    const correct = Math.round((resultScore / 100) * questions.length);

    return (
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.centeredCard, { backgroundColor: colors.surface, borderColor: '#E2E8F0' }]}>
          <Text style={styles.trophyEmoji}>🏆</Text>
          <Text style={[styles.scoreDisplay, { color: colors.text }]}>{resultScore}%</Text>
          <Text style={[styles.accuracyLabel, { color: '#64748b' }]}>
            {correct} de {questions.length} corretas
          </Text>
          <Text style={[styles.timeLabel, { color: '#64748b' }]}>
            Tempo: {formatTime(elapsedTime)}
          </Text>
        </View>

        <View style={[styles.centeredCard, { backgroundColor: colors.surface, borderColor: '#E2E8F0' }]}>
          <Text style={[styles.breakdownTitle, { color: colors.text }]}>Desempenho por Área</Text>
          {Object.entries(resultBreakdown).map(([area, data]) => {
            const areaPct = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0;
            const barColor =
              areaPct >= 80 ? '#10b981' : areaPct >= 50 ? '#f59e0b' : '#ef4444';
            return (
              <View key={area} style={styles.breakdownItem}>
                <View style={styles.breakdownHeader}>
                  <Text style={[styles.breakdownArea, { color: colors.text }]}>{area}</Text>
                  <Text style={[styles.breakdownScore, { color: barColor }]}>
                    {data.correct}/{data.total} ({areaPct}%)
                  </Text>
                </View>
                <View style={[styles.breakdownBarOuter]}>
                  <View
                    style={[
                      styles.breakdownBarInner,
                      { width: `${areaPct}%`, backgroundColor: barColor },
                    ]}
                  />
                </View>
              </View>
            );
          })}
        </View>

        <TouchableOpacity
          style={[styles.novoButton, { backgroundColor: colors.surface, borderColor: '#E2E8F0' }]}
          onPress={() => setScreen('config')}
        >
          <Ionicons name="refresh" size={20} color="#2563EB" />
          <Text style={[styles.novoButtonText, { color: '#2563EB' }]}>Novo Simulado</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {screen === 'quiz' ? (
        renderQuiz()
      ) : (
        <>
          <View
            style={[
              styles.header,
              { backgroundColor: colors.surface, borderBottomColor: '#E2E8F0' },
            ]}
          >
            <Ionicons name="school" size={28} color={colors.primary} />
            <Text style={[styles.headerTitle, { color: colors.text }]}>Simulados ENEM</Text>
          </View>
          {screen === 'config' ? renderConfig() : renderResults()}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: 56,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    gap: Spacing.sm,
  },
  headerTitle: { fontSize: FontSize.xl, fontWeight: '700', flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: Spacing.lg, paddingBottom: 100, alignItems: 'center' },

  centeredCard: {
    width: '100%',
    borderRadius: BorderRadius.xxl,
    borderWidth: 1,
    padding: 24,
    marginBottom: 16,
  },

  configTitle: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 20,
  },
  configSectionLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 4,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  chipText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  countChip: {
    flex: 1,
    alignItems: 'center',
  },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
    backgroundColor: '#21c55d',
  },
  startButtonText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: '#fff',
  },

  quizHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: 56,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    gap: Spacing.md,
  },
  timerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    flex: 1,
  },
  timerText: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  progressText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  progressBarOuter: {
    height: 6,
    backgroundColor: '#E2E8F0',
  },
  progressBarInner: {
    height: '100%',
    backgroundColor: '#2563EB',
    borderRadius: 3,
  },

  quizScrollContent: {
    padding: Spacing.lg,
    paddingBottom: 16,
  },
  questionCard: {
    borderRadius: BorderRadius.xxl,
    borderWidth: 1,
    padding: 24,
  },
  areaTag: {
    alignSelf: 'flex-start',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 9999,
    marginBottom: 12,
  },
  areaTagText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: '#2563EB',
  },
  questionText: {
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 16,
  },
  optionsContainer: {
    gap: 10,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  optionLetter: {
    width: 24,
    height: 24,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionLetterText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  optionText: {
    fontSize: 12,
    flex: 1,
    lineHeight: 18,
    paddingTop: 2,
  },

  dotsContainer: {
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dotsScroll: {
    gap: 6,
    alignItems: 'center',
  },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotText: {
    fontSize: 11,
    fontWeight: '700',
  },
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  nextButtonText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: '#fff',
  },

  trophyEmoji: {
    fontSize: 48,
    marginBottom: 8,
  },
  scoreDisplay: {
    fontSize: 48,
    fontWeight: '800',
  },
  accuracyLabel: {
    fontSize: FontSize.md,
    fontWeight: '500',
    marginTop: 4,
  },
  timeLabel: {
    fontSize: FontSize.sm,
    marginTop: 4,
  },
  breakdownTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  breakdownItem: {
    marginBottom: 14,
  },
  breakdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  breakdownArea: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  breakdownScore: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  breakdownBarOuter: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  breakdownBarInner: {
    height: '100%',
    borderRadius: 4,
  },

  novoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 40,
  },
  novoButtonText: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
});
