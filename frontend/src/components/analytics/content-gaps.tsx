"use client";

import { useRouter } from "next/navigation";
import type { ContentGap } from "@/types/analytics";

interface ContentGapsProps {
  gaps: ContentGap[];
  isLoading?: boolean;
}

export function ContentGaps({ gaps, isLoading }: ContentGapsProps) {
  const router = useRouter();

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 animate-pulse rounded-xl bg-[#F7F7F7]" />
        ))}
      </div>
    );
  }

  if (gaps.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-[#DDDDDD] text-sm text-[#B0B0B0]">
        No content gaps detected
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[#EBEBEB]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#EBEBEB] bg-[#F7F7F7]">
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#717171]">
              Product
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#717171]">
              Type
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#717171]">
              FSC Creates
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#717171]">
              Action
            </th>
          </tr>
        </thead>
        <tbody>
          {gaps.map((gap, i) => (
            <tr
              key={i}
              className="border-b border-[#EBEBEB] bg-white transition-colors last:border-0 hover:bg-[#F7F7F7]"
            >
              <td className="px-4 py-3 font-medium text-[#222222]">
                {gap.product || "—"}
              </td>
              <td className="px-4 py-3 text-[#484848]">
                {gap.artifact_type.replace(/_/g, " ")}
              </td>
              <td className="px-4 py-3 text-right font-semibold text-[#D0103A]">
                {gap.fsc_count}
              </td>
              <td className="px-4 py-3 text-right">
                <button
                  onClick={() => router.push("/brand-library")}
                  className="text-xs font-medium text-[#1B9D74] hover:underline"
                >
                  Publish template →
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
