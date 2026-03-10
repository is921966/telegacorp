"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAuthStore } from "@/store/auth";
import { ArrowLeft, LogOut, Moon, Sun, Building2, Plus, Check, Trash2 } from "lucide-react";
import { useUIStore } from "@/store/ui";
import { AddCompanyModal } from "@/components/chat/AddCompanyModal";

export function SettingsView() {
  const router = useRouter();
  const { supabaseUser, telegramUser, workCompanies, toggleWorkCompany, removeWorkCompany, reset: resetAuth } = useAuthStore();
  const { theme, setTheme, setCurrentView } = useUIStore();
  const [showAddCompany, setShowAddCompany] = useState(false);

  const handleLogout = async () => {
    // Navigate first to avoid GramJS TIMEOUT errors showing in UI
    resetAuth();
    router.replace("/auth");
    // Then clean up in background
    try {
      const { disconnectClient } = await import("@/lib/telegram/client");
      await disconnectClient();
    } catch {
      // GramJS update loop throws TIMEOUT on disconnect — ignore
    }
    try {
      const { signOut } = await import("@/lib/supabase/auth");
      await signOut();
    } catch {
      // ignore
    }
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
                <p className="text-sm">
                  {supabaseUser?.email ?? "Авторизация через Telegram"}
                </p>
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

          {/* Work Companies */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-4 w-4" />
                Рабочие компании
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {workCompanies.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Компании не добавлены. Добавьте рабочий email для доступа к корпоративным чатам.
                </p>
              ) : (
                <div className="space-y-1">
                  {workCompanies.map((company) => (
                    <div
                      key={company.email}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50 group"
                    >
                      <button
                        onClick={() => toggleWorkCompany(company.email)}
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                          company.enabled
                            ? "border-teal-500 bg-teal-500 text-white"
                            : "border-muted-foreground/30"
                        }`}
                      >
                        {company.enabled && <Check className="h-3 w-3" />}
                      </button>
                      <span className="flex-1 text-sm truncate">
                        {company.email}
                      </span>
                      <button
                        onClick={() => removeWorkCompany(company.email)}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <Button
                variant="outline"
                size="sm"
                className="w-full mt-2"
                onClick={() => setShowAddCompany(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                Добавить компанию
              </Button>
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

          <p className="text-center text-xs text-muted-foreground/60 pt-2">
            v{process.env.NEXT_PUBLIC_APP_VERSION} build {process.env.NEXT_PUBLIC_BUILD_NUMBER} ({process.env.NEXT_PUBLIC_BUILD_DATE})
          </p>
        </div>
      </div>

      <AddCompanyModal
        open={showAddCompany}
        onOpenChange={setShowAddCompany}
      />
    </div>
  );
}
