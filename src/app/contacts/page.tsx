"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUIStore } from "@/store/ui";

export default function ContactsRedirect() {
  const router = useRouter();
  const { setCurrentView } = useUIStore();

  useEffect(() => {
    setCurrentView("contacts");
    router.replace("/chat");
  }, [setCurrentView, router]);

  return null;
}
