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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, getColors, Spacing, FontSize, BorderRadius } from '../../lib/theme';
import { fetchEnemQuestions } from '../../lib/api';
import { saveSimulado, getProfile, upsertProfile } from '../../lib/supabase';
import { supabase } from '../../lib/supabase';
import { useFocusEffect } from 'expo-router';

const SUBJECTS = [
  { key: 'Geral', label: 'Geral', icon: 'school' as const },
  { key: 'Matemática', label: 'Matemática', icon: 'calculator' as const },
  { key: 'Humanas', label: 'Humanas', icon: 'people' as const },
  { key: 'Natureza', label: 'Natureza', icon: 'leaf' as const },
  { key: 'Linguagens', label: 'Linguagens', icon: 'language' as const },
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
  const isDark = colorScheme === 'dark';

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
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Configurar Simulado</Text>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="book" size={20} color={colors.primary} />
            <Text style={[styles.cardTitle, { color: colors.text }]}>Área</Text>
          </View>
          <View style={styles.optionGrid}>
            {SUBJECTS.map(s => (
              <TouchableOpacity
                key={s.key}
                style={[
                  styles.optionChip,
                  {
                    backgroundColor: subject === s.key ? colors.primary : colors.input,
                    borderColor: subject === s.key ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setSubject(s.key)}
              >
                <Ionicons
                  name={s.icon}
                  size={18}
                  color={subject === s.key ? '#fff' : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.optionLabel,
                    { color: subject === s.key ? '#fff' : colors.text },
                  ]}
                >
                  {s.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="calendar" size={20} color={colors.primary} />
            <Text style={[styles.cardTitle, { color: colors.text }]}>Edição (Ano)</Text>
          </View>
          <View style={styles.optionRow}>
            {YEAR_OPTIONS.map(y => (
              <TouchableOpacity
                key={y}
                style={[
                  styles.yearChip,
                  {
                    backgroundColor: year === y ? colors.primary : colors.input,
                    borderColor: year === y ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setYear(y)}
              >
                <Text
                  style={[
                    styles.yearLabel,
                    { color: year === y ? '#fff' : colors.text },
                  ]}
                >
                  {y}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="list" size={20} color={colors.primary} />
            <Text style={[styles.cardTitle, { color: colors.text }]}>Quantidade</Text>
          </View>
          <View style={styles.optionRow}>
            {COUNTS.map(c => (
              <TouchableOpacity
                key={c}
                style={[
                  styles.countChip,
                  {
                    backgroundColor: count === c ? colors.primary : colors.input,
                    borderColor: count === c ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setCount(c)}
              >
                <Text
                  style={[
                    styles.countLabel,
                    { color: count === c ? '#fff' : colors.text },
                  ]}
                >
                  {c}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.startButton, { backgroundColor: colors.primary, opacity: loading ? 0.7 : 1 }]}
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
      </ScrollView>
    );
  }

  function renderQuiz() {
    const q = questions[currentIndex];
    if (!q) return null;

    const alternatives = normalizeAlternatives(q);
    const labels = ['A', 'B', 'C', 'D', 'E'];
    const selected = answers[currentIndex];

    return (
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        <View style={[styles.quizHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
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
            <Ionicons name="close" size={24} color={colors.danger} />
          </TouchableOpacity>

          <View style={styles.timerContainer}>
            <Ionicons name="time" size={16} color={colors.primary} />
            <Text style={[styles.timerText, { color: colors.text }]}>{formatTime(elapsedTime)}</Text>
          </View>

          <Text style={[styles.progressText, { color: colors.textSecondary }]}>
            {currentIndex + 1}/{questions.length}
          </Text>
        </View>

        <View style={[styles.progressBarOuter, { backgroundColor: colors.surfaceAlt }]}>
          <View
            style={[
              styles.progressBarInner,
              {
                width: `${((currentIndex + 1) / questions.length) * 100}%`,
                backgroundColor: colors.primary,
              },
            ]}
          />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {q.enem_area && (
            <View style={[styles.areaTag, { backgroundColor: colors.primaryLight }]}>
              <Text style={[styles.areaTagText, { color: colors.primary }]}>{q.enem_area}</Text>
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
                    {
                      backgroundColor: isSelected ? colors.primaryLight : colors.surface,
                      borderColor: isSelected ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => selectAnswer(currentIndex, label)}
                >
                  <View
                    style={[
                      styles.optionLetter,
                      {
                        backgroundColor: isSelected ? colors.primary : colors.input,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.optionLetterText,
                        { color: isSelected ? '#fff' : colors.text },
                      ]}
                    >
                      {label}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.optionText,
                      { color: colors.text },
                      isSelected && { fontWeight: '600' },
                    ]}
                  >
                    {alt}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        <View style={[styles.quizFooter, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[
              styles.navButton,
              { backgroundColor: colors.input, borderColor: colors.border },
              currentIndex === 0 && { opacity: 0.4 },
            ]}
            onPress={prevQuestion}
            disabled={currentIndex === 0}
          >
            <Ionicons name="chevron-back" size={18} color={colors.text} />
            <Text style={[styles.navButtonText, { color: colors.text }]}>Voltar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.navButtonPrimary, { backgroundColor: colors.primary }]}
            onPress={nextQuestion}
          >
            <Text style={styles.navButtonPrimaryText}>
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
    const scoreColor =
      resultScore >= 80 ? colors.success : resultScore >= 50 ? colors.warning : colors.danger;

    return (
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.resultScoreCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons
            name={resultScore >= 60 ? 'trophy' : resultScore >= 40 ? 'medal' : 'refresh'}
            size={48}
            color={scoreColor}
          />
          <Text style={[styles.resultScoreBig, { color: scoreColor }]}>{resultScore}%</Text>
          <Text style={[styles.resultScoreSub, { color: colors.textSecondary }]}>
            {correct} de {questions.length} corretas
          </Text>
          <Text style={[styles.resultTime, { color: colors.textSecondary }]}>
            Tempo: {formatTime(elapsedTime)}
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="pie-chart" size={20} color={colors.primary} />
            <Text style={[styles.cardTitle, { color: colors.text }]}>Desempenho por Área</Text>
          </View>
          {Object.entries(resultBreakdown).map(([area, data]) => {
            const areaPct = data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0;
            const barColor =
              areaPct >= 80 ? colors.success : areaPct >= 50 ? colors.warning : colors.danger;
            return (
              <View key={area} style={styles.breakdownItem}>
                <View style={styles.breakdownHeader}>
                  <Text style={[styles.breakdownArea, { color: colors.text }]}>{area}</Text>
                  <Text style={[styles.breakdownScore, { color: barColor }]}>
                    {data.correct}/{data.total} ({areaPct}%)
                  </Text>
                </View>
                <View style={[styles.progressBar, { backgroundColor: colors.surfaceAlt }]}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${areaPct}%`, backgroundColor: barColor },
                    ]}
                  />
                </View>
              </View>
            );
          })}
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.cardHeader}>
            <Ionicons name="document-text" size={20} color={colors.accent} />
            <Text style={[styles.cardTitle, { color: colors.text }]}>Revisão</Text>
          </View>
          {questions.map((q, i) => {
            const labels = ['A', 'B', 'C', 'D', 'E'];
            const userAnswer = answers[i];
            const correctIndex = q.correct_answer?.trim().toUpperCase();
            const correctLetter =
              correctIndex && !isNaN(Number(correctIndex))
                ? String.fromCharCode(64 + Number(correctIndex))
                : correctIndex;
            const isCorrect = userAnswer === correctLetter;
            const alternatives = normalizeAlternatives(q);

            return (
              <View
                key={q.id || i}
                style={[
                  styles.reviewItem,
                  {
                    backgroundColor: isCorrect ? colors.successLight : colors.dangerLight,
                    borderLeftColor: isCorrect ? colors.success : colors.danger,
                  },
                ]}
              >
                <View style={styles.reviewHeader}>
                  <Ionicons
                    name={isCorrect ? 'checkmark-circle' : 'close-circle'}
                    size={18}
                    color={isCorrect ? colors.success : colors.danger}
                  />
                  <Text style={[styles.reviewNumber, { color: colors.text }]}>Q{i + 1}</Text>
                  {q.enem_area && (
                    <Text style={[styles.reviewArea, { color: colors.textSecondary }]}>{q.enem_area}</Text>
                  )}
                </View>
                <Text style={[styles.reviewStatement, { color: colors.text }]} numberOfLines={3}>
                  {q.statement}
                </Text>
                {!isCorrect && (
                  <View style={styles.reviewAnswers}>
                    <Text style={[styles.reviewAnswer, { color: colors.danger }]}>
                      Sua resposta: {userAnswer || '-'}
                    </Text>
                    <Text style={[styles.reviewAnswer, { color: colors.success }]}>
                      Resposta correta: {correctLetter}
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        <TouchableOpacity
          style={[styles.startButton, { backgroundColor: colors.primary }]}
          onPress={() => setScreen('config')}
        >
          <Ionicons name="arrow-back" size={20} color="#fff" />
          <Text style={styles.startButtonText}>Novo Simulado</Text>
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
              { backgroundColor: colors.surface, borderBottomColor: colors.border },
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
  scrollContent: { padding: Spacing.lg, paddingBottom: 100 },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: '700', marginBottom: Spacing.md },
  card: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  cardTitle: { fontSize: FontSize.md, fontWeight: '600' },
  optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  optionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  optionLabel: { fontSize: FontSize.sm, fontWeight: '500' },
  optionRow: { flexDirection: 'row', gap: Spacing.sm },
  yearChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  yearLabel: { fontSize: FontSize.sm, fontWeight: '600' },
  countChip: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    alignItems: 'center',
  },
  countLabel: { fontSize: FontSize.lg, fontWeight: '700' },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
    marginBottom: 60,
  },
  startButtonText: { fontSize: FontSize.md, fontWeight: '700', color: '#fff' },
  quizHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: 56,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    gap: Spacing.md,
  },
  timerContainer: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flex: 1 },
  timerText: { fontSize: FontSize.lg, fontWeight: '700', fontVariant: ['tabular-nums'] },
  progressText: { fontSize: FontSize.sm, fontWeight: '600' },
  progressBarOuter: { height: 4 },
  progressBarInner: { height: '100%', borderRadius: 2 },
  areaTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.md,
  },
  areaTagText: { fontSize: FontSize.xs, fontWeight: '600' },
  questionText: {
    fontSize: FontSize.md,
    lineHeight: 24,
    marginBottom: Spacing.lg,
  },
  optionsContainer: { gap: Spacing.sm },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1.5,
  },
  optionLetter: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionLetterText: { fontSize: FontSize.sm, fontWeight: '700' },
  optionText: { fontSize: FontSize.sm, flex: 1, lineHeight: 20, paddingTop: 4 },
  quizFooter: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    gap: Spacing.sm,
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  navButtonText: { fontSize: FontSize.sm, fontWeight: '600' },
  navButtonPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.sm,
    flex: 1,
    justifyContent: 'center',
  },
  navButtonPrimaryText: { fontSize: FontSize.sm, fontWeight: '700', color: '#fff' },
  resultScoreCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.xxl,
    alignItems: 'center',
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  resultScoreBig: { fontSize: 48, fontWeight: '800' },
  resultScoreSub: { fontSize: FontSize.md },
  resultTime: { fontSize: FontSize.sm },
  progressBar: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  breakdownItem: { marginBottom: Spacing.md },
  breakdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  breakdownArea: { fontSize: FontSize.sm, fontWeight: '600' },
  breakdownScore: { fontSize: FontSize.sm, fontWeight: '700' },
  reviewItem: {
    borderLeftWidth: 3,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginBottom: Spacing.xs },
  reviewNumber: { fontSize: FontSize.sm, fontWeight: '700' },
  reviewArea: { fontSize: FontSize.xs },
  reviewStatement: { fontSize: FontSize.sm, lineHeight: 20 },
  reviewAnswers: { marginTop: Spacing.xs, gap: 2 },
  reviewAnswer: { fontSize: FontSize.xs, fontWeight: '600' },
});
