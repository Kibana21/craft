"use client";

export function AnalyticsTab() {
  // Placeholder — real data wired in Phase 8
  return (
    <div>
      <h3 className="mb-3 text-[11px] font-bold text-[#1A1A18]">
        Agent usage this week
      </h3>
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-[#E2DDD4] bg-[#F0EDE6] p-3 text-center">
          <p className="text-lg font-bold text-[#1A1A18]">—</p>
          <p className="text-[9px] text-[#9C9A92]">Assets created</p>
        </div>
        <div className="rounded-lg border border-[#E2DDD4] bg-[#F0EDE6] p-3 text-center">
          <p className="text-lg font-bold text-[#1A1A18]">—</p>
          <p className="text-[9px] text-[#9C9A92]">Library remixes</p>
        </div>
        <div className="rounded-lg border border-[#E2DDD4] bg-[#F0EDE6] p-3 text-center">
          <p className="text-lg font-bold text-[#1A1A18]">—</p>
          <p className="text-[9px] text-[#9C9A92]">Compliance rate</p>
        </div>
      </div>
      <p className="mt-4 text-center text-[11px] text-[#9C9A92]">
        Analytics dashboard will be available in a future update.
      </p>
    </div>
  );
}
