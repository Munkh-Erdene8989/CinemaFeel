import { Suspense } from "react";
import { RenewView } from "@/components/renew-view";

export default async function RenewPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const params = await searchParams;
  const code = String(params.code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 20);
  return (
    <Suspense fallback={<section className="min-h-screen bg-[#08080a]" />}>
      <RenewView code={code} />
    </Suspense>
  );
}
