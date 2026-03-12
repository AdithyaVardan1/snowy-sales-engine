/**
 * Runtime config resolver — reads from AppSetting DB first, falls back to .env.
 * This lets users configure API keys from the platform UI without touching .env files.
 */
import { db } from "./db";

const cache = new Map<string, string>();
let cacheLoaded = false;

async function loadCache() {
    if (cacheLoaded) return;
    const settings = await db.appSetting.findMany();
    for (const s of settings) {
        cache.set(s.key, s.value);
    }
    cacheLoaded = true;
}

/** Invalidate cache (call after saving a new setting) */
export function invalidateSettingsCache() {
    cache.clear();
    cacheLoaded = false;
}

export async function getSetting(key: string): Promise<string | undefined> {
    await loadCache();
    // DB value takes priority over env
    return cache.get(key) ?? process.env[key] ?? undefined;
}

export async function requireSetting(key: string, hint?: string): Promise<string> {
    const value = await getSetting(key);
    if (!value) {
        throw new Error(
            `${key} is not configured. ${hint ?? `Go to Settings in the platform to add it.`}`
        );
    }
    return value;
}
