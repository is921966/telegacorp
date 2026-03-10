"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { signInAnonymously } from "@/lib/supabase/auth";
import { useAuthStore } from "@/store/auth";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { setSupabaseUser } = useAuthStore();

  const handleTelegramLogin = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const data = await signInAnonymously();
      if (data.user) {
        setSupabaseUser({ id: data.user.id, email: null });
        router.push("/telegram-auth");
        return;
      }
      setError("Не удалось создать сессию");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка авторизации");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-8 w-8 text-primary-foreground"
            >
              <path d="m22 2-7 20-4-9-9-4Z" />
              <path d="M22 2 11 13" />
            </svg>
          </div>
          <CardTitle className="text-2xl">Telegram Corp</CardTitle>
          <p className="text-sm text-muted-foreground">
            Corporate Telegram Client
          </p>
          <p className="text-xs text-muted-foreground/60">
            v{process.env.NEXT_PUBLIC_APP_VERSION} build{" "}
            {process.env.NEXT_PUBLIC_BUILD_NUMBER} (
            {process.env.NEXT_PUBLIC_BUILD_DATE})
          </p>
        </CardHeader>
        <CardContent>
          <button
            type="button"
            disabled={isLoading}
            onClick={handleTelegramLogin}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#2AABEE] px-4 py-3 text-base font-medium text-white transition-colors hover:bg-[#229ED9] active:bg-[#1E8DC1] disabled:opacity-50"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
              <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
            </svg>
            {isLoading ? "Подключение..." : "Войти через Telegram"}
          </button>

          {error && (
            <p className="mt-3 text-sm text-destructive text-center">
              {error}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
