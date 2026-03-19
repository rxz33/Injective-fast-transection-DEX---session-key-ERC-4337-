import { useEffect, useMemo, useState } from "react";
import { fetchOrderbook, fetchTrades } from "../lib/injective";

export function usePriceFeed(pair: string) {
    const [prices, setPrices] = useState<number[]>([]);
    const [midPrice, setMidPrice] = useState(0);

    useEffect(() => {
        let mounted = true;

        async function tick() {
            try {
                const [book, tradeResp] = await Promise.all([
                    fetchOrderbook(pair),
                    fetchTrades(pair)
                ]);
                if (!mounted) return;

                const nextMid = Number(book?.midPrice || 0);
                const tradePrices = Array.isArray(tradeResp?.trades)
                    ? tradeResp.trades
                        .map((t: any) => Number(t?.price || 0))
                        .filter((n: number) => Number.isFinite(n) && n > 0)
                    : [];

                if (nextMid > 0) {
                    setMidPrice(nextMid);
                } else if (tradePrices.length) {
                    setMidPrice(tradePrices[0]);
                }

                if (tradePrices.length >= 8) {
                    setPrices(tradePrices.slice(0, 30).reverse());
                } else {
                    const fallback = nextMid > 0 ? nextMid : 0;
                    setPrices((prev) => [...prev.slice(-29), fallback]);
                }
            } catch {
                if (!mounted) return;
            }
        }

        tick();
        const i = setInterval(tick, 2000);
        return () => {
            mounted = false;
            clearInterval(i);
        };
    }, [pair]);

    const change24h = useMemo(() => {
        if (prices.length < 2) return 0;
        const first = prices[0] || 1;
        const last = prices[prices.length - 1] || 1;
        return ((last - first) / first) * 100;
    }, [prices]);

    return { prices, midPrice, change24h };
}
