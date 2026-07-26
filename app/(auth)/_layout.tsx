import { Stack } from 'expo-router';
import { useColorScheme } from 'react-native';
import { Colors, getColors } from '../../lib/theme';

export default function AuthLayout() {
  const colorScheme = useColorScheme();
  const colors = getColors(colorScheme);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    />
  );
}
