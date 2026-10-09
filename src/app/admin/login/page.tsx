"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon, Logo } from "@/components/icons";

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    setError("");
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = (await response.json()) as { error?: string };
    setLoading(false);
    if (!response.ok) {
      setError(data.error || "Нэвтрэх нэр эсвэл нууц үг буруу.");
      return;
    }
    router.replace("/admin");
  };

  return (
    <main className="grid min-h-screen place-items-center bg-[#08080a] px-4 text-white">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#151519] p-7 sm:p-9">
        <Logo href="/" />
        <div className="mb-7 mt-8 grid h-12 w-12 place-items-center rounded-2xl bg-[#ff3d56]/15 text-[#ff536a]">
          <Icon name="lock" className="h-6 w-6" />
        </div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#ff536a]">Удирдлага</p>
        <h1 className="mt-2 text-2xl font-black">Админ нэвтрэх</h1>
        <label className="mt-7 block">
          <span className="mb-2 block text-xs font-bold text-zinc-400">НЭВТРЭХ НЭР</span>
          <input value={username} onChange={(e) => setUsername(e.target.value)} className="admin-input" />
        </label>
        <label className="mt-4 block">
          <span className="mb-2 block text-xs font-bold text-zinc-400">НУУЦ ҮГ</span>
          <input value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} type="password" className="admin-input" />
        </label>
        {error && <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</p>}
        <button disabled={loading} onClick={submit} className="mt-6 h-12 w-full rounded-xl bg-white text-sm font-extrabold text-black disabled:opacity-60">
          {loading ? "Шалгаж байна..." : "Нэвтрэх"}
        </button>
      </div>
    </main>
  );
}
