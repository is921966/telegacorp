import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

type ThemeMode = "light" | "dark" | "system";

interface ThemeColors {
  background: string;
  surface: string;
  text: string;
  textSecondary: string;
  border: string;
  primary: string;
  accent: string;
  danger: string;
  bubbleOut: string;
  bubbleIn: string;
}

interface ThemeContextValue {
  mode: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  setMode: (mode: ThemeMode) => void;
}

const lightColors: ThemeColors = {
  background: "#f5f5f5",
  surface: "#ffffff",
  text: "#1a1a2e",
  textSecondary: "#999999",
  border: "#e5e5e5",
  primary: "#2196F3",
  accent: "#1a1a2e",
  danger: "#d32f2f",
  bubbleOut: "#DCF8C6",
  bubbleIn: "#F0F0F0",
};

const darkColors: ThemeColors = {
  background: "#0e0e14",
  surface: "#1a1a2e",
  text: "#ffffff",
  textSecondary: "#888888",
  border: "#2a2a3e",
  primary: "#64B5F6",
  accent: "#ffffff",
  danger: "#ef5350",
  bubbleOut: "#2b5e35",
  bubbleIn: "#1e1e32",
};

const THEME_KEY = "tgcorp_theme_mode";

const ThemeContext = createContext<ThemeContextValue>({
  mode: "system",
  isDark: false,
  colors: lightColors,
  setMode: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

/**
 * Theme provider — light/dark/system theme support with AsyncStorage persistence.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("system");

  useEffect(() => {
    // Restore saved preference
    AsyncStorage.getItem(THEME_KEY).then((saved) => {
      if (saved === "light" || saved === "dark" || saved === "system") {
        setModeState(saved);
      }
    });
  }, []);

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    AsyncStorage.setItem(THEME_KEY, newMode);
  };

  const isDark =
    mode === "system" ? systemScheme === "dark" : mode === "dark";

  const colors = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ mode, isDark, colors, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}
