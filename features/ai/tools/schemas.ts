import { z } from "zod";

export const searchCreatorsInputSchema = z.object({
  query: z.string().min(1),
  platforms: z.array(z.string()).optional(),
  categories: z.array(z.string()).optional(),
  country: z.string().optional(),
  language: z.string().optional(),
  minFollowers: z.number().optional(),
  maxFollowers: z.number().optional(),
  minEngagement: z.number().optional(),
  minThinkwayScore: z.number().optional(),
  limit: z.number().int().min(1).max(100).default(20),
});

export const searchCreatorsOutputSchema = z.object({
  creators: z.array(
    z.object({
      id: z.string(),
      handle: z.string(),
      displayName: z.string(),
      platform: z.string(),
      followers: z.number().optional(),
      engagementRate: z.number().optional(),
      avatarUrl: z.string().optional(),
      profileUrl: z.string().optional(),
      campaignRelevanceScore: z.number().optional(),
    })
  ),
  total: z.number(),
});

export const getCreatorInputSchema = z.object({
  creatorId: z.string().min(1),
});

export const getCreatorOutputSchema = z.object({
  id: z.string(),
  handle: z.string(),
  displayName: z.string(),
  platform: z.string(),
  bio: z.string().optional(),
  followers: z.number().optional(),
  engagementRate: z.number().optional(),
  categories: z.array(z.string()).optional(),
});

export const getCampaignInputSchema = z.object({
  campaignId: z.string().min(1),
});

export const getCampaignOutputSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  status: z.string(),
  brandId: z.string().optional(),
  clientId: z.string().optional(),
  poAmount: z.number().optional(),
  currency: z.string().optional(),
  lineCount: z.number().optional(),
});

export const getClientInputSchema = z.object({
  clientId: z.string().min(1),
});

export const getClientOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  groupId: z.string().optional(),
  country: z.string().optional(),
  brandCount: z.number().optional(),
});

export const getShortlistInputSchema = z.object({
  shortlistId: z.string().min(1),
});

export const getShortlistOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.string(),
  creatorCount: z.number(),
  creators: z.array(
    z.object({
      id: z.string(),
      handle: z.string(),
      displayName: z.string(),
    })
  ),
});

export const createShortlistInputSchema = z.object({
  name: z.string().min(1),
  creatorIds: z.array(z.string()).default([]),
  campaignId: z.string().optional(),
});

export const createShortlistOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  creatorCount: z.number(),
  status: z.literal("draft"),
});

export const buildCampaignInputSchema = z.object({
  brandId: z.string().min(1),
  name: z.string().min(1),
  poAmount: z.number().min(0).optional(),
  creatorIds: z.array(z.string()).optional(),
});

export const buildCampaignOutputSchema = z.object({
  draft: z.object({
    brandId: z.string(),
    name: z.string(),
    suggestedLines: z.array(
      z.object({
        code: z.string(),
        creatorId: z.string().optional(),
        poAmount: z.number().optional(),
      })
    ),
  }),
});

export const generateBriefInputSchema = z.object({
  campaignId: z.string().min(1),
  creatorId: z.string().optional(),
  tone: z.string().optional(),
});

export const generateBriefOutputSchema = z.object({
  title: z.string(),
  sections: z.array(
    z.object({
      heading: z.string(),
      content: z.string(),
    })
  ),
});

export const generateReportInputSchema = z.object({
  campaignId: z.string().min(1),
  reportType: z.enum(["performance", "billing", "deliverables"]).default("performance"),
  period: z.string().optional(),
});

export const generateReportOutputSchema = z.object({
  title: z.string(),
  summary: z.string(),
  metrics: z.array(
    z.object({
      label: z.string(),
      value: z.string(),
    })
  ),
  recommendations: z.array(z.string()),
});

export type SearchCreatorsInput = z.infer<typeof searchCreatorsInputSchema>;
export type SearchCreatorsOutput = z.infer<typeof searchCreatorsOutputSchema>;
export type GetCreatorInput = z.infer<typeof getCreatorInputSchema>;
export type GetCreatorOutput = z.infer<typeof getCreatorOutputSchema>;
export type GetCampaignInput = z.infer<typeof getCampaignInputSchema>;
export type GetCampaignOutput = z.infer<typeof getCampaignOutputSchema>;
export type GetClientInput = z.infer<typeof getClientInputSchema>;
export type GetClientOutput = z.infer<typeof getClientOutputSchema>;
export type GetShortlistInput = z.infer<typeof getShortlistInputSchema>;
export type GetShortlistOutput = z.infer<typeof getShortlistOutputSchema>;
export type CreateShortlistInput = z.infer<typeof createShortlistInputSchema>;
export type CreateShortlistOutput = z.infer<typeof createShortlistOutputSchema>;
export type BuildCampaignInput = z.infer<typeof buildCampaignInputSchema>;
export type BuildCampaignOutput = z.infer<typeof buildCampaignOutputSchema>;
export type GenerateBriefInput = z.infer<typeof generateBriefInputSchema>;
export type GenerateBriefOutput = z.infer<typeof generateBriefOutputSchema>;
export type GenerateReportInput = z.infer<typeof generateReportInputSchema>;
export type GenerateReportOutput = z.infer<typeof generateReportOutputSchema>;
