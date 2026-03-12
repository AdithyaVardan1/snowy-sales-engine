import { TVLData, FeesData } from "../types";

const BASE_URL = "https://api.llama.fi";

/**
 * Fetch TVL data for a protocol from DefiLlama.
 * Free API, no key needed.
 */
export async function fetchTVL(defiLlamaSlug: string): Promise<TVLData> {
  const url = `${BASE_URL}/protocol/${encodeURIComponent(defiLlamaSlug)}`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    throw new Error(`DefiLlama TVL error ${res.status} for ${defiLlamaSlug}`);
  }

  const data = await res.json();

  // Current TVL is the last entry in the tvl array
  const tvlHistory = data.tvl as Array<{ date: number; totalLiquidityUSD: number }> | undefined;
  const currentTvl = tvlHistory?.length ? tvlHistory[tvlHistory.length - 1].totalLiquidityUSD : 0;
  const prevTvl = tvlHistory && tvlHistory.length > 1 ? tvlHistory[tvlHistory.length - 2].totalLiquidityUSD : 0;
  const tvlChange24hPct = prevTvl > 0 ? ((currentTvl - prevTvl) / prevTvl) * 100 : 0;

  return { tvl: currentTvl, tvlChange24hPct };
}

/**
 * Fetch fee/revenue data for a protocol from DefiLlama.
 */
export async function fetchFees(defiLlamaSlug: string): Promise<FeesData> {
  const url = `${BASE_URL}/summary/fees/${encodeURIComponent(defiLlamaSlug)}`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    // Fee data is not available for all protocols
    if (res.status === 404) {
      return { fees24h: 0, revenue24h: 0 };
    }
    throw new Error(`DefiLlama fees error ${res.status} for ${defiLlamaSlug}`);
  }

  const data = await res.json();

  return {
    fees24h: data.total24h ?? 0,
    revenue24h: data.totalRevenue24h ?? data.total24h ?? 0,
  };
}
