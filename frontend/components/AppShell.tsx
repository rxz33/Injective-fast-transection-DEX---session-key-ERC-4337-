"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
    { to: "/", label: "Setup" },
    { to: "/terminal", label: "Trade" },
    { to: "/portfolio", label: "Portfolio" }
];

export default function AppShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    return (
        <div className="min-h-screen">
            <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
                <header className="mb-6 flex flex-wrap items-center justify-between gap-3 panel p-4">
                    <div className="flex items-center gap-3">
                        <div className="h-2.5 w-2.5 rounded-full bg-accent animate-pulseDot" />
                        <h1 className="text-xl font-bold tracking-wide">Phantom DEX · inEVM</h1>
                    </div>
                    <nav className="flex items-center gap-2">
                        {nav.map((item) => {
                            const active = pathname === item.to;
                            return (
                                <Link
                                    key={item.to}
                                    href={item.to}
                                    className={`rounded-lg px-3 py-1.5 text-sm transition ${active ? "bg-accent/20 text-accent border border-accent/40" : "border border-white/10 hover:border-white/30"}`}
                                >
                                    {item.label}
                                </Link>
                            );
                        })}
                    </nav>
                </header>
                {children}
            </div>
        </div>
    );
}
