"use client";

// Hand-rolled minimal React error boundary. Catches any uncaught render-time
// throw in the tree and renders a friendly fallback instead of blanking the
// app to a white screen. Avoids the react-error-boundary dep — class component
// is the only React API for this and it's tiny.
//
// Reset behaviour: clicking "Try again" re-mounts the wrapped tree by bumping
// `key`. For most CRAFT errors (e.g. a stale closure in a list page) this is
// enough; if the underlying fetch is still failing the page will re-error and
// the user can hit Reload, which fully refreshes the bundle.

import { Component, type ErrorInfo, type ReactNode } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";

interface Props {
  children: ReactNode;
  /** Optional override for the fallback UI. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
  resetKey: number;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, resetKey: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Console only for v1 — Sentry hook lands later (Tier 3).
    // Don't crash the boundary itself if logging fails.
    try {
      // eslint-disable-next-line no-console
      console.error("[ErrorBoundary] Uncaught render error", { error, info });
    } catch {
      /* noop */
    }
  }

  reset = () => {
    this.setState((prev) => ({ error: null, resetKey: prev.resetKey + 1 }));
  };

  render(): ReactNode {
    if (this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.reset);
      }
      return (
        <Box
          role="alert"
          sx={{
            minHeight: "60vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            px: 3,
            gap: 1.5,
          }}
        >
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: "16px",
              bgcolor: "#FFF0F3",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#D0103A",
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </Box>
          <Typography sx={{ fontSize: "18px", fontWeight: 700, color: "#1F1F1F" }}>
            Something went wrong
          </Typography>
          <Typography sx={{ fontSize: "13px", color: "#5F6368", maxWidth: 420 }}>
            CRAFT hit an unexpected error. Try again, or reload the page if it persists.
          </Typography>
          <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
            <Button
              variant="outlined"
              onClick={this.reset}
              sx={{
                borderRadius: 9999,
                textTransform: "none",
                borderColor: "#E8EAED",
                color: "#1F1F1F",
                "&:hover": { borderColor: "#ABABAB" },
              }}
            >
              Try again
            </Button>
            <Button
              variant="contained"
              onClick={() => {
                if (typeof window !== "undefined") window.location.reload();
              }}
              sx={{
                borderRadius: 9999,
                textTransform: "none",
                bgcolor: "#D0103A",
                "&:hover": { bgcolor: "#A00D2E" },
              }}
            >
              Reload page
            </Button>
          </Box>
          {process.env.NODE_ENV !== "production" && (
            <Box
              component="pre"
              sx={{
                mt: 3,
                px: 2,
                py: 1.5,
                maxWidth: 600,
                maxHeight: 200,
                overflow: "auto",
                bgcolor: "#FAFAFA",
                border: "1px solid #E8EAED",
                borderRadius: "8px",
                fontSize: "11px",
                color: "#5F6368",
                textAlign: "left",
                whiteSpace: "pre-wrap",
              }}
            >
              {this.state.error.message}
              {"\n\n"}
              {this.state.error.stack}
            </Box>
          )}
        </Box>
      );
    }

    // `key` bump on reset re-mounts the children, clearing whatever stale
    // state caused the throw.
    return <div key={this.state.resetKey}>{this.props.children}</div>;
  }
}
