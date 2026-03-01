"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAuthStore } from "@/store/auth";
import { ArrowLeft, LogOut, Moon, Sun } from "lucide-react";
import { useUIStore } from "@/store/ui";

export function SettingsView() {
  const router = useRouter();
  const { supabaseUser, telegramUser, reset: resetAuth } = useAuthStore();
  const { theme, setTheme, setCurrentView } = useUIStore();

  const handleLogout = async () => {
    const { signOut } = await import("@/lib/supabase/auth");
    const { disconnectClient } = await import("@/lib/telegram/client");
    await disconnectClient();
    await signOut();
    resetAuth();
    router.replace("/auth");
  };

  return (
    <div className="h-full bg-background overflow-y-auto">
      <div className="mx-auto max-w-lg px-4 py-4">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => setCurrentView("chats")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold">Settings</h1>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Account</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-muted-foreground">Email</Label>
                <p className="text-sm">{supabaseUser?.email}</p>
              </div>
              {telegramUser && (
                <>
                  <Separator />
                  <div>
                    <Label className="text-muted-foreground">Telegram</Label>
                    <p className="text-sm">
                      {telegramUser.firstName} {telegramUser.lastName}
                      {telegramUser.username && (
                        <span className="text-muted-foreground">
                          {" "}@{telegramUser.username}
                        </span>
                      )}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Appearance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {theme === "dark" ? (
                    <Moon className="h-4 w-4" />
                  ) : (
                    <Sun className="h-4 w-4" />
                  )}
                  <span className="text-sm">Theme</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                >
                  {theme === "dark" ? "Dark" : "Light"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Button
            variant="destructive"
            className="w-full"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );
}
