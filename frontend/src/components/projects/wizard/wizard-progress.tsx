"use client";

interface WizardProgressProps {
  steps: string[];
  currentStep: number;
}

export function WizardProgress({ steps, currentStep }: WizardProgressProps) {
  return (
    <div className="mb-10">
      {/* Numbered step indicators */}
      <div className="mb-6 flex items-center justify-center gap-3">
        {steps.map((step, i) => (
          <div key={step} className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${
                  i === currentStep
                    ? "bg-[#222222] text-white"
                    : i < currentStep
                      ? "bg-[#008A05] text-white"
                      : "bg-[#F7F7F7] text-[#B0B0B0]"
                }`}
              >
                {i < currentStep ? "✓" : i + 1}
              </span>
              <span
                className={`text-sm ${
                  i === currentStep
                    ? "font-semibold text-[#222222]"
                    : i < currentStep
                      ? "text-[#008A05]"
                      : "text-[#B0B0B0]"
                }`}
              >
                {step}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={`h-px w-8 ${
                  i < currentStep ? "bg-[#008A05]" : "bg-[#EBEBEB]"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="mx-auto max-w-md">
        <div className="flex items-center gap-1">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                i <= currentStep ? "bg-[#222222]" : "bg-[#EBEBEB]"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
