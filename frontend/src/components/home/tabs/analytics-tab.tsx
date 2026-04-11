"use client";

export function AnalyticsTab() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-[#222222]">
          Agent usage this week
        </h2>
        <p className="mt-0.5 text-sm text-[#717171]">
          Track how FSCs are using CRAFT
        </p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="rounded-xl border border-[#EBEBEB] bg-white p-6 text-center">
          <p className="text-3xl font-bold text-[#222222]">—</p>
          <p className="mt-1 text-sm text-[#717171]">Assets created</p>
        </div>
        <div className="rounded-xl border border-[#EBEBEB] bg-white p-6 text-center">
          <p className="text-3xl font-bold text-[#222222]">—</p>
          <p className="mt-1 text-sm text-[#717171]">Library remixes</p>
        </div>
        <div className="rounded-xl border border-[#EBEBEB] bg-white p-6 text-center">
          <p className="text-3xl font-bold text-[#222222]">—</p>
          <p className="mt-1 text-sm text-[#717171]">Compliance rate</p>
        </div>
      </div>

      <div className="mt-12 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#F7F7F7] text-3xl">
          📊
        </div>
        <h3 className="mt-4 text-lg font-semibold text-[#222222]">
          Analytics coming soon
        </h3>
        <p className="mt-1 text-sm text-[#717171]">
          Full dashboard with charts and content gap signals
        </p>
      </div>
    </div>
  );
}
