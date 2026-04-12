"use client";

import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { craftTheme } from "@/lib/theme";

export function MuiThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider theme={craftTheme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
