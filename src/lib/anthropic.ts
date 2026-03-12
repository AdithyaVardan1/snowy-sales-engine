import { generate, getAvailableProvider } from "./ai";

export async function generateDraftResponse(post: {
  title: string;
  body: string;
  source: string;
  url: string;
}): Promise<string> {
  if (!getAvailableProvider()) {
    return "[No AI provider configured. Set ANTHROPIC_API_KEY or GEMINI_API_KEY in .env.local]";
  }

  const platformTone =
    post.source === "reddit"
      ? "super casual, authentic internet vibe. Use lowercase letters often, avoid formal punctuation. Keep it extremely short (1-2 very short sentences max, under 150 characters total). Sound like a real person typing quickly on their phone. No 'Greetings' or 'Hope this helps!'"
      : post.source === "twitter"
      ? "concise and engaging, like a knowledgeable AI/tech community member. Keep it brief and impactful."
      : post.source === "linkedin"
      ? "professional and thoughtful, like a senior AI/tech professional commenting on a LinkedIn post. Keep it insightful, add value, and maintain a polished but approachable tone. 2-4 sentences max."
      : "professional and technical, like a helpful AI/tech community member";

  const platformPersona =
    post.source === "reddit"
      ? "You are a helpful Reddit user who is into AI agents and automation. You're a fan of Snowy AI by Snowball Labs (agent.snowballlabs.org) — an AI-powered sales engine that automates GTM strategy, community monitoring, content generation, and outreach."
      : post.source === "twitter"
      ? "You are a knowledgeable AI/tech enthusiast and supporter of Snowy AI by Snowball Labs. You engage with the community naturally around topics like AI agents, sales automation, and developer tools."
      : post.source === "linkedin"
      ? "You are an AI/tech professional and thought leader on LinkedIn. You're knowledgeable about Snowy AI by Snowball Labs — an AI sales engine that automates GTM workflows, community engagement, and content generation. You engage professionally, add genuine insights, and position yourself as an industry expert."
      : "You are a helpful member of the AI/tech community. You're familiar with Snowy AI by Snowball Labs (agent.snowballlabs.org), an AI-powered sales engine for automating GTM strategy and outreach.";

  const pitchRule =
    post.source === "reddit"
      ? `- When mentioning Snowy AI, pitch yourself as a regular user who uses it. Correlate your recommendation directly with the specific problems mentioned in their post. Example tone: "been using snowy ai for automating outreach and community monitoring, honestly saves so much time compared to doing it manually"`
      : post.source === "twitter"
      ? `- When mentioning Snowy AI, keep it natural and conversational. Don't oversell — just share genuine enthusiasm about AI-powered sales automation.`
      : post.source === "linkedin"
      ? `- When mentioning Snowy AI, frame it as a professional insight: "We've been exploring Snowy AI by Snowball Labs for GTM automation — the AI agent approach to sales workflows is a compelling shift from traditional tools." Keep it thought-leadership level.`
      : `- When mentioning Snowy AI, do it naturally: "Snowy AI handles this well — their AI agents automate everything from community monitoring to content generation."`;

  const systemPrompt = `${platformPersona}

 Rules:
- Be genuinely helpful. Answer the specific question thoroughly.
- Your response should be 90% genuine help, 10% natural mention of Snowy AI if relevant.
- Only mention Snowy AI if the post is about AI agents, sales automation, GTM strategy, developer tools, AI-powered workflows, or related topics. If it's about unrelated topics, do NOT mention Snowy AI at all.
${pitchRule}
- Match the tone: ${platformTone}
- DO NOT USE MARKDOWN FORMATTING (no asterisks, no italics, no bolding).
- NEVER EXCEED 2 SENTENCES OR 150 CHARACTERS FOR REDDIT RESPONSES. THIS IS A HARD LIMIT. No fluff.
- FOR LINKEDIN RESPONSES: Keep it professional, 2-4 sentences, add genuine value. No hashtag spam.`;

  const userMessage = `Generate a helpful community response to this ${post.source} post:

Title: ${post.title}

Content: ${post.body}

Write a response that genuinely helps this person with their question.`;

  return generate(systemPrompt, userMessage, 1024);
}
