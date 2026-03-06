"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface PasswordInputProps {
  hint?: string;
  onSubmit: (password: string) => Promise<void>;
  error?: string;
}

export function PasswordInput({ hint, onSubmit, error }: PasswordInputProps) {
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await onSubmit(password);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-10 w-10 text-primary">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/>
            <path d="m9 12 2 2 4-4"/>
          </svg>
        </div>
        <h2 className="text-xl font-semibold">Двухфакторная аутентификация</h2>
        <p className="text-sm text-muted-foreground mt-1">
          У вашего аккаунта включена 2FA. Введите облачный пароль.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="tg-password">Облачный пароль</Label>
        <Input
          id="tg-password"
          type="password"
          placeholder="Введите пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoFocus
        />
        {hint && (
          <p className="text-xs text-muted-foreground">Подсказка: {hint}</p>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={isLoading || !password}>
        {isLoading ? "Проверка..." : "Подтвердить"}
      </Button>
    </form>
  );
}
