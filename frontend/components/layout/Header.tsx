"use client";
import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";
import { cn } from "@/lib/utils";

interface HeaderProps {
  onWalletConnect?: (address: string) => void;
  walletAddress?: string;
}

export default function Header({ onWalletConnect, walletAddress }: HeaderProps) {
  const pathname = usePathname();
  const [connecting, setConnecting] = useState(false);

  const navLinks = [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Setup", href: "/setup" },
    { label: "Trade", href: "/trade" },
    { label: "Portfolio", href: "/portfolio" },
  ];

  const handleConnect = async () => {
    setConnecting(true);
    // Simulate wallet connection (UI-only)
    await new Promise((r) => setTimeout(r, 800));
    const mockAddress = "0xAf3a9c1B2d4E5F6789abcdef0123456789f1e";
    setConnecting(false);
    onWalletConnect?.(mockAddress);
  };

  const truncate = (addr: string) =>
    `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  return (
    <header
      className={cn(
        "anim-header sticky top-0 z-[100]",
        "flex min-h-[76px] w-full items-center justify-between gap-4",
        "border-b border-[var(--header-border)] bg-[var(--header-bg)]",
        "px-4 py-3 md:px-6",
        "backdrop-blur-xl",
        "shadow-[0_10px_30px_rgba(15,23,42,0.06)]"
      )}
    >
      {/* LOGO */}
      {/* Keep logo sizing controlled by max-height to prevent layout shifts */}
      <Link href="/" className="flex items-center gap-2" style={{ textDecoration: "none" }}>
        <Image
          src="/instainject-logo.png"
          alt="InstaInject"
          width={675}
          height={361}
          priority
          unoptimized
          quality={100}
          sizes="(max-width: 640px) 64px, 80px"
          style={{ display: "block", maxHeight: 36, width: "auto", height: "auto", objectFit: "contain" }}
        />
        <span className="hidden sm:inline text-base font-bold text-foreground">InstaInject</span>
      </Link>

      {/* NAV */}
      <nav className="flex flex-1 flex-wrap items-center justify-center gap-1.5 px-2" aria-label="Primary">
        {navLinks.map(({ label, href }) => {
          const baseHref = href.split("#")[0];
          const active = pathname === baseHref || (baseHref === "/dashboard" && href.includes("#") && pathname === "/dashboard");
          return (
            <Link
              key={label}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "rounded-full border px-3.5 py-2 text-[13px] font-medium",
                "transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--accent-blue)_30%,transparent)]",
                active
                  ? "border-[var(--card-border)] bg-[var(--surface-strong)] text-[var(--text-primary)] shadow-[0_10px_24px_rgba(37,99,235,0.08)]"
                  : "border-transparent bg-transparent text-[var(--text-muted)] hover:bg-[var(--surface-tint)] hover:text-[var(--text-primary)]"
              )}
            >
              {label}
            </Link>
          );
        })}
      </nav>

      {/* RIGHT SIDE */}
      <div className="flex flex-wrap items-center justify-end gap-3">
        <ThemeToggle />
        {/* Network badge */}
        <div className="network-badge" id="network-badge" style={{ fontSize: "11px" }}>
          <span className="dot" />
          Injective inEVM
        </div>

      </div>
    </header>
  );
}
