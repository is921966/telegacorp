"use client";

import dynamic from "next/dynamic";

const HomeRedirect = dynamic(
  () => import("@/components/home/HomeRedirect").then((m) => ({ default: m.HomeRedirect })),
  { ssr: false }
);

export default function Page() {
  return <HomeRedirect />;
}
