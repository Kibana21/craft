"use client";

import { useEffect, useState } from "react";
import { fetchScoreBreakdown, type ComplianceScore } from "@/lib/api/compliance";

interface ScoreBreakdownProps {
  artifactId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ScoreBreakdown({ artifactId, isOpen, onClose }: ScoreBreakdownProps) {
  const [data, setData] = useState<ComplianceScore | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isOpen && artifactId) {
      setIsLoading(true);
      fetchScoreBreakdown(artifactId)
        .then(setData)
        .catch(() => {})
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, artifactId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="mx-4 max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl border border-[#EBEBEB] bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-[#222222]">Compliance Score</h2>
          <button onClick={onClose} className="rounded-lg p-2 text-[#717171] hover:bg-[#F7F7F7] hover:text-[#222222]">
            ✕
          </button>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="h-12 animate-pulse rounded-xl bg-[#F7F7F7]" />)}
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* Overall score */}
            <div className="flex items-center justify-center">
              <div className={`flex h-20 w-20 items-center justify-center rounded-full text-2xl font-bold text-white ${
                data.score >= 90 ? "bg-[#008A05]" : data.score >= 70 ? "bg-amber-500" : "bg-[#D0103A]"
              }`}>
                {Math.round(data.score)}
              </div>
            </div>

            {/* Rules */}
            {data.breakdown.rules && data.breakdown.rules.length > 0 && (
              <div>
                <h3 className="mb-3 text-sm font-semibold text-[#484848]">Rules checked</h3>
                <div className="space-y-2">
                  {data.breakdown.rules.map((rule, i) => (
                    <div key={i} className={`flex items-start gap-3 rounded-xl p-3 ${rule.passed ? "bg-[#F0FFF0]" : "bg-[#FFF0F3]"}`}>
                      <span className={`mt-0.5 text-sm ${rule.passed ? "text-[#008A05]" : "text-[#D0103A]"}`}>
                        {rule.passed ? "✓" : "✗"}
                      </span>
                      <div className="flex-1">
                        <p className="text-sm text-[#484848]">{rule.rule_text}</p>
                        {rule.details && (
                          <p className="mt-1 text-xs text-[#D0103A]">{rule.details}</p>
                        )}
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        rule.severity === "error" ? "bg-[#FFF0F3] text-[#D0103A]" : "bg-amber-50 text-amber-700"
                      }`}>
                        {rule.severity}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Disclaimers */}
            {data.breakdown.disclaimers && data.breakdown.disclaimers.length > 0 && (
              <div>
                <h3 className="mb-3 text-sm font-semibold text-[#484848]">Required disclaimers</h3>
                <div className="space-y-2">
                  {data.breakdown.disclaimers.map((d, i) => (
                    <div key={i} className={`flex items-start gap-3 rounded-xl p-3 ${d.present ? "bg-[#F0FFF0]" : "bg-[#FFF0F3]"}`}>
                      <span className={`mt-0.5 text-sm ${d.present ? "text-[#008A05]" : "text-[#D0103A]"}`}>
                        {d.present ? "✓" : "✗"}
                      </span>
                      <p className="flex-1 text-xs text-[#484848]">{d.disclaimer}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Suggestions */}
            {data.suggestions.length > 0 && (
              <div>
                <h3 className="mb-3 text-sm font-semibold text-[#484848]">Suggestions</h3>
                <div className="space-y-2">
                  {data.suggestions.map((s, i) => (
                    <div key={i} className="rounded-xl bg-amber-50 p-3">
                      <p className="text-sm text-amber-800">{s}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-center text-sm text-[#717171]">Failed to load score breakdown</p>
        )}
      </div>
    </div>
  );
}
