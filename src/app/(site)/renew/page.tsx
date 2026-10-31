import { Suspense } from "react";
import { RenewView } from "@/components/renew-view";

export const revalidate = 300;

export default function RenewPage() {
  return (
    <Suspense fallback={<section className="min-h-screen bg-[#08080a]" />}>
      <RenewView />
    </Suspense>
  );
}
