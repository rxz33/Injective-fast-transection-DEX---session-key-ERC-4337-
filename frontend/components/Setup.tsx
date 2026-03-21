"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ethers } from "ethers";
import { useRouter } from "next/navigation";
import {
    PAYMASTER_ADDRESS,
    VAULT_ADDRESS,
    paymasterAbi,
    vaultAbi
} from "@/lib/contracts";
import { useSessionKey } from "@/hooks/useSessionKey";

type DurationOption = 3600 | 86400;
type MaxOption = 100 | 500;
type WalletOption = {
    id: string;
    name: string;
    provider: any;
};

const PAIRS = ["INJ/USDT", "ETH/USDT"];
const REQUIRED_CHAIN_ID = 1439;
const INJECTIVE_CHAIN_HEX = "0x59F";

function inferWalletName(provider: any): string {
    if (!provider) {
        return "Injected Wallet";
    }
    if (provider.isRabby) {
        return "Rabby";
    }
    if (provider.isBraveWallet) {
        return "Brave Wallet";
    }
    if (provider.isCoinbaseWallet) {
        return "Coinbase Wallet";
    }
    if (provider.isMetaMask) {
        return "MetaMask";
    }
    return "Injected Wallet";
}

function discoverWallets(): WalletOption[] {
    const win = window as any;
    const candidates: any[] = [];

    if (Array.isArray(win.ethereum?.providers)) {
        candidates.push(...win.ethereum.providers);
    }
    if (win.ethereum) {
        candidates.push(win.ethereum);
    }
    if (win.rabby?.ethereum) {
        candidates.push(win.rabby.ethereum);
    }

    const seen = new Set<any>();
    const unique = candidates.filter((provider) => {
        if (!provider || seen.has(provider)) {
            return false;
        }
        seen.add(provider);
        return true;
    });

    return unique.map((provider, idx) => {
        const name = inferWalletName(provider);
        return {
            id: `${name.toLowerCase().replace(/\s+/g, "-")}-${idx}`,
            name,
            provider
        };
    });
}

export default function Setup() {
    const router = useRouter();
    const { saveSession, remainingText, session } = useSessionKey();

    const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
    const [walletAddress, setWalletAddress] = useState("");
    const [step, setStep] = useState(1);
    const [duration, setDuration] = useState<DurationOption>(86400);
    const [maxTrade, setMaxTrade] = useState<MaxOption>(500);
    const [pairs, setPairs] = useState<string[]>(["INJ/USDT"]);
    const [depositAmount, setDepositAmount] = useState("0.1");
    const [sessionAddress, setSessionAddress] = useState("");
    const [stakeInj, setStakeInj] = useState("0.02");
    const [sponsorInj, setSponsorInj] = useState("0.10");
    const [fundingBusy, setFundingBusy] = useState(false);
    const [depositBusy, setDepositBusy] = useState(false);
    const [walletInjBalance, setWalletInjBalance] = useState("-");
    const [vaultInjBalance, setVaultInjBalance] = useState("-");
    const [balanceLoading, setBalanceLoading] = useState(false);
    const [walletOptions, setWalletOptions] = useState<WalletOption[]>([]);
    const [showWalletPicker, setShowWalletPicker] = useState(false);
    const [selectedWalletName, setSelectedWalletName] = useState("");

    const hasActiveSession = Boolean(session?.address && session.expiry > Date.now());

    const networkText = useMemo(() => (provider ? "inEVM Testnet" : "not connected"), [provider]);

    const refreshBalances = useCallback(
        async (nextProvider?: ethers.BrowserProvider, nextAddress?: string) => {
            const p = nextProvider || provider;
            const address = nextAddress || walletAddress;
            if (!p || !address) {
                return;
            }

            setBalanceLoading(true);
            try {
                const [walletBal, vaultBal] = await Promise.all([
                    p.getBalance(address),
                    new ethers.Contract(VAULT_ADDRESS, vaultAbi, p).getBalance(address, ethers.ZeroAddress)
                ]);
                setWalletInjBalance(Number(ethers.formatEther(walletBal)).toFixed(4));
                setVaultInjBalance(Number(ethers.formatEther(vaultBal)).toFixed(4));
            } catch (err) {
                console.warn("Failed to refresh balances", err);
                setWalletInjBalance("-");
                setVaultInjBalance("-");
            } finally {
                setBalanceLoading(false);
            }
        },
        [provider, walletAddress]
    );

    useEffect(() => {
        setWalletOptions(discoverWallets());
    }, []);

    async function getConnectedProvider(): Promise<ethers.BrowserProvider> {
        const eth = (window as any).ethereum;
        if (!eth) {
            throw new Error("No wallet provider found");
        }
        return new ethers.BrowserProvider(eth);
    }

    async function autoAdvanceAfterConnect(nextProvider: ethers.BrowserProvider, address: string) {
        let nextStep = 2;
        try {
            const vaultBal = await new ethers.Contract(VAULT_ADDRESS, vaultAbi, nextProvider).getBalance(
                address,
                ethers.ZeroAddress
            );
            if (vaultBal > 0n) {
                nextStep = 3;
            }
        } catch {
            nextStep = 2;
        }

        if (hasActiveSession && session?.address) {
            setSessionAddress(session.address);
            setStep(4);
            return;
        }

        setStep(nextStep);
    }

    async function connectWallet(selectedProvider?: any, selectedName?: string) {
        const eth = selectedProvider || (window as any).ethereum;
        if (!eth) {
            alert("No wallet extension found. Install MetaMask, Rabby, Brave Wallet, or Coinbase Wallet.");
            return;
        }

        try {
            let next = new ethers.BrowserProvider(eth);
            await next.send("eth_requestAccounts", []);

            // ✅ Check correct network
            const network = await next.getNetwork();
            if (Number(network.chainId) !== REQUIRED_CHAIN_ID) {
                // Try to switch automatically
                try {
                    await eth.request({
                        method: "wallet_switchEthereumChain",
                        params: [{ chainId: INJECTIVE_CHAIN_HEX }], // 1439 in hex
                    });
                } catch (switchErr: any) {
                    // Chain not added yet — add it
                    if (switchErr.code === 4902) {
                        await eth.request({
                            method: "wallet_addEthereumChain",
                            params: [{
                                chainId: INJECTIVE_CHAIN_HEX,
                                chainName: "Injective EVM Testnet",
                                nativeCurrency: {
                                    name: "INJ",
                                    symbol: "INJ",
                                    decimals: 18
                                },
                                rpcUrls: ["https://k8s.testnet.json-rpc.injective.network"],
                                blockExplorerUrls: ["https://testnet.blockscout.injective.network"]
                            }]
                        });
                    }
                }

                // Recreate provider after a network switch to avoid stale-network errors.
                next = new ethers.BrowserProvider(eth);
            }

            const signer = await next.getSigner();
            const address = await signer.getAddress();
            setProvider(next);
            setWalletAddress(address);
            setSelectedWalletName(selectedName || inferWalletName(eth));
            setShowWalletPicker(false);
            await refreshBalances(next, address);
            await autoAdvanceAfterConnect(next, address);

        } catch (err: any) {
            console.error("Connect failed:", err);
            alert(`Connection failed: ${err.message}`);
        }
    }

    function onConnectClick() {
        if (walletAddress) {
            setProvider(null);
            setWalletAddress("");
            setSelectedWalletName("");
            setShowWalletPicker(false);
            setWalletInjBalance("-");
            setVaultInjBalance("-");
            setStep(1);
            return;
        }

        const currentWallets = discoverWallets();
        setWalletOptions(currentWallets);

        if (currentWallets.length === 0) {
            alert("No supported wallet detected. Install MetaMask, Rabby, Brave Wallet, or Coinbase Wallet.");
            return;
        }
        if (currentWallets.length === 1) {
            connectWallet(currentWallets[0].provider, currentWallets[0].name);
            return;
        }
        setShowWalletPicker(true);
    }

    // ✅ FIXED: Use native INJ deposit instead of USDT ERC-20
    async function depositUSDT() {
        setDepositBusy(true);
        try {
            const activeProvider = await getConnectedProvider();
            const signer = await activeProvider.getSigner();

            // Verify correct network
            const network = await activeProvider.getNetwork();
            if (Number(network.chainId) !== REQUIRED_CHAIN_ID) {
                alert(`Wrong network!\n\nPlease switch MetaMask to:\nNetwork: Injective EVM Testnet\nChain ID: 1439\nRPC: https://k8s.testnet.json-rpc.injective.network`);
                return;
            }

            if (!VAULT_ADDRESS) {
                alert("VITE_VAULT_CONTRACT not set in frontend/.env");
                return;
            }

            const amount = depositAmount || "0.1";
            console.log(`Depositing ${amount} INJ to vault: ${VAULT_ADDRESS}`);

            // Send native INJ directly to vault
            const tx = await signer.sendTransaction({
                to: VAULT_ADDRESS,
                value: ethers.parseEther(amount),
                gasLimit: 100000,
            });

            console.log("Deposit tx sent:", tx.hash);
            await tx.wait();
            console.log("Deposit confirmed:", tx.hash);
            setStep(3);
            await refreshBalances(activeProvider);

        } catch (err: any) {
            console.error("Deposit failed:", err);
            alert(`Deposit failed: ${err.message}`);
        } finally {
            setDepositBusy(false);
        }
    }

    useEffect(() => {
        if (!provider || !walletAddress) {
            return;
        }

        const id = setInterval(() => {
            refreshBalances().catch(() => {
                // no-op: UI keeps previous values if polling fails briefly
            });
        }, 6000);

        return () => clearInterval(id);
    }, [provider, walletAddress, refreshBalances]);

    async function configureSessionKey() {
        try {
            const activeProvider = await getConnectedProvider();
            const signer = await activeProvider.getSigner();
            const owner = await signer.getAddress();

            const network = await activeProvider.getNetwork();
            if (Number(network.chainId) !== 1439) {
                alert("Switch to Injective EVM Testnet (1439)");
                return;
            }

            console.log("Generating session key for:", owner);

            const ephemeral = ethers.Wallet.createRandom();
            const expiry = Date.now() + duration * 1000;

            saveSession({
                privateKey: ephemeral.privateKey,
                address: ephemeral.address,
                expiry,
                maxTradeSize: maxTrade,
                allowedPairs: pairs
            });

            setSessionAddress(ephemeral.address);
            setStep(4);

            console.log("✅ Session key ready:", ephemeral.address);
            console.log("Expires:", new Date(expiry).toLocaleString());

        } catch (err: any) {
            console.error("Session key failed:", err);
            alert(`Session key setup failed: ${err.message}`);
        }
    }

    async function addPaymasterStake() {
        if (!PAYMASTER_ADDRESS) {
            alert("Set VITE_PAYMASTER_CONTRACT in frontend env.");
            return;
        }
        setFundingBusy(true);
        try {
            const activeProvider = await getConnectedProvider();
            const signer = await activeProvider.getSigner();
            const paymaster = new ethers.Contract(PAYMASTER_ADDRESS, paymasterAbi, signer);
            const tx = await paymaster.addStake(86400, {
                value: ethers.parseEther(stakeInj || "0")
            });
            await tx.wait();
            alert("Stake added to paymaster.");
        } catch (err: any) {
            alert(`Stake failed: ${err.message}`);
        } finally {
            setFundingBusy(false);
        }
    }

    async function depositPaymasterGas() {
        if (!PAYMASTER_ADDRESS) {
            alert("Set VITE_PAYMASTER_CONTRACT in frontend env.");
            return;
        }
        setFundingBusy(true);
        try {
            const activeProvider = await getConnectedProvider();
            const signer = await activeProvider.getSigner();
            const paymaster = new ethers.Contract(PAYMASTER_ADDRESS, paymasterAbi, signer);
            const tx = await paymaster.depositToEntryPoint({
                value: ethers.parseEther(sponsorInj || "0")
            });
            await tx.wait();
            alert("Paymaster deposit funded.");
        } catch (err: any) {
            alert(`Deposit failed: ${err.message}`);
        } finally {
            setFundingBusy(false);
        }
    }

    function togglePair(pair: string) {
        setPairs((prev) =>
            prev.includes(pair) ? prev.filter((x) => x !== pair) : [...prev, pair]
        );
    }

    return (
        <div className="space-y-4">
            <section className="panel p-6 animate-rise">
                <h2 className="text-2xl font-bold">Session Setup</h2>
                <p className="mt-2 text-sm text-slate-300">
                    One-time deposit and key setup. Then trade without MetaMask popups.
                </p>
            </section>

            <section className="grid gap-4 lg:grid-cols-2">
                {/* STEP 1 */}
                <div className="panel p-5">
                    <div className="mb-4 text-sm uppercase tracking-widest text-slate-400">Step 1</div>
                    <button
                        onClick={onConnectClick}
                        className="rounded-lg bg-accent px-4 py-2 font-semibold text-black"
                    >
                        {walletAddress ? "Disconnect Wallet" : "Connect Wallet"}
                    </button>
                    {showWalletPicker && walletOptions.length > 1 && (
                        <div className="mt-3 space-y-2">
                            <p className="text-xs text-slate-300">Choose wallet:</p>
                            <div className="flex flex-wrap gap-2">
                                {walletOptions.map((wallet) => (
                                    <button
                                        key={wallet.id}
                                        onClick={() => connectWallet(wallet.provider, wallet.name)}
                                        className="rounded-lg border border-white/20 bg-black/20 px-3 py-1.5 text-sm"
                                    >
                                        {wallet.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    <p className="mt-3 text-sm">
                        Wallet: <span className="font-mono">{walletAddress || "-"}</span>
                    </p>
                    <p className="text-sm">
                        Network: <span className="font-mono">{networkText}</span>
                    </p>
                    {selectedWalletName && walletAddress && (
                        <p className="mt-2 text-xs text-slate-400">
                            Connected with: <span className="font-mono">{selectedWalletName}</span>
                        </p>
                    )}
                    <p className="mt-2 text-xs text-slate-400">
                        After connect, setup auto-continues to the next unlocked step.
                    </p>
                    {/* ✅ Show warning if wrong network */}
                    {provider && (
                        <p className="mt-2 text-xs text-amber-400">
                            Make sure MetaMask shows "Injective EVM Testnet" (Chain 1439)
                        </p>
                    )}
                </div>

                {/* STEP 2 */}
                <div className="panel p-5">
                    <div className="mb-4 text-sm uppercase tracking-widest text-slate-400">Step 2</div>
                    {/* ✅ Changed label from USDT to INJ */}
                    <label className="block text-sm text-slate-300">
                        Deposit INJ (native token)
                    </label>
                    <input
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                        className="mt-2 w-full rounded-lg border border-white/20 bg-black/20 px-3 py-2 font-mono"
                        placeholder="0.1"
                    />
                    <p className="mt-1 text-xs text-slate-400">
                        {provider && walletAddress
                            ? `Wallet INJ: ${walletInjBalance}${balanceLoading ? " (updating...)" : ""}`
                            : "Connect wallet to load real balance"}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                        {provider && walletAddress
                            ? `Vault INJ: ${vaultInjBalance}`
                            : "Vault INJ: -"}
                    </p>
                    <button
                        onClick={depositUSDT}
                        disabled={depositBusy || step < 2}
                        className="mt-3 rounded-lg border border-accent/40 bg-accent/20 px-4 py-2 text-accent disabled:opacity-40"
                    >
                        {depositBusy ? "Depositing..." : "Deposit (only popup step)"}
                    </button>
                </div>
            </section>

            {/* OWNER ACTION - Fund Paymaster */}
            <section className="panel p-5">
                <div className="mb-4 text-sm uppercase tracking-widest text-slate-400">Owner Action</div>
                <h3 className="text-lg font-semibold">Fund Paymaster</h3>
                <p className="mt-1 text-sm text-slate-300">
                    This requires the paymaster owner wallet. It uses MetaMask popups.
                </p>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div>
                        <label className="block text-sm text-slate-300">Stake Amount (INJ)</label>
                        <input
                            value={stakeInj}
                            onChange={(e) => setStakeInj(e.target.value)}
                            className="mt-2 w-full rounded-lg border border-white/20 bg-black/20 px-3 py-2 font-mono"
                        />
                        <button
                            onClick={addPaymasterStake}
                            disabled={fundingBusy}
                            className="mt-3 rounded-lg border border-amber-400/40 bg-amber-400/20 px-4 py-2 text-amber-400 disabled:opacity-40"
                        >
                            Add Stake (1 day)
                        </button>
                    </div>
                    <div>
                        <label className="block text-sm text-slate-300">Gas Deposit (INJ)</label>
                        <input
                            value={sponsorInj}
                            onChange={(e) => setSponsorInj(e.target.value)}
                            className="mt-2 w-full rounded-lg border border-white/20 bg-black/20 px-3 py-2 font-mono"
                        />
                        <button
                            onClick={depositPaymasterGas}
                            disabled={fundingBusy}
                            className="mt-3 rounded-lg border border-accent/40 bg-accent/20 px-4 py-2 text-accent disabled:opacity-40"
                        >
                            Deposit Sponsor Gas
                        </button>
                    </div>
                </div>
            </section>

            {/* STEP 3 - Session Key Config */}
            <section className="panel p-5">
                <div className="mb-4 text-sm uppercase tracking-widest text-slate-400">Step 3</div>
                <div className="grid gap-4 lg:grid-cols-3">
                    <div>
                        <p className="mb-2 text-sm">Duration</p>
                        <div className="flex gap-2">
                            {[3600, 86400].map((d) => (
                                <button
                                    key={d}
                                    onClick={() => setDuration(d as DurationOption)}
                                    className={`rounded-lg px-3 py-1.5 ${duration === d ? "bg-accent/20 text-accent" : "bg-black/30"}`}
                                >
                                    {d === 3600 ? "1h" : "24h"}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <p className="mb-2 text-sm">Max Trade Size</p>
                        <div className="flex gap-2">
                            {[100, 500].map((m) => (
                                <button
                                    key={m}
                                    onClick={() => setMaxTrade(m as MaxOption)}
                                    className={`rounded-lg px-3 py-1.5 ${maxTrade === m ? "bg-accent/20 text-accent" : "bg-black/30"}`}
                                >
                                    {m} INJ
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <p className="mb-2 text-sm">Allowed Pairs</p>
                        <div className="flex flex-wrap gap-2">
                            {PAIRS.map((pair) => (
                                <label
                                    key={pair}
                                    className="flex items-center gap-2 rounded-lg bg-black/30 px-3 py-1.5"
                                >
                                    <input
                                        type="checkbox"
                                        checked={pairs.includes(pair)}
                                        onChange={() => togglePair(pair)}
                                    />
                                    <span>{pair}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>
                <button
                    onClick={configureSessionKey}
                    disabled={step < 3}
                    className="mt-4 rounded-lg bg-accent px-4 py-2 font-semibold text-black disabled:opacity-40"
                >
                    Generate Session Key
                </button>
                {step < 3 && (
                    <p className="mt-2 text-xs text-slate-400">Complete deposit first to unlock this step</p>
                )}
            </section>

            {/* STEP 4 - Done */}
            <section className="panel p-5">
                <div className="mb-4 text-sm uppercase tracking-widest text-slate-400">Step 4</div>
                <p className="text-lg font-semibold text-accent">Setup complete</p>
                <p className="mt-1 text-sm">
                    Session key: <span className="font-mono text-xs">{sessionAddress || session?.address || "-"}</span>
                </p>
                <p className="mt-1 text-sm">
                    Countdown: <span className="font-mono">{remainingText}</span>
                </p>
                <button
                    onClick={() => router.push("/terminal")}
                    disabled={step < 4}
                    className="mt-4 rounded-lg border border-white/20 px-4 py-2 disabled:opacity-40"
                >
                    Open trading terminal →
                </button>
            </section>

            <p className="text-xs text-slate-400">Current step: {step}/4</p>
        </div>
    );
}