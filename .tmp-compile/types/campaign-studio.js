export const CAMPAIGN_STUDIO_SECTION_DEFS = [
    {
        id: "campaign-summary",
        title: "Campaign Summary",
        taskIds: ["analyze-request", "generate-brief"],
        summaryIds: ["campaign-brief"],
    },
    {
        id: "executive-strategy",
        title: "Executive Strategy",
        taskIds: ["build-strategy"],
        summaryIds: ["campaign-strategy"],
    },
    {
        id: "creator-discovery",
        title: "Vendor Discovery",
        taskIds: ["search-creators"],
        summaryIds: ["creator-discovery"],
    },
    {
        id: "creator-recommendations",
        title: "Vendor Recommendations",
        taskIds: ["build-shortlist"],
        summaryIds: ["creator-recommendations"],
    },
    {
        id: "budget-planner",
        title: "Budget Planner",
        taskIds: ["estimate-budget"],
        summaryIds: ["budget"],
    },
    {
        id: "timeline",
        title: "Timeline",
        taskIds: ["generate-timeline"],
        summaryIds: ["timeline"],
    },
    {
        id: "kpi-forecast",
        title: "KPI Forecast",
        taskIds: ["build-strategy"],
        summaryIds: ["campaign-strategy"],
    },
    {
        id: "risk-analysis",
        title: "Risk Analysis",
        taskIds: ["build-strategy", "estimate-budget"],
        summaryIds: ["campaign-strategy", "budget"],
    },
    {
        id: "creative-concepts",
        title: "Creative Concepts",
        taskIds: ["build-strategy", "generate-brief"],
        summaryIds: ["campaign-strategy", "campaign-brief"],
    },
    {
        id: "content-plan",
        title: "Content Plan",
        taskIds: ["build-strategy", "generate-timeline"],
        summaryIds: ["campaign-strategy", "timeline"],
    },
    {
        id: "creator-mix",
        title: "Creator Mix",
        taskIds: ["build-strategy", "search-creators"],
        summaryIds: ["campaign-strategy", "creator-discovery"],
    },
    {
        id: "why-ai",
        title: "Director Decision Minutes",
        taskIds: ["analyze-request", "build-strategy"],
        summaryIds: ["campaign-strategy", "campaign-brief"],
    },
    {
        id: "industry-benchmark",
        title: "Industry Benchmark",
        taskIds: ["build-strategy", "estimate-budget"],
        summaryIds: ["campaign-strategy", "budget"],
    },
    {
        id: "success-probability",
        title: "Success Probability",
        taskIds: ["build-strategy", "estimate-budget"],
        summaryIds: ["campaign-strategy", "budget"],
    },
    {
        id: "opportunity-finder",
        title: "Strategic Opportunities",
        taskIds: ["build-strategy", "search-creators"],
        summaryIds: ["campaign-strategy", "creator-discovery"],
    },
    {
        id: "executive-summary",
        title: "Executive Summary",
        taskIds: ["prepare-approval", "build-strategy"],
        summaryIds: ["campaign-strategy", "approval"],
    },
    {
        id: "presentation-status",
        title: "Presentation Status",
        taskIds: ["prepare-approval"],
        summaryIds: ["approval"],
    },
];
export const SPECIALIST_TASK_MAP = {
    planner: ["analyze-request", "generate-timeline"],
    strategist: ["build-strategy", "generate-brief", "prepare-approval"],
    scout: ["search-creators", "build-shortlist"],
    analyst: ["estimate-budget"],
};
export const SPECIALIST_LABELS = {
    planner: "Campaign Planner",
    strategist: "Strategist",
    scout: "Scout",
    analyst: "Analyst",
};
