import React, { createContext, useContext } from "react";
import { useColorScheme } from "react-native";
import { AppTheme, appThemes } from "./index";

const ThemeContext = createContext<AppTheme>(appThemes.light);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const scheme = useColorScheme();

  const theme = scheme === "dark" ? appThemes.dark : appThemes.light;

  return (
    <ThemeContext.Provider value={theme as AppTheme}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): AppTheme => useContext(ThemeContext);
