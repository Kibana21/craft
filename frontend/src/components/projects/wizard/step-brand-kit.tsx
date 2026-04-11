"use client";

export function StepBrandKit() {
  return (
    <div>
      <h2 className="text-[28px] font-bold text-[#222222]">
        Brand + compliance kit
      </h2>
      <p className="mt-2 text-base text-[#717171]">
        Your project will use these brand assets and compliance rules
      </p>

      <div className="mt-10">
        <div className="flex items-center justify-between rounded-xl border border-[#EBEBEB] bg-white p-6">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#F0FFF0]">
              <span className="text-lg text-[#008A05]">●</span>
            </div>
            <div>
              <p className="text-base font-semibold text-[#222222]">
                AIA Singapore — Brand Kit v1
              </p>
              <p className="mt-0.5 text-sm text-[#717171]">
                MAS compliance rules active · 5 rules loaded
              </p>
            </div>
          </div>
          <button className="rounded-lg border border-[#222222] px-4 py-2 text-sm font-semibold text-[#222222] transition-colors hover:bg-[#F7F7F7]">
            Change
          </button>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-[#EBEBEB] bg-white p-4">
            <div className="mb-2 flex items-center gap-2">
              <div className="h-5 w-5 rounded bg-[#D0103A]" />
              <div className="h-5 w-5 rounded bg-[#1A1A18]" />
              <div className="h-5 w-5 rounded bg-[#1B9D74]" />
            </div>
            <p className="text-xs font-medium text-[#717171]">Brand colours</p>
          </div>
          <div className="rounded-xl border border-[#EBEBEB] bg-white p-4">
            <p className="mb-2 text-base font-semibold text-[#222222]">Aa</p>
            <p className="text-xs font-medium text-[#717171]">Inter font family</p>
          </div>
          <div className="rounded-xl border border-[#EBEBEB] bg-white p-4">
            <p className="mb-2 text-base">🛡️</p>
            <p className="text-xs font-medium text-[#717171]">MAS compliant</p>
          </div>
        </div>
      </div>
    </div>
  );
}
