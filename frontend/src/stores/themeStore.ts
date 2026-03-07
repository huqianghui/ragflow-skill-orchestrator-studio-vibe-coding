import { create } from 'zustand';

const STORAGE_KEY = 'app-theme';

function loadThemeKey(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || 'light';
  } catch {
    return 'light';
  }
}

interface ThemeState {
  themeKey: string;
  setTheme: (key: string) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  themeKey: loadThemeKey(),
  setTheme: (key: string) => {
    try {
      localStorage.setItem(STORAGE_KEY, key);
    } catch {
      // ignore
    }
    set({ themeKey: key });
  },
}));
