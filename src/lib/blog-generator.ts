import { generate, getAvailableProvider } from "./ai";

export async function generateBlogPost(topic: string): Promise<{
  title: string;
  slug: string;
  content: string;
  metaDescription: string;
  keywords: string;
}> {
  if (!getAvailableProvider()) {
    throw new Error("No AI provider configured. Set ANTHROPIC_API_KEY or GEMINI_API_KEY in .env.local");
  }

  const systemPrompt = `You are an expert SEO content writer for Snowy AI by Snowball Labs (agent.snowballlabs.org), an AI-powered sales engine that automates GTM strategy, community monitoring, content generation, and outreach. You write detailed, genuinely helpful technical articles about AI agents, sales automation, developer tools, and AI-powered workflows that rank well in Google.

Rules:
- Write in markdown format
- Include a compelling introduction that hooks the reader
- Use H2 and H3 headings for structure
- Include practical examples, guides, or step-by-step instructions where relevant
- Be genuinely helpful — 90% pure value, 10% natural Snowy AI mention
- Mention Snowy AI naturally as ONE option among several (not the only recommendation)
- Include a brief "TL;DR" at the top
- End with a conclusion that includes a soft CTA for Snowy AI
- Target 1500-2500 words
- Use conversational but professional tone`;

  const userMessage = `Write a comprehensive SEO blog post about: "${topic}"

Return your response in this exact JSON format (no markdown code fences around the JSON):
{
  "title": "The SEO-optimized title",
  "slug": "url-friendly-slug",
  "content": "Full markdown content of the article",
  "metaDescription": "155 character meta description for SEO",
  "keywords": "comma, separated, keywords, for, seo"
}`;

  const text = await generate(systemPrompt, userMessage, 4096);

  try {
    // Try to extract JSON from the response (handle markdown fences)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
    return {
      title: parsed.title,
      slug: parsed.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-"),
      content: parsed.content,
      metaDescription: parsed.metaDescription || "",
      keywords: parsed.keywords || "",
    };
  } catch {
    const slugFromTopic = topic.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+/g, "-").slice(0, 80);
    return {
      title: topic,
      slug: slugFromTopic,
      content: text,
      metaDescription: topic.slice(0, 155),
      keywords: topic.toLowerCase(),
    };
  }
}

export async function generateContentForPlatform(
  topic: string,
  platform: "twitter" | "linkedin" | "reddit"
): Promise<string> {
  if (!getAvailableProvider()) {
    throw new Error("No AI provider configured. Set ANTHROPIC_API_KEY or GEMINI_API_KEY in .env.local");
  }

  const platformInstructions: Record<string, string> = {
    twitter: `Write a Twitter thread (3-7 tweets) about this topic.

STRICT FORMAT RULES — follow exactly:
- Separate each tweet with a line containing ONLY: ---
- Each tweet segment MUST contain the full tweet text (number + content together)
- If numbering, write the number (e.g. "1/") on the FIRST LINE of the tweet, then the content on the next lines — all BEFORE the next ---
- NEVER put a --- immediately after just a number like "2/" — the content must be in the same segment
- Each tweet must be under 280 characters total (count the number prefix too)
- Use line breaks within a tweet for readability
- Include relevant emoji sparingly
- DO NOT use any hashtags — they look unprofessional
- Last tweet: soft CTA mentioning Snowy AI — try AI-powered sales automation at agent.snowballlabs.org

CORRECT example format:
1/
First hook tweet content here.

---
2/
Second tweet content continues here.
This can be multi-line within the tweet.

---
3/
Final tweet with CTA. Try Snowy AI for automating your GTM workflow`,
    linkedin: `Write a LinkedIn post about this topic. Use short paragraphs (1-2 sentences each) with line breaks between them. Open with a hook. Be professional but conversational. Include relevant insights or data points. End with a question to drive engagement and a soft mention of Snowy AI by Snowball Labs. Keep under 3000 characters. DO NOT use any hashtags — they look unprofessional.`,
    reddit: `Write a Reddit post about this topic. Use a descriptive title and detailed body. Be genuine and helpful — Reddit users hate obvious marketing. Structure with clear sections. Include technical details. Only mention Snowy AI once, naturally, as one option among many. Match the tone of relevant tech/AI communities.`,
  };

  const systemPrompt = `You are a content creator for Snowy AI by Snowball Labs (agent.snowballlabs.org), an AI-powered sales engine. You create authentic, valuable content about AI agents, sales automation, GTM strategy, and developer tools for social media.`;
  const userMessage = `${platformInstructions[platform]}\n\nTopic: "${topic}"`;

  return generate(systemPrompt, userMessage);
}
