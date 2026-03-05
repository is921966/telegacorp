"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface CodeInputProps {
  phoneNumber: string;
  onSubmit: (code: string) => Promise<void>;
  onBack: () => void;
  error?: string;
}

export function CodeInput({ phoneNumber, onSubmit, onBack, error }: CodeInputProps) {
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await onSubmit(code);
    } finally {
      setIsLoading(false);
    }
  };

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
          Код отправлен на <span className="font-medium text-foreground">{phoneNumber}</span>
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          Проверьте приложение Telegram на другом устройстве или SMS
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
      <Button type="button" variant="ghost" className="w-full" onClick={onBack}>
        Назад
      </Button>
    </form>
  );
}
