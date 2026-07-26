import { useState, useRef, useEffect } from 'react';
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

const CATEGORIES = [
  {
    key: 'matematica',
    label: 'Matemática',
    description: 'Álgebra, geometria, estatística e mais',
    icon: 'calculator' as const,
    bgColor: '#dbeafe',
    iconColor: '#2563EB',
  },
  {
    key: 'natureza',
    label: 'Ciências da Natureza',
    description: 'Biologia, química e física',
    icon: 'leaf' as const,
    bgColor: '#d1fae5',
    iconColor: '#10b981',
  },
  {
    key: 'humanas',
    label: 'Ciências Humanas',
    description: 'História, geografia e sociologia',
    icon: 'earth' as const,
    bgColor: '#ede9fe',
    iconColor: '#7c3aed',
  },
  {
    key: 'linguagens',
    label: 'Linguagens',
    description: 'Gramática, literatura e interpretação',
    icon: 'book' as const,
    bgColor: '#fef3c7',
    iconColor: '#f59e0b',
  },
  {
    key: 'geral',
    label: 'Geral',
    description: 'Revisão geral do ENEM',
    icon: 'school' as const,
    bgColor: '#e0e7ff',
    iconColor: '#4f46e5',
  },
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
  const [currentStep, setCurrentStep] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);
  const colorScheme = useColorScheme();
  const colors = getColors(colorScheme);
  const scrollRef = useRef<ScrollView>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const getAllBlocks = (): { cycleIndex: number; blockIndex: number; block: Block }[] => {
    if (!lesson) return [];
    const blocks: { cycleIndex: number; blockIndex: number; block: Block }[] = [];
    lesson.cycles.forEach((cycle, ci) => {
      cycle.blocks.forEach((block, bi) => {
        blocks.push({ cycleIndex: ci, blockIndex: bi, block });
      });
    });
    return blocks;
  };

  const allBlocks = getAllBlocks();
  const totalSteps = allBlocks.length;

  const getInteractiveBlocks = () => {
    return allBlocks.filter(({ block }) => block.type === 'interactive' || block.type === 'challenge');
  };

  const totalInteractive = getInteractiveBlocks().length;

  const correctCount = getInteractiveBlocks().filter(({ cycleIndex, blockIndex, block }) => {
    const key = cycleIndex * 100 + blockIndex;
    const answer = answers[key];
    return answer !== undefined && answer === block.correctIndex;
  }).length;

  const handleGenerate = async (subjectKey: string) => {
    setSelectedSubject(subjectKey);
    setLoading(true);
    setLesson(null);
    setAnswers({});
    setShowResults(false);
    setXpEarned(0);
    setCurrentStep(0);
    setElapsedTime(0);

    if (timerRef.current) clearInterval(timerRef.current);

    try {
      const data = await generateLesson(subjectKey);
      if (data.cura) {
        const result = await pollCura(data.cura);
        setLesson(result);
      } else {
        setLesson(data);
      }
      timerRef.current = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    } catch (e: any) {
      Alert.alert('Erro', e.message || 'Não foi possível gerar a aula.');
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = (cycleIndex: number, blockIndex: number, optionIndex: number) => {
    const key = cycleIndex * 100 + blockIndex;
    if (answers[key] !== undefined) return;
    setAnswers((prev) => ({ ...prev, [key]: optionIndex }));
  };

  const handleFinish = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

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

  const handleNext = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep((prev) => prev + 1);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } else {
      handleFinish();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    }
  };

  const handleReset = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setLesson(null);
    setAnswers({});
    setShowResults(false);
    setXpEarned(0);
    setCurrentStep(0);
    setElapsedTime(0);
    setSelectedSubject(null);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const renderHeader = () => (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
        paddingTop: 56,
        paddingBottom: Spacing.lg,
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
      }}
    >
      <Ionicons name="school" size={28} color={colors.primary} />
      <Text
        style={{
          fontSize: FontSize.xl,
          fontWeight: '700',
          color: colors.text,
          marginLeft: Spacing.sm,
        }}
      >
        Aprendizado
      </Text>
    </View>
  );

  if (showResults) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        {renderHeader()}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            padding: Spacing.xl,
            alignItems: 'center',
            paddingTop: Spacing.xxl,
          }}
          showsVerticalScrollIndicator={false}
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

          <Text
            style={{
              fontSize: FontSize.xxl,
              fontWeight: 'bold',
              color: colors.text,
              marginBottom: Spacing.sm,
            }}
          >
            Aula Concluída!
          </Text>
          <Text
            style={{
              fontSize: FontSize.md,
              color: colors.textSecondary,
              marginBottom: Spacing.xxl,
              textAlign: 'center',
            }}
          >
            Parabéns! Você completou a aula.
          </Text>

          <View
            style={{
              backgroundColor: colors.surface,
              borderRadius: BorderRadius.xxl,
              padding: 24,
              width: '100%',
              borderWidth: 1,
              borderColor: colors.border,
              marginBottom: Spacing.xl,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
              <View style={{ alignItems: 'center', flex: 1 }}>
                <Text
                  style={{
                    fontSize: FontSize.xs,
                    color: colors.textSecondary,
                    marginBottom: Spacing.xs,
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                  }}
                >
                  Acertos
                </Text>
                <Text
                  style={{
                    fontSize: FontSize.xxl,
                    fontWeight: 'bold',
                    color: colors.primary,
                  }}
                >
                  {correctCount}/{totalInteractive}
                </Text>
              </View>

              <View style={{ width: 1, backgroundColor: colors.border }} />

              <View style={{ alignItems: 'center', flex: 1 }}>
                <Text
                  style={{
                    fontSize: FontSize.xs,
                    color: colors.textSecondary,
                    marginBottom: Spacing.xs,
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                  }}
                >
                  XP Ganho
                </Text>
                <Text
                  style={{
                    fontSize: FontSize.xxl,
                    fontWeight: 'bold',
                    color: colors.warning,
                  }}
                >
                  +{xpEarned}
                </Text>
                {savingXp && (
                  <ActivityIndicator
                    size="small"
                    color={colors.warning}
                    style={{ marginTop: 2 }}
                  />
                )}
              </View>

              <View style={{ width: 1, backgroundColor: colors.border }} />

              <View style={{ alignItems: 'center', flex: 1 }}>
                <Text
                  style={{
                    fontSize: FontSize.xs,
                    color: colors.textSecondary,
                    marginBottom: Spacing.xs,
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                  }}
                >
                  Tempo
                </Text>
                <Text
                  style={{
                    fontSize: FontSize.xxl,
                    fontWeight: 'bold',
                    color: colors.text,
                  }}
                >
                  {formatTime(elapsedTime)}
                </Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={{
              backgroundColor: colors.primary,
              borderRadius: BorderRadius.sm,
              padding: Spacing.lg,
              alignItems: 'center',
              width: '100%',
              flexDirection: 'row',
              justifyContent: 'center',
              gap: Spacing.sm,
            }}
            onPress={handleReset}
          >
            <Ionicons name="arrow-back" size={20} color="#fff" />
            <Text style={{ color: '#fff', fontSize: FontSize.md, fontWeight: '700' }}>
              Voltar às Categorias
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        {renderHeader()}
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            padding: Spacing.xl,
          }}
        >
          <ActivityIndicator size="large" color={colors.primary} />
          <Text
            style={{
              fontSize: FontSize.lg,
              color: colors.textSecondary,
              marginTop: Spacing.lg,
              fontWeight: '600',
            }}
          >
            Gerando aula...
          </Text>
          <Text
            style={{
              fontSize: FontSize.sm,
              color: colors.textTertiary,
              marginTop: Spacing.sm,
            }}
          >
            Aguarde enquanto preparamos seu conteúdo
          </Text>
        </View>
      </View>
    );
  }

  if (lesson) {
    const stepData = allBlocks[currentStep];
    const progressPct = totalSteps > 0 ? (currentStep + 1) / totalSteps : 0;

    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <View
          style={{
            backgroundColor: colors.surface,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            paddingTop: 56,
            paddingBottom: Spacing.md,
            paddingHorizontal: Spacing.lg,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginBottom: Spacing.md,
            }}
          >
            <TouchableOpacity
              onPress={handleReset}
              style={{ padding: Spacing.xs, marginRight: Spacing.sm }}
            >
              <Ionicons name="close" size={24} color={colors.danger} />
            </TouchableOpacity>
            <Text
              style={{
                flex: 1,
                fontSize: FontSize.lg,
                fontWeight: '700',
                color: colors.text,
              }}
            >
              {selectedSubject
                ? CATEGORIES.find((c) => c.key === selectedSubject)?.label || selectedSubject
                : 'Aula'}
            </Text>
            <Text
              style={{
                fontSize: FontSize.sm,
                fontWeight: '600',
                color: colors.textSecondary,
              }}
            >
              {currentStep + 1}/{totalSteps}
            </Text>
          </View>

          <View
            style={{
              height: 8,
              borderRadius: 4,
              backgroundColor: colors.surfaceDim,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                height: '100%',
                borderRadius: 4,
                backgroundColor: colors.primary,
                width: `${progressPct * 100}%`,
              }}
            />
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{
            padding: Spacing.lg,
            paddingBottom: 100,
          }}
          showsVerticalScrollIndicator={false}
        >
          {stepData && (
            <View
              style={{
                backgroundColor: colors.surface,
                borderRadius: BorderRadius.xxl,
                padding: 24,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text
                style={{
                  fontSize: FontSize.xs,
                  fontFamily: 'monospace',
                  color: colors.textTertiary,
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                  marginBottom: Spacing.md,
                }}
              >
                Passo {currentStep + 1} de {totalSteps}
              </Text>

              {stepData.block.cabritoSpeech ? (
                <View
                  style={{
                    backgroundColor: colors.accentLight,
                    borderRadius: BorderRadius.md,
                    padding: Spacing.md,
                    marginBottom: Spacing.lg,
                    flexDirection: 'row',
                    gap: Spacing.sm,
                  }}
                >
                  <Text style={{ fontSize: FontSize.xl }}>{"\uD83D\uDC10"}</Text>
                  <Text
                    style={{
                      fontSize: FontSize.sm,
                      color: colors.text,
                      flex: 1,
                      lineHeight: 20,
                    }}
                  >
                    {stepData.block.cabritoSpeech}
                  </Text>
                </View>
              ) : null}

              <Text
                style={{
                  fontSize: FontSize.md,
                  color: colors.text,
                  lineHeight: 24,
                }}
              >
                {stepData.block.content}
              </Text>

              {stepData.block.options && stepData.block.options.length > 0 && (
                <View style={{ marginTop: Spacing.lg, gap: Spacing.sm }}>
                  {stepData.block.options.map((opt, oi) => {
                    const key = stepData.cycleIndex * 100 + stepData.blockIndex;
                    const selected = answers[key] === oi;
                    const isAnswered = answers[key] !== undefined;
                    const isCorrect =
                      stepData.block.correctIndex !== undefined &&
                      answers[key] === stepData.block.correctIndex;
                    const showCorrect = isAnswered && oi === stepData.block.correctIndex;

                    let bgColor = colors.surface;
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
                          borderWidth: 1.5,
                          borderColor,
                          borderRadius: BorderRadius.sm,
                          padding: Spacing.md,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: Spacing.md,
                          opacity: isAnswered && !selected && !showCorrect ? 0.5 : 1,
                        }}
                        onPress={() =>
                          handleAnswer(stepData.cycleIndex, stepData.blockIndex, oi)
                        }
                        disabled={isAnswered}
                      >
                        <View
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 16,
                            backgroundColor: showCorrect
                              ? colors.success
                              : selected
                              ? colors.danger
                              : colors.input,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {isAnswered && showCorrect ? (
                            <Ionicons name="checkmark" size={16} color="#fff" />
                          ) : isAnswered && selected && !isCorrect ? (
                            <Ionicons name="close" size={16} color="#fff" />
                          ) : (
                            <Text
                              style={{
                                fontSize: FontSize.sm,
                                fontWeight: '700',
                                color: selected ? '#fff' : colors.textSecondary,
                              }}
                            >
                              {opt.letter}
                            </Text>
                          )}
                        </View>
                        <Text
                          style={{
                            fontSize: FontSize.sm,
                            color: textColor,
                            flex: 1,
                            lineHeight: 20,
                          }}
                        >
                          {opt.text}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          )}
        </ScrollView>

        <View
          style={{
            flexDirection: 'row',
            paddingHorizontal: Spacing.lg,
            paddingVertical: Spacing.md,
            paddingBottom: 32,
            backgroundColor: colors.surface,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            gap: Spacing.sm,
          }}
        >
          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: Spacing.xs,
              paddingHorizontal: Spacing.lg,
              paddingVertical: Spacing.md,
              borderRadius: BorderRadius.sm,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.input,
              opacity: currentStep === 0 ? 0.4 : 1,
            }}
            onPress={handlePrev}
            disabled={currentStep === 0}
          >
            <Ionicons name="chevron-back" size={18} color={colors.text} />
            <Text style={{ fontSize: FontSize.sm, fontWeight: '600', color: colors.text }}>
              Anterior
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: Spacing.xs,
              paddingHorizontal: Spacing.xl,
              paddingVertical: Spacing.md,
              borderRadius: BorderRadius.sm,
              flex: 1,
              justifyContent: 'center',
              backgroundColor: colors.primary,
            }}
            onPress={handleNext}
          >
            <Text style={{ fontSize: FontSize.sm, fontWeight: '700', color: '#fff' }}>
              {currentStep === totalSteps - 1 ? 'Finalizar' : 'Próximo'}
            </Text>
            <Ionicons
              name={currentStep === totalSteps - 1 ? 'checkmark' : 'chevron-forward'}
              size={18}
              color="#fff"
            />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {renderHeader()}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: Spacing.lg,
          paddingBottom: 40,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Text
          style={{
            fontSize: FontSize.xxl,
            fontWeight: 'bold',
            color: colors.text,
            marginBottom: Spacing.xs,
          }}
        >
          Aprendizado
        </Text>
        <Text
          style={{
            fontSize: FontSize.md,
            color: colors.textSecondary,
            marginBottom: Spacing.xl,
          }}
        >
          Estude com explicações personalizadas por IA
        </Text>

        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: Spacing.md,
          }}
        >
          {CATEGORIES.map((cat) => (
            <View
              key={cat.key}
              style={{
                width: '47%',
                backgroundColor: colors.surface,
                borderRadius: BorderRadius.xxl,
                borderWidth: 1,
                borderColor: colors.border,
                padding: 24,
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  backgroundColor: cat.bgColor,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: Spacing.md,
                }}
              >
                <Ionicons name={cat.icon} size={20} color={cat.iconColor} />
              </View>

              <Text
                style={{
                  fontSize: FontSize.md,
                  fontWeight: '600',
                  color: colors.text,
                  marginBottom: Spacing.xs,
                }}
              >
                {cat.label}
              </Text>

              <Text
                style={{
                  fontSize: FontSize.xs,
                  color: colors.textSecondary,
                  marginBottom: Spacing.lg,
                  lineHeight: 16,
                }}
              >
                {cat.description}
              </Text>

              <TouchableOpacity
                style={{
                  backgroundColor: 'transparent',
                  paddingVertical: Spacing.sm,
                  paddingHorizontal: 0,
                }}
                onPress={() => handleGenerate(cat.key)}
              >
                <Text
                  style={{
                    fontSize: FontSize.md,
                    fontWeight: '600',
                    color: '#2563EB',
                  }}
                >
                  Estudar
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
