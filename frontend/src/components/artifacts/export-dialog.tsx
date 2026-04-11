"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ExportFormatOptions } from "./export-format-options";
import { checkExportStatus, exportArtifact, getDownloadUrl } from "@/lib/api/exports";
import type { ExportAspectRatio, ExportFormat, ExportStatus } from "@/types/export";

interface ExportDialogProps {
  artifactId: string;
  artifactType: string;
  artifactName: string;
  complianceScore: number | null;
  onClose: () => void;
}

const MIN_COMPLIANCE = 70;

export function ExportDialog({
  artifactId,
  artifactType,
  artifactName,
  complianceScore,
  onClose,
}: ExportDialogProps) {
  const [selected, setSelected] = useState<{
    format: ExportFormat;
    aspectRatio?: ExportAspectRatio;
  } | null>(null);
  const [phase, setPhase] = useState<"select" | "processing" | "ready" | "failed">("select");
  const [exportId, setExportId] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isBlocked = complianceScore === null || complianceScore < MIN_COMPLIANCE;

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPoll(), [stopPoll]);

  async function handleExport() {
    if (!selected) return;
    setPhase("processing");

    try {
      const res = await exportArtifact(artifactId, selected.format, selected.aspectRatio);
      setExportId(res.export_id);

      // Poll for status
      pollRef.current = setInterval(async () => {
        try {
          const statusRes = await checkExportStatus(res.export_id);
          if (statusRes.status === "ready") {
            stopPoll();
            setDownloadUrl(getDownloadUrl(res.export_id));
            setPhase("ready");
          } else if (statusRes.status === "failed") {
            stopPoll();
            setPhase("failed");
          }
        } catch {
          stopPoll();
          setPhase("failed");
        }
      }, 2000);
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "detail" in err
          ? String((err as { detail: string }).detail)
          : "Export failed";
      setPhase("failed");
    }
  }

  function handleDownload() {
    if (!downloadUrl) return;
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#EBEBEB] px-6 py-5">
          <div>
            <h2 className="text-lg font-bold text-[#222222]">Export</h2>
            <p className="mt-0.5 text-sm text-[#717171] truncate max-w-[320px]">{artifactName}</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#717171] hover:bg-[#F7F7F7] hover:text-[#222222]"
          >
            ✕
          </button>
        </div>

        <div className="px-6 py-5">
          {/* Compliance gate */}
          {isBlocked && (
            <div className="mb-5 flex items-start gap-3 rounded-xl bg-[#FFF8E6] p-4">
              <span className="text-lg">⚠️</span>
              <div>
                <p className="text-sm font-semibold text-[#B8860B]">Compliance check required</p>
                <p className="mt-0.5 text-xs text-[#B8860B]">
                  {complianceScore === null
                    ? "This artifact has not been scored yet. Run compliance check first."
                    : `Score is ${complianceScore.toFixed(0)}/100 — minimum ${MIN_COMPLIANCE} required to export.`}
                </p>
              </div>
            </div>
          )}

          {phase === "select" && (
            <>
              <p className="mb-4 text-sm text-[#484848]">Select export format:</p>
              <ExportFormatOptions
                artifactType={artifactType}
                selected={selected}
                onSelect={(format, aspectRatio) => setSelected({ format, aspectRatio })}
              />
            </>
          )}

          {phase === "processing" && (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="h-10 w-10 animate-spin rounded-full border-3 border-[#DDDDDD] border-t-[#D0103A]" />
              <div className="text-center">
                <p className="text-sm font-semibold text-[#222222]">Rendering your export…</p>
                <p className="mt-1 text-xs text-[#717171]">
                  {selected?.format === "mp4"
                    ? "Reel rendering takes 10–30 seconds"
                    : "Poster rendering takes 2–5 seconds"}
                </p>
              </div>
            </div>
          )}

          {phase === "ready" && (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#E6F4EA] text-2xl">
                ✅
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-[#222222]">Export ready!</p>
                <p className="mt-1 text-xs text-[#717171]">Your file is ready to download.</p>
              </div>
              <button
                onClick={handleDownload}
                className="rounded-xl bg-[#D0103A] px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-[#B80E33] active:scale-95"
              >
                Download file
              </button>
            </div>
          )}

          {phase === "failed" && (
            <div className="flex flex-col items-center gap-4 py-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#FFF0F3] text-2xl">
                ❌
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-[#222222]">Export failed</p>
                <p className="mt-1 text-xs text-[#717171]">Something went wrong. Please try again.</p>
              </div>
              <button
                onClick={() => setPhase("select")}
                className="rounded-xl border border-[#DDDDDD] px-6 py-2.5 text-sm font-medium text-[#484848] hover:border-[#222222]"
              >
                Try again
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {phase === "select" && (
          <div className="flex items-center justify-end gap-3 border-t border-[#EBEBEB] px-6 py-4">
            <button
              onClick={onClose}
              className="rounded-xl border border-[#DDDDDD] px-5 py-2.5 text-sm font-medium text-[#484848] hover:border-[#222222]"
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              disabled={!selected || isBlocked}
              className="rounded-xl bg-[#D0103A] px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#B80E33] disabled:cursor-not-allowed disabled:opacity-40 active:scale-95"
            >
              Export
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
