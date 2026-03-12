import { Agent } from "@prisma/client";

export interface AgentRunResult {
  observationsCreated: number;
  reportsCreated: number;
  summary: string;
}

export interface AgentRunner {
  slug: string;
  execute(agent: Agent): Promise<AgentRunResult>;
}

export interface CompetitorDef {
  slug: string;
  name: string;
  twitterHandle?: string;
  tokenSymbol?: string;
  coingeckoId?: string;
  defiLlamaSlug?: string;
  dappRadarSlug?: string;
  duneQueryId?: string;
  website?: string;
}

export interface TokenData {
  price: number;
  marketCap: number;
  priceChange24hPct: number;
  volume24h: number;
}

export interface TVLData {
  tvl: number;
  tvlChange24hPct: number;
}

export interface FeesData {
  fees24h: number;
  revenue24h: number;
}

export interface TwitterActivity {
  tweets: Array<{
    id: string;
    text: string;
    author: string;
    authorHandle: string;
    createdAt: string;
    replyCount: number;
    retweetCount: number;
    likeCount: number;
    url: string;
  }>;
  totalEngagement: number;
  topTweet: {
    id: string;
    text: string;
    likeCount: number;
    retweetCount: number;
    url: string;
  } | null;
}
