"use client";
import DexTerminal from "@/components/dex-pages/Terminal";
import Header from "@/components/layout/Header";

export default function TradePage() {
  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-[1200px] px-6 py-8">
        <DexTerminal />
      </main>
    </>
  );
}
