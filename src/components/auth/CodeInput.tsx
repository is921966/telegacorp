"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { CodeDeliveryType } from "@/lib/telegram/auth";
import { deliveryTypeLabel } from "@/lib/telegram/auth";

interface CodeInputProps {
  phoneNumber: string;
  deliveryType?: CodeDeliveryType;
  onSubmit: (code: string) => Promise<void>;
  onResend?: () => Promise<void>;
  onBack: () => void;
  error?: string;
}

export function CodeInput({
  phoneNumber,
  deliveryType,
  onSubmit,
  onResend,
  onBack,
  error,
}: CodeInputProps) {
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendDone, setResendDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await onSubmit(code);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (!onResend || isResending) return;
    setIsResending(true);
    try {
      await onResend();
      setResendDone(true);
    } catch {
      // Error displayed via error prop
    } finally {
      setIsResending(false);
    }
  };

  const deliveryHint = deliveryType
    ? `Код отправлен ${deliveryTypeLabel(deliveryType)}`
    : "Проверьте приложение Telegram или SMS";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-10 w-10 text-primary">
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>
        <h2 className="text-xl font-semibold">Введите код</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Номер: <span className="font-medium text-foreground">{phoneNumber}</span>
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          {deliveryHint}
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="code">Код подтверждения</Label>
        <Input
          id="code"
          type="text"
          inputMode="numeric"
          placeholder="12345"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          maxLength={6}
          required
          autoFocus
          className="text-center text-2xl tracking-widest"
        />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={isLoading || code.length < 5}>
        {isLoading ? "Проверка..." : "Подтвердить"}
      </Button>

      {/* Resend via SMS — shown when code was sent to app and user didn't get it */}
      {onResend && !resendDone && (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={handleResend}
          disabled={isResending}
        >
          {isResending ? "Отправка..." : "Не пришёл код? Отправить по SMS"}
        </Button>
      )}
      {resendDone && (
        <p className="text-sm text-center text-green-600">
          Код повторно отправлен — проверьте SMS
        </p>
      )}

      <Button type="button" variant="secondary" className="w-full" onClick={onBack}>
        ← Назад
      </Button>
    </form>
  );
}
