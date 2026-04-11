"use client";

import { useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--aia-warm-gray)]">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-black tracking-tight text-[var(--aia-red)]">
            CRAFT
          </h1>
          <p className="mt-1 text-sm text-[var(--aia-text-muted)]">
            by AIA Singapore
          </p>
        </div>

        {/* Login card */}
        <div className="rounded-xl border border-[var(--aia-warm-gray-dark)] bg-white p-8">
          <h2 className="mb-6 text-center text-base font-semibold text-[var(--aia-text)]">
            Sign in to your account
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label
                htmlFor="email"
                className="text-xs font-semibold uppercase tracking-wide text-[var(--aia-text-muted)]"
              >
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="name@aia.com.sg"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="rounded-lg border-[var(--aia-warm-gray-dark)] focus-visible:ring-[var(--aia-red)]"
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="password"
                className="text-xs font-semibold uppercase tracking-wide text-[var(--aia-text-muted)]"
              >
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="rounded-lg border-[var(--aia-warm-gray-dark)] focus-visible:ring-[var(--aia-red)]"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-[var(--aia-red-light)] px-3 py-2 text-sm text-[var(--aia-red)]">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-lg bg-[var(--aia-red)] text-white hover:bg-[var(--aia-red-hover)] disabled:opacity-50"
            >
              {isLoading ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          {/* Quick login hints for dev */}
          <div className="mt-6 border-t border-[var(--aia-warm-gray-dark)] pt-4">
            <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-[var(--aia-text-muted)]">
              Test accounts
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs text-[var(--aia-text-secondary)]">
              <button
                type="button"
                onClick={() => {
                  setEmail("sarah@aia.com.sg");
                  setPassword("craft2026");
                }}
                className="rounded-md border border-[var(--aia-warm-gray-dark)] px-2 py-1.5 text-left hover:border-[var(--aia-red)] hover:bg-[var(--aia-red-light)]"
              >
                <span className="font-semibold text-[var(--aia-text)]">Sarah</span>
                <br />
                Brand Admin
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmail("david@aia.com.sg");
                  setPassword("craft2026");
                }}
                className="rounded-md border border-[var(--aia-warm-gray-dark)] px-2 py-1.5 text-left hover:border-[var(--aia-green)] hover:bg-[var(--aia-green-light)]"
              >
                <span className="font-semibold text-[var(--aia-text)]">David</span>
                <br />
                District Leader
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmail("michael@aia.com.sg");
                  setPassword("craft2026");
                }}
                className="rounded-md border border-[var(--aia-warm-gray-dark)] px-2 py-1.5 text-left hover:border-[var(--aia-green)] hover:bg-[var(--aia-green-light)]"
              >
                <span className="font-semibold text-[var(--aia-text)]">Michael</span>
                <br />
                Agency Leader
              </button>
              <button
                type="button"
                onClick={() => {
                  setEmail("maya@agent.aia.com.sg");
                  setPassword("craft2026");
                }}
                className="rounded-md border border-[var(--aia-warm-gray-dark)] px-2 py-1.5 text-left hover:border-[var(--aia-purple)] hover:bg-[var(--aia-purple-light)]"
              >
                <span className="font-semibold text-[var(--aia-text)]">Maya</span>
                <br />
                FSC / Agent
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
