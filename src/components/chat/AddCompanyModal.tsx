"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/store/auth";

interface AddCompanyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded?: () => void;
}

export function AddCompanyModal({
  open,
  onOpenChange,
  onAdded,
}: AddCompanyModalProps) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const addWorkCompany = useAuthStore((s) => s.addWorkCompany);
  const workCompanies = useAuthStore((s) => s.workCompanies);

  const handleSave = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) {
      setError("Введите корректный email");
      return;
    }
    if (workCompanies.some((c) => c.email === trimmed)) {
      setError("Эта компания уже добавлена");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await addWorkCompany(trimmed);
      setEmail("");
      onOpenChange(false);
      onAdded?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка сохранения");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Добавить компанию</DialogTitle>
          <DialogDescription>
            Укажите рабочий email для доступа к корпоративным чатам
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Input
            type="email"
            placeholder="work@company.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
            }}
            autoFocus
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Отмена
          </Button>
          <Button onClick={handleSave} disabled={saving || !email.trim()}>
            {saving ? "Сохранение..." : "Сохранить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
