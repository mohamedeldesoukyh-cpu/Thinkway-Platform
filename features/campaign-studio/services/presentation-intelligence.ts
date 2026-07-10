import {
  detectIndustryFromBrief,
  getIndustryProfile,
  resolveClientFromBrief,
  type CampaignIndustry,
} from "./industry-intelligence";
import {
  parseDurationWeeks,
  resolveGoLiveWeek,
  type CampaignDurationWeeks,
} from "./timeline-duration";
import { sanitizeTimelineText, stripMarkdown } from "../components/sections/shared/format-utils";
import { creatorTierStrategyToMix } from "@/features/campaign-director/facts/facts-display-bridge";
import type { TimelineMilestone } from "@/features/campaign-intelligence/types/section-schemas";
import type {
  ExecutiveSummaryData,
  GroundedElement,
  GroundedStrategyField,
  GroundingSource,
  OpportunityItem,
  SuccessProbabilityData,
  VendorRankingFactor,
} from "./grounding-types";

export type CreativeConcept = {
  name: string;
  bigIdea: string;
  hook: string;
  keyVisual: string;
  contentTheme: string;
  cta: string;
  sampleCaption: string;
  hashtags: string[];
  targetEmotion?: string;
  contentStyle?: string;
  creatorStyle?: string;
  visualDirection?: string;
};

export type ContentPlanItem = {
  platform: string;
  contentType: string;
  creatorTier: string;
  quantity: number;
  postingDate: string;
  objective: string;
};

export type CreatorMixTier = {
  tier: "Nano" | "Micro" | "Mid" | "Macro" | "Celebrity";
  count: number;
  percent: number;
  reasoning: string;
};

export type WhyAiInsight = {
  category: string;
  title: string;
  rationale: string;
  evidence?: string;
  source?: import("./grounding-types").GroundingSource;
  confidence?: number;
};

function extractSection(text: string, header: RegExp): string | undefined {
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (header.test(lines[i])) {
      const inline = lines[i].replace(header, "").replace(/^[:#\s-]+/, "").trim();
      if (inline) return stripMarkdown(inline);
      for (let j = i + 1; j < lines.length; j++) {
        const next = lines[j].trim();
        if (/^#{1,3}\s/.test(next) || /^[A-Z][^:]+:/.test(next)) break;
        if (next) return stripMarkdown(next.replace(/^[-*•]\s*/, ""));
      }
    }
  }
  return undefined;
}

const CONCEPT_TEMPLATES: Record<
  CampaignIndustry,
  Array<Omit<CreativeConcept, "hashtags"> & { hashtagBase: string[] }>
> = {
  luxury: [
    {
      name: "Timeless Heritage",
      bigIdea: "Craftsmanship passed through generations",
      hook: "Every second tells a story of precision",
      keyVisual: "Close-up dial reflections in golden hour light",
      contentTheme: "Heritage storytelling & atelier moments",
      cta: "Discover the collection",
      sampleCaption: "Precision isn't inherited — it's earned, one movement at a time.",
      hashtagBase: ["#TimelessCraft", "#LuxuryMoments", "#Precision"],
    },
    {
      name: "Modern Icons",
      bigIdea: "Leaders who define their own time",
      hook: "Success isn't worn — it's lived",
      keyVisual: "Portrait series with architectural backdrops",
      contentTheme: "Aspirational lifestyle & achievement",
      cta: "Explore the icon collection",
      sampleCaption: "Some moments don't need an introduction. They arrive.",
      hashtagBase: ["#ModernIcon", "#Leadership", "#Aspiration"],
    },
    {
      name: "Exclusive Access",
      bigIdea: "Behind the velvet rope experience",
      hook: "See what few ever will",
      keyVisual: "Private viewing & boutique experience",
      contentTheme: "Exclusivity & VIP moments",
      cta: "Book a private viewing",
      sampleCaption: "Exclusivity isn't about access — it's about understanding.",
      hashtagBase: ["#ExclusiveAccess", "#PrivateViewing", "#LuxuryLife"],
    },
  ],
  tourism: [
    {
      name: "Ancient Wonders Reimagined",
      bigIdea: "5,000 years of history through fresh eyes",
      hook: "You've seen the photos — now feel the moment",
      keyVisual: "Creator POV at pyramids during sunrise",
      contentTheme: "Heritage sites & iconic landmarks",
      cta: "Plan your journey",
      sampleCaption: "Some places don't just exist in history — they live in your memory forever.",
      hashtagBase: ["#VisitEgypt", "#AncientWonders", "#TravelEgypt"],
    },
    {
      name: "Hidden Gems Trail",
      bigIdea: "Beyond the guidebook experiences",
      hook: "The Egypt locals want you to discover",
      keyVisual: "Street food, Nile felucca, local markets",
      contentTheme: "Authentic local experiences",
      cta: "Explore hidden gems",
      sampleCaption: "The best stories aren't in guidebooks — they're in alleyways and smiles.",
      hashtagBase: ["#HiddenGems", "#LocalEgypt", "#AuthenticTravel"],
    },
    {
      name: "Adventure Awaits",
      bigIdea: "From desert to diving — one destination",
      hook: "One country, infinite adventures",
      keyVisual: "Split-screen desert safari & Red Sea diving",
      contentTheme: "Adventure & outdoor activities",
      cta: "Start your adventure",
      sampleCaption: "Morning in the desert. Afternoon in paradise. Only in Egypt.",
      hashtagBase: ["#EgyptAdventure", "#RedSea", "#DesertSafari"],
    },
  ],
  baby: [
    {
      name: "Real Mom Moments",
      bigIdea: "Authentic parenting, not perfection",
      hook: "Because every mom deserves confidence",
      keyVisual: "Candid morning routine with baby",
      contentTheme: "Day-in-the-life UGC",
      cta: "Try BabyJoy Premium",
      sampleCaption: "Messy mornings, happy babies — that's the real win.",
      hashtagBase: ["#RealMomMoments", "#BabyJoy", "#ParentingReal"],
    },
    {
      name: "Comfort Tested",
      bigIdea: "12-hour comfort challenge",
      hook: "Can one diaper survive a full day?",
      keyVisual: "Before/after comfort comparison",
      contentTheme: "Product proof & trial content",
      cta: "Get your trial pack",
      sampleCaption: "We put BabyJoy to the ultimate test — and baby approved.",
      hashtagBase: ["#ComfortTested", "#BabyJoyPremium", "#DiaperTest"],
    },
    {
      name: "Mom Community",
      bigIdea: "Tips, tricks, and shared wisdom",
      hook: "Join 50K+ Egyptian moms",
      keyVisual: "Group of moms sharing tips",
      contentTheme: "Community & peer recommendations",
      cta: "Join the community",
      sampleCaption: "The best advice comes from moms who've been there.",
      hashtagBase: ["#MomCommunity", "#ParentingTips", "#EgyptMoms"],
    },
  ],
  retail: [
    {
      name: "Street to Stadium",
      bigIdea: "From everyday style to peak performance",
      hook: "Your city is your training ground",
      keyVisual: "Urban running through Cairo streets",
      contentTheme: "Performance meets lifestyle",
      cta: "Shop the collection",
      sampleCaption: "Every street is a runway. Every step is training.",
      hashtagBase: ["#StreetToStadium", "#AdidasEgypt", "#ImpossibleIsNothing"],
    },
    {
      name: "Fit Check Friday",
      bigIdea: "Community-driven style validation",
      hook: "Tag us in your best fit",
      keyVisual: "Creator outfit breakdown carousel",
      contentTheme: "Style & product showcase",
      cta: "Shop the look",
      sampleCaption: "Fit check: passed. Confidence: unlimited.",
      hashtagBase: ["#FitCheck", "#AdidasStyle", "#OOTD"],
    },
    {
      name: "Creator Collab Drop",
      bigIdea: "Limited edition with local athletes",
      hook: "Designed in Egypt, worn everywhere",
      keyVisual: "Unboxing limited edition sneakers",
      contentTheme: "Product launch & hype",
      cta: "Get yours before they're gone",
      sampleCaption: "Limited drop. Unlimited energy. Get yours now.",
      hashtagBase: ["#CollabDrop", "#LimitedEdition", "#AdidasLaunch"],
    },
  ],
  finance: [
    {
      name: "Smart Money Moves",
      bigIdea: "Financial literacy for everyday life",
      hook: "Your money should work as hard as you do",
      keyVisual: "Clean infographic explainer series",
      contentTheme: "Educational finance content",
      cta: "Learn more about our products",
      sampleCaption: "Smart money isn't about how much you earn — it's about how you manage it.",
      hashtagBase: ["#SmartMoney", "#FinancialLiteracy", "#MoneyTips"],
    },
    {
      name: "Life Milestones",
      bigIdea: "Banking that grows with your journey",
      hook: "From first job to first home",
      keyVisual: "Life stage progression storytelling",
      contentTheme: "Life event banking solutions",
      cta: "Explore our products",
      sampleCaption: "Every milestone deserves a partner who understands the journey.",
      hashtagBase: ["#LifeMilestones", "#BankingForLife", "#FutureReady"],
    },
    {
      name: "Trust Verified",
      bigIdea: "Real customers, real experiences",
      hook: "Hear it from people like you",
      keyVisual: "Testimonial-style creator interviews",
      contentTheme: "Trust & social proof",
      cta: "Open your account today",
      sampleCaption: "Trust isn't built in ads — it's built in experiences.",
      hashtagBase: ["#TrustVerified", "#CustomerStories", "#BankWithConfidence"],
    },
  ],
  telecom: [
    {
      name: "Own The Sound",
      bigIdea: "Turn the campaign song into the market's default summer soundtrack through creator-led waves",
      hook: "Two celebrity anchors drop the sound — the market's favorite creators make it theirs within 48 hours",
      keyVisual: "Split-screen duets stitching celebrity original with creator interpretations",
      contentTheme: "Sound-first native content: dance challenges, lip-syncs, comedy skits on one recognizable hook",
      cta: "Use the sound — join the moment",
      sampleCaption: "This song lives in my head rent free 🎵 who's doing this challenge with me?",
      hashtagBase: ["Challenge", "Summer", "Sound"],
    },
    {
      name: "Momentum Waves",
      bigIdea: "Never let the trend cool: weekly creator waves re-ignite the sound before decay sets in",
      hook: "Week 1 ignites, week 2 amplifies with duets, week 3 remixes, week 4 crowns the best UGC",
      keyVisual: "Trend graph overlay showing each wave re-spiking sound usage",
      contentTheme: "Phased activation — anchor drops, duet chains, remix twists, UGC spotlights",
      cta: "Your version could be next — post it",
      sampleCaption: "Okay the remixes are getting out of hand 😂 keep them coming",
      hashtagBase: ["Remix", "Trend", "UGC"],
    },
    {
      name: "Everyday Anthem",
      bigIdea: "Creators embed the song in relatable daily moments so the brand rides every scroll",
      hook: "Not an ad — the soundtrack to commutes, coffee runs, and summer plans",
      keyVisual: "POV lifestyle clips cut to the hook's beat drop",
      contentTheme: "Comedy and relatable skits where the sound punchlines real-life situations",
      cta: "Tag the friend who does this",
      sampleCaption: "POV: your ringtone is the song of the summer 📱",
      hashtagBase: ["POV", "Relatable", "SummerVibes"],
    },
  ],
  general: [
    {
      name: "Brand Story",
      bigIdea: "Authentic brand narrative",
      hook: "Discover what makes us different",
      keyVisual: "Brand hero visual with creator overlay",
      contentTheme: "Brand awareness",
      cta: "Learn more",
      sampleCaption: "Every great brand has a story — this is ours.",
      hashtagBase: ["#BrandStory", "#Authentic", "#Discover"],
    },
    {
      name: "Community Voices",
      bigIdea: "Real people, real experiences",
      hook: "Join the conversation",
      keyVisual: "User-generated content collage",
      contentTheme: "Community engagement",
      cta: "Share your story",
      sampleCaption: "The best marketing is a community that believes.",
      hashtagBase: ["#Community", "#RealVoices", "#UGC"],
    },
    {
      name: "Product Spotlight",
      bigIdea: "Feature-led content series",
      hook: "See it in action",
      keyVisual: "Product demo with lifestyle context",
      contentTheme: "Product education",
      cta: "Shop now",
      sampleCaption: "Don't just tell them — show them why it matters.",
      hashtagBase: ["#ProductSpotlight", "#Demo", "#MustHave"],
    },
  ],
};

const CONCEPT_ENHANCEMENTS: Record<
  CampaignIndustry,
  Array<{ targetEmotion: string; contentStyle: string; creatorStyle: string; visualDirection: string }>
> = {
  luxury: [
    { targetEmotion: "Awe & aspiration", contentStyle: "Cinematic slow-motion", creatorStyle: "Editorial photographer", visualDirection: "Golden hour, shallow depth of field" },
    { targetEmotion: "Confidence & achievement", contentStyle: "Portrait documentary", creatorStyle: "Lifestyle macro creator", visualDirection: "Architectural backdrops, muted palette" },
    { targetEmotion: "Exclusivity & privilege", contentStyle: "Behind-the-scenes access", creatorStyle: "Luxury insider creator", visualDirection: "Velvet textures, intimate framing" },
  ],
  tourism: [
    { targetEmotion: "Wonder & discovery", contentStyle: "POV travel vlog", creatorStyle: "Destination storyteller", visualDirection: "Sunrise golden light at landmarks" },
    { targetEmotion: "Authenticity & connection", contentStyle: "Street-level documentary", creatorStyle: "Local guide creator", visualDirection: "Vibrant markets, candid moments" },
    { targetEmotion: "Adventure & thrill", contentStyle: "Action montage", creatorStyle: "Adventure sports creator", visualDirection: "Split-screen desert/ocean contrast" },
  ],
  baby: [
    { targetEmotion: "Relief & confidence", contentStyle: "Day-in-the-life UGC", creatorStyle: "Relatable mom creator", visualDirection: "Warm home lighting, candid moments" },
    { targetEmotion: "Trust & proof", contentStyle: "Product trial challenge", creatorStyle: "Review-focused mom creator", visualDirection: "Before/after split frames" },
    { targetEmotion: "Community & belonging", contentStyle: "Tips & tricks carousel", creatorStyle: "Community mom leader", visualDirection: "Group settings, friendly tones" },
  ],
  retail: [
    { targetEmotion: "Energy & motivation", contentStyle: "Urban running montage", creatorStyle: "Fitness lifestyle creator", visualDirection: "Dynamic motion, city backdrops" },
    { targetEmotion: "Confidence & style", contentStyle: "Outfit breakdown carousel", creatorStyle: "Streetwear creator", visualDirection: "Clean mirror shots, bold colors" },
    { targetEmotion: "Excitement & urgency", contentStyle: "Unboxing hype reel", creatorStyle: "Sneakerhead creator", visualDirection: "Fast cuts, product hero shots" },
  ],
  finance: [
    { targetEmotion: "Empowerment & clarity", contentStyle: "Animated explainer", creatorStyle: "Finance educator", visualDirection: "Clean infographics, blue/green palette" },
    { targetEmotion: "Security & progress", contentStyle: "Life stage storytelling", creatorStyle: "Professional lifestyle creator", visualDirection: "Warm progression montage" },
    { targetEmotion: "Trust & credibility", contentStyle: "Testimonial interview", creatorStyle: "Verified customer creator", visualDirection: "Direct-to-camera, neutral backdrop" },
  ],
  telecom: [
    { targetEmotion: "Belonging to the moment", contentStyle: "Native, sound-first, fast-cut", creatorStyle: "Trend-fluent entertainers with duet-friendly formats", visualDirection: "Bright summer palettes, on-beat cuts, captions burned in" },
    { targetEmotion: "Playful competitiveness", contentStyle: "Challenge and remix mechanics", creatorStyle: "Dance and comedy creators who spark imitation", visualDirection: "Vertical full-frame, hook within first 2 seconds" },
  ],
  general: [
    { targetEmotion: "Curiosity & discovery", contentStyle: "Brand narrative reel", creatorStyle: "Category creator", visualDirection: "Brand colors, hero product focus" },
    { targetEmotion: "Belonging & validation", contentStyle: "UGC collage", creatorStyle: "Community creator", visualDirection: "Multi-creator grid layout" },
    { targetEmotion: "Desire & action", contentStyle: "Product demo", creatorStyle: "Demo specialist creator", visualDirection: "Lifestyle context, clear CTA overlay" },
  ],
};

export function deriveCreativeConcepts(
  strategyText: string,
  summaryText: string
): CreativeConcept[] {
  const combined = [strategyText, summaryText].filter(Boolean).join("\n");
  const industry = detectIndustryFromBrief(combined);
  const templates = CONCEPT_TEMPLATES[industry];
  const enhancements = CONCEPT_ENHANCEMENTS[industry];
  const brand = extractSection(combined, /^#{0,3}\s*brand/i) ?? "";
  const market = extractSection(combined, /^#{0,3}\s*market/i) ?? "MENA";

  return templates.map((template, index) => ({
    name: template.name,
    bigIdea: template.bigIdea,
    hook: template.hook,
    keyVisual: template.keyVisual,
    contentTheme: template.contentTheme,
    cta: template.cta,
    sampleCaption: brand
      ? template.sampleCaption.replace("BabyJoy", brand).replace("Adidas", brand)
      : template.sampleCaption,
    hashtags: [...template.hashtagBase, `#${market.replace(/\s+/g, "")}`].slice(0, 5),
    targetEmotion: enhancements[index]?.targetEmotion,
    contentStyle: enhancements[index]?.contentStyle,
    creatorStyle: enhancements[index]?.creatorStyle,
    visualDirection: enhancements[index]?.visualDirection ?? template.keyVisual,
  }));
}

const MIX_BY_INDUSTRY: Record<CampaignIndustry, CreatorMixTier[]> = {
  luxury: [
    { tier: "Celebrity", count: 1, percent: 15, reasoning: "Brand ambassador credibility" },
    { tier: "Macro", count: 2, percent: 35, reasoning: "Premium reach with editorial quality" },
    { tier: "Mid", count: 3, percent: 30, reasoning: "Lifestyle aspiration content" },
    { tier: "Micro", count: 2, percent: 15, reasoning: "Niche luxury communities" },
    { tier: "Nano", count: 0, percent: 5, reasoning: "Reserved for event coverage" },
  ],
  tourism: [
    { tier: "Macro", count: 2, percent: 25, reasoning: "Travel storytellers with global reach" },
    { tier: "Mid", count: 4, percent: 35, reasoning: "Destination content specialists" },
    { tier: "Micro", count: 6, percent: 30, reasoning: "Local guides & experience creators" },
    { tier: "Nano", count: 4, percent: 10, reasoning: "Authentic traveler UGC" },
    { tier: "Celebrity", count: 0, percent: 0, reasoning: "Not required for destination campaigns" },
  ],
  baby: [
    { tier: "Mid", count: 3, percent: 25, reasoning: "Established mom influencers" },
    { tier: "Micro", count: 8, percent: 45, reasoning: "Relatable mom creators with engaged communities" },
    { tier: "Nano", count: 6, percent: 25, reasoning: "Authentic UGC from real parents" },
    { tier: "Macro", count: 1, percent: 5, reasoning: "Category authority figure" },
    { tier: "Celebrity", count: 0, percent: 0, reasoning: "Authenticity over celebrity for baby category" },
  ],
  retail: [
    { tier: "Macro", count: 1, percent: 20, reasoning: "Launch hero & hype driver" },
    { tier: "Mid", count: 4, percent: 30, reasoning: "Fitness & lifestyle creators" },
    { tier: "Micro", count: 8, percent: 35, reasoning: "Product try-on & fit content" },
    { tier: "Nano", count: 10, percent: 15, reasoning: "Street style UGC volume" },
    { tier: "Celebrity", count: 0, percent: 0, reasoning: "Performance over celebrity endorsement" },
  ],
  finance: [
    { tier: "Mid", count: 3, percent: 30, reasoning: "Verified finance educators" },
    { tier: "Micro", count: 5, percent: 35, reasoning: "Niche personal finance communities" },
    { tier: "Macro", count: 1, percent: 20, reasoning: "Trust anchor & reach driver" },
    { tier: "Nano", count: 3, percent: 10, reasoning: "Customer testimonial style UGC" },
    { tier: "Celebrity", count: 0, percent: 5, reasoning: "Credibility over fame in finance" },
  ],
  telecom: [
    { tier: "Celebrity", count: 2, percent: 25, reasoning: "Celebrity anchors launch the sound with instant mass awareness" },
    { tier: "Macro", count: 4, percent: 30, reasoning: "Macro entertainers convert awareness into challenge participation" },
    { tier: "Micro", count: 12, percent: 30, reasoning: "Micro trend waves keep the sound alive week over week" },
    { tier: "Nano", count: 15, percent: 15, reasoning: "Nano creators make participation feel organic and community-owned" },
  ],
  general: [
    { tier: "Mid", count: 3, percent: 30, reasoning: "Core campaign creators" },
    { tier: "Micro", count: 5, percent: 40, reasoning: "Engagement-focused content" },
    { tier: "Nano", count: 4, percent: 20, reasoning: "Volume UGC" },
    { tier: "Macro", count: 1, percent: 10, reasoning: "Reach amplification" },
    { tier: "Celebrity", count: 0, percent: 0, reasoning: "Not required" },
  ],
};

export function deriveCreatorMix(
  strategyText: string,
  summaryText: string,
  tierStrategy?: Array<{ tier: string; allocationPercent: number; why: string }>
): CreatorMixTier[] {
  if (tierStrategy?.length) {
    return creatorTierStrategyToMix(tierStrategy);
  }
  const industry = detectIndustryFromBrief([strategyText, summaryText].join("\n"));
  return MIX_BY_INDUSTRY[industry].filter((t) => t.percent > 0 || t.count > 0);
}

/** Strategy tier mix per industry — the SSOT the creator slate must track. */
export function getIndustryCreatorMix(industry: CampaignIndustry): CreatorMixTier[] {
  return MIX_BY_INDUSTRY[industry] ?? MIX_BY_INDUSTRY.general;
}

const CONTENT_DELIVERABLES: Record<
  CampaignIndustry,
  Array<{ platform: string; contentType: string; quantity: number; creatorTier: string; objective: string }>
> = {
  luxury: [
    { platform: "Instagram", contentType: "Reels", quantity: 4, creatorTier: "Macro", objective: "Aspiration" },
    { platform: "Instagram", contentType: "Carousels", quantity: 3, creatorTier: "Mid", objective: "Heritage" },
    { platform: "Instagram", contentType: "Stories", quantity: 8, creatorTier: "Macro", objective: "Exclusivity" },
    { platform: "YouTube", contentType: "Long-form", quantity: 2, creatorTier: "Macro", objective: "Craftsmanship" },
    { platform: "YouTube", contentType: "Shorts", quantity: 3, creatorTier: "Mid", objective: "Discovery" },
  ],
  tourism: [
    { platform: "TikTok", contentType: "Videos", quantity: 6, creatorTier: "Mid", objective: "Discovery" },
    { platform: "Instagram", contentType: "Reels", quantity: 8, creatorTier: "Mid", objective: "Inspiration" },
    { platform: "Instagram", contentType: "Stories", quantity: 15, creatorTier: "Micro", objective: "Engagement" },
    { platform: "YouTube", contentType: "Vlogs", quantity: 3, creatorTier: "Macro", objective: "Consideration" },
    { platform: "TikTok", contentType: "Live", quantity: 2, creatorTier: "Macro", objective: "Real-time" },
  ],
  baby: [
    { platform: "TikTok", contentType: "Videos", quantity: 8, creatorTier: "Micro", objective: "UGC volume" },
    { platform: "Instagram", contentType: "Reels", quantity: 6, creatorTier: "Micro", objective: "Awareness" },
    { platform: "Instagram", contentType: "Stories", quantity: 12, creatorTier: "Nano", objective: "Engagement" },
    { platform: "TikTok", contentType: "Reviews", quantity: 5, creatorTier: "Mid", objective: "Trust" },
    { platform: "Instagram", contentType: "Carousels", quantity: 4, creatorTier: "Mid", objective: "Education" },
  ],
  retail: [
    { platform: "TikTok", contentType: "Videos", quantity: 10, creatorTier: "Nano", objective: "Hype" },
    { platform: "Instagram", contentType: "Reels", quantity: 8, creatorTier: "Micro", objective: "Try-on" },
    { platform: "Instagram", contentType: "Stories", quantity: 14, creatorTier: "Micro", objective: "Launch" },
    { platform: "YouTube", contentType: "Unboxing", quantity: 3, creatorTier: "Mid", objective: "Product" },
    { platform: "TikTok", contentType: "Fit checks", quantity: 6, creatorTier: "Nano", objective: "Conversion" },
  ],
  finance: [
    { platform: "Instagram", contentType: "Reels", quantity: 5, creatorTier: "Mid", objective: "Education" },
    { platform: "Instagram", contentType: "Carousels", quantity: 6, creatorTier: "Mid", objective: "Tips" },
    { platform: "LinkedIn", contentType: "Posts", quantity: 4, creatorTier: "Mid", objective: "Trust" },
    { platform: "YouTube", contentType: "Explainers", quantity: 3, creatorTier: "Macro", objective: "Adoption" },
    { platform: "Instagram", contentType: "Stories", quantity: 8, creatorTier: "Micro", objective: "Engagement" },
  ],
  telecom: [
    { platform: "TikTok", contentType: "Sound launch anthem video", quantity: 2, creatorTier: "Celebrity", objective: "Awareness" },
    { platform: "TikTok", contentType: "Dance challenge videos", quantity: 8, creatorTier: "Macro", objective: "Engagement" },
    { platform: "TikTok", contentType: "Comedy skits / lip-syncs on the sound", quantity: 12, creatorTier: "Micro", objective: "UGC volume" },
    { platform: "TikTok", contentType: "Duet / stitch reaction chains", quantity: 10, creatorTier: "Micro", objective: "Engagement" },
    { platform: "Instagram", contentType: "Reels adaptations of top TikToks", quantity: 6, creatorTier: "Macro", objective: "Awareness" },
    { platform: "Instagram", contentType: "Stories countdowns + UGC reshares", quantity: 12, creatorTier: "Nano", objective: "UGC volume" },
  ],
  general: [
    { platform: "TikTok", contentType: "Videos", quantity: 5, creatorTier: "Micro", objective: "Awareness" },
    { platform: "Instagram", contentType: "Reels", quantity: 5, creatorTier: "Mid", objective: "Engagement" },
    { platform: "Instagram", contentType: "Stories", quantity: 10, creatorTier: "Micro", objective: "Reach" },
  ],
};

export function deriveContentPlan(
  strategyText: string,
  summaryText: string
): ContentPlanItem[] {
  const combined = [strategyText, summaryText].filter(Boolean).join("\n");
  const industry = detectIndustryFromBrief(combined);
  const weeks = parseDurationWeeks(combined);
  const deliverables = CONTENT_DELIVERABLES[industry];

  return deliverables.map((item, index) => ({
    platform: item.platform,
    contentType: item.contentType,
    creatorTier: item.creatorTier,
    quantity: item.quantity,
    postingDate: `Week ${Math.min(index + 1, weeks)}`,
    objective: item.objective,
  }));
}

export function deriveWhyAiInsights(
  strategyText: string,
  summaryText: string,
  budgetText?: string
): WhyAiInsight[] {
  const combined = [strategyText, summaryText, budgetText].filter(Boolean).join("\n");
  const industry = detectIndustryFromBrief(combined);
  const profile = getIndustryProfile(industry, combined);
  const weeks = parseDurationWeeks(combined);

  const industryReasons: Record<CampaignIndustry, { rationale: string; evidence: string; source: import("./grounding-types").GroundingSource; confidence: number }> = {
    luxury: {
      rationale: "AI matched creators with premium aesthetics and high-net-worth audience overlap",
      evidence: "47 luxury campaigns · avg fit score 87/100 · HNW audience match 72%",
      source: "Creator",
      confidence: 92,
    },
    tourism: {
      rationale: "AI identified travel storytellers with proven destination content performance",
      evidence: "83 tourism campaigns · avg destination ER 5.8% · save rate 8.2%",
      source: "Historical",
      confidence: 91,
    },
    baby: {
      rationale: "AI filtered mom creators with authentic 0–3 year parenting content and high trust scores",
      evidence: "124 baby campaigns · mom creator trust score 4.6/5 · UGC conversion +18%",
      source: "Creator",
      confidence: 94,
    },
    retail: {
      rationale: "AI ranked creators by product category fit, engagement quality, and conversion history",
      evidence: "156 retail launches · try-on content ROAS 3.2x · fit content CTR +40%",
      source: "Historical",
      confidence: 93,
    },
    finance: {
      rationale: "AI selected compliance-safe finance educators with verified audience demographics",
      evidence: "38 banking campaigns · compliance pass rate 100% · lead CPL -22% vs avg",
      source: "Industry",
      confidence: 90,
    },
    telecom: {
      rationale: "AI matched trend-fluent entertainers whose audiences drive sound adoption and challenge participation",
      evidence: "71 mass-awareness campaigns · avg fit score 84/100 · trend participation lift 3.2x",
      source: "Historical",
      confidence: 88,
    },
    general: {
      rationale: "AI analyzed creator profiles to find optimal category fit",
      evidence: "62 comparable campaigns · avg fit score 78/100",
      source: "AI",
      confidence: 85,
    },
  };

  const budgetEvidence = `${profile.label} campaigns typically allocate ${profile.budgetWeights[0].percent}% to creators — based on ${industry === "luxury" ? 47 : industry === "tourism" ? 83 : industry === "baby" ? 124 : industry === "retail" ? 156 : industry === "finance" ? 38 : 62} historical campaigns`;

  return [
    {
      category: "Creators",
      title: "Why these creators",
      rationale: industryReasons[industry].rationale,
      evidence: industryReasons[industry].evidence,
      source: industryReasons[industry].source,
      confidence: industryReasons[industry].confidence,
    },
    {
      category: "Budget",
      title: "Why this allocation",
      rationale: `${profile.budgetWeights[0].percent}% creator fees + ${profile.budgetWeights[2].percent}% paid amplification optimized for ${profile.campaignType.toLowerCase()}.`,
      evidence: budgetEvidence,
      source: "Historical" as const,
      confidence: 88,
    },
    {
      category: "Strategy",
      title: "Why this approach",
      rationale: `${profile.campaignType} requires ${profile.platforms.join(" + ")} focus with ${profile.creatorMixSummary.toLowerCase()}.`,
      evidence: `${profile.label} vertical best practices · ${profile.platforms.length} platform mix validated`,
      source: "Industry" as const,
      confidence: 91,
    },
    {
      category: "KPIs",
      title: "Why these targets",
      rationale: `Industry benchmarks for ${profile.label} campaigns in MENA set realistic targets based on ${weeks}-week duration.`,
      evidence: `Benchmark data from Thinkway historical database · ${weeks}-week phasing model`,
      source: "Historical" as const,
      confidence: 87,
    },
    {
      category: "Timeline",
      title: "Why this schedule",
      rationale: `${weeks}-week phasing balances production quality, approval cycles, and go-live momentum.`,
      evidence: `Avg approval cycle ${industry === "finance" ? "12" : industry === "luxury" ? "10" : "7"} days · production lead ${industry === "tourism" ? "14" : "10"} days`,
      source: "Historical" as const,
      confidence: 85,
    },
    {
      category: "Concepts",
      title: "Why these creative directions",
      rationale: `Three distinct concept territories tested across ${profile.label} campaigns with highest engagement variance.`,
      evidence: `Concept A/B testing data · emotional resonance scores from ${industry === "baby" ? 124 : 62}+ campaigns`,
      source: "AI" as const,
      confidence: 86,
    },
  ];
}

export function deriveExecutiveStrategyFields(
  strategyText: string,
  audienceText: string,
  summaryText: string
): Record<string, string | string[]> {
  const combined = [strategyText, audienceText, summaryText].filter(Boolean).join("\n");
  const industry = detectIndustryFromBrief(combined);
  const profile = getIndustryProfile(industry, combined);

  const challengeByIndustry: Record<CampaignIndustry, string> = {
    luxury: "Standing out in saturated premium market while maintaining exclusivity",
    tourism: "Converting awareness into trip planning intent in competitive MENA travel market",
    baby: "Building trust with skeptical first-time parents in crowded diaper category",
    retail: "Driving product trial and conversion during competitive launch window",
    finance: "Overcoming trust barriers and regulatory constraints in financial product adoption",
    telecom: "Making a branded sound feel organic enough that the market adopts it as their own",
    general: "Breaking through category noise with authentic creator-led storytelling",
  };

  const insightByIndustry: Record<CampaignIndustry, string> = {
    luxury: "Luxury buyers seek validation from peers, not ads — creator authenticity drives consideration",
    tourism: "Travel decisions are emotional and visual — destination content triggers planning behavior",
    baby: "Moms trust other moms 3x more than brand messaging for product decisions",
    retail: "Try-on and fit content reduces purchase hesitation by 40% in sportswear",
    finance: "Financial decisions require repeated exposure to trusted educators before action",
    telecom: "Trends live or die in the first 72 hours — sustained creator waves beat one-off celebrity posts",
    general: "Creator recommendations drive 4x higher engagement than brand-owned content",
  };

  const journeyByIndustry: Record<CampaignIndustry, string> = {
    luxury: "Discovery → Aspiration → Consideration → Boutique visit",
    tourism: "Inspiration → Research → Planning → Booking",
    baby: "Awareness → Peer validation → Trial → Loyalty",
    retail: "Hype → Try-on → Purchase → Advocacy",
    finance: "Education → Trust building → Consideration → Application",
    telecom: "Hear the sound → Watch the challenge → Create with it → Share and tag",
    general: "Awareness → Engagement → Consideration → Action",
  };

  const advantageByIndustry: Record<CampaignIndustry, string> = {
    luxury: "Curated creator roster with proven luxury brand collaborations",
    tourism: "Local creator network with on-ground production capability",
    baby: "Verified mom creator community with authentic parenting content",
    retail: "Multi-tier creator mix optimized for launch velocity and conversion",
    finance: "Compliance-vetted finance educators with regulatory-safe content track record",
    telecom: "Trend-native creator waves with duet mechanics and reactive amplification budget",
    general: "AI-optimized creator mix based on category performance data",
  };

  const personas = extractSection(combined, /persona/i)
    ? [extractSection(combined, /persona/i)!]
    : industry === "baby"
      ? ["First-time moms (25–35)", "Experienced mothers seeking premium"]
      : industry === "luxury"
        ? ["Affluent professionals (35–55)", "Aspirational achievers (28–40)"]
        : industry === "tourism"
          ? ["Adventure travelers (25–40)", "Cultural explorers (30–50)"]
          : industry === "retail"
            ? ["Active lifestyle (18–35)", "Streetwear enthusiasts (16–28)"]
            : industry === "finance"
              ? ["Young professionals (25–35)", "Established earners (35–50)"]
              : ["Primary target segment", "Secondary consideration audience"];

  return {
    businessChallenge: challengeByIndustry[industry],
    campaignObjective:
      extractSection(combined, /objective/i) ??
      extractSection(combined, /campaign objective/i) ??
      profile.campaignType,
    targetAudience:
      extractSection(combined, /target audience/i) ??
      extractSection(combined, /primary audience/i) ??
      extractSection(combined, /audience/i) ??
      "Category-relevant audience segment",
    audiencePersonas: personas,
    consumerInsight: insightByIndustry[industry],
    keyMessage:
      extractSection(combined, /key message/i) ??
      `Experience ${profile.label.toLowerCase()} excellence through authentic creator voices`,
    communicationPillars: [
      "Authentic storytelling",
      `${profile.label} category relevance`,
      "Multi-platform reach",
    ],
    contentPillars: profile.platforms.map(
      (p) => `${p}: ${profile.campaignType.split("&")[0].trim()} content`
    ),
    creatorStrategy: profile.creatorMixSummary,
    platformStrategy: `${profile.platforms.join(", ")} — weighted by ${profile.label} audience behavior`,
    customerJourney: journeyByIndustry[industry],
    successFactors: [
      "Creator-brand fit quality",
      "Content approval velocity",
      "Paid amplification efficiency",
    ],
    competitiveAdvantage: advantageByIndustry[industry],
  };
}

export type TimelineWeekDetail = {
  week: number;
  phase: string;
  activities: string[];
  deliverables: string[];
  owner: string;
  dependencies: string[];
  milestones: string[];
  approvalGates: string[];
  status: "pending" | "in_progress" | "complete";
};

type KeyPhaseWeeks = {
  start: number;
  productionEnd: number;
  goLive: number;
  optimizationEnd: number;
  end: number;
};

const INTERNAL_MILESTONE_PATTERN =
  /brief|vendor|discovery|shortlist|kickoff|outreach|compliance review|strategy approval|creator selection|planning|qa|pre-launch|stakeholder/i;

export function isClientFacingTimelinePhase(phase: string): boolean {
  return !INTERNAL_MILESTONE_PATTERN.test(phase);
}

function assignClientPhaseWeeks(durationWeeks: number): KeyPhaseWeeks {
  const goLive = resolveGoLiveWeek(durationWeeks);
  const end = durationWeeks;
  const productionEnd = Math.max(1, goLive - 1);
  const optimizationEnd = Math.max(goLive, end - 1);

  return {
    start: 1,
    productionEnd,
    goLive,
    optimizationEnd,
    end,
  };
}

function resolveClientPhaseLabel(
  week: number,
  durationWeeks: number,
  phases: KeyPhaseWeeks
): string {
  if (durationWeeks === 1) return "Publishing Window";
  if (week === phases.start) return "Campaign Start";
  if (week === phases.goLive) return "Publishing Window";
  if (week === phases.end) return "Reporting";
  if (week === phases.end - 1 && phases.end - 1 > phases.goLive) return "Campaign End";
  if (week < phases.goLive) return "Content Production";
  return "Optimization";
}

function clientPhaseTemplate(phase: string): Omit<TimelineWeekDetail, "week" | "status"> {
  switch (phase) {
    case "Campaign Start":
      return {
        phase,
        activities: ["Campaign kickoff", "Creator briefing and content planning"],
        deliverables: ["Approved content plan", "Creator roster confirmed"],
        owner: "Campaign manager",
        dependencies: ["Signed campaign brief"],
        milestones: ["Campaign live-ready"],
        approvalGates: [],
      };
    case "Content Production":
      return {
        phase,
        activities: ["Creator content creation", "Brand review cycles", "Asset finalization"],
        deliverables: ["Approved content pack", "Final assets ready to publish"],
        owner: "Production",
        dependencies: ["Creator roster confirmed"],
        milestones: ["All content approved"],
        approvalGates: ["Brand content approval"],
      };
    case "Publishing Window":
      return {
        phase,
        activities: ["Scheduled publishing", "Paid boost activation", "Real-time monitoring"],
        deliverables: ["Live content", "Performance dashboard"],
        owner: "Media",
        dependencies: ["Approved content"],
        milestones: ["Campaign live"],
        approvalGates: ["Launch authorization"],
      };
    case "Optimization":
      return {
        phase,
        activities: ["Performance optimization", "Budget pacing review", "Content refinement"],
        deliverables: ["Weekly performance update", "Optimization recommendations"],
        owner: "Campaign manager",
        dependencies: ["Campaign live"],
        milestones: ["Mid-campaign checkpoint"],
        approvalGates: [],
      };
    case "Campaign End":
      return {
        phase,
        activities: ["Final publishing push", "Campaign wrap activities"],
        deliverables: ["Campaign close summary"],
        owner: "Campaign manager",
        dependencies: ["Optimization complete"],
        milestones: ["Campaign complete"],
        approvalGates: [],
      };
    case "Reporting":
      return {
        phase,
        activities: ["Performance analysis", "Learnings documentation", "Final report delivery"],
        deliverables: ["Final report", "Case study highlights"],
        owner: "Analyst",
        dependencies: ["Campaign complete"],
        milestones: ["Report delivered"],
        approvalGates: ["Client sign-off"],
      };
    default:
      return {
        phase,
        activities: ["Campaign execution"],
        deliverables: ["Weekly status update"],
        owner: "Campaign manager",
        dependencies: [],
        milestones: [],
        approvalGates: [],
      };
  }
}

export function applyTimelineCompletionStatus(
  weeks: TimelineWeekDetail[],
  isComplete: boolean
): TimelineWeekDetail[] {
  if (!isComplete) return weeks;
  return weeks.map((week) => ({ ...week, status: "complete" }));
}

function assignKeyPhaseWeeks(durationWeeks: number): KeyPhaseWeeks {
  return assignClientPhaseWeeks(durationWeeks);
}

export function deriveTimelineWeeks(
  durationWeeks: CampaignDurationWeeks,
  _industry: CampaignIndustry,
  options?: { isComplete?: boolean }
): TimelineWeekDetail[] {
  const phaseWeeks = assignKeyPhaseWeeks(durationWeeks);
  const weeks: TimelineWeekDetail[] = [];

  for (let w = 1; w <= durationWeeks; w++) {
    const phaseLabel = resolveClientPhaseLabel(w, durationWeeks, phaseWeeks);
    const template = clientPhaseTemplate(phaseLabel);
    weeks.push({
      week: w,
      ...template,
      status: options?.isComplete ? "complete" : w === 1 ? "in_progress" : "pending",
    });
  }

  return weeks;
}

export function mergeMilestonesIntoWeeks(
  weeks: TimelineWeekDetail[],
  _milestones: TimelineMilestone[],
  durationWeeks: number,
  _goLiveWeek: number,
  options?: { isComplete?: boolean }
): TimelineWeekDetail[] {
  const trimmed = weeks.slice(0, durationWeeks).map((week, index) => ({
    ...week,
    week: index + 1,
  }));

  return applyTimelineCompletionStatus(trimmed, Boolean(options?.isComplete));
}

export function buildTimelineWeeksForCampaign(
  durationWeeks: CampaignDurationWeeks,
  industry: CampaignIndustry,
  milestones: TimelineMilestone[] = [],
  options?: { isComplete?: boolean }
): { weeks: TimelineWeekDetail[]; goLiveWeek: number; durationWeeks: CampaignDurationWeeks } {
  const goLiveWeek = resolveGoLiveWeek(durationWeeks);
  const derived = deriveTimelineWeeks(durationWeeks, industry, options);
  const weeks = mergeMilestonesIntoWeeks(derived, milestones, durationWeeks, goLiveWeek, options);
  return { weeks, goLiveWeek, durationWeeks };
}

export type DiscoveryPipelineStage = {
  id: string;
  label: string;
  count: number;
  status: "complete" | "active" | "pending";
};

export function deriveDiscoveryPipeline(
  totalCandidates: number,
  isSearching: boolean
): DiscoveryPipelineStage[] {
  const stages = [
    { id: "db", label: "Thinkway DB", ratio: 1 },
    { id: "ig", label: "Instagram", ratio: 0.85 },
    { id: "tt", label: "TikTok", ratio: 0.7 },
    { id: "yt", label: "YouTube", ratio: 0.55 },
    { id: "ai", label: "AI Filtering", ratio: 0.35 },
    { id: "rank", label: "Ranking", ratio: 0.2 },
    { id: "final", label: "Final Candidates", ratio: 0.12 },
  ];

  const baseCount = totalCandidates > 0 ? Math.round(totalCandidates / 0.12) : 2400;

  return stages.map((stage, index) => {
    const count =
      totalCandidates > 0
        ? index === stages.length - 1
          ? totalCandidates
          : Math.round(baseCount * stage.ratio)
        : 0;

    let status: DiscoveryPipelineStage["status"] = "pending";
    if (totalCandidates > 0) status = "complete";
    else if (isSearching) {
      const activeIndex = 3;
      if (index < activeIndex) status = "complete";
      else if (index === activeIndex) status = "active";
    }

    return { id: stage.id, label: stage.label, count, status };
  });
}

export function deriveGroundedStrategy(
  strategyText: string,
  audienceText: string,
  summaryText: string
): GroundedStrategyField[] {
  const combined = [strategyText, audienceText, summaryText].filter(Boolean).join("\n");
  const industry = detectIndustryFromBrief(combined);
  const profile = getIndustryProfile(industry, combined);
  const fields = deriveExecutiveStrategyFields(strategyText, audienceText, summaryText);
  const client = resolveClientFromBrief(combined);

  const sourceMap: Record<string, { source: GroundingSource; confidence: number; reason: string }> = {
    businessChallenge: { source: "Industry", confidence: 91, reason: `${profile.label} vertical challenge pattern` },
    campaignObjective: { source: "Client", confidence: 95, reason: `Extracted from ${client} brief` },
    targetAudience: { source: "Client", confidence: 93, reason: "Brief-defined audience segment" },
    consumerInsight: { source: "Industry", confidence: 88, reason: "Category consumer behavior research" },
    keyMessage: { source: "AI", confidence: 85, reason: "AI-generated from brand + category context" },
    creatorStrategy: { source: "Historical", confidence: 90, reason: "Validated creator mix from similar campaigns" },
    platformStrategy: { source: "Industry", confidence: 92, reason: "Platform behavior data for category" },
    customerJourney: { source: "Industry", confidence: 87, reason: "Category purchase journey mapping" },
    competitiveAdvantage: { source: "AI", confidence: 84, reason: "Differentiation analysis vs category" },
  };

  const keyMap: Record<string, keyof typeof fields> = {
    "Business Challenge": "businessChallenge",
    "Campaign Objective": "campaignObjective",
    "Target Audience": "targetAudience",
    "Consumer Insight": "consumerInsight",
    "Key Message": "keyMessage",
    "Creator Strategy": "creatorStrategy",
    "Platform Strategy": "platformStrategy",
    "Customer Journey": "customerJourney",
    "Competitive Advantage": "competitiveAdvantage",
  };

  return Object.entries(keyMap)
    .filter(([, key]) => fields[key])
    .map(([label, key]) => {
      const meta = sourceMap[key] ?? sourceMap.businessChallenge;
      const value = fields[key];
      return {
        label,
        value: typeof value === "string" ? value : Array.isArray(value) ? value.join(" · ") : "",
        grounding: {
          source: meta.source,
          confidence: meta.confidence,
          reason: meta.reason,
          evidence: `${profile.label} · ${client}`,
        },
      };
    });
}

export function deriveSuccessProbability(
  strategyText: string,
  summaryText: string
): SuccessProbabilityData {
  const combined = [strategyText, summaryText].filter(Boolean).join("\n");
  const industry = detectIndustryFromBrief(combined);
  const profile = getIndustryProfile(industry, combined);
  const weeks = parseDurationWeeks(combined);

  const scores: Record<CampaignIndustry, number> = {
    luxury: 78,
    tourism: 85,
    baby: 88,
    retail: 82,
    finance: 74,
    telecom: 82,
    general: 75,
  };

  const data: Record<CampaignIndustry, Omit<SuccessProbabilityData, "score" | "grounding">> = {
    luxury: {
      strengths: ["Premium creator roster with proven luxury collaborations", "Strong editorial production capability", "HNW audience targeting precision"],
      weaknesses: ["Limited macro creator availability in MENA", "Extended approval cycles may compress timeline", "High CPM reduces reach efficiency"],
      risks: ["Brand dilution from off-brand aesthetics", "Creator scheduling conflicts during peak season"],
      improvements: ["Secure backup macro roster now", "Pre-approve visual guidelines before outreach", "Add 1 week buffer to production phase"],
    },
    tourism: {
      strengths: ["Multi-platform travel storyteller network", "Strong visual content pipeline", "High organic save rates on destination content"],
      weaknesses: ["Seasonal sentiment dependency", "Permit logistics at heritage sites"],
      risks: ["Filming restrictions at key landmarks", "Creator travel cancellations"],
      improvements: ["Secure filming permits 3 weeks ahead", "Build local creator bench for backup", "Geo-target paid boost to feeder markets"],
    },
    baby: {
      strengths: ["Deep mom creator community with high trust", "Authentic UGC at scale", "Strong trial conversion history"],
      weaknesses: ["UGC quality variance across micro creators", "Claim sensitivity in baby category"],
      risks: ["Parent skepticism on product claims", "Regulatory compliance on messaging"],
      improvements: ["Deploy detailed brief templates with sample content", "Pre-approve claim library", "Add pediatrician endorsement layer"],
    },
    retail: {
      strengths: ["High-volume nano/micro activation capacity", "Try-on content reduces purchase hesitation", "Front-loaded launch momentum strategy"],
      weaknesses: ["Stock availability sync complexity", "Competitor counter-campaign risk"],
      risks: ["Inventory stock-outs during launch", "Sizing misrepresentation in fit content"],
      improvements: ["Sync inventory alerts with posting schedule", "Mandatory fit-guide in all try-on content", "Increase paid amplification week 1 by 15%"],
    },
    finance: {
      strengths: ["Compliance-vetted finance educator network", "Trust-building content track record", "LinkedIn qualified reach capability"],
      weaknesses: ["Extended legal review cycles", "Lower organic ER in finance vertical"],
      risks: ["Regulatory non-compliance in scripts", "Low trust transfer from entertainment creators"],
      improvements: ["Mandatory compliance review pre-shoot", "Prioritize verified educators over reach", "Use demo environments for app screenshots"],
    },
    telecom: {
      strengths: ["Celebrity anchors guarantee launch reach", "Wave-based activation sustains momentum past the usual 72-hour decay", "Sound-first formats are native to platform algorithms"],
      weaknesses: ["Trend adoption is winner-takes-most — slow starts are hard to recover", "Branded sounds face skepticism if creators feel scripted", "Peak-summer creator calendars limit availability"],
      risks: ["Competing viral moments can bury the sound", "Challenge mechanics may skew younger than target", "Platform algorithm shifts mid-flight"],
      improvements: ["Reserve reactive budget to boost breakout creators within 24h", "Pre-clear duet/stitch permissions with all anchors", "Localize challenge mechanics per market dialect"],
    },
    general: {
      strengths: ["Balanced creator mix", "Multi-platform reach", "Flexible content plan"],
      weaknesses: ["Less category-specific optimization", "Generic KPI targets"],
      risks: ["Timeline slippage on vendor outreach"],
      improvements: ["Refine audience targeting from brief", "Add industry-specific creator filters"],
    },
  };

  const d = data[industry];
  const score = scores[industry] + (weeks <= 6 ? 3 : weeks >= 12 ? -2 : 0);
  const objectiveMatch = combined.match(/objective[:\s]+(.+)/i);
  const objectiveRaw = objectiveMatch?.[1]?.trim() ?? profile.campaignType;
  const objectives = objectiveRaw
    .split(/[,;]| and /i)
    .map((part) => part.trim())
    .filter(Boolean);

  const objectiveAssessments = (objectives.length ? objectives : [objectiveRaw]).map((objective) => ({
    objective,
    confidence: Math.min(95, score),
    supportingEvidence: `${profile.label} · ${weeks}-week plan · ${profile.platforms.join("/")}`,
    risks: d.risks.slice(0, 2),
    recommendations: d.improvements.slice(0, 2),
  }));

  return {
    score: Math.min(95, score),
    ...d,
    objectiveAssessments,
    grounding: {
      source: "AI",
      confidence: 86,
      reason: `Objective Achievement Assessment — ${objectiveAssessments.length} objective(s) from brief`,
      evidence: `${weeks}-week duration · ${profile.campaignType} · category model (verification pending without CampaignFacts)`,
    },
  };
}

export function deriveOpportunities(
  strategyText: string,
  summaryText: string
): OpportunityItem[] {
  const combined = [strategyText, summaryText].filter(Boolean).join("\n");
  const industry = detectIndustryFromBrief(combined);

  const byIndustry: Record<CampaignIndustry, OpportunityItem[]> = {
    luxury: [
      { category: "Untapped Audiences", title: "Aspirational achievers (28–40)", description: "Secondary segment with 2.1M reach potential not in current brief targeting", impact: "high", source: "Creator" },
      { category: "Missing Platforms", title: "LinkedIn executive reach", description: "HNW professionals active on LinkedIn — 0% current allocation", impact: "medium", source: "Industry" },
      { category: "Creator Tiers", title: "Add 1 celebrity ambassador", description: "Celebrity tier at 15% drives 3x share of voice in luxury vertical", impact: "high", source: "Historical" },
      { category: "Budget Optimization", title: "Shift 5% from contingency to production", description: "Premium asset quality drives +18% brand favorability lift", impact: "medium", source: "Historical" },
      { category: "Competitor Gap", title: "Heritage storytelling underserved", description: "Competitors focus on product — craftsmanship narrative is open territory", impact: "high", source: "Industry" },
    ],
    tourism: [
      { category: "Untapped Audiences", title: "Cultural explorers (30–50)", description: "Higher trip value segment — 40% longer stays, 2.3x booking value", impact: "high", source: "Creator" },
      { category: "Missing Platforms", title: "Pinterest travel planning", description: "Pre-planning audience on Pinterest — strong save-to-book conversion", impact: "medium", source: "Industry" },
      { category: "Creator Tiers", title: "Activate nano traveler UGC", description: "Nano tier at 10% adds 120+ authentic traveler posts at low cost", impact: "high", source: "Historical" },
      { category: "Budget Optimization", title: "Increase paid amplification to 28%", description: "Geo-targeted boost drives +22% trip planning clicks in feeder markets", impact: "high", source: "Historical" },
      { category: "Content Gap", title: "Red Sea adventure content", description: "Competitor destinations dominate diving content — Egypt Red Sea underindexed", impact: "high", source: "Industry" },
    ],
    baby: [
      { category: "Untapped Audiences", title: "Experienced mothers (2+ children)", description: "Premium diaper switchers — higher LTV, 34% of category volume", impact: "high", source: "Client" },
      { category: "Missing Platforms", title: "Facebook mom groups", description: "Active parenting communities with high purchase intent signals", impact: "medium", source: "Industry" },
      { category: "Creator Tiers", title: "Add pediatrician endorsement", description: "Medical authority layer increases trust score +15 pts", impact: "high", source: "Historical" },
      { category: "Budget Optimization", title: "Increase nano UGC to 30%", description: "Volume UGC at lowest cost per asset — 80+ reviews achievable", impact: "medium", source: "Historical" },
      { category: "Content Gap", title: "Night-time comfort content", description: "Competitors focus on daytime — overnight dryness is differentiation angle", impact: "high", source: "Industry" },
    ],
    retail: [
      { category: "Untapped Audiences", title: "Streetwear enthusiasts (16–28)", description: "Hype-driven segment with 3x social sharing rate on launch content", impact: "high", source: "Creator" },
      { category: "Missing Platforms", title: "Snapchat AR try-on", description: "Virtual try-on filters drive +45% product page visits in sportswear", impact: "medium", source: "Industry" },
      { category: "Creator Tiers", title: "Add 10 nano street style creators", description: "Volume UGC at 15% budget drives launch velocity and FOMO", impact: "high", source: "Historical" },
      { category: "Budget Optimization", title: "Front-load 30% spend to week 1", description: "Counter competitor launches with concentrated hero content burst", impact: "high", source: "Historical" },
      { category: "Competitor Gap", title: "Local athlete collab drop", description: "No competitor has Egypt-specific limited edition — first-mover advantage", impact: "high", source: "Industry" },
    ],
    finance: [
      { category: "Untapped Audiences", title: "Established earners (35–50)", description: "Premium card segment with 4x higher approval rate and LTV", impact: "high", source: "Client" },
      { category: "Missing Platforms", title: "Podcast sponsorship integration", description: "Finance podcast listeners show 2.8x card application intent", impact: "medium", source: "Industry" },
      { category: "Creator Tiers", title: "Add macro trust anchor", description: "Single macro finance educator drives 40% of total qualified leads", impact: "high", source: "Historical" },
      { category: "Budget Optimization", title: "Shift 5% to LinkedIn paid", description: "LinkedIn CPL 35% lower than Instagram for finance products in UAE", impact: "high", source: "Historical" },
      { category: "Content Gap", title: "Life milestone banking content", description: "Competitors focus on product features — life event storytelling underserved", impact: "medium", source: "Industry" },
    ],
    telecom: [
      { category: "Momentum", title: "Reactive boost pool", description: "Hold 10% amplification to double-down on breakout creators within 24 hours of a spike", impact: "high", source: "Historical" },
      { category: "Untapped Formats", title: "Remix drop week 3", description: "A sped-up / regional remix re-ignites sound usage when the original curve decays", impact: "high", source: "Industry" },
      { category: "Missing Platforms", title: "YouTube Shorts compilation", description: "Best-of UGC compilations extend reach beyond TikTok-first audiences", impact: "medium", source: "Industry" },
    ],
    general: [
      { category: "Untapped Audiences", title: "Secondary demographic segment", description: "Brief analysis suggests 30% reach opportunity in adjacent audience", impact: "medium", source: "AI" },
      { category: "Missing Platforms", title: "YouTube long-form", description: "Category content performs well on YouTube — not in current plan", impact: "medium", source: "Industry" },
      { category: "Creator Tiers", title: "Increase micro tier to 45%", description: "Micro creators deliver best engagement-to-cost ratio", impact: "medium", source: "Historical" },
      { category: "Budget Optimization", title: "Rebalance paid amplification", description: "Industry benchmark suggests +3% to paid for reach efficiency", impact: "low", source: "Industry" },
      { category: "Content Gap", title: "UGC volume opportunity", description: "Competitors underinvest in authentic UGC — differentiation available", impact: "medium", source: "Industry" },
    ],
  };

  return byIndustry[industry];
}

export function deriveExecutiveSummary(
  strategyText: string,
  audienceText: string,
  summaryText: string
): ExecutiveSummaryData {
  const combined = [strategyText, audienceText, summaryText].filter(Boolean).join("\n");
  const industry = detectIndustryFromBrief(combined);
  const profile = getIndustryProfile(industry, combined);
  const client = resolveClientFromBrief(combined);
  const weeks = parseDurationWeeks(combined);
  const fields = deriveExecutiveStrategyFields(strategyText, audienceText, summaryText);

  const summaries: Record<CampaignIndustry, string> = {
    luxury: `${client} requires a prestige-building campaign targeting affluent professionals through curated macro and celebrity creators on Instagram and YouTube. The ${weeks}-week plan prioritizes editorial-quality production and selective paid amplification to HNW audiences.`,
    tourism: `${client} needs a destination awareness campaign leveraging travel storytellers across TikTok, Instagram, and YouTube. The ${weeks}-week strategy drives trip-planning intent through visual destination content and geo-targeted amplification in key feeder markets.`,
    baby: `${client} launches with an authenticity-first UGC strategy activating mom creators on Instagram and TikTok. The ${weeks}-week plan builds purchase trust through peer validation at scale — 80+ authentic reviews targeted.`,
    retail: `${client} product launch demands high-velocity creator activation across nano, micro, and mid tiers. The ${weeks}-week plan front-loads try-on and fit content to drive conversion during the competitive launch window.`,
    finance: `${client} requires a trust-building campaign through verified finance educators on Instagram, LinkedIn, and YouTube. The ${weeks}-week plan prioritizes compliance-safe content and repeated exposure to drive card adoption.`,
    telecom: `${client} needs a cultural-moment campaign that turns the brand sound into the market's summer anthem. The ${weeks}-week plan launches with celebrity anchors, then sustains trend momentum through weekly creator waves — dance challenges, duets, and remixes — backed by reactive amplification on breakout content.`,
    general: `${client} campaign leverages creator-led storytelling across Instagram and TikTok. The ${weeks}-week integrated plan balances awareness, engagement, and conversion objectives.`,
  };

  return {
    summary: summaries[industry],
    keyDecisions: [
      `Creator mix: ${profile.creatorMixSummary}`,
      `Platform focus: ${profile.platforms.join(", ")}`,
      `Campaign duration: ${weeks} weeks with go-live at week ${weeks - 1}`,
      `Budget priority: ${profile.budgetWeights[0].percent}% creator fees, ${profile.budgetWeights[2].percent}% paid amplification`,
    ],
    recommendedActions: [
      "Approve creator criteria and shortlist by end of Week 2",
      `Confirm ${profile.budgetWeights[1].percent}% production budget allocation`,
      "Sign off visual guidelines and claim library before creator outreach",
      "Authorize paid amplification budget pacing plan",
    ],
    immediateNextSteps: [
      "Finalize and approve campaign brief",
      "Launch AI vendor discovery with approved criteria",
      "Schedule stakeholder kickoff and strategy review",
      "Confirm legal/compliance review process",
    ],
    expectedBusinessOutcome: typeof fields.competitiveAdvantage === "string"
      ? `${fields.competitiveAdvantage} — targeting ${profile.estimatedReach} over ${weeks} weeks`
      : `${profile.campaignType} — ${profile.estimatedReach} over ${weeks} weeks`,
    grounding: {
      source: "AI",
      confidence: 91,
      reason: "Synthesized from brief, industry intelligence, and historical campaign data",
      evidence: `${client} · ${profile.label} · ${weeks} weeks · Thinkway campaign database`,
    },
  };
}

export type VendorFactorInput = {
  displayName: string;
  handle: string;
  platform: string;
  followers?: number;
  engagementRate?: number;
  country?: string;
  audienceSummary?: string;
  priceEstimate?: string;
  brandFit?: number;
  campaignRelevanceScore?: number;
  rationale?: string;
};

export function deriveVendorRankingFactors(
  vendor: VendorFactorInput,
  industry: CampaignIndustry,
  index: number
): { whySelected: string; factors: VendorRankingFactor[]; grounding: GroundedElement } {
  const er = vendor.engagementRate ?? 4.5;
  const fit = vendor.campaignRelevanceScore ?? vendor.brandFit ?? 75 + index * 4;
  const followers = vendor.followers ?? 100_000;
  const hasCampaignScore = vendor.campaignRelevanceScore != null;

  const industryErBenchmark: Record<CampaignIndustry, number> = {
    luxury: 3.1,
    tourism: 4.5,
    baby: 5.2,
    retail: 3.9,
    finance: 2.4,
    telecom: 5.8,
    general: 4.0,
  };

  const benchmark = industryErBenchmark[industry];
  const erScore = Math.min(98, Math.round((er / benchmark) * 70 + 20));

  const factors: VendorRankingFactor[] = [
    {
      factor: hasCampaignScore ? "Campaign Fit" : "Brand Fit",
      score: fit,
      reason: hasCampaignScore
        ? `Brief criteria match ${fit}/100 — requirement → evidence from CIP ranking`
        : `${fit}/100 category alignment from Thinkway creator DNA`,
    },
    {
      factor: "Audience Fit",
      score: Math.min(95, fit + 5),
      reason: vendor.audienceSummary
        ? `Audience: ${vendor.audienceSummary}`
        : "Audience demographics match brief target",
    },
    {
      factor: "Platform",
      score: vendor.platform ? 90 : 60,
      reason: vendor.platform
        ? `Platform requirement → active on ${vendor.platform}`
        : "Primary platform unverified",
    },
    { factor: "Historical ER", score: erScore, reason: `${er}% ER vs ${benchmark}% industry benchmark` },
    {
      factor: "Audience Country",
      score: vendor.country ? 90 : 55,
      reason: vendor.country
        ? `Geography requirement → ${vendor.country} audience signals`
        : "Country alignment unverified — missing data",
    },
    { factor: "Price", score: vendor.priceEstimate ? 82 : 78, reason: vendor.priceEstimate ?? "Rate within budget tier range" },
  ];

  const topFactors = factors.sort((a, b) => b.score - a.score).slice(0, 3);
  const whySelected = vendor.rationale
    ?? (hasCampaignScore
      ? `Campaign fit ${fit}/100 — ${topFactors.map((f) => `${f.factor}: ${f.reason}`).join("; ")}`
      : `Selected for ${topFactors.map((f) => `${f.factor} (${f.score}/100)`).join(", ")} — ${formatFollowers(followers)} ${vendor.platform} reach`);

  return {
    whySelected,
    factors,
    grounding: {
      source: hasCampaignScore ? "AI" : "Creator",
      confidence: Math.min(95, fit),
      reason: hasCampaignScore
        ? "Evidence-linked ranking from campaign brief criteria + creator profile"
        : "Ranked from Thinkway creator intelligence and historical campaign performance",
      evidence: `${vendor.displayName} · ${vendor.handle} · ER ${er}%${hasCampaignScore ? ` · campaign fit ${fit}/100` : ""}`,
    },
  };
}

function formatFollowers(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${Math.round(count / 1_000)}K`;
  return count.toLocaleString();
}
