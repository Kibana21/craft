"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

interface WizardProgressProps {
  steps: string[];
  currentStep: number;
}

export function WizardProgress({ steps, currentStep }: WizardProgressProps) {
  return (
    <Box sx={{ mb: 5 }}>
      {/* Numbered step indicators */}
      <Box sx={{ mb: 3, display: "flex", alignItems: "center", justifyContent: "center", gap: 1.5 }}>
        {steps.map((step, i) => (
          <Box key={step} sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              {/* Circle */}
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  fontSize: 14,
                  fontWeight: 600,
                  bgcolor:
                    i === currentStep
                      ? "#D0103A"
                      : i < currentStep
                      ? "#188038"
                      : "#E8EAED",
                  color:
                    i === currentStep
                      ? "#FFFFFF"
                      : i < currentStep
                      ? "#FFFFFF"
                      : "#9E9E9E",
                  transition: "all 0.2s",
                }}
              >
                {i < currentStep ? "✓" : i + 1}
              </Box>

              {/* Label */}
              <Typography
                sx={{
                  fontSize: 14,
                  fontWeight: i === currentStep ? 600 : 400,
                  color:
                    i === currentStep
                      ? "#1F1F1F"
                      : i < currentStep
                      ? "#188038"
                      : "#9E9E9E",
                }}
              >
                {step}
              </Typography>
            </Box>

            {/* Connector line */}
            {i < steps.length - 1 && (
              <Box
                sx={{
                  width: 32,
                  height: 1,
                  bgcolor: i < currentStep ? "#188038" : "#E8EAED",
                  transition: "background-color 0.2s",
                }}
              />
            )}
          </Box>
        ))}
      </Box>

      {/* Progress bar */}
      <Box sx={{ mx: "auto", maxWidth: 448 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          {steps.map((_, i) => (
            <Box
              key={i}
              sx={{
                flex: 1,
                height: 4,
                borderRadius: 9999,
                bgcolor: i <= currentStep ? "#D0103A" : "#E8EAED",
                transition: "background-color 0.3s",
              }}
            />
          ))}
        </Box>
      </Box>
    </Box>
  );
}
