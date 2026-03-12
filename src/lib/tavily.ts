import { getSetting } from "./config";

export interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

export async function searchTavilyNews(
  query: string,
  maxResults: number = 5
): Promise<TavilyResult[]> {
  const apiKey = await getSetting("TAVILY_API_KEY");
  if (!apiKey) {
    throw new Error("TAVILY_API_KEY not configured. Add it in Settings or .env.local.");
  }

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: "basic",
      max_results: maxResults,
      include_answer: false,
      topic: "news",
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Tavily API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return (data.results || []).map((r: any) => ({
    title: r.title,
    url: r.url,
    content: r.content,
    score: r.score,
  }));
}
