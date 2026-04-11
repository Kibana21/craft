"use client";

export default function ComplianceReviewPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <div className="mb-10">
        <h1 className="text-[28px] font-bold text-[#222222]">Review Queue</h1>
        <p className="mt-1 text-base text-[#717171]">
          Pending Brand Library items and low-compliance artifacts
        </p>
      </div>

      <div className="mt-12 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#F7F7F7] text-3xl">
          ✅
        </div>
        <h3 className="mt-4 text-lg font-semibold text-[#222222]">
          All clear
        </h3>
        <p className="mt-1 text-sm text-[#717171]">
          No items requiring review right now. Check the Brand Library for pending publications.
        </p>
      </div>
    </div>
  );
}
