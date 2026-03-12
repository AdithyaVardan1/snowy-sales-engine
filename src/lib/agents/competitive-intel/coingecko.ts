import { TokenData } from "../types";

const BASE_URL = "https://api.coingecko.com/api/v3";

/**
 * Fetch token price, market cap, 24h change, and volume from CoinGecko.
 * Free tier: ~10-30 calls/min, no API key needed.
 */
export async function fetchTokenData(coingeckoId: string): Promise<TokenData> {
  const url = `${BASE_URL}/simple/price?ids=${encodeURIComponent(coingeckoId)}&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    throw new Error(`CoinGecko API error ${res.status}: ${await res.text().catch(() => "")}`);
  }

  const data = await res.json();
  const coin = data[coingeckoId];

  if (!coin) {
    throw new Error(`CoinGecko: no data for ${coingeckoId}`);
  }

  return {
    price: coin.usd ?? 0,
    marketCap: coin.usd_market_cap ?? 0,
    priceChange24hPct: coin.usd_24h_change ?? 0,
    volume24h: coin.usd_24h_vol ?? 0,
  };
}

/**
 * Batch fetch token data for multiple coins in one request.
 * CoinGecko supports comma-separated IDs.
 */
export async function fetchTokenDataBatch(coingeckoIds: string[]): Promise<Record<string, TokenData>> {
  if (coingeckoIds.length === 0) return {};

  const ids = coingeckoIds.join(",");
  const url = `${BASE_URL}/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=usd&include_market_cap=true&include_24hr_vol=true&include_24hr_change=true`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    throw new Error(`CoinGecko batch API error ${res.status}`);
  }

  const data = await res.json();
  const result: Record<string, TokenData> = {};

  for (const id of coingeckoIds) {
    const coin = data[id];
    if (coin) {
      result[id] = {
        price: coin.usd ?? 0,
        marketCap: coin.usd_market_cap ?? 0,
        priceChange24hPct: coin.usd_24h_change ?? 0,
        volume24h: coin.usd_24h_vol ?? 0,
      };
    }
  }

  return result;
}
