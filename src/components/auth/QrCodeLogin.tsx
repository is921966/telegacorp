"use client";

import { useEffect, useRef, useState } from "react";
import { useIsMobile } from "@/hooks/useIsMobile";

interface QrCodeLoginProps {
  qrUrl: string | null;
  expires: number | null;
  isLoading: boolean;
  isChecking?: boolean;
  onBack: () => void;
  error?: string;
}

export function QrCodeLogin({
  qrUrl,
  expires,
  isLoading,
  isChecking,
  onBack,
  error,
}: QrCodeLoginProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const isMobile = useIsMobile();

  // Render QR code to canvas (desktop only)
  useEffect(() => {
    if (isMobile || !qrUrl || !canvasRef.current) return;

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
  }, [qrUrl, isMobile]);

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
          {isMobile ? (
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
              <path d="m15 12-8.373 8.373a1 1 0 1 1-3-3L12 9" />
              <path d="m18 15 .243-.323A4.45 4.45 0 0 0 19.5 11.5C19.5 9.015 17.485 7 15 7s-4.5 2.015-4.5 4.5c0 .91.27 1.756.733 2.463L11 14.5" />
              <path d="M22 12c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2s10 4.477 10 10" />
            </svg>
          ) : (
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
          )}
        </div>
        <h2 className="text-xl font-semibold">
          {isMobile ? "Вход через Telegram" : "Вход по QR-коду"}
        </h2>
        <p className="text-sm text-muted-foreground mt-2">
          {isChecking && isMobile
            ? "Проверяем подтверждение входа..."
            : isMobile
              ? "Нажмите кнопку ниже — откроется Telegram для подтверждения входа"
              : "Откройте Telegram на телефоне и отсканируйте QR-код"}
        </p>
      </div>

      {/* Mobile: deep link button / Desktop: QR code */}
      <div className="flex justify-center">
        {isLoading && !qrUrl ? (
          <div className="flex h-[280px] w-[280px] items-center justify-center rounded-lg border bg-muted">
            <p className="text-sm text-muted-foreground animate-pulse">
              Подключение...
            </p>
          </div>
        ) : qrUrl ? (
          isMobile ? (
            <div className="w-full space-y-3">
              {isChecking ? (
                <div className="flex w-full items-center justify-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-base font-medium text-primary">
                  <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                    <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" className="opacity-75" />
                  </svg>
                  Проверяем авторизацию...
                </div>
              ) : (
                <a
                  href={qrUrl}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#2AABEE] px-4 py-3 text-base font-medium text-white transition-colors hover:bg-[#229ED9] active:bg-[#1E8DC1]"
                >
                  <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current">
                    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                  </svg>
                  Открыть Telegram
                </a>
              )}
              <p className="text-center text-xs text-muted-foreground">
                {isChecking
                  ? "Подождите, проверяем статус входа..."
                  : "После подтверждения в Telegram вы автоматически войдёте в приложение"}
              </p>
            </div>
          ) : (
            <div className="rounded-lg border bg-white p-2">
              <canvas ref={canvasRef} />
            </div>
          )
        ) : null}
      </div>

      {/* Timer */}
      {timeLeft !== null && timeLeft > 0 && !isChecking && (
        <p className="text-center text-xs text-muted-foreground">
          {isMobile ? "Ссылка" : "QR-код"} действительн{isMobile ? "а" : ""}: {timeLeft} сек.
        </p>
      )}
      {timeLeft !== null && timeLeft <= 0 && !isChecking && (
        <p className="text-center text-xs text-amber-600">
          {isMobile ? "Ссылка истекла" : "QR-код истёк"} — новая генерируется автоматически...
        </p>
      )}

      {/* Instructions */}
      {!isMobile && (
        <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground space-y-1">
          <p>1. Откройте <strong>Telegram</strong> на телефоне</p>
          <p>2. Перейдите в <strong>Настройки → Устройства → Подключить устройство</strong></p>
          <p>3. Наведите камеру на QR-код</p>
        </div>
      )}

      {isMobile && !isChecking && (
        <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground space-y-1">
          <p>1. Нажмите <strong>«Открыть Telegram»</strong></p>
          <p>2. Подтвердите вход в приложении Telegram</p>
          <p>3. Вернитесь сюда — вход произойдёт автоматически</p>
        </div>
      )}

      {error && <p className="text-sm text-destructive text-center">{error}</p>}

      <div className="text-center">
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-primary hover:underline"
        >
          Войти по номеру телефона →
        </button>
      </div>
    </div>
  );
}
