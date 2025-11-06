import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { CheckCircle2 } from "lucide-react";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showInvalidState, setShowInvalidState] = useState(false);
  const { updatePassword, session, loading: authLoading, isPasswordRecovery } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  // Add small grace period to allow PASSWORD_RECOVERY event to fire
  useEffect(() => {
    if (!authLoading && !session && !isPasswordRecovery) {
      // Wait 500ms before showing invalid state to give PASSWORD_RECOVERY event time to fire
      const timer = setTimeout(() => {
        setShowInvalidState(true);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setShowInvalidState(false);
    }
  }, [authLoading, session, isPasswordRecovery]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({
        title: "Passwords don't match",
        description: "Please make sure both passwords are the same.",
        variant: "destructive",
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "Password too short",
        description: "Password must be at least 6 characters long.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    const { error } = await updatePassword(password);

    if (error) {
      toast({
        title: "Failed to reset password",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setSuccess(true);
      toast({
        title: "Password updated!",
        description: "Your password has been successfully changed.",
      });
      setTimeout(() => setLocation("/"), 2000);
    }

    setLoading(false);
  };

  // Show loading while auth context initializes
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-background">
        <Card className="w-full max-w-md p-8">
          <div className="text-center">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </Card>
      </div>
    );
  }

  // Show error state if link is invalid (with grace period for PASSWORD_RECOVERY event)
  if (showInvalidState) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-background">
        <Card className="w-full max-w-md p-8">
          <div className="text-center">
            <h1 className="text-2xl font-semibold mb-2">Invalid Reset Link</h1>
            <p className="text-sm text-muted-foreground mb-6">
              This password reset link is invalid or has expired. Please request a new one.
            </p>
            <Button
              variant="default"
              className="w-full"
              onClick={() => setLocation("/forgot-password")}
              data-testid="button-request-new-link"
            >
              Request New Reset Link
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-background">
        <Card className="w-full max-w-md p-8">
          <div className="text-center">
            <div className="mb-4 flex justify-center">
              <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-green-500" />
              </div>
            </div>
            <h1 className="text-2xl font-semibold mb-2">Password Changed!</h1>
            <p className="text-sm text-muted-foreground mb-6">
              Your password has been successfully updated. Redirecting you to the app...
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-background">
      <Card className="w-full max-w-md p-8">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold mb-2">Reset Your Password</h1>
          <p className="text-sm text-muted-foreground">
            Enter your new password below
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="password">New Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              data-testid="input-new-password"
            />
            <p className="text-xs text-muted-foreground">
              Must be at least 6 characters
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              data-testid="input-confirm-password"
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={loading}
            data-testid="button-reset-password"
          >
            {loading ? "Updating..." : "Reset Password"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
