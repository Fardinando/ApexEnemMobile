import { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  useColorScheme,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { generateLesson, pollCura } from '../../lib/api';
import { supabase, upsertProfile, getProfile } from '../../lib/supabase';
import { Colors, getColors, Spacing, FontSize, BorderRadius } from '../../lib/theme';
import { XP_REWARDS } from '../../lib/gamification';

const SUBJECTS = [
  { key: 'redacao', label: 'Redação', icon: 'document-text' as const },
  { key: 'linguagens', label: 'Linguagens', icon: 'book' as const },
  { key: 'humanas', label: 'Humanas', icon: 'earth' as const },
  { key: 'natureza', label: 'Natureza', icon: 'leaf' as const },
  { key: 'matematica', label: 'Matemática', icon: 'calculator' as const },
];

interface Block {
  type: 'story' | 'explanation' | 'interactive' | 'challenge';
  cabritoSpeech: string;
  content: string;
  options?: { letter: string; text: string }[];
  correctIndex?: number;
}

interface Cycle {
  title: string;
  subtitle: string;
  blocks: Block[];
}

interface Lesson {
  title?: string;
  description?: string;
  cycles: Cycle[];
}

const BLOCK_ICONS: Record<string, { name: string; color: string }> = {
  story: { name: 'book-outline', color: '#7c3aed' },
  explanation: { name: 'bulb-outline', color: '#2563eb' },
  interactive: { name: 'chatbubbles-outline', color: '#10b981' },
  challenge: { name: 'trophy-outline', color: '#f59e0b' },
};

const BLOCK_LABELS: Record<string, string> = {
  story: 'História',
  explanation: 'Explicação',
  interactive: 'Interativo',
  challenge: 'Desafio',
};

export default function AprendizadoScreen() {
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [showResults, setShowResults] = useState(false);
  const [xpEarned, setXpEarned] = useState(0);
  const [savingXp, setSavingXp] = useState(false);
  const colorScheme = useColorScheme();
  const colors = getColors(colorScheme);
  const scrollRef = useRef<ScrollView>(null);

  const handleGenerate = async () => {
    if (!selectedSubject) {
      Alert.alert('Selecione uma matéria', 'Escolha uma matéria antes de gerar a aula.');
      return;
    }

    setLoading(true);
    setLesson(null);
    setAnswers({});
    setShowResults(false);
    setXpEarned(0);

    try {
      const data = await generateLesson(selectedSubject);
      if (data.cura) {
        const result = await pollCura(data.cura);
        setLesson(result);
      } else {
        setLesson(data);
      }
    } catch (e: any) {
      Alert.alert('Erro', e.message || 'Não foi possível gerar a aula.');
    } finally {
      setLoading(false);
    }
  };

  const getInteractiveBlocks = () => {
    if (!lesson) return [];
    const blocks: { cycleIndex: number; blockIndex: number; block: Block }[] = [];
    lesson.cycles.forEach((cycle, ci) => {
      cycle.blocks.forEach((block, bi) => {
        if (block.type === 'interactive' || block.type === 'challenge') {
          blocks.push({ cycleIndex: ci, blockIndex: bi, block });
        }
      });
    });
    return blocks;
  };

  const totalInteractive = getInteractiveBlocks().length;

  const correctCount = getInteractiveBlocks().filter(({ cycleIndex, blockIndex, block }) => {
    const key = cycleIndex * 100 + blockIndex;
    const answer = answers[key];
    return answer !== undefined && answer === block.correctIndex;
  }).length;

  const handleAnswer = (cycleIndex: number, blockIndex: number, optionIndex: number) => {
    const key = cycleIndex * 100 + blockIndex;
    if (answers[key] !== undefined) return;
    setAnswers((prev) => ({ ...prev, [key]: optionIndex }));
  };

  const handleFinish = async () => {
    const xp = correctCount * XP_REWARDS.QUESTION_CORRECT;
    setXpEarned(xp);
    setShowResults(true);

    setSavingXp(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const profile = await getProfile(session.user.id);
        if (profile) {
          await upsertProfile({
            id: session.user.id,
            total_xp: (profile.total_xp || 0) + xp,
          });
        }
      }
    } catch {}
    setSavingXp(false);
  };

  const handleReset = () => {
    setLesson(null);
    setAnswers({});
    setShowResults(false);
    setXpEarned(0);
  };

  if (showResults) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.bg }}
        contentContainerStyle={{ padding: Spacing.xl, alignItems: 'center', paddingTop: 60 }}
      >
        <View
          style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: colors.successLight,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: Spacing.lg,
          }}
        >
          <Ionicons name="trophy" size={40} color={colors.success} />
        </View>
        <Text style={{ fontSize: FontSize.xxl, fontWeight: 'bold', color: colors.text, marginBottom: Spacing.sm }}>
          Aula Finalizada!
        </Text>
        <Text style={{ fontSize: FontSize.lg, color: colors.textSecondary, marginBottom: Spacing.xxl, textAlign: 'center' }}>
          Você acertou {correctCount} de {totalInteractive} questões interativas
        </Text>

        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: BorderRadius.lg,
            padding: Spacing.xl,
            width: '100%',
            alignItems: 'center',
            marginBottom: Spacing.xl,
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <Text style={{ fontSize: FontSize.sm, color: colors.textSecondary, marginBottom: Spacing.xs }}>
            XP Ganho
          </Text>
          <Text style={{ fontSize: FontSize.xxxl, fontWeight: 'bold', color: colors.accent }}>
            +{xpEarned} XP
          </Text>
          {savingXp && (
            <ActivityIndicator size="small" color={colors.accent} style={{ marginTop: Spacing.sm }} />
          )}
        </View>

        <View style={{ width: '100%', gap: Spacing.md }}>
          <TouchableOpacity
            style={{
              backgroundColor: colors.primary,
              borderRadius: BorderRadius.md,
              padding: Spacing.lg,
              alignItems: 'center',
            }}
            onPress={handleReset}
          >
            <Text style={{ color: '#fff', fontSize: FontSize.lg, fontWeight: '700' }}>
              Gerar Nova Aula
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      ref={scrollRef}
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: Spacing.xl, paddingBottom: 40 }}
    >
      <Text style={{ fontSize: FontSize.xxl, fontWeight: 'bold', color: colors.text, marginTop: 48, marginBottom: Spacing.xs }}>
        Aprendizado
      </Text>
      <Text style={{ fontSize: FontSize.md, color: colors.textSecondary, marginBottom: Spacing.xl }}>
        Escolha uma matéria e gere uma aula personalizada
      </Text>

      <Text style={{ fontSize: FontSize.sm, fontWeight: '600', color: colors.textSecondary, marginBottom: Spacing.sm, textTransform: 'uppercase', letterSpacing: 1 }}>
        Matéria
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.xl }}>
        {SUBJECTS.map((s) => {
          const active = selectedSubject === s.key;
          return (
            <TouchableOpacity
              key={s.key}
              onPress={() => setSelectedSubject(s.key)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: active ? colors.primary : colors.surface,
                borderWidth: 1,
                borderColor: active ? colors.primary : colors.border,
                borderRadius: BorderRadius.full,
                paddingVertical: Spacing.sm,
                paddingHorizontal: Spacing.lg,
                gap: Spacing.xs,
              }}
            >
              <Ionicons
                name={s.icon}
                size={16}
                color={active ? '#fff' : colors.textSecondary}
              />
              <Text style={{ fontSize: FontSize.sm, fontWeight: '600', color: active ? '#fff' : colors.text }}>
                {s.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        style={{
          backgroundColor: selectedSubject ? colors.primary : colors.surfaceAlt,
          borderRadius: BorderRadius.md,
          padding: Spacing.lg,
          alignItems: 'center',
          opacity: loading ? 0.7 : 1,
          borderWidth: 1,
          borderColor: selectedSubject ? colors.primary : colors.border,
        }}
        onPress={handleGenerate}
        disabled={loading || !selectedSubject}
      >
        {loading ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
            <ActivityIndicator color="#fff" />
            <Text style={{ color: '#fff', fontSize: FontSize.lg, fontWeight: '700' }}>
              Gerando aula...
            </Text>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
            <Ionicons name="sparkles" size={20} color={selectedSubject ? '#fff' : colors.textSecondary} />
            <Text style={{ color: selectedSubject ? '#fff' : colors.textSecondary, fontSize: FontSize.lg, fontWeight: '700' }}>
              Gerar Aula
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {lesson && (
        <View style={{ marginTop: Spacing.xxl }}>
          {lesson.title && (
            <Text style={{ fontSize: FontSize.xl, fontWeight: 'bold', color: colors.text, marginBottom: Spacing.xs }}>
              {lesson.title}
            </Text>
          )}
          {lesson.description && (
            <Text style={{ fontSize: FontSize.md, color: colors.textSecondary, marginBottom: Spacing.xl }}>
              {lesson.description}
            </Text>
          )}

          {lesson.cycles.map((cycle, ci) => (
            <View key={ci} style={{ marginBottom: Spacing.xxl }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm }}>
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: colors.primary,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: '#fff', fontSize: FontSize.xs, fontWeight: 'bold' }}>
                    {ci + 1}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: FontSize.lg, fontWeight: 'bold', color: colors.text }}>
                    {cycle.title}
                  </Text>
                  {cycle.subtitle && (
                    <Text style={{ fontSize: FontSize.sm, color: colors.textSecondary }}>
                      {cycle.subtitle}
                    </Text>
                  )}
                </View>
              </View>

              {cycle.blocks.map((block, bi) => {
                const key = ci * 100 + bi;
                const iconInfo = BLOCK_ICONS[block.type] || BLOCK_ICONS.explanation;
                const isAnswered = answers[key] !== undefined;
                const isCorrect = block.correctIndex !== undefined && answers[key] === block.correctIndex;

                return (
                  <View
                    key={bi}
                    style={{
                      backgroundColor: colors.surface,
                      borderRadius: BorderRadius.lg,
                      padding: Spacing.lg,
                      marginBottom: Spacing.md,
                      borderWidth: 1,
                      borderColor: isAnswered
                        ? (isCorrect ? colors.success : colors.danger)
                        : colors.border,
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md }}>
                      <View
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: BorderRadius.sm,
                          backgroundColor: iconInfo.color + '20',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Ionicons name={iconInfo.name as any} size={18} color={iconInfo.color} />
                      </View>
                      <Text style={{ fontSize: FontSize.sm, fontWeight: '600', color: iconInfo.color }}>
                        {BLOCK_LABELS[block.type] || block.type}
                      </Text>
                    </View>

                    {block.cabritoSpeech ? (
                      <View
                        style={{
                          backgroundColor: colors.accentLight,
                          borderRadius: BorderRadius.md,
                          padding: Spacing.md,
                          marginBottom: Spacing.md,
                          flexDirection: 'row',
                          gap: Spacing.sm,
                        }}
                      >
                        <Text style={{ fontSize: FontSize.xl }}>🐐</Text>
                        <Text style={{ fontSize: FontSize.sm, color: colors.text, flex: 1, lineHeight: 20 }}>
                          {block.cabritoSpeech}
                        </Text>
                      </View>
                    ) : null}

                    <Text style={{ fontSize: FontSize.md, color: colors.text, lineHeight: 22 }}>
                      {block.content}
                    </Text>

                    {block.options && block.options.length > 0 && (
                      <View style={{ marginTop: Spacing.md, gap: Spacing.sm }}>
                        {block.options.map((opt, oi) => {
                          const selected = answers[key] === oi;
                          const showCorrect = isAnswered && oi === block.correctIndex;
                          let bgColor = colors.surfaceAlt;
                          let borderColor = colors.border;
                          let textColor = colors.text;

                          if (showCorrect) {
                            bgColor = colors.successLight;
                            borderColor = colors.success;
                            textColor = colors.success;
                          } else if (selected && !isCorrect) {
                            bgColor = colors.dangerLight;
                            borderColor = colors.danger;
                            textColor = colors.danger;
                          }

                          return (
                            <TouchableOpacity
                              key={oi}
                              style={{
                                backgroundColor: bgColor,
                                borderWidth: 1,
                                borderColor,
                                borderRadius: BorderRadius.md,
                                padding: Spacing.md,
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: Spacing.sm,
                                opacity: isAnswered && !selected && !showCorrect ? 0.5 : 1,
                              }}
                              onPress={() => handleAnswer(ci, bi, oi)}
                              disabled={isAnswered}
                            >
                              <View
                                style={{
                                  width: 28,
                                  height: 28,
                                  borderRadius: 14,
                                  borderWidth: 1.5,
                                  borderColor: showCorrect ? colors.success : selected ? textColor : colors.border,
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                {isAnswered && showCorrect ? (
                                  <Ionicons name="checkmark" size={16} color={colors.success} />
                                ) : isAnswered && selected && !isCorrect ? (
                                  <Ionicons name="close" size={16} color={colors.danger} />
                                ) : (
                                  <Text style={{ fontSize: FontSize.xs, fontWeight: '600', color: colors.textSecondary }}>
                                    {opt.letter}
                                  </Text>
                                )}
                              </View>
                              <Text style={{ fontSize: FontSize.sm, color: textColor, flex: 1 }}>
                                {opt.text}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          ))}

          {totalInteractive > 0 && !showResults && (
            <TouchableOpacity
              style={{
                backgroundColor: colors.accent,
                borderRadius: BorderRadius.md,
                padding: Spacing.lg,
                alignItems: 'center',
                marginTop: Spacing.md,
                opacity: Object.keys(answers).length < totalInteractive ? 0.5 : 1,
              }}
              onPress={handleFinish}
              disabled={Object.keys(answers).length < totalInteractive}
            >
              <Text style={{ color: '#fff', fontSize: FontSize.lg, fontWeight: '700' }}>
                Finalizar Aula ({Object.keys(answers).length}/{totalInteractive})
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </ScrollView>
  );
}
