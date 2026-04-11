"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { PosterCreator } from "@/components/artifacts/create/poster-creator";
import { WhatsAppCreator } from "@/components/artifacts/create/whatsapp-creator";
import { ReelCreator } from "@/components/artifacts/create/reel-creator";
import { createArtifact } from "@/lib/api/artifacts";
import { fetchProjectDetail, type ProjectDetail } from "@/lib/api/projects";
import type { ArtifactType } from "@/types/artifact";

const ARTIFACT_TYPES: { key: ArtifactType; icon: string; label: string; desc: string }[] = [
  { key: "poster", icon: "◻", label: "Static poster", desc: "PNG / PDF · Social media & print" },
  { key: "whatsapp_card", icon: "✉", label: "WhatsApp card", desc: "800x800 · Client messaging" },
  { key: "reel", icon: "▶", label: "Reel / Video", desc: "9:16 vertical · Social stories" },
  { key: "infographic", icon: "📊", label: "Infographic", desc: "Steps / guide · Educational" },
  { key: "slide_deck", icon: "📋", label: "Slide deck", desc: "PPTX · Presentations" },
];

export default function NewArtifactPage() {
  const { id: projectId } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const preselectedType = searchParams.get("type") as ArtifactType | null;
  const [selectedType, setSelectedType] = useState<ArtifactType | null>(preselectedType);
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (projectId) {
      fetchProjectDetail(projectId).then(setProject).catch(() => router.push("/home"));
    }
  }, [projectId, router]);

  const handleSave = async (data: Record<string, unknown>) => {
    if (!selectedType || !projectId) return;
    setIsSaving(true);
    try {
      const artifact = await createArtifact(projectId, {
        type: selectedType,
        name: (data.headline as string) || `New ${selectedType}`,
        content: data,
        channel: selectedType === "whatsapp_card" ? "whatsapp" : selectedType === "poster" ? "instagram" : "social",
        format: (data.format as "1:1" | "4:5" | "9:16" | "800x800") || undefined,
      });
      router.push(`/projects/${projectId}/artifacts/${artifact.id}`);
    } catch {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2 text-sm text-[#717171]">
        <button onClick={() => router.push("/home")} className="hover:text-[#222222]">
          Home
        </button>
        <span>/</span>
        <button
          onClick={() => router.push(`/projects/${projectId}`)}
          className="hover:text-[#222222]"
        >
          {project?.name || "Project"}
        </button>
        <span>/</span>
        <span className="text-[#222222]">New artifact</span>
      </div>

      {!selectedType ? (
        /* Type selector */
        <div className="rounded-xl border border-[#EBEBEB] bg-white p-8">
          <h1 className="text-[28px] font-bold text-[#222222]">
            Choose artifact type
          </h1>
          <p className="mt-2 text-base text-[#717171]">
            What kind of content do you want to create?
          </p>

          <div className="mt-10 grid grid-cols-2 gap-6 lg:grid-cols-3">
            {ARTIFACT_TYPES.map((type) => (
              <button
                key={type.key}
                onClick={() => setSelectedType(type.key)}
                className="group rounded-xl border-2 border-[#EBEBEB] p-8 text-left transition-all duration-200 hover:shadow-lg hover:scale-[1.02] hover:border-[#D0103A]"
              >
                <span className="text-4xl">{type.icon}</span>
                <h3 className="mt-4 text-base font-semibold text-[#222222] group-hover:text-[#D0103A]">
                  {type.label}
                </h3>
                <p className="mt-1 text-sm text-[#717171]">{type.desc}</p>
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* Creator form */
        <div>
          <div className="mb-6 flex items-center gap-3">
            <button
              onClick={() => setSelectedType(null)}
              className="text-sm text-[#717171] hover:text-[#222222]"
            >
              ← Change type
            </button>
            <span className="rounded-full bg-[#F7F7F7] px-3 py-1 text-sm font-medium text-[#484848]">
              {ARTIFACT_TYPES.find((t) => t.key === selectedType)?.label}
            </span>
          </div>

          <div className="rounded-xl border border-[#EBEBEB] bg-white p-8">
            <h1 className="mb-6 text-[28px] font-bold text-[#222222]">
              Create {ARTIFACT_TYPES.find((t) => t.key === selectedType)?.label?.toLowerCase()}
            </h1>

            {selectedType === "poster" && (
              <PosterCreator
                product={project?.product || ""}
                audience={project?.target_audience || ""}
                onSave={handleSave}
                isSaving={isSaving}
              />
            )}
            {selectedType === "whatsapp_card" && (
              <WhatsAppCreator
                product={project?.product || ""}
                audience={project?.target_audience || ""}
                onSave={handleSave}
                isSaving={isSaving}
              />
            )}
            {selectedType === "reel" && (
              <ReelCreator
                product={project?.product || ""}
                audience={project?.target_audience || ""}
                keyMessage={project?.key_message || ""}
                onSave={handleSave}
                isSaving={isSaving}
              />
            )}
            {(selectedType === "infographic" || selectedType === "slide_deck") && (
              <div className="py-12 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#F7F7F7] text-3xl">
                  🚧
                </div>
                <h3 className="mt-4 text-lg font-semibold text-[#222222]">
                  Coming soon
                </h3>
                <p className="mt-1 text-sm text-[#717171]">
                  {selectedType === "infographic" ? "Infographic" : "Slide deck"} creation will be available in a future update.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
