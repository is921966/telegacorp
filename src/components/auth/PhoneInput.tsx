"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface PhoneInputProps {
  onSubmit: (phone: string) => Promise<void> | void;
  error?: string;
}

export function PhoneInput({ onSubmit, error }: PhoneInputProps) {
  const [phone, setPhone] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  /** Normalize phone: keep only digits and leading '+' */
  const normalizePhone = (raw: string): string => {
    const trimmed = raw.trim();
    const hasPlus = trimmed.startsWith("+");
    const digits = trimmed.replace(/\D/g, "");
    return hasPlus ? `+${digits}` : `+${digits}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || isLoading) return;

    const normalized = normalizePhone(phone);
    if (normalized.length < 8) {
      // Too short — likely missing country code or digits
      return;
    }

    setIsLoading(true);
    try {
      await onSubmit(normalized);
      // onSubmit resolves when code is sent → step changes to "code"
      // PhoneInput will unmount, but just in case:
    } catch {
      // Error is displayed via error prop from parent
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-10 w-10 text-primary">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
          </svg>
        </div>
        <h2 className="text-xl font-semibold">Подключение Telegram</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Введите номер телефона для входа в Telegram
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Номер телефона</Label>
        <Input id="phone" type="tel" placeholder="+7 999 123 4567" value={phone} onChange={(e) => setPhone(e.target.value)} required autoFocus />
        <p className="text-xs text-muted-foreground">
          Укажите код страны (напр. +7 для России, +1 для США)
        </p>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={isLoading || !phone}>
        {isLoading ? "Отправка кода..." : "Далее"}
      </Button>
    </form>
  );
}
