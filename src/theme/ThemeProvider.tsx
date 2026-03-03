import React, {
  createContext,
  ReactNode,
  useContext,
  useMemo,
  useState,
} from "react";
import { useColorScheme } from "react-native";
import { appThemes } from "./index";

export type ThemeMode = "light" | "dark" | "system";

type ThemeContextType = {
  mode: ThemeMode;
  theme: typeof appThemes.light;
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType | null>(null);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const systemScheme = useColorScheme(); // "light" | "dark" | null
  const [mode, setMode] = useState<ThemeMode>("system");

  const resolvedMode =
    mode === "system" ? systemScheme ?? "light" : mode;

  const theme = useMemo(() => {
    return appThemes[resolvedMode];
  }, [resolvedMode]);

  const toggleTheme = () => {
    setMode((prev) =>
      prev === "light" ? "dark" : prev === "dark" ? "system" : "light"
    );
  };

  return (
    <ThemeContext.Provider
      value={{
        mode,
        theme,
        setMode,
        toggleTheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context)
    throw new Error("useTheme must be used inside ThemeProvider");
  return context;
};