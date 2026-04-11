"use client";

import { useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";

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
      setError("Invalid email or password");
    } finally {
      setIsLoading(false);
    }
  };

  const quickLogin = (quickEmail: string) => {
    setEmail(quickEmail);
    setPassword("craft2026");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <div className="w-full max-w-md px-6">
        {/* Logo */}
        <div className="mb-12 text-center">
          <h1 className="text-5xl font-black tracking-tight text-[#D0103A]">
            CRAFT
          </h1>
          <p className="mt-3 text-base text-[#717171]">
            AI-powered content creation by AIA Singapore
          </p>
        </div>

        {/* Login card */}
        <div className="rounded-xl border border-[#EBEBEB] bg-white p-8 shadow-sm">
          <h2 className="mb-6 text-xl font-semibold text-[#222222]">
            Sign in to your account
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="mb-1.5 block text-sm font-medium text-[#484848]"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                placeholder="name@aia.com.sg"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-lg border border-[#DDDDDD] px-4 py-3.5 text-base text-[#222222] placeholder-[#B0B0B0] transition-colors focus:border-[#222222] focus:outline-none focus:ring-0"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-[#484848]"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full rounded-lg border border-[#DDDDDD] px-4 py-3.5 text-base text-[#222222] placeholder-[#B0B0B0] transition-colors focus:border-[#222222] focus:outline-none focus:ring-0"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-[#FFF0F3] px-4 py-3 text-sm font-medium text-[#D0103A]">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-lg bg-[#D0103A] px-6 py-3 text-base font-semibold text-white transition-all duration-200 hover:bg-[#B80E33] disabled:opacity-50"
            >
              {isLoading ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>

        {/* Quick login — test accounts */}
        <div className="mt-6 rounded-xl border border-[#EBEBEB] bg-white p-6">
          <p className="mb-4 text-center text-xs font-semibold uppercase tracking-wider text-[#717171]">
            Test accounts
          </p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { email: "sarah@aia.com.sg", name: "Sarah", role: "Brand Admin", color: "border-[#EBEBEB] hover:bg-[#FFF0F3]" },
              { email: "david@aia.com.sg", name: "David", role: "District Leader", color: "border-[#EBEBEB] hover:bg-[#F0FFF0]" },
              { email: "michael@aia.com.sg", name: "Michael", role: "Agency Leader", color: "border-[#EBEBEB] hover:bg-[#F0FFF0]" },
              { email: "maya@agent.aia.com.sg", name: "Maya", role: "FSC / Agent", color: "border-[#EBEBEB] hover:bg-[#F7F7F7]" },
            ].map((account) => (
              <button
                key={account.email}
                type="button"
                onClick={() => quickLogin(account.email)}
                className={`rounded-xl border px-4 py-3 text-left transition-all duration-200 hover:shadow-sm ${account.color}`}
              >
                <span className="block text-sm font-semibold text-[#222222]">
                  {account.name}
                </span>
                <span className="block text-xs text-[#717171]">
                  {account.role}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
