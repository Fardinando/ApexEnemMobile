import { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  Switch,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getColors, Spacing, FontSize, BorderRadius } from '../../lib/theme';
import { supabase } from '../../lib/supabase';

interface MoreSheetProps {
  visible: boolean;
  onClose: () => void;
}

export default function MoreSheet({ visible, onClose }: MoreSheetProps) {
  const colorScheme = useColorScheme();
  const colors = getColors(colorScheme);
  const router = useRouter();

  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [streak, setStreak] = useState(0);
  const [level, setLevel] = useState(1);
  const [totalXp, setTotalXp] = useState(0);
  const [darkMode, setDarkMode] = useState(colorScheme === 'dark');

  useEffect(() => {
    if (!visible) return;

    const load = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const user = session.user;
        setUserEmail(user.email || '');

        const { data: profile } = await supabase
          .from('profiles')
          .select('name, streak, total_xp')
          .eq('id', user.id)
          .maybeSingle();

        if (profile) {
          setUserName(profile.name || user.email?.split('@')[0] || '');
          setStreak(profile.streak || 0);
          setTotalXp(profile.total_xp || 0);
          const xp = profile.total_xp || 0;
          const lvl = Math.floor(xp / 500) + 1;
          setLevel(lvl);
        } else {
          setUserName(user.email?.split('@')[0] || '');
        }
      } catch {
        // silent
      }
    };

    load();
  }, [visible]);

  const initials = userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const handleNavigate = (path: string) => {
    onClose();
    setTimeout(() => {
      router.push(path as any);
    }, 200);
  };

  const handleLogout = async () => {
    onClose();
    await supabase.auth.signOut();
    router.replace('/(auth)/login');
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
          <View style={[styles.handle, { backgroundColor: colors.surfaceDim }]} />

          {/* User Info */}
          <View style={styles.userRow}>
            <View style={[styles.avatar, { backgroundColor: '#DBEAFE' }]}>
              <Text style={[styles.avatarText, { color: '#2563EB' }]}>{initials || '?'}</Text>
            </View>
            <View style={styles.userInfo}>
              <Text style={[styles.userName, { color: colors.text }]} numberOfLines={1}>
                {userName || 'Carregando...'}
              </Text>
              <Text style={[styles.userEmail, { color: colors.textSecondary }]} numberOfLines={1}>
                {userEmail}
              </Text>
            </View>
          </View>

          {/* Badges */}
          <View style={styles.badgeRow}>
            <View style={[styles.badge, { backgroundColor: '#FEF3C7' }]}>
              <Ionicons name="flame" size={14} color="#F97316" />
              <Text style={[styles.badgeText, { color: '#D97706' }]}>{streak} dias</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: '#EDE9FE' }]}>
              <Ionicons name="flash" size={14} color="#7C3AED" />
              <Text style={[styles.badgeText, { color: '#6D28D9' }]}>Nv. {level}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: '#DBEAFE' }]}>
              <Ionicons name="star" size={14} color="#2563EB" />
              <Text style={[styles.badgeText, { color: '#1D4ED8' }]}>{totalXp} XP</Text>
            </View>
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Menu Items */}
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => handleNavigate('/perfil')}
          >
            <View style={[styles.menuIconBg, { backgroundColor: '#DBEAFE' }]}>
              <Ionicons name="person" size={18} color="#2563EB" />
            </View>
            <Text style={[styles.menuText, { color: colors.text }]}>Meu Perfil</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => handleNavigate('/configuracoes')}
          >
            <View style={[styles.menuIconBg, { backgroundColor: '#F1F5F9' }]}>
              <Ionicons name="settings" size={18} color="#64748B" />
            </View>
            <Text style={[styles.menuText, { color: colors.text }]}>Configurações</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
          </TouchableOpacity>

          <View style={styles.menuItem}>
            <View style={[styles.menuIconBg, { backgroundColor: darkMode ? '#FEF3C7' : '#F1F5F9' }]}>
              <Ionicons name={darkMode ? 'moon' : 'sunny'} size={18} color={darkMode ? '#F59E0B' : '#64748B'} />
            </View>
            <Text style={[styles.menuText, { color: colors.text }]}>Modo Escuro</Text>
            <Switch
              value={darkMode}
              onValueChange={setDarkMode}
              trackColor={{ false: colors.border, true: colors.primaryLight }}
              thumbColor={darkMode ? colors.primary : colors.textSecondary}
            />
          </View>

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <TouchableOpacity style={styles.logoutRow} onPress={handleLogout}>
            <Ionicons name="log-out" size={18} color="#EF4444" />
            <Text style={styles.logoutText}>Sair</Text>
          </TouchableOpacity>

          <View style={{ height: 20 }} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 12,
    fontWeight: '700',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 12,
    fontWeight: '700',
  },
  userEmail: {
    fontSize: 9,
    marginTop: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    marginBottom: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  menuIconBg: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  logoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  logoutText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#EF4444',
  },
});
