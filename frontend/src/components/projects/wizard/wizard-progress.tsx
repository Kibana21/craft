"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

interface WizardProgressProps {
  steps: string[];
  currentStep: number;
  // When provided, step circle+label render as a button that invokes onStepClick.
  onStepClick?: (index: number) => void;
  // If onStepClick is provided, controls which indices are clickable.
  // Defaults to "all" for maximum flexibility.
  clickableSteps?: "all" | "completed-and-current";
}

export function WizardProgress({
  steps,
  currentStep,
  onStepClick,
  clickableSteps = "all",
}: WizardProgressProps) {
  const isClickable = (i: number) => {
    if (!onStepClick) return false;
    if (clickableSteps === "completed-and-current") return i <= currentStep;
    return true;
  };

  return (
    <Box sx={{ mb: 5 }}>
      {/* Numbered step indicators */}
      <Box sx={{ mb: 3, display: "flex", alignItems: "center", justifyContent: "center", gap: 1.5 }}>
        {steps.map((step, i) => {
          const clickable = isClickable(i);
          const circleBg =
            i === currentStep ? "#D0103A" : i < currentStep ? "#188038" : "#E8EAED";
          const circleColor =
            i === currentStep ? "#FFFFFF" : i < currentStep ? "#FFFFFF" : "#9E9E9E";
          const labelColor =
            i === currentStep ? "#1F1F1F" : i < currentStep ? "#188038" : "#9E9E9E";

          return (
            <Box key={step} sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Box
                component={clickable ? "button" : "div"}
                onClick={clickable ? () => onStepClick!(i) : undefined}
                aria-label={clickable ? `Go to ${step} step` : undefined}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  border: "none",
                  bgcolor: "transparent",
                  p: 0,
                  cursor: clickable ? "pointer" : "default",
                  borderRadius: 9999,
                  transition: "opacity 0.15s",
                  "&:hover": clickable ? { opacity: 0.75 } : {},
                  "&:focus-visible": clickable
                    ? { outline: "2px solid #D0103A", outlineOffset: 2 }
                    : {},
                }}
              >
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
                    bgcolor: circleBg,
                    color: circleColor,
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
                    color: labelColor,
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
          );
        })}
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
