"use client";

import { useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";

const TEST_ACCOUNTS = [
  { email: "sarah@aia.com.sg", name: "Sarah Lim", role: "Brand Admin", initials: "SL" },
  { email: "david@aia.com.sg", name: "David Tan", role: "District Leader", initials: "DT" },
  { email: "michael@aia.com.sg", name: "Michael Chen", role: "Agency Leader", initials: "MC" },
  { email: "maya@agent.aia.com.sg", name: "Maya Raj", role: "FSC · Agent", initials: "MR" },
];

const fontStack = "var(--font-geist-sans), -apple-system, sans-serif";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      await login(email, password);
    } catch {
      setError("Couldn't sign in. Check your email and password.");
    } finally {
      setIsLoading(false);
    }
  };

  const quickLogin = (emailAddr: string) => {
    setEmail(emailAddr);
    setPassword("craft2026");
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        backgroundColor: "#FFFFFF",
        px: 2,
        fontFamily: fontStack,
      }}
    >
      {/* Logo */}
      <Box
        sx={{
          mb: 4,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <Box
          sx={{
            mb: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 48,
            height: 48,
            borderRadius: "12px",
            backgroundColor: "#D0103A",
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
          </svg>
        </Box>
        <Typography
          component="h1"
          sx={{
            fontSize: "22px",
            fontWeight: 600,
            letterSpacing: "-0.02em",
            color: "#1F1F1F",
            fontFamily: fontStack,
          }}
        >
          CRAFT
        </Typography>
        <Typography
          sx={{
            mt: 0.5,
            fontSize: "13px",
            color: "#5F6368",
            fontFamily: fontStack,
          }}
        >
          AI-powered content platform by AIA
        </Typography>
      </Box>

      {/* Card */}
      <Box
        sx={{
          width: "100%",
          maxWidth: 400,
          borderRadius: "16px",
          border: "1px solid #E8EAED",
          backgroundColor: "#FFFFFF",
          p: 4,
          boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)",
        }}
      >
        <Typography
          component="h2"
          sx={{
            mb: 3,
            textAlign: "center",
            fontSize: "18px",
            fontWeight: 600,
            color: "#1F1F1F",
            fontFamily: fontStack,
          }}
        >
          Sign in
        </Typography>

        <Box
          component="form"
          onSubmit={handleSubmit}
          sx={{ display: "flex", flexDirection: "column", gap: 2 }}
        >
          {/* Email field */}
          <Box>
            <Typography
              component="label"
              htmlFor="email"
              sx={{
                display: "block",
                mb: 0.75,
                fontSize: "13px",
                fontWeight: 500,
                color: "#3C4043",
                fontFamily: fontStack,
              }}
            >
              Email
            </Typography>
            <TextField
              id="email"
              type="email"
              placeholder="name@aia.com.sg"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              fullWidth
              variant="outlined"
              size="small"
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: "10px",
                  backgroundColor: "#FFFFFF",
                  fontFamily: fontStack,
                  fontSize: "14px",
                  color: "#1F1F1F",
                  "& fieldset": {
                    borderColor: "#DADCE0",
                  },
                  "&:hover fieldset": {
                    borderColor: "#DADCE0",
                  },
                  "&.Mui-focused fieldset": {
                    borderColor: "#D0103A",
                    borderWidth: "1px",
                    boxShadow: "0 0 0 3px rgba(208,16,58,0.08)",
                  },
                },
                "& .MuiOutlinedInput-input": {
                  px: 1.75,
                  py: 1.25,
                  fontFamily: fontStack,
                  "&::placeholder": {
                    color: "#BDC1C6",
                    opacity: 1,
                  },
                },
              }}
            />
          </Box>

          {/* Password field */}
          <Box>
            <Box
              sx={{
                mb: 0.75,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Typography
                component="label"
                htmlFor="password"
                sx={{
                  fontSize: "13px",
                  fontWeight: 500,
                  color: "#3C4043",
                  fontFamily: fontStack,
                }}
              >
                Password
              </Typography>
              <Button
                type="button"
                disableRipple
                sx={{
                  fontSize: "13px",
                  color: "#D0103A",
                  fontFamily: fontStack,
                  textTransform: "none",
                  p: 0,
                  minWidth: 0,
                  lineHeight: 1,
                  background: "none",
                  "&:hover": {
                    background: "none",
                    textDecoration: "underline",
                  },
                }}
              >
                Forgot password?
              </Button>
            </Box>
            <TextField
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              fullWidth
              variant="outlined"
              size="small"
              slotProps={{ htmlInput: { minLength: 8 } }}
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: "10px",
                  backgroundColor: "#FFFFFF",
                  fontFamily: fontStack,
                  fontSize: "14px",
                  color: "#1F1F1F",
                  "& fieldset": {
                    borderColor: "#DADCE0",
                  },
                  "&:hover fieldset": {
                    borderColor: "#DADCE0",
                  },
                  "&.Mui-focused fieldset": {
                    borderColor: "#D0103A",
                    borderWidth: "1px",
                    boxShadow: "0 0 0 3px rgba(208,16,58,0.08)",
                  },
                },
                "& .MuiOutlinedInput-input": {
                  px: 1.75,
                  py: 1.25,
                  fontFamily: fontStack,
                  "&::placeholder": {
                    color: "#BDC1C6",
                    opacity: 1,
                  },
                },
              }}
            />
          </Box>

          {/* Error */}
          {error && (
            <Box
              sx={{
                borderRadius: "10px",
                backgroundColor: "#FCE8E6",
                px: 1.75,
                py: 1.25,
              }}
            >
              <Typography
                sx={{
                  fontSize: "13px",
                  color: "#C5221F",
                  fontFamily: fontStack,
                }}
              >
                {error}
              </Typography>
            </Box>
          )}

          {/* Submit */}
          <Button
            type="submit"
            variant="contained"
            disableElevation
            disabled={isLoading}
            fullWidth
            sx={{
              mt: 1,
              borderRadius: 9999,
              textTransform: "none",
              fontSize: "14px",
              fontWeight: 600,
              fontFamily: fontStack,
              backgroundColor: "#D0103A",
              color: "#FFFFFF",
              py: 1.25,
              "&:hover": {
                backgroundColor: "#B80E33",
              },
              "&.Mui-disabled": {
                backgroundColor: "#D0103A",
                color: "#FFFFFF",
                opacity: 0.6,
              },
            }}
          >
            {isLoading ? (
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 1,
                }}
              >
                <CircularProgress
                  size={16}
                  thickness={4}
                  sx={{ color: "rgba(255,255,255,0.85)" }}
                />
                Signing in…
              </Box>
            ) : (
              "Sign in"
            )}
          </Button>
        </Box>
      </Box>

      {/* Demo accounts */}
      <Box sx={{ mt: 3, width: "100%", maxWidth: 400 }}>
        <Typography
          sx={{
            mb: 1.5,
            textAlign: "center",
            fontSize: "12px",
            fontWeight: 500,
            color: "#80868B",
            fontFamily: fontStack,
          }}
        >
          Demo accounts
        </Typography>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 1,
          }}
        >
          {TEST_ACCOUNTS.map((acct) => (
            <Box
              key={acct.email}
              component="button"
              onClick={() => quickLogin(acct.email)}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.25,
                borderRadius: "12px",
                border: "1px solid #E8EAED",
                backgroundColor: "#FFFFFF",
                px: 1.5,
                py: 1.25,
                textAlign: "left",
                cursor: "pointer",
                transition: "background-color 0.15s ease",
                fontFamily: fontStack,
                "&:hover": {
                  backgroundColor: "#F8F9FA",
                },
                "&:active": {
                  transform: "scale(0.98)",
                },
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 32,
                  height: 32,
                  flexShrink: 0,
                  borderRadius: "50%",
                  backgroundColor: "#D0103A",
                  fontSize: "10px",
                  fontWeight: 700,
                  color: "#FFFFFF",
                  fontFamily: fontStack,
                }}
              >
                {acct.initials}
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography
                  sx={{
                    fontSize: "12px",
                    fontWeight: 500,
                    color: "#1F1F1F",
                    fontFamily: fontStack,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {acct.name}
                </Typography>
                <Typography
                  sx={{
                    fontSize: "11px",
                    color: "#80868B",
                    fontFamily: fontStack,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {acct.role}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </Box>

      <Typography
        sx={{
          mt: 4,
          fontSize: "11px",
          color: "#BDC1C6",
          fontFamily: fontStack,
        }}
      >
        © 2026 AIA Singapore · Internal use only
      </Typography>
    </Box>
  );
}
