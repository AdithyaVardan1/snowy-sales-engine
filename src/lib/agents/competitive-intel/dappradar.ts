import { getSetting } from "../../config";

export interface DappRadarData {
  dau: number;
  transactions24h: number;
  volume24h: number;
}

/**
 * Fetch DApp usage data from DappRadar API.
 * Requires DAPPRADAR_API_KEY in Settings.
 * Returns null if API key is not configured (Phase 2).
 */
export async function fetchDappRadarData(dappRadarSlug: string): Promise<DappRadarData | null> {
  const apiKey = await getSetting("DAPPRADAR_API_KEY");
  if (!apiKey) {
    // No API key — silently skip (Phase 2)
    return null;
  }

  try {
    const url = `https://apis.dappradar.com/v2/dapps/${encodeURIComponent(dappRadarSlug)}`;
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "X-BLOBR-KEY": apiKey,
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      console.warn(`[CompetitiveIntel] DappRadar error ${res.status} for ${dappRadarSlug}`);
      return null;
    }

    const data = await res.json();
    const metrics = data.results?.[0]?.metrics || {};

    return {
      dau: metrics.uaw ?? 0,
      transactions24h: metrics.transactions ?? 0,
      volume24h: metrics.volume ?? 0,
    };
  } catch (error) {
    console.warn(`[CompetitiveIntel] DappRadar failed for ${dappRadarSlug}:`, error);
    return null;
  }
}
