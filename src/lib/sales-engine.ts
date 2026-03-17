/**
 * sales-engine.ts — AI-powered autonomous sales conversation engine
 *
 * Handles:
 * 1. Building knowledge context from the knowledge base
 * 2. Generating cold outreach DMs
 * 3. Processing inbound replies and generating contextual responses
 * 4. Stage progression (cold_outreach → engaged → interested → closing → converted)
 * 5. Sentiment analysis and conversation summarization
 */

import { db } from "./db";
import { generate } from "./ai";

// ── Knowledge Base Context Builder ──────────────────────────────────────────

export async function buildKnowledgeContext(): Promise<string> {
  const entries = await db.knowledgeEntry.findMany({
    where: { isActive: true },
    orderBy: [{ priority: "desc" }, { category: "asc" }],
  });

  if (entries.length === 0) {
    return "No product knowledge configured yet. Use general conversational tone.";
  }

  const grouped: Record<string, string[]> = {};
  for (const entry of entries) {
    if (!grouped[entry.category]) grouped[entry.category] = [];
    grouped[entry.category].push(`**${entry.title}**: ${entry.content}`);
  }

  let context = "=== PRODUCT KNOWLEDGE BASE ===\n\n";
  for (const [category, items] of Object.entries(grouped)) {
    context += `[${category.toUpperCase()}]\n`;
    context += items.join("\n") + "\n\n";
  }

  return context;
}

// ── Conversation History Builder ────────────────────────────────────────────

async function buildConversationHistory(sessionId: string): Promise<string> {
  const messages = await db.salesMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: "asc" },
  });

  if (messages.length === 0) return "No prior messages in this conversation.";

  return messages
    .map((m) => {
      const label = m.role === "outbound" ? "US" : m.role === "inbound" ? "PROSPECT" : "SYSTEM";
      return `[${label}]: ${m.content}`;
    })
    .join("\n");
}

// ── Cold Outreach Generator ─────────────────────────────────────────────────

function buildColdOutreachPrompt(platform: string): string {
  const platformName = platform === "instagram" ? "Instagram" : "Twitter";
  const charLimit = platform === "instagram" ? 500 : 280;

  return `You are an AI sales agent for a tech startup. Your job is to craft a compelling first DM to a prospect on ${platformName}.

RULES:
- Be casual and human — NOT salesy or corporate
- Lead with genuine interest in what THEY do (use their bio/context)
- Ask a question that opens dialogue, don't pitch immediately
- Keep it under ${charLimit} characters (it's a ${platformName} DM)
- NO emojis, NO exclamation marks spam
- Sound like a real founder reaching out, not a bot
- Reference something specific about them if possible
- End with ONE simple question

Write ONLY the DM text. Nothing else.`;
}

export async function generateColdOutreach(
  prospect: {
    username: string;
    displayName?: string | null;
    bio?: string | null;
    followers?: number;
    platform?: string;
  },
  knowledgeContext: string
): Promise<string> {
  const prospectInfo = [
    `Username: @${prospect.username}`,
    prospect.displayName && `Name: ${prospect.displayName}`,
    prospect.bio && `Bio: ${prospect.bio}`,
    prospect.followers && `Followers: ${prospect.followers}`,
  ]
    .filter(Boolean)
    .join("\n");

  const userMessage = `${knowledgeContext}\n\n=== PROSPECT INFO ===\n${prospectInfo}\n\nWrite a cold outreach DM to this person. Make it feel personal and authentic.`;

  return (await generate(buildColdOutreachPrompt(prospect.platform || "twitter"), userMessage, 512)).trim();
}

// ── Reply Generator ─────────────────────────────────────────────────────────

function buildReplySystemPrompt(stage: string): string {
  const stageInstructions: Record<string, string> = {
    cold_outreach: `The prospect just replied to your cold outreach. This is exciting — they're engaging!
- Acknowledge what they said naturally
- Start building rapport
- Gently steer toward understanding their needs/pain points
- Do NOT pitch yet — it's too early`,

    engaged: `The prospect is engaged in conversation. They're interested but haven't shown buying intent yet.
- Continue building rapport
- Ask discovery questions about their workflow/challenges
- Drop subtle hints about how your product might help
- Let them come to the realization organically`,

    interested: `The prospect has shown interest in your product. They may have asked questions about it.
- Answer their questions clearly and confidently
- Share specific features/benefits relevant to THEIR use case
- Use social proof if available (users, testimonials)
- Guide toward a next step (trial, demo, pricing page)`,

    objection_handling: `The prospect has raised objections or concerns. Handle with care.
- Acknowledge their concern — don't dismiss it
- Provide a clear, honest answer
- Use data or examples when possible
- Redirect to the value proposition
- Don't be pushy — if they're not interested, be graceful`,

    closing: `The prospect is close to converting. They've shown strong interest.
- Be direct about next steps
- Make it easy to take action (share link, offer to help set up)
- Create gentle urgency without being manipulative
- Confirm their decision and offer support`,
  };

  const stageGuide = stageInstructions[stage] || stageInstructions.engaged;

  return `You are an AI sales agent having a DM conversation on social media. You represent a tech startup.

STAGE: ${stage}
${stageGuide}

GENERAL RULES:
- Keep responses under 500 characters
- Be conversational, casual, human
- NO corporate speak, NO buzzwords
- Reference the conversation history — show you're listening
- ONE message at a time, don't overwhelm
- If the prospect asks a direct question, answer it
- If they seem uninterested, gracefully pull back
- Never lie about features or capabilities

Write ONLY the reply DM text. Nothing else.`;
}

export async function generateReply(
  sessionId: string,
  stage: string,
  knowledgeContext: string,
  prospect: { username: string; displayName?: string | null; bio?: string | null }
): Promise<string> {
  const history = await buildConversationHistory(sessionId);
  const systemPrompt = buildReplySystemPrompt(stage);

  const userMessage = `${knowledgeContext}\n\n=== PROSPECT ===\n@${prospect.username}${prospect.bio ? ` — ${prospect.bio}` : ""}\n\n=== CONVERSATION HISTORY ===\n${history}\n\nGenerate the next reply in this conversation.`;

  return (await generate(systemPrompt, userMessage, 512)).trim();
}

// ── Stage Classifier ────────────────────────────────────────────────────────

const STAGE_CLASSIFIER_SYSTEM = `You analyze sales DM conversations and determine the current stage.

Stages (pick exactly one):
- cold_outreach: First message sent, no reply yet
- engaged: Prospect replied but hasn't shown product interest
- interested: Prospect asked about the product or showed buying signals
- objection_handling: Prospect raised concerns, pricing questions, or compared alternatives
- closing: Prospect is ready to try/buy, asking for links or next steps
- converted: Prospect signed up, bought, or committed
- lost: Prospect explicitly said no, blocked, or stopped responding after 3+ messages

Respond with ONLY a JSON object:
{"stage": "...", "sentiment": "positive|neutral|negative", "summary": "1-sentence summary", "nextAction": "suggested next step"}`;

export async function classifySession(sessionId: string): Promise<{
  stage: string;
  sentiment: string;
  summary: string;
  nextAction: string;
}> {
  const history = await buildConversationHistory(sessionId);

  const raw = await generate(STAGE_CLASSIFIER_SYSTEM, `Conversation:\n${history}`, 256);
  const cleaned = raw.replace(/```json?\s*/g, "").replace(/```/g, "").trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    return {
      stage: "engaged",
      sentiment: "unknown",
      summary: "Could not classify conversation",
      nextAction: "Review manually",
    };
  }
}

// ── Full Pipeline: Process an inbound message and generate reply ─────────

export async function processInboundMessage(
  sessionId: string,
  inboundText: string,
  externalId?: string
): Promise<{ reply: string; stage: string; sentiment: string }> {
  // 0. Verify session exists
  const sessionCheck = await db.salesSession.findUnique({
    where: { id: sessionId },
  });
  if (!sessionCheck) throw new Error("Session not found");
  if (sessionCheck.isPaused) throw new Error("Session is paused");

  // 1. Record the inbound message
  await db.salesMessage.create({
    data: {
      sessionId,
      role: "inbound",
      content: inboundText,
      externalId: externalId || null,
      status: "delivered",
      sentAt: new Date(),
    },
  });

  // 2. Get session + prospect (we already verified existence above)
  const session = await db.salesSession.findUnique({
    where: { id: sessionId },
    include: { prospect: true },
  });

  if (!session) throw new Error("Session not found");

  // 3. Classify the conversation to determine current stage
  const classification = await classifySession(sessionId);

  // 4. Update session with new classification
  await db.salesSession.update({
    where: { id: sessionId },
    data: {
      stage: classification.stage,
      sentiment: classification.sentiment,
      summary: classification.summary,
      nextAction: classification.nextAction,
      lastMessageAt: new Date(),
    },
  });

  // 5. Update prospect status based on stage
  const prospectStatus =
    classification.stage === "converted" ? "converted" :
    classification.stage === "lost" ? "lost" :
    classification.stage === "cold_outreach" ? "contacted" :
    "in_conversation";

  await db.salesProspect.update({
    where: { id: session.prospectId },
    data: { status: prospectStatus },
  });

  // 6. If lost or converted, don't generate a reply
  if (classification.stage === "lost" || classification.stage === "converted") {
    await db.salesSession.update({
      where: { id: sessionId },
      data: { isActive: false },
    });
    return {
      reply: "",
      stage: classification.stage,
      sentiment: classification.sentiment,
    };
  }

  // 7. Build knowledge context and generate reply
  const knowledgeContext = await buildKnowledgeContext();
  const reply = await generateReply(sessionId, classification.stage, knowledgeContext, session.prospect);

  // 8. Record outbound reply as pending (will be sent by the engine)
  await db.salesMessage.create({
    data: {
      sessionId,
      role: "outbound",
      content: reply,
      status: "pending",
    },
  });

  return {
    reply,
    stage: classification.stage,
    sentiment: classification.sentiment,
  };
}

// ── Initiate Outreach: Create prospect + session + send first DM ────────

export async function initiateOutreach(
  prospectData: {
    platform: string;
    username: string;
    displayName?: string;
    bio?: string;
    followers?: number;
    source?: string;
    sourceDetails?: unknown;
    socialAccountId?: string;
  }
): Promise<{ prospectId: string; sessionId: string; message: string }> {
  // 1. Upsert prospect
  const prospect = await db.salesProspect.upsert({
    where: {
      platform_username: {
        platform: prospectData.platform,
        username: prospectData.username,
      },
    },
    create: {
      platform: prospectData.platform,
      username: prospectData.username,
      displayName: prospectData.displayName || null,
      bio: prospectData.bio || null,
      followers: prospectData.followers || 0,
      source: prospectData.source || "manual",
      sourceDetails: prospectData.sourceDetails ? JSON.stringify(prospectData.sourceDetails) : null,
      socialAccountId: prospectData.socialAccountId || null,
      status: "queued",
    },
    update: {
      ...(prospectData.displayName && { displayName: prospectData.displayName }),
      ...(prospectData.bio && { bio: prospectData.bio }),
    },
  });

  // 2. Create session
  const session = await db.salesSession.create({
    data: {
      prospectId: prospect.id,
      stage: "cold_outreach",
    },
  });

  // 3. Generate cold outreach
  const knowledgeContext = await buildKnowledgeContext();
  const message = await generateColdOutreach(prospect, knowledgeContext);

  // 4. Record as pending outbound message
  await db.salesMessage.create({
    data: {
      sessionId: session.id,
      role: "outbound",
      content: message,
      status: "pending",
    },
  });

  return { prospectId: prospect.id, sessionId: session.id, message };
}
