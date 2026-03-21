import type { Metadata } from "next";
import AppShell from "@/components/AppShell";
import "@/styles/globals.css";

export const metadata: Metadata = {
    title: "Phantom DEX · inEVM",
    description: "Gasless session-key trading frontend"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body>
                <AppShell>{children}</AppShell>
            </body>
        </html>
    );
}
