import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DARK_COLORS, LIGHT_COLORS, POKEDEX_COLORS, ColorScheme } from '../constants/theme';

const THEME_KEY = 'wilddex_theme';

export type ThemeMode = 'dark' | 'light' | 'pokedex';

interface ThemeContextValue {
  colors: ColorScheme;
  theme: ThemeMode;
  isDark: boolean;
  setTheme: (t: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  colors: POKEDEX_COLORS,
  theme: 'pokedex',
  isDark: false,
  setTheme: () => {},
  toggleTheme: () => {},
});

function colorsForTheme(t: ThemeMode): ColorScheme {
  if (t === 'light') return LIGHT_COLORS;
  if (t === 'pokedex') return POKEDEX_COLORS;
  return DARK_COLORS;
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeMode>('light');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((v) => {
      if (v === 'light' || v === 'dark' || v === 'pokedex') setThemeState(v);
      setReady(true);
    });
  }, []);

  const setTheme = (t: ThemeMode) => {
    setThemeState(t);
    AsyncStorage.setItem(THEME_KEY, t);
  };

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  if (!ready) return null;

  return (
    <ThemeContext.Provider value={{ colors: colorsForTheme(theme), theme, isDark: theme === 'dark', setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
