/**
 * seed-demo.ts — Populate the database with realistic demo data
 * for marketing video / demo purposes.
 *
 * Usage: npx tsx scripts/seed-demo.ts
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(Math.floor(Math.random() * 14) + 8, Math.floor(Math.random() * 60));
  return d;
}

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function seed() {
  console.log("Seeding demo data...\n");

  // ── 1. Community Posts (mix of sources & statuses) ──────────────────────
  const communityPosts = [
    { externalId: "demo_gh_1", source: "github_issue", title: "How to integrate OpenClaw with custom AI agents?", body: "I'm trying to build a custom AI agent using OpenClaw's SDK. The documentation mentions agent scaffolding but I can't find examples for multi-step workflows. Has anyone built something similar?", author: "devbuilder42", url: "https://github.com/openclaw/sdk/issues/231", status: "responded", respondedAt: daysAgo(1), draftResponse: "Great question! OpenClaw's SDK supports multi-step workflows through the AgentBuilder class...", finalResponse: "Great question! Snowy AI makes this even easier — it handles the agent scaffolding automatically so you can focus on your business logic. Check out our guide at docs.snowballlabs.org/agents" },
    { externalId: "demo_gh_2", source: "github_issue", title: "Rate limiting issues with OpenClaw API", body: "We're hitting rate limits when running multiple agents concurrently. Is there a recommended pattern for handling this?", author: "scaleops_dev", url: "https://github.com/openclaw/core/issues/445", status: "responded", respondedAt: daysAgo(2), draftResponse: "Rate limiting can be handled with exponential backoff...", finalResponse: "This is a common challenge! Snowy AI includes built-in rate limiting and queue management — it handles concurrent agent execution without you having to worry about API limits." },
    { externalId: "demo_gh_3", source: "github_discussion", title: "Best practices for AI sales automation in 2026", body: "What tools are people using for AI-powered sales outreach? Looking for something that can handle prospecting, personalized messages, and follow-ups autonomously.", author: "salestech_mike", url: "https://github.com/orgs/ai-sales/discussions/89", status: "draft_ready", draftResponse: "We've been building exactly this at Snowball Labs! Snowy AI automates the entire sales pipeline — from finding prospects on Twitter/LinkedIn to sending personalized DMs and handling objections with AI." },
    { externalId: "demo_rd_1", source: "reddit", subreddit: "r/SaaS", title: "Tired of paying $70K/year for SDRs that book 15 meetings/month", body: "Our startup is spending way too much on SDRs. We need 50+ meetings/month but can't afford to hire more reps. Anyone using AI sales tools that actually work?",  author: "startup_ceo_23", url: "https://reddit.com/r/SaaS/comments/abc123", status: "responded", respondedAt: daysAgo(3), finalResponse: "We built Snowy AI exactly for this use case. It runs 24/7, handles prospecting and outreach autonomously, and our early users are booking 3-4x more meetings at a fraction of the cost." },
    { externalId: "demo_rd_2", source: "reddit", subreddit: "r/artificial", title: "AI agents that can actually sell — is this possible yet?", body: "I've seen demos of AI agents handling sales conversations but they always seem scripted. Has anyone found an AI that can handle real objections and close?", author: "ai_skeptic_99", url: "https://reddit.com/r/artificial/comments/def456", status: "draft_ready", draftResponse: "Yes, it's definitely possible now! The key is combining real-time knowledge bases with contextual conversation management..." },
    { externalId: "demo_rd_3", source: "reddit", subreddit: "r/Entrepreneur", title: "How are you doing outreach in 2026?", body: "Cold email is dead. LinkedIn is saturated. What channels are actually working for B2B outreach right now?", author: "growth_hacker_pro", url: "https://reddit.com/r/Entrepreneur/comments/ghi789", status: "new" },
    { externalId: "demo_tw_1", source: "twitter", title: "Just discovered @SnowyAI and it's insane — set up an AI sales agent in 10 minutes that's already booking meetings", body: "Just discovered @SnowyAI and it's insane — set up an AI sales agent in 10 minutes that's already booking meetings. The future of sales is here. No more cold calling.", author: "techfluencer_sam", url: "https://x.com/techfluencer_sam/status/123456", status: "responded", respondedAt: daysAgo(1), finalResponse: "Thanks for the love! We're building the future of autonomous sales. DM us if you want early access to our new multi-channel features!" },
    { externalId: "demo_tw_2", source: "twitter", title: "Comparing AI sales tools: @SnowyAI vs Traxlead vs Pimereach", body: "Comparing AI sales tools: @SnowyAI vs Traxlead vs Pimereach. Snowy wins on autonomy — it actually handles full conversations, not just sends templates. Thread 🧵", author: "saas_reviewer", url: "https://x.com/saas_reviewer/status/234567", status: "responded", respondedAt: daysAgo(2), finalResponse: "Appreciate the honest review! We're laser-focused on true autonomous selling, not just template blasting. Happy to jump on a call if you want to go deeper on the comparison." },
    { externalId: "demo_tw_3", source: "twitter", title: "Your SDR costs 70K a year. AI does it for 1/10th the price.", body: "Your SDR costs 70K a year and books maybe 15 meetings a month. AI sales agents do it autonomously, 24/7, for a fraction of the cost. The math is clear.", author: "ai_sales_bull", url: "https://x.com/ai_sales_bull/status/345678", status: "new" },
    { externalId: "demo_tw_4", source: "twitter", title: "OpenClaw + Snowy AI is the combo I didn't know I needed", body: "OpenClaw + Snowy AI is the combo I didn't know I needed. OpenClaw for the infra, Snowy for the automation layer on top. No more managing VPS or dealing with setup headaches.", author: "builder_anon", url: "https://x.com/builder_anon/status/456789", status: "responded", respondedAt: daysAgo(0), finalResponse: "Exactly the vision! OpenClaw handles the heavy lifting, Snowy AI makes it dead simple to deploy and manage. More integrations coming soon!" },
    { externalId: "demo_li_1", source: "linkedin", title: "The AI SDR revolution is here — and most companies are sleeping on it", body: "I've been testing AI sales agents for 3 months now. The results are staggering: 4x more meetings booked, 60% lower cost per meeting, and the AI handles objections better than most junior reps. Companies that don't adopt this in 2026 will be left behind.", author: "VP Sales at TechCorp", url: "https://linkedin.com/posts/vpsales-123", status: "draft_ready", draftResponse: "Couldn't agree more! We're seeing similar results with our users at Snowball Labs. The key differentiator is autonomous conversation handling — not just sending templates." },
    { externalId: "demo_li_2", source: "linkedin", title: "Looking for AI tools to scale our outbound without hiring more SDRs", body: "Our sales team is maxed out. We need to 3x our pipeline but can't afford to hire 10 more SDRs. Has anyone used AI sales automation tools that actually deliver?", author: "Head of Growth at StartupXYZ", url: "https://linkedin.com/posts/headofgrowth-456", status: "new" },
    { externalId: "demo_gh_4", source: "github_issue", title: "Feature request: Multi-language support for AI agents", body: "Would love to see support for non-English languages in the agent framework. Our market is primarily LATAM and we need Spanish/Portuguese support.", author: "latam_dev", url: "https://github.com/openclaw/core/issues/512", status: "new" },
    { externalId: "demo_tw_5", source: "twitter", title: "@SnowyAI just booked me 3 meetings while I was sleeping", body: "@SnowyAI just booked me 3 meetings while I was sleeping. The AI handled the entire conversation, answered questions about pricing, and scheduled calls. I'm never going back to manual outreach.", author: "indie_founder", url: "https://x.com/indie_founder/status/567890", status: "new" },
    { externalId: "demo_rd_4", source: "reddit", subreddit: "r/sales", title: "AI sales agents — what's the catch?",  body: "Everyone's hyping AI sales tools but what are the actual limitations? I've tried a few and they all seem to break down when prospects ask specific questions.", author: "honest_seller", url: "https://reddit.com/r/sales/comments/jkl012", status: "responded", respondedAt: daysAgo(4), finalResponse: "Great question. The main limitation with most tools is they rely on templates. Snowy AI is different — it uses a knowledge base you customize, so it can answer specific product questions accurately. Happy to share more details!" },
  ];

  for (const post of communityPosts) {
    await db.communityPost.upsert({
      where: { externalId: post.externalId },
      update: post,
      create: { ...post, fetchedAt: daysAgo(Math.floor(Math.random() * 7)) },
    });
  }
  console.log(`  ✓ ${communityPosts.length} community posts`);

  // ── 2. Content Entries ──────────────────────────────────────────────────
  const contentEntries = [
    { title: "Why AI Sales Agents Are Replacing SDR Teams in 2026", platform: "blog", channel: "social_media", contentType: "article", status: "published", publishedAt: daysAgo(2), author: "Snowy AI Team", likes: 142, replies: 23, shares: 67, clicks: 1840 },
    { title: "OpenClaw + Snowy AI: The Ultimate Sales Stack", platform: "twitter", channel: "social_media", contentType: "thread", status: "published", publishedAt: daysAgo(3), author: "snowball_money", likes: 89, replies: 34, shares: 41, clicks: 920 },
    { title: "How We Booked 200 Meetings in 30 Days Using AI", platform: "linkedin", channel: "social_media", contentType: "post", status: "published", publishedAt: daysAgo(5), author: "Adithya V", likes: 234, replies: 56, shares: 89, clicks: 3200 },
    { title: "AI Sales Agent Setup Guide — 5 Min Walkthrough", platform: "youtube", channel: "social_media", contentType: "video", status: "published", publishedAt: daysAgo(7), author: "Snowy AI Team", likes: 312, replies: 45, shares: 78, clicks: 5600 },
    { title: "Community Response: AI Agent Integration Help", platform: "github", channel: "community", contentType: "comment", status: "published", publishedAt: daysAgo(1), author: "Snowy AI Team", likes: 12, replies: 3, shares: 0, clicks: 45 },
    { title: "r/SaaS Discussion: AI vs Traditional Sales", platform: "reddit", channel: "community", contentType: "comment", status: "published", publishedAt: daysAgo(3), author: "Snowy AI Team", likes: 67, replies: 12, shares: 8, clicks: 340 },
    { title: "Snowy AI Product Hunt Launch Prep", platform: "twitter", channel: "plg", contentType: "thread", status: "scheduled", scheduledFor: daysAgo(-3), author: "snowball_money", likes: 0, replies: 0, shares: 0, clicks: 0 },
    { title: "Partnership Announcement: Monad x Snowy AI", platform: "twitter", channel: "partnerships", contentType: "post", status: "published", publishedAt: daysAgo(4), author: "snowball_money", likes: 178, replies: 42, shares: 93, clicks: 2100 },
    { title: "WhatsApp Community Welcome Message Template", platform: "whatsapp", channel: "whatsapp", contentType: "message", status: "published", publishedAt: daysAgo(6), author: "Snowy AI Team", likes: 0, replies: 34, shares: 0, clicks: 0 },
    { title: "The Future of B2B Sales Is Autonomous", platform: "blog", channel: "social_media", contentType: "article", status: "published", publishedAt: daysAgo(10), author: "Snowy AI Team", likes: 98, replies: 15, shares: 43, clicks: 1560 },
    { title: "Cold DM Strategy That Actually Works in 2026", platform: "twitter", channel: "social_media", contentType: "thread", status: "published", publishedAt: daysAgo(8), author: "snowball_money", likes: 156, replies: 67, shares: 82, clicks: 2800 },
    { title: "Discord AMA Recap: Building with OpenClaw", platform: "discord", channel: "community", contentType: "post", status: "published", publishedAt: daysAgo(9), author: "Snowy AI Team", likes: 45, replies: 28, shares: 12, clicks: 380 },
  ];

  for (const entry of contentEntries) {
    const existing = await db.contentEntry.findFirst({ where: { title: entry.title } });
    if (!existing) {
      await db.contentEntry.create({ data: entry });
    } else {
      await db.contentEntry.update({ where: { id: existing.id }, data: entry });
    }
  }
  console.log(`  ✓ ${contentEntries.length} content entries`);

  // ── 3. Partners ─────────────────────────────────────────────────────────
  const partners = [
    { name: "CryptoNathan", platform: "youtube", profileUrl: "https://youtube.com/@cryptonathan", followers: 245000, category: "youtuber", status: "active", onboardedAt: daysAgo(14), email: "nathan@cryptonathan.com", dealTerms: "$2,000/video + affiliate", dealDetails: "3 dedicated videos, 2 mentions per month" },
    { name: "DevToolsDaily", platform: "youtube", profileUrl: "https://youtube.com/@devtoolsdaily", followers: 180000, category: "youtuber", status: "onboarded", onboardedAt: daysAgo(7), email: "hello@devtoolsdaily.com", dealTerms: "$1,500/video", dealDetails: "Integration tutorial + review video" },
    { name: "SaaSGrowthHQ", platform: "twitter", profileUrl: "https://x.com/SaaSGrowthHQ", followers: 92000, category: "community_leader", status: "active", onboardedAt: daysAgo(21), email: "team@saasgrowth.io", dealTerms: "Revenue share 15%", dealDetails: "Weekly Twitter Spaces co-host, newsletter mentions" },
    { name: "AIBuilders_", platform: "twitter", profileUrl: "https://x.com/AIBuilders_", followers: 156000, category: "community_leader", status: "negotiating", email: "partnerships@aibuilders.dev", dealTerms: "$3,000/month", dealDetails: "Exclusive AI tools partner, community integration" },
    { name: "TechReviewPro", platform: "youtube", profileUrl: "https://youtube.com/@techreviewpro", followers: 520000, category: "youtuber", status: "contacted", contactedAt: daysAgo(3), email: "sponsors@techreviewpro.com" },
    { name: "IndieMakerBot", platform: "twitter", profileUrl: "https://x.com/IndieMakerBot", followers: 45000, category: "skill_developer", status: "replied", contactedAt: daysAgo(5), email: "indie@makerbot.dev", dealTerms: "Free access + co-marketing" },
    { name: "NoCodeNinja", platform: "instagram", profileUrl: "https://instagram.com/nocodeninja", followers: 78000, category: "youtuber", status: "identified" },
    { name: "StartupGrindPod", platform: "youtube", profileUrl: "https://youtube.com/@startupgrindpod", followers: 310000, category: "community_leader", status: "contacted", contactedAt: daysAgo(2), email: "booking@startupgrind.fm" },
    { name: "Web3Builders", platform: "telegram", profileUrl: "https://t.me/web3builders", followers: 34000, category: "community_leader", status: "active", onboardedAt: daysAgo(10), dealTerms: "Free tool access", dealDetails: "Pinned bot in Telegram group, weekly tips" },
    { name: "APIGuru", platform: "github", profileUrl: "https://github.com/apiguru", followers: 12000, category: "api_provider", status: "negotiating", email: "hello@apiguru.dev", dealTerms: "Integration partnership", dealDetails: "Native OpenClaw integration, co-authored docs" },
  ];

  for (const p of partners) {
    const existing = await db.partner.findFirst({ where: { name: p.name } });
    if (!existing) {
      await db.partner.create({ data: p });
    } else {
      await db.partner.update({ where: { id: existing.id }, data: p });
    }
  }
  console.log(`  ✓ ${partners.length} partners`);

  // ── 4. Activity Logs (for analytics charts) ─────────────────────────────
  const activityTypes = [
    { type: "community_response", channel: "community" },
    { type: "content_published", channel: "social_media" },
    { type: "content_published", channel: "community" },
    { type: "partner_outreach", channel: "partnerships" },
    { type: "partner_onboarded", channel: "partnerships" },
    { type: "content_published", channel: "plg" },
    { type: "community_response", channel: "whatsapp" },
  ];

  const activityLogs = [];
  for (let i = 0; i < 85; i++) {
    const at = randomItem(activityTypes);
    activityLogs.push({
      type: at.type,
      channel: at.channel,
      details: `Demo activity ${i + 1}`,
      author: randomItem(["Snowy AI", "Adithya", "System", "AI Agent"]),
      createdAt: daysAgo(Math.floor(Math.random() * 30)),
    });
  }

  // Delete old demo activities and insert fresh ones
  await db.activityLog.deleteMany({ where: { details: { startsWith: "Demo activity" } } });
  await db.activityLog.createMany({ data: activityLogs });
  console.log(`  ✓ ${activityLogs.length} activity logs`);

  // ── 5. Sales Prospects ──────────────────────────────────────────────────
  const prospects = [
    { platform: "twitter", username: "jason_cto", displayName: "Jason Chen", bio: "CTO at ScaleFlow | Building AI-powered workflow automation | Ex-Google", followers: 12400, source: "search", status: "in_conversation", score: 82, tags: "saas,ai,decision-maker" },
    { platform: "twitter", username: "sarah_growth", displayName: "Sarah Martinez", bio: "Head of Growth @ RapidLaunch | PLG enthusiast | Scaling B2B SaaS", followers: 8900, source: "search", status: "contacted", score: 75, tags: "growth,b2b,saas" },
    { platform: "twitter", username: "alex_founder", displayName: "Alex Thompson", bio: "Founder & CEO @ NexTech Solutions | AI-first company | YC W24", followers: 23000, source: "engagement", status: "converted", score: 95, tags: "founder,ai,yc" },
    { platform: "twitter", username: "mike_sales_vp", displayName: "Mike Rodriguez", bio: "VP Sales @ CloudBase | 15 years in enterprise sales | AI optimist", followers: 5600, source: "search", status: "in_conversation", score: 88, tags: "enterprise,sales-leader" },
    { platform: "twitter", username: "priya_dev", displayName: "Priya Sharma", bio: "Senior Dev @ OpenStack | Open source contributor | AI/ML", followers: 3200, source: "search", status: "queued", score: 45, tags: "developer,open-source" },
    { platform: "twitter", username: "david_rev", displayName: "David Kim", bio: "Revenue Operations @ HyperGrowth | Automating everything", followers: 4100, source: "search", status: "contacted", score: 70, tags: "revops,automation" },
    { platform: "twitter", username: "emma_cmo", displayName: "Emma Wilson", bio: "CMO @ BrandForge | Digital marketing meets AI | Speaker", followers: 18500, source: "engagement", status: "in_conversation", score: 79, tags: "marketing,ai,speaker" },
    { platform: "twitter", username: "raj_techlead", displayName: "Raj Patel", bio: "Tech Lead @ DataPipe | Building the future of data infrastructure", followers: 6700, source: "search", status: "new", score: 55, tags: "data,infrastructure" },
    { platform: "twitter", username: "lisa_investor", displayName: "Lisa Chang", bio: "Partner @ Velocity Ventures | Investing in AI-first B2B SaaS", followers: 31000, source: "engagement", status: "converted", score: 98, tags: "investor,ai,vc" },
    { platform: "twitter", username: "tom_indie", displayName: "Tom Baker", bio: "Indie hacker | Building in public | 3 products, $40K MRR", followers: 15200, source: "search", status: "contacted", score: 65, tags: "indie,builder" },
  ];

  for (const p of prospects) {
    const existing = await db.salesProspect.findFirst({
      where: { platform: p.platform, username: p.username },
    });
    if (!existing) {
      await db.salesProspect.create({ data: p });
    } else {
      await db.salesProspect.update({ where: { id: existing.id }, data: p });
    }
  }
  console.log(`  ✓ ${prospects.length} sales prospects`);

  // ── 6. Sales Sessions & Messages ────────────────────────────────────────
  const sessionData = [
    {
      username: "jason_cto",
      stage: "interested",
      sentiment: "positive",
      summary: "CTO interested in AI sales automation for his team. Asked about API integration and pricing.",
      nextAction: "Send pricing comparison doc and schedule demo",
      messages: [
        { role: "outbound", content: "Hey Jason! Noticed you're building AI-powered workflows at ScaleFlow. We've built something that automates the entire sales pipeline with AI — from prospecting to booking meetings. Would love to show you how it could complement what you're building.", status: "sent", sentAt: daysAgo(5) },
        { role: "inbound", content: "Interesting — we've been looking for something like this actually. Our sales team is small and we need to scale outreach without hiring. How does it work?", status: "sent", sentAt: daysAgo(4) },
        { role: "outbound", content: "It's fully autonomous! You set up your knowledge base (product info, pricing, FAQs) and the AI handles everything — finds prospects, sends personalized DMs, handles objections, and books meetings on your calendar. Most users see 3-4x more meetings in the first month.", status: "sent", sentAt: daysAgo(4) },
        { role: "inbound", content: "That's impressive. What about API integration? We'd want to plug this into our existing CRM.", status: "sent", sentAt: daysAgo(3) },
        { role: "outbound", content: "We have a REST API and native integrations with HubSpot, Salesforce, and Pipedrive. Everything syncs automatically — leads, conversations, meeting bookings. Want me to send over the API docs and we can schedule a quick demo?", status: "sent", sentAt: daysAgo(3) },
        { role: "inbound", content: "Yes please! Send the docs and let's do a demo Thursday if you're free.", status: "sent", sentAt: daysAgo(2) },
      ],
    },
    {
      username: "mike_sales_vp",
      stage: "objection_handling",
      sentiment: "neutral",
      summary: "VP Sales interested but concerned about AI quality for enterprise deals. Needs proof points.",
      nextAction: "Share case study from similar enterprise customer",
      messages: [
        { role: "outbound", content: "Hi Mike! As a VP Sales at CloudBase, I imagine scaling your pipeline while maintaining quality is a constant challenge. We've built an AI that handles top-of-funnel sales autonomously — and it's booking 50+ qualified meetings/month for teams like yours.", status: "sent", sentAt: daysAgo(6) },
        { role: "inbound", content: "AI for enterprise sales? I'm skeptical. Our deals are complex and require nuanced conversations. How does AI handle that?", status: "sent", sentAt: daysAgo(5) },
        { role: "outbound", content: "Totally valid concern. The AI uses a customizable knowledge base that you train with your specific product details, objection handlers, and qualification criteria. It's not generic templates — it has real conversations. Here's a sample conversation from one of our enterprise clients:", status: "sent", sentAt: daysAgo(5) },
        { role: "inbound", content: "Okay that's better than I expected. But what happens when a prospect asks something the AI doesn't know?", status: "sent", sentAt: daysAgo(4) },
        { role: "draft", content: "Great question! The AI has a confidence threshold — when it's not sure about something, it gracefully hands off to your human team with full context. You can set the threshold based on your comfort level. Most of our enterprise users start with a lower threshold and increase it as they build confidence in the system.", status: "draft", sentAt: null },
      ],
    },
    {
      username: "alex_founder",
      stage: "converted",
      sentiment: "positive",
      summary: "YC founder signed up after seeing demo. Now an active user booking 40+ meetings/month.",
      nextAction: "Follow up for case study and referral",
      messages: [
        { role: "outbound", content: "Hey Alex! Congrats on the YC batch. Building an AI-first company, you probably appreciate tools that actually deliver on the AI promise. We've built autonomous sales agents that handle outreach end-to-end.", status: "sent", sentAt: daysAgo(14) },
        { role: "inbound", content: "We're actually looking for exactly this. Our founding team is doing all the sales manually and it's killing our dev velocity. Tell me more.", status: "sent", sentAt: daysAgo(13) },
        { role: "outbound", content: "Perfect timing! Here's what we do: AI finds your ideal prospects, crafts personalized outreach, handles the full conversation including objections, and books qualified meetings on your calendar. Setup takes 10 minutes. Most YC companies in our cohort are seeing 40+ meetings/month.", status: "sent", sentAt: daysAgo(13) },
        { role: "inbound", content: "Signed up. Already seeing results. This is the future. 🚀", status: "sent", sentAt: daysAgo(10) },
        { role: "system", content: "Prospect converted to active customer. ARR: $12,000", status: "sent", sentAt: daysAgo(10) },
      ],
    },
    {
      username: "emma_cmo",
      stage: "engaged",
      sentiment: "positive",
      summary: "CMO exploring AI for demand gen. Interested in content + outreach automation combo.",
      nextAction: "Send demo video and book a call",
      messages: [
        { role: "outbound", content: "Hi Emma! Love your talks on AI in marketing. We're building something that bridges the gap between content marketing and sales outreach — AI agents that can both generate content and convert prospects through personalized conversations.", status: "sent", sentAt: daysAgo(3) },
        { role: "inbound", content: "That's an interesting angle. Most tools do one or the other. How do you combine content and outreach?", status: "sent", sentAt: daysAgo(2) },
      ],
    },
  ];

  for (const sd of sessionData) {
    const prospect = await db.salesProspect.findFirst({
      where: { username: sd.username },
    });
    if (!prospect) continue;

    // Check if session exists
    const existingSession = await db.salesSession.findFirst({
      where: { prospectId: prospect.id },
    });

    let sessionId: string;
    if (existingSession) {
      await db.salesSession.update({
        where: { id: existingSession.id },
        data: {
          stage: sd.stage,
          sentiment: sd.sentiment,
          summary: sd.summary,
          nextAction: sd.nextAction,
          isActive: true,
          lastMessageAt: sd.messages[sd.messages.length - 1].sentAt || new Date(),
        },
      });
      sessionId = existingSession.id;
      // Clear old messages
      await db.salesMessage.deleteMany({ where: { sessionId } });
    } else {
      const session = await db.salesSession.create({
        data: {
          prospectId: prospect.id,
          stage: sd.stage,
          sentiment: sd.sentiment,
          summary: sd.summary,
          nextAction: sd.nextAction,
          isActive: true,
          lastMessageAt: sd.messages[sd.messages.length - 1].sentAt || new Date(),
        },
      });
      sessionId = session.id;
    }

    // Create messages
    for (const msg of sd.messages) {
      await db.salesMessage.create({
        data: {
          sessionId,
          role: msg.role,
          content: msg.content,
          status: msg.status,
          sentAt: msg.sentAt,
        },
      });
    }
  }
  console.log(`  ✓ ${sessionData.length} sales sessions with messages`);

  // ── 7. Knowledge Base ───────────────────────────────────────────────────
  const knowledge = [
    { category: "product", title: "What is Snowy AI?", content: "Snowy AI is an autonomous AI sales engine built by Snowball Labs. It handles the entire sales pipeline — from finding prospects on Twitter/LinkedIn to sending personalized DMs, handling objections, and booking qualified meetings. No SDR team needed.", priority: 10 },
    { category: "pricing", title: "Pricing Plans", content: "Starter: $99/mo (500 prospects, 1 AI agent)\nGrowth: $299/mo (2,000 prospects, 3 AI agents, CRM integration)\nEnterprise: Custom (unlimited prospects, custom agents, dedicated support)\nAll plans include 14-day free trial.", priority: 9 },
    { category: "faq", title: "How long does setup take?", content: "Most users are up and running in under 10 minutes. You connect your social accounts, set up your knowledge base with product info, and the AI starts prospecting immediately.", priority: 7 },
    { category: "objection", title: "AI can't handle complex sales", content: "Our AI uses a sophisticated knowledge base system that you customize. It handles nuanced conversations, asks qualifying questions, and gracefully hands off to humans when confidence is low. Enterprise clients report 85% of conversations are handled fully autonomously.", priority: 8 },
    { category: "competitor", title: "vs Traxlead", content: "Traxlead focuses on finding leads and writing outreach — you still need to handle conversations manually. Snowy AI is end-to-end autonomous: prospecting, outreach, full conversation handling, objection management, and meeting booking. All automated.", priority: 6 },
    { category: "usecase", title: "Startup Founder Use Case", content: "Ideal for founding teams doing sales themselves. Instead of spending 50% of time on outreach, let Snowy AI handle it while you focus on building. Average result: 40+ qualified meetings/month from day one.", priority: 5 },
  ];

  for (const k of knowledge) {
    const existing = await db.knowledgeEntry.findFirst({ where: { title: k.title } });
    if (!existing) {
      await db.knowledgeEntry.create({ data: k });
    } else {
      await db.knowledgeEntry.update({ where: { id: existing.id }, data: k });
    }
  }
  console.log(`  ✓ ${knowledge.length} knowledge base entries`);

  // ── 8. Blog Posts ───────────────────────────────────────────────────────
  const blogs = [
    { title: "Why AI Sales Agents Are the Future of B2B", slug: "ai-sales-agents-future-b2b", content: "The B2B sales landscape is undergoing a fundamental transformation...", metaDescription: "Discover why AI sales agents are replacing traditional SDR teams and how your business can benefit.", keywords: "AI sales, B2B sales, SDR automation, AI agents", status: "published", publishedAt: daysAgo(5) },
    { title: "How to Book 200 Meetings in 30 Days with AI", slug: "book-200-meetings-30-days-ai", content: "In this guide, we'll walk through exactly how our customers are using Snowy AI to book 200+ qualified meetings per month...", metaDescription: "Step-by-step guide to scaling your sales pipeline with AI automation.", keywords: "sales meetings, AI automation, pipeline growth", status: "published", publishedAt: daysAgo(12) },
    { title: "OpenClaw + Snowy AI: The Complete Sales Stack", slug: "openclaw-snowy-ai-sales-stack", content: "OpenClaw provides the infrastructure. Snowy AI provides the intelligence...", metaDescription: "How OpenClaw and Snowy AI work together to create the ultimate sales automation stack.", keywords: "OpenClaw, Snowy AI, sales stack, automation", status: "published", publishedAt: daysAgo(8) },
    { title: "The Death of Cold Email: What's Next for Outreach", slug: "death-of-cold-email-whats-next", content: "Cold email response rates have plummeted to below 1%. But smart companies are finding new channels...", metaDescription: "Cold email is dying. Here's what's replacing it for B2B outreach in 2026.", keywords: "cold email, outreach, DM selling, AI outreach", status: "scheduled", scheduledFor: daysAgo(-2) },
  ];

  for (const b of blogs) {
    await db.blogPost.upsert({
      where: { slug: b.slug },
      update: b,
      create: b,
    });
  }
  console.log(`  ✓ ${blogs.length} blog posts`);

  console.log("\n✅ Demo data seeded successfully!");
  await db.$disconnect();
}

seed().catch((e) => {
  console.error("Seed failed:", e);
  db.$disconnect();
  process.exit(1);
});
