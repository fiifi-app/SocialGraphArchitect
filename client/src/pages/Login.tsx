import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { isSupabaseConfigured, supabaseUrl, supabaseAnonKey } from "@/lib/supabase";
import { AlertCircle, CheckCircle2 } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn, user } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  useEffect(() => {
    if (user) {
      setLocation("/");
    }
  }, [user, setLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
      setLoading(false);
    } else {
      toast({
        title: "Welcome back!",
        description: "You've successfully signed in.",
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-background">
      <Card className="w-full max-w-md p-8">
        {/* Supabase Connection Status - Visible on all devices */}
        <div className="mb-6 p-4 rounded-lg border bg-card">
          <div className="flex items-center gap-2 mb-3">
            {isSupabaseConfigured() ? (
              <>
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                <span className="font-semibold text-sm text-green-700">Supabase Connected</span>
              </>
            ) : (
              <>
                <AlertCircle className="w-5 h-5 text-red-600" />
                <span className="font-semibold text-sm text-red-700">Supabase Not Connected</span>
              </>
            )}
          </div>
          <div className="space-y-1 text-xs text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>Supabase URL:</span>
              <span>{supabaseUrl ? '✓ Set' : '✗ Missing'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Supabase Key:</span>
              <span>{supabaseAnonKey ? '✓ Set' : '✗ Missing'}</span>
            </div>
          </div>
          {!isSupabaseConfigured() && (
            <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
              <p className="font-semibold mb-1">To fix:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Go to Replit Secrets</li>
                <li>Add VITE_SUPABASE_URL</li>
                <li>Add VITE_SUPABASE_ANON_KEY</li>
                <li>Restart the app</li>
              </ol>
            </div>
          )}
        </div>

        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold mb-2">Welcome Back</h1>
          <p className="text-sm text-muted-foreground">
            Sign in to your Social Graph Connector account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              data-testid="input-email"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <a
                href="/forgot-password"
                className="text-xs text-primary hover:underline"
                data-testid="link-forgot-password"
              >
                Forgot password?
              </a>
            </div>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              data-testid="input-password"
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={loading}
            data-testid="button-login"
          >
            {loading ? "Signing in..." : "Sign In"}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">
            Don't have an account?{" "}
            <a
              href="/signup"
              className="text-primary hover:underline"
              data-testid="link-signup"
            >
              Sign up
            </a>
          </p>
        </div>
      </Card>
    </div>
  );
}
