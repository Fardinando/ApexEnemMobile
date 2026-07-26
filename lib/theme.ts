export type ThemeColors = typeof Colors.light;

export function getColors(scheme: string | null | undefined): ThemeColors {
  return scheme === 'dark' ? Colors.dark : Colors.light;
}

export const Colors = {
  light: {
    bg: '#f8fafc',
    surface: '#ffffff',
    surfaceAlt: '#f1f5f9',
    text: '#1b1b24',
    textSecondary: '#64748b',
    border: '#e2e8f0',
    primary: '#2563eb',
    primaryLight: '#dbeafe',
    danger: '#ef4444',
    dangerLight: '#fef2f2',
    success: '#10b981',
    successLight: '#d1fae5',
    warning: '#f59e0b',
    accent: '#7c3aed',
    accentLight: '#ede9fe',
    tab: '#ffffff',
    tabActive: '#2563eb',
    tabInactive: '#94a3b8',
    card: '#ffffff',
    input: '#f1f5f9',
    overlay: 'rgba(0,0,0,0.5)',
  },
  dark: {
    bg: '#0f172a',
    surface: '#1e293b',
    surfaceAlt: '#334155',
    text: '#f1f5f9',
    textSecondary: '#94a3b8',
    border: '#334155',
    primary: '#3b82f6',
    primaryLight: '#1e3a5f',
    danger: '#f87171',
    dangerLight: '#450a0a',
    success: '#34d399',
    successLight: '#064e3b',
    warning: '#fbbf24',
    accent: '#a78bfa',
    accentLight: '#2e1065',
    tab: '#1e293b',
    tabActive: '#3b82f6',
    tabInactive: '#64748b',
    card: '#1e293b',
    input: '#0f172a',
    overlay: 'rgba(0,0,0,0.7)',
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const FontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
};
