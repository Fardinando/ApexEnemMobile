import { useState } from 'react';
import { Tabs } from 'expo-router';
import { useColorScheme, View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getColors } from '../../lib/theme';
import MoreSheet from './more-sheet';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const colors = getColors(colorScheme);
  const [showMore, setShowMore] = useState(false);

  return (
    <>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: true,
          tabBarActiveTintColor: colors.tabActive,
          tabBarInactiveTintColor: colors.tabInactive,
          tabBarLabelStyle: {
            fontSize: 10,
            fontWeight: '600',
            marginTop: -2,
            marginBottom: 2,
          },
          tabBarStyle: {
            backgroundColor: colors.tab,
            borderTopColor: colors.border,
            borderTopWidth: 1,
            height: 60,
            paddingBottom: 8,
            paddingTop: 6,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Início',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home" size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="redacao"
          options={{
            title: 'Redação',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="document-text" size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="aprendizado"
          options={{
            title: 'Estudos',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="school" size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="simulados"
          options={{
            title: 'Simulados',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="book" size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="perguntas"
          options={{
            title: 'Questões IA',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="chatbubble-ellipses" size={22} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="more-sheet"
          options={{
            title: 'Mais',
            tabBarIcon: () => (
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: colors.primary,
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: -8,
                }}
              >
                <Ionicons name="add" size={24} color="#FFFFFF" />
              </View>
            ),
          }}
          listeners={{
            tabPress: (e) => {
              e.preventDefault();
              setShowMore(true);
            },
          }}
        />
      </Tabs>

      <MoreSheet visible={showMore} onClose={() => setShowMore(false)} />
    </>
  );
}
