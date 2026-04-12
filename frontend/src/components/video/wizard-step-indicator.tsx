"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import ButtonBase from "@mui/material/ButtonBase";

const STEPS = [
  { key: "brief", label: "Brief" },
  { key: "presenter", label: "Presenter" },
  { key: "script", label: "Script" },
  { key: "storyboard", label: "Storyboard" },
  { key: "generate", label: "Generate" },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

interface WizardStepIndicatorProps {
  currentStep: StepKey;
  projectId: string;
  artifactId: string;
  onNavigate?: (step: StepKey) => void;
}

const STEP_ORDER: StepKey[] = ["brief", "presenter", "script", "storyboard", "generate"];

export function WizardStepIndicator({
  currentStep,
  projectId,
  artifactId,
  onNavigate,
}: WizardStepIndicatorProps) {
  const currentIdx = STEP_ORDER.indexOf(currentStep);

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0,
        mb: 5,
        overflowX: "auto",
      }}
    >
      {STEPS.map((step, idx) => {
        const isCompleted = idx < currentIdx;
        const isCurrent = idx === currentIdx;
        const isDisabled = idx > currentIdx;
        const isLast = idx === STEPS.length - 1;

        const pill = (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              px: 2,
              py: 0.75,
              borderRadius: "9999px",
              border: "1.5px solid",
              borderColor: isCurrent
                ? "#D0103A"
                : isCompleted
                ? "#22C55E"
                : "#E5E7EB",
              bgcolor: isCurrent
                ? "#FFF1F4"
                : isCompleted
                ? "#F0FDF4"
                : "#FAFAFA",
              cursor: isDisabled ? "default" : "pointer",
              transition: "all 0.15s",
              whiteSpace: "nowrap",
              "&:hover": isDisabled
                ? {}
                : {
                    boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
                    transform: "scale(1.03)",
                  },
            }}
          >
            {isCompleted && (
              <Box
                component="span"
                sx={{
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  bgcolor: "#22C55E",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path
                    d="M2 5l2.5 2.5L8 3"
                    stroke="white"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Box>
            )}
            {isCurrent && (
              <Box
                component="span"
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  bgcolor: "#D0103A",
                  flexShrink: 0,
                }}
              />
            )}
            {isDisabled && (
              <Box
                component="span"
                sx={{
                  width: 16,
                  height: 16,
                  borderRadius: "50%",
                  border: "1.5px solid #D1D5DB",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Typography sx={{ fontSize: "9px", color: "#9CA3AF", lineHeight: 1 }}>
                  {idx + 1}
                </Typography>
              </Box>
            )}
            <Typography
              sx={{
                fontSize: "13px",
                fontWeight: isCurrent ? 600 : 500,
                color: isCurrent ? "#D0103A" : isCompleted ? "#16A34A" : "#9CA3AF",
              }}
            >
              {step.label}
            </Typography>
          </Box>
        );

        return (
          <Box key={step.key} sx={{ display: "flex", alignItems: "center" }}>
            {isDisabled ? (
              pill
            ) : (
              <ButtonBase
                disableRipple
                onClick={() => onNavigate?.(step.key)}
                sx={{ borderRadius: "9999px" }}
              >
                {pill}
              </ButtonBase>
            )}
            {!isLast && (
              <Box
                sx={{
                  width: 28,
                  height: 1.5,
                  bgcolor: idx < currentIdx ? "#22C55E" : "#E5E7EB",
                  flexShrink: 0,
                }}
              />
            )}
          </Box>
        );
      })}
    </Box>
  );
}
