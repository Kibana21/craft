import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import { AuthProvider } from "@/components/providers/auth-provider";
import { MuiThemeProvider } from "@/components/providers/mui-theme-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { ErrorBoundary } from "@/components/common/error-boundary";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CRAFT by AIA",
  description: "AI-powered content creation platform for AIA Singapore",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${inter.variable}`}
      style={{ height: "100%", WebkitFontSmoothing: "antialiased", MozOsxFontSmoothing: "grayscale" }}
    >
      <body style={{ minHeight: "100vh", display: "flex", flexDirection: "column", margin: 0 }}>
        <AppRouterCacheProvider options={{ enableCssLayer: true }}>
          <MuiThemeProvider>
            <ErrorBoundary>
              <QueryProvider>
                <AuthProvider>{children}</AuthProvider>
              </QueryProvider>
            </ErrorBoundary>
          </MuiThemeProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
