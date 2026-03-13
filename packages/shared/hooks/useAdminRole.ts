"use client";

import { useState, useEffect } from "react";
import { supabase } from "../supabase/client";
import type { AdminRole } from "../types/admin";

export function useAdminRole(telegramId?: string) {
  const [role, setRole] = useState<AdminRole | null>(null);

  useEffect(() => {
    if (!telegramId) return;

    supabase
      .from("admin_roles")
      .select("role")
      .eq("telegram_id", telegramId)
      .single()
      .then(({ data }) => {
        if (data?.role) setRole(data.role as AdminRole);
      });
  }, [telegramId]);

  return { role, isAdmin: role !== null };
}
