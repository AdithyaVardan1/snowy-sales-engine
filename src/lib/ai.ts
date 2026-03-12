import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getSetting } from "./config";

let anthropicClient: Anthropic | null = null;
let geminiClient: GoogleGenerativeAI | null = null;

async function getAnthropicClient(): Promise<Anthropic | null> {
  const key = await getSetting("ANTHROPIC_API_KEY");
  if (!key) return null;
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey: key });
  }
  return anthropicClient;
}

async function getGeminiClient(): Promise<GoogleGenerativeAI | null> {
  const key = await getSetting("GEMINI_API_KEY");
  if (!key) return null;
  if (!geminiClient) {
    geminiClient = new GoogleGenerativeAI(key);
  }
  return geminiClient;
}

export async function getAvailableProvider(): Promise<"claude" | "gemini" | null> {
  if (await getSetting("ANTHROPIC_API_KEY")) return "claude";
  if (await getSetting("GEMINI_API_KEY")) return "gemini";
  return null;
}

async function generateWithClaude(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number = 2048
): Promise<string> {
  const client = await getAnthropicClient();
  if (!client) throw new Error("Anthropic API key not configured. Go to Settings → AI to add it.");

  const message = await client.messages.create({
    model: "claude-3-5-sonnet-20241022",
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const block = message.content[0];
  return block.type === "text" ? block.text : "";
}

async function generateWithGemini(
  systemPrompt: string,
  userMessage: string
): Promise<string> {
  const client = await getGeminiClient();
  if (!client) throw new Error("Gemini API key not configured. Go to Settings → AI to add it.");

  const model = client.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: systemPrompt,
  });

  const result = await model.generateContent(userMessage);
  return result.response.text();
}

/**
 * Generate text using Claude (preferred) or Gemini (fallback).
 * API keys can be set in .env.local OR in the platform Settings → AI section.
 */
export async function generate(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number = 2048
): Promise<string> {
  const provider = await getAvailableProvider();

  if (!provider) {
    throw new Error(
      "No AI provider configured. Go to Settings → AI and add a Gemini or Anthropic API key."
    );
  }

  if (provider === "claude") {
    try {
      return await generateWithClaude(systemPrompt, userMessage, maxTokens);
    } catch (error) {
      // If Claude fails and Gemini is available, fall back
      if (await getSetting("GEMINI_API_KEY")) {
        console.warn("[AI] Claude failed, falling back to Gemini:", error);
        return await generateWithGemini(systemPrompt, userMessage);
      }
      throw error;
    }
  }

  return await generateWithGemini(systemPrompt, userMessage);
}
