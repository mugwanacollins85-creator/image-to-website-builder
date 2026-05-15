import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign In · SwiftLink" }] }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { full_name: fullName, phone },
          },
        });
        if (error) throw error;
        nav({ to: "/dashboard" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        nav({ to: "/dashboard" });
      }
    } catch (e: any) {
      setErr(e.message ?? "Authentication failed");
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-accent/5 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-card rounded-2xl shadow-xl p-8 border">
        <Link to="/" className="flex items-center gap-2 mb-6">
          <img src={logo} alt="SwiftLink" className="h-10 w-10" />
          <span className="font-bold text-xl">SwiftLink</span>
        </Link>
        <h1 className="text-2xl font-bold mb-1">{mode === "login" ? "Welcome back" : "Create your account"}</h1>
        <p className="text-sm text-muted-foreground mb-6">
          {mode === "login" ? "Sign in to book and track deliveries." : "Start sending parcels in seconds."}
        </p>
        <form onSubmit={submit} className="space-y-3">
          {mode === "signup" && (
            <>
              <input className="w-full h-11 px-3 rounded-md border bg-background" placeholder="Full name"
                value={fullName} onChange={(e) => setFullName(e.target.value)} required />
              <input className="w-full h-11 px-3 rounded-md border bg-background" placeholder="+254 7XX XXX XXX"
                value={phone} onChange={(e) => setPhone(e.target.value)} required />
            </>
          )}
          <input type="email" className="w-full h-11 px-3 rounded-md border bg-background" placeholder="Email"
            value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input type="password" className="w-full h-11 px-3 rounded-md border bg-background" placeholder="Password (min 6 chars)"
            value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          {err && <p className="text-sm text-destructive">{err}</p>}
          <button disabled={loading} className="w-full h-11 rounded-md bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50">
            {loading ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>
        <p className="text-sm text-center mt-6 text-muted-foreground">
          {mode === "login" ? "New to SwiftLink?" : "Already have an account?"}{" "}
          <button onClick={() => setMode(mode === "login" ? "signup" : "login")} className="text-primary font-medium hover:underline">
            {mode === "login" ? "Create account" : "Sign in"}
          </button>
        </p>
      </div>
    </div>
  );
}
