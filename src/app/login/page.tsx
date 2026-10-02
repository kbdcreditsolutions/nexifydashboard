"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const DEMO_ACCOUNTS = [
  { role: "Owner", email: "owner@nexifyinfo.com" },
  { role: "Finance", email: "finance@nexifyinfo.com" },
  { role: "Operations", email: "ops@nexifyinfo.com" },
  { role: "Manager", email: "manager@nexifyinfo.com" },
  { role: "Employee", email: "employee@nexifyinfo.com" },
];

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("owner@nexifyinfo.com");
  const [password, setPassword] = useState("Nexify2026!");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn("credentials", { email, password, redirect: false });
    setLoading(false);
    if (res?.error) {
      setError("Invalid email or password.");
      return;
    }
    router.push(params.get("callbackUrl") || "/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/logo-full.png" alt="Nexify InfoSystems" className="h-14 w-auto" />
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Operations &amp; Finance</h1>
            <p className="text-sm text-muted-foreground">Sign in to your internal dashboard</p>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-0" />
          <CardContent className="pt-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
              {error && <p className="text-sm text-negative">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Sign in
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="rounded-lg border border-border bg-card p-3.5">
          <p className="text-xs font-medium text-muted-foreground mb-2">Demo accounts (password: Nexify2026!)</p>
          <div className="grid grid-cols-1 gap-1">
            {DEMO_ACCOUNTS.map((a) => (
              <button
                key={a.email}
                type="button"
                onClick={() => setEmail(a.email)}
                className="flex items-center justify-between rounded px-2 py-1 text-xs hover:bg-accent text-left"
              >
                <span className="text-foreground">{a.role}</span>
                <span className="text-muted-foreground">{a.email}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
