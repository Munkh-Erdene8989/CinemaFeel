"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminApp } from "@/components/admin-app";

export default function AdminPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    fetch("/api/admin/session").then((response) => {
      if (!response.ok) router.replace("/admin/login");
      else setReady(true);
    });
  }, [router]);

  if (!ready) {
    return <main className="grid min-h-screen place-items-center bg-[#0c0c0f] text-sm text-zinc-500">Ачааллаж байна...</main>;
  }
  return <AdminApp />;
}
