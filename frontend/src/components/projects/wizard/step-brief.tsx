"use client";

const AIA_PRODUCTS = [
  "PAA — Personal Accident Advantage",
  "HealthShield",
  "AIA Vitality",
  "PRUWealth",
  "AIA Family Protect",
  "SG60 Special",
  "General / Other",
];

interface BriefData {
  name: string;
  product: string;
  target_audience: string;
  campaign_period: string;
  key_message: string;
}

interface StepBriefProps {
  value: BriefData;
  onChange: (data: BriefData) => void;
}

export function StepBrief({ value, onChange }: StepBriefProps) {
  const update = (field: keyof BriefData, val: string) => {
    onChange({ ...value, [field]: val });
  };

  return (
    <div>
      <h2 className="text-[28px] font-bold text-[#222222]">
        Tell us about the campaign
      </h2>
      <p className="mt-2 text-base text-[#717171]">
        This brief is shared by every artifact in the project
      </p>

      <div className="mt-10 space-y-6">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="mb-2 block text-sm font-medium text-[#484848]">
              Project / campaign name
            </label>
            <input
              type="text"
              value={value.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="e.g., PAA Launch Q2 2025"
              className="w-full rounded-lg border border-[#DDDDDD] px-4 py-3.5 text-base text-[#222222] placeholder-[#B0B0B0] transition-colors focus:border-[#222222] focus:outline-none focus:ring-0"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-[#484848]">
              Product
            </label>
            <select
              value={value.product}
              onChange={(e) => update("product", e.target.value)}
              className="w-full rounded-lg border border-[#DDDDDD] px-4 py-3.5 text-base text-[#222222] transition-colors focus:border-[#222222] focus:outline-none focus:ring-0"
            >
              <option value="">Select a product</option>
              {AIA_PRODUCTS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="mb-2 block text-sm font-medium text-[#484848]">
              Primary audience
            </label>
            <input
              type="text"
              value={value.target_audience}
              onChange={(e) => update("target_audience", e.target.value)}
              placeholder="e.g., Young parents (28–35)"
              className="w-full rounded-lg border border-[#DDDDDD] px-4 py-3.5 text-base text-[#222222] placeholder-[#B0B0B0] transition-colors focus:border-[#222222] focus:outline-none focus:ring-0"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-[#484848]">
              Launch / campaign period
            </label>
            <input
              type="text"
              value={value.campaign_period}
              onChange={(e) => update("campaign_period", e.target.value)}
              placeholder="e.g., 1 May – 30 Jun 2025"
              className="w-full rounded-lg border border-[#DDDDDD] px-4 py-3.5 text-base text-[#222222] placeholder-[#B0B0B0] transition-colors focus:border-[#222222] focus:outline-none focus:ring-0"
            />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-[#484848]">
            Key message
          </label>
          <textarea
            value={value.key_message}
            onChange={(e) => update("key_message", e.target.value)}
            placeholder="e.g., Affordable protection for young parents — from $1.20/day, with hospitalisation income benefit included."
            rows={3}
            className="w-full rounded-lg border border-[#DDDDDD] px-4 py-3.5 text-base text-[#222222] placeholder-[#B0B0B0] transition-colors focus:border-[#222222] focus:outline-none focus:ring-0"
          />
        </div>
      </div>
    </div>
  );
}
