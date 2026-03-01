"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUIStore } from "@/store/ui";

export default function SearchRedirect() {
  const router = useRouter();
  const { setCurrentView } = useUIStore();

  useEffect(() => {
    setCurrentView("search");
    router.replace("/chat");
  }, [setCurrentView, router]);

  return null;
}
