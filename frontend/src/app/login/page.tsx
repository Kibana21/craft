"use client";

import { useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";

const TEST_ACCOUNTS = [
  { email: "sarah@aia.com.sg", name: "Sarah Lim", role: "Brand Admin", initials: "SL" },
  { email: "david@aia.com.sg", name: "David Tan", role: "District Leader", initials: "DT" },
  { email: "michael@aia.com.sg", name: "Michael Chen", role: "Agency Leader", initials: "MC" },
  { email: "maya@agent.aia.com.sg", name: "Maya Raj", role: "FSC · Agent", initials: "MR" },
];

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      await login(email, password);
    } catch {
      setError("Couldn't sign in. Check your email and password.");
    } finally {
      setIsLoading(false);
    }
  };

  const quickLogin = (emailAddr: string) => {
    setEmail(emailAddr);
    setPassword("craft2026");
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4">
      {/* Logo */}
      <div className="mb-8 flex flex-col items-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#D0103A]">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M12 3L3 19h4l5-10 5 10h4L12 3z" fill="white" />
            <path d="M8.5 15h7" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </div>
        <h1 className="text-[22px] font-semibold tracking-tight text-[#1F1F1F]">CRAFT</h1>
        <p className="mt-1 text-[13px] text-[#5F6368]">AI-powered content platform by AIA</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-[400px] rounded-2xl border border-[#E8EAED] bg-white p-8 shadow-[0_1px_3px_rgba(0,0,0,0.06),0_4px_16px_rgba(0,0,0,0.04)]">
        <h2 className="mb-6 text-center text-[18px] font-semibold text-[#1F1F1F]">Sign in</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-[13px] font-medium text-[#3C4043]">
              Email
            </label>
            <input
              id="email"
              type="email"
              placeholder="name@aia.com.sg"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-lg border border-[#DADCE0] bg-white px-3.5 py-2.5 text-[14px] text-[#1F1F1F] placeholder-[#BDC1C6] outline-none transition-all focus:border-[#D0103A] focus:shadow-[0_0_0_3px_rgba(208,16,58,0.08)]"
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="password" className="text-[13px] font-medium text-[#3C4043]">
                Password
              </label>
              <button type="button" className="text-[13px] text-[#D0103A] hover:underline">
                Forgot password?
              </button>
            </div>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full rounded-lg border border-[#DADCE0] bg-white px-3.5 py-2.5 text-[14px] text-[#1F1F1F] placeholder-[#BDC1C6] outline-none transition-all focus:border-[#D0103A] focus:shadow-[0_0_0_3px_rgba(208,16,58,0.08)]"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-[#FCE8E6] px-3.5 py-2.5 text-[13px] text-[#C5221F]">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="mt-2 w-full rounded-lg bg-[#D0103A] py-2.5 text-[14px] font-semibold text-white transition-colors hover:bg-[#B80E33] disabled:opacity-60"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Signing in…
              </span>
            ) : "Sign in"}
          </button>
        </form>
      </div>

      {/* Demo accounts */}
      <div className="mt-6 w-full max-w-[400px]">
        <p className="mb-3 text-center text-[12px] font-medium text-[#80868B]">Demo accounts</p>
        <div className="grid grid-cols-2 gap-2">
          {TEST_ACCOUNTS.map((acct) => (
            <button
              key={acct.email}
              onClick={() => quickLogin(acct.email)}
              className="flex items-center gap-2.5 rounded-xl border border-[#E8EAED] bg-white px-3 py-2.5 text-left transition-colors hover:bg-[#F8F9FA] active:scale-[0.98]"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#D0103A] text-[10px] font-bold text-white">
                {acct.initials}
              </div>
              <div className="min-w-0">
                <p className="truncate text-[12px] font-medium text-[#1F1F1F]">{acct.name}</p>
                <p className="truncate text-[11px] text-[#80868B]">{acct.role}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <p className="mt-8 text-[11px] text-[#BDC1C6]">© 2026 AIA Singapore · Internal use only</p>
    </div>
  );
}
