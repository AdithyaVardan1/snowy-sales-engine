import { getSetting } from "../../config";

export interface DuneData {
  registrations7d: number;
  registrations30d: number;
  revenue7d: number;
}

/**
 * Fetch on-chain analytics from Dune API.
 * Requires DUNE_API_KEY in Settings.
 * Returns null if API key is not configured (Phase 2).
 */
export async function fetchDuneData(queryId: string): Promise<DuneData | null> {
  const apiKey = await getSetting("DUNE_API_KEY");
  if (!apiKey) {
    // No API key — silently skip (Phase 2)
    return null;
  }

  try {
    const url = `https://api.dune.com/api/v1/query/${queryId}/results`;
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "X-Dune-API-Key": apiKey,
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      console.warn(`[CompetitiveIntel] Dune error ${res.status} for query ${queryId}`);
      return null;
    }

    const data = await res.json();
    const rows = data.result?.rows ?? [];
    const latest = rows[0] ?? {};

    return {
      registrations7d: latest.registrations_7d ?? 0,
      registrations30d: latest.registrations_30d ?? 0,
      revenue7d: latest.revenue_7d ?? 0,
    };
  } catch (error) {
    console.warn(`[CompetitiveIntel] Dune failed for query ${queryId}:`, error);
    return null;
  }
}
