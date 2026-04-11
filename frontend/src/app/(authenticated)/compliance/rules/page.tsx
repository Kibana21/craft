"use client";

import { useEffect, useState } from "react";
import { fetchRules, createRule, updateRule, type ComplianceRule } from "@/lib/api/compliance";

export default function ComplianceRulesPage() {
  const [rules, setRules] = useState<ComplianceRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newRule, setNewRule] = useState<{ rule_text: string; category: string; severity: "error" | "warning" }>({ rule_text: "", category: "disclaimer_required", severity: "error" });

  const loadRules = () => {
    fetchRules().then(setRules).finally(() => setIsLoading(false));
  };

  useEffect(() => { loadRules(); }, []);

  const handleCreate = async () => {
    await createRule(newRule);
    setNewRule({ rule_text: "", category: "disclaimer_required", severity: "error" });
    setShowForm(false);
    loadRules();
  };

  const handleToggle = async (rule: ComplianceRule) => {
    await updateRule(rule.id, { is_active: !rule.is_active });
    loadRules();
  };

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <div className="mb-10 flex items-start justify-between">
        <div>
          <h1 className="text-[28px] font-bold text-[#222222]">Compliance Rules</h1>
          <p className="mt-1 text-base text-[#717171]">MAS compliance rules applied to all artifact content</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="rounded-lg bg-[#D0103A] px-6 py-3 text-base font-semibold text-white transition-all hover:bg-[#B80E33]"
        >
          + Add rule
        </button>
      </div>

      {showForm && (
        <div className="mb-8 rounded-xl border border-[#EBEBEB] bg-white p-6">
          <h3 className="mb-4 text-base font-semibold text-[#222222]">New rule</h3>
          <div className="space-y-4">
            <textarea
              value={newRule.rule_text}
              onChange={(e) => setNewRule({ ...newRule, rule_text: e.target.value })}
              placeholder="Rule description..."
              rows={3}
              className="w-full rounded-lg border border-[#DDDDDD] px-4 py-3.5 text-base focus:border-[#222222] focus:outline-none focus:ring-0"
            />
            <div className="flex gap-4">
              <select
                value={newRule.category}
                onChange={(e) => setNewRule({ ...newRule, category: e.target.value })}
                className="rounded-lg border border-[#DDDDDD] px-4 py-3.5 text-base focus:border-[#222222] focus:outline-none focus:ring-0"
              >
                <option value="disclaimer_required">Disclaimer required</option>
                <option value="prohibited_claim">Prohibited claim</option>
                <option value="benefit_illustration">Benefit illustration</option>
                <option value="competitor_reference">Competitor reference</option>
                <option value="testimonial">Testimonial</option>
              </select>
              <div className="flex gap-2">
                {(["error", "warning"] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setNewRule({ ...newRule, severity: s })}
                    className={`rounded-full px-4 py-2 text-sm font-medium ${
                      newRule.severity === s
                        ? s === "error" ? "bg-[#D0103A] text-white" : "bg-amber-500 text-white"
                        : "border border-[#DDDDDD] text-[#484848]"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <button
                onClick={handleCreate}
                disabled={newRule.rule_text.length < 10}
                className="rounded-lg bg-[#008A05] px-6 py-2 text-base font-semibold text-white disabled:opacity-40"
              >
                Save rule
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-20 animate-pulse rounded-xl bg-[#F7F7F7]" />)}</div>
      ) : (
        <div className="space-y-4">
          {rules.map((rule) => (
            <div key={rule.id} className={`flex items-start gap-4 rounded-xl border border-[#EBEBEB] bg-white p-5 transition-all ${!rule.is_active && "opacity-50"}`}>
              <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${rule.severity === "error" ? "bg-[#D0103A]" : "bg-amber-500"}`}>
                {rule.severity === "error" ? "!" : "⚠"}
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-[#222222]">{rule.rule_text}</p>
                <div className="mt-2 flex gap-2">
                  <span className="rounded-full bg-[#F7F7F7] px-3 py-0.5 text-xs font-medium text-[#484848]">{rule.category.replace("_", " ")}</span>
                  <span className={`rounded-full px-3 py-0.5 text-xs font-medium ${rule.severity === "error" ? "bg-[#FFF0F3] text-[#D0103A]" : "bg-amber-50 text-amber-700"}`}>{rule.severity}</span>
                </div>
              </div>
              <button
                onClick={() => handleToggle(rule)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${rule.is_active ? "bg-[#F7F7F7] text-[#717171] hover:bg-[#FFF0F3] hover:text-[#D0103A]" : "bg-[#F0FFF0] text-[#008A05]"}`}
              >
                {rule.is_active ? "Deactivate" : "Activate"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
