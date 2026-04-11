"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createProject } from "@/lib/api/projects";

const QUICK_CREATE_OPTIONS = [
  { label: "Poster", icon: "◻", type: "poster" },
  { label: "WhatsApp", icon: "✉", type: "whatsapp_card" },
  { label: "Reel", icon: "▶", type: "reel" },
  { label: "Card", icon: "📋", type: "story" },
];

export function QuickCreateStrip() {
  const router = useRouter();
  const [creating, setCreating] = useState<string | null>(null);

  const handleQuickCreate = async (artifactType: string) => {
    setCreating(artifactType);
    try {
      const now = new Date();
      const month = now.toLocaleString("default", { month: "short" });
      const project = await createProject({
        name: `Quick ${artifactType.replace("_", " ")} — ${month} ${now.getFullYear()}`,
        type: "personal",
        purpose: "campaign",
      });
      router.push(`/projects/${project.id}/artifacts/new?type=${artifactType}`);
    } catch {
      setCreating(null);
    }
  };

  return (
    <div className="bg-white border-b border-[#EBEBEB] px-6 py-6">
      <div className="mx-auto max-w-3xl">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-[#717171]">
          Quick create
        </p>
        <div className="flex gap-3">
          {QUICK_CREATE_OPTIONS.map((option) => (
            <button
              key={option.type}
              onClick={() => handleQuickCreate(option.type)}
              disabled={creating !== null}
              className="flex-1 rounded-xl border border-[#E8E8E8] bg-white px-4 py-3 text-center text-sm font-semibold text-[#222222] transition-all duration-200 hover:border-[#D0103A] hover:shadow-sm disabled:opacity-50"
            >
              {creating === option.type ? "Creating..." : `${option.icon} ${option.label}`}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
