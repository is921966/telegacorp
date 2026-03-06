"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

interface QrCodeLoginProps {
  qrUrl: string | null;
  expires: number | null;
  isLoading: boolean;
  onBack: () => void;
  error?: string;
}

export function QrCodeLogin({
  qrUrl,
  expires,
  isLoading,
  onBack,
  error,
}: QrCodeLoginProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  // Render QR code to canvas
  useEffect(() => {
    if (!qrUrl || !canvasRef.current) return;

    let cancelled = false;

    (async () => {
      const QRCode = (await import("qrcode")).default;
      if (cancelled || !canvasRef.current) return;
      await QRCode.toCanvas(canvasRef.current, qrUrl, {
        width: 280,
        margin: 2,
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [qrUrl]);

  // Countdown timer
  useEffect(() => {
    if (!expires) {
      setTimeLeft(null);
      return;
    }

    const updateTimer = () => {
      const left = expires - Math.floor(Date.now() / 1000);
      setTimeLeft(left > 0 ? left : 0);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [expires]);

  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-10 w-10 text-primary"
          >
            <rect width="5" height="5" x="3" y="3" rx="1" />
            <rect width="5" height="5" x="16" y="3" rx="1" />
            <rect width="5" height="5" x="3" y="16" rx="1" />
            <path d="M21 16h-3a2 2 0 0 0-2 2v3" />
            <path d="M21 21v.01" />
            <path d="M12 7v3a2 2 0 0 1-2 2H7" />
            <path d="M3 12h.01" />
            <path d="M12 3h.01" />
            <path d="M12 16v.01" />
            <path d="M16 12h1" />
            <path d="M21 12v.01" />
            <path d="M12 21v-1" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold">Вход по QR-коду</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Откройте Telegram на телефоне и отсканируйте QR-код
        </p>
      </div>

      {/* QR Code */}
      <div className="flex justify-center">
        {isLoading && !qrUrl ? (
          <div className="flex h-[280px] w-[280px] items-center justify-center rounded-lg border bg-muted">
            <p className="text-sm text-muted-foreground animate-pulse">
              Подключение...
            </p>
          </div>
        ) : qrUrl ? (
          <div className="rounded-lg border bg-white p-2">
            <canvas ref={canvasRef} />
          </div>
        ) : null}
      </div>

      {/* Timer */}
      {timeLeft !== null && timeLeft > 0 && (
        <p className="text-center text-xs text-muted-foreground">
          QR-код действителен: {timeLeft} сек.
        </p>
      )}
      {timeLeft !== null && timeLeft <= 0 && (
        <p className="text-center text-xs text-amber-600">
          QR-код истёк — новый генерируется автоматически...
        </p>
      )}

      {/* Instructions */}
      <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground space-y-1">
        <p>1. Откройте <strong>Telegram</strong> на телефоне</p>
        <p>2. Перейдите в <strong>Настройки → Устройства → Подключить устройство</strong></p>
        <p>3. Наведите камеру на QR-код</p>
      </div>

      {error && <p className="text-sm text-destructive text-center">{error}</p>}

      <Button
        type="button"
        variant="secondary"
        className="w-full"
        onClick={onBack}
      >
        ← Войти по номеру телефона
      </Button>
    </div>
  );
}
