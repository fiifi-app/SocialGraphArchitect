import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { LogOut, User, Bell, Shield } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export default function Settings() {
  const { user, signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold mb-3">Settings</h1>
        <p className="text-muted-foreground text-base">
          Manage your account preferences and settings
        </p>
      </div>

      <div className="space-y-6">
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <User className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold">Account</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground">Email</label>
              <p className="text-base" data-testid="text-user-email">{user?.email}</p>
            </div>
            <div>
              <label className="text-sm text-muted-foreground">User ID</label>
              <p className="text-base text-muted-foreground text-xs font-mono" data-testid="text-user-id">
                {user?.id}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <Bell className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold">Notifications</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Notification preferences will be available soon
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-semibold">Privacy & Security</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Privacy settings will be available soon
          </p>
        </Card>

        <Separator />

        <Card className="p-6 border-destructive/50">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold mb-1">Sign Out</h2>
              <p className="text-sm text-muted-foreground">
                Sign out of your account on this device
              </p>
            </div>
            <Button
              variant="destructive"
              onClick={handleLogout}
              data-testid="button-logout"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
