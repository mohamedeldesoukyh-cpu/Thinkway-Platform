type WebSearchResult = {
  snippets: string[];
  source: "serper" | "brave" | "tavily" | "none";
};

async function searchWithSerper(query: string, apiKey: string): Promise<string[]> {
  const response = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": apiKey,
    },
    body: JSON.stringify({ q: query, num: 5 }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Serper search failed (${response.status})`);
  }

  const data = (await response.json()) as {
    organic?: { title?: string; snippet?: string }[];
    knowledgeGraph?: { title?: string; description?: string; type?: string };
  };

  const snippets: string[] = [];
  if (data.knowledgeGraph) {
    snippets.push(
      [data.knowledgeGraph.title, data.knowledgeGraph.type, data.knowledgeGraph.description]
        .filter(Boolean)
        .join(" — ")
    );
  }
  for (const item of data.organic ?? []) {
    snippets.push([item.title, item.snippet].filter(Boolean).join(" — "));
  }
  return snippets.filter(Boolean);
}

async function searchWithBrave(query: string, apiKey: string): Promise<string[]> {
  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", query);
  url.searchParams.set("count", "5");

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "X-Subscription-Token": apiKey,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Brave search failed (${response.status})`);
  }

  const data = (await response.json()) as {
    web?: { results?: { title?: string; description?: string }[] };
  };

  return (data.web?.results ?? [])
    .map((item) => [item.title, item.description].filter(Boolean).join(" — "))
    .filter(Boolean);
}

async function searchWithTavily(query: string, apiKey: string): Promise<string[]> {
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: 5,
      include_answer: true,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Tavily search failed (${response.status})`);
  }

  const data = (await response.json()) as {
    answer?: string;
    results?: { title?: string; content?: string }[];
  };

  const snippets: string[] = [];
  if (data.answer) {
    snippets.push(data.answer);
  }
  for (const item of data.results ?? []) {
    snippets.push([item.title, item.content].filter(Boolean).join(" — "));
  }
  return snippets.filter(Boolean);
}

export async function searchCompanyOnWeb(query: string): Promise<WebSearchResult> {
  const serperKey = process.env.SERPER_API_KEY?.trim();
  const braveKey = process.env.BRAVE_SEARCH_API_KEY?.trim();
  const tavilyKey = process.env.TAVILY_API_KEY?.trim();

  const providers: Array<{
    key: string;
    source: WebSearchResult["source"];
    search: (query: string, key: string) => Promise<string[]>;
  }> = [
    { key: serperKey ?? "", source: "serper", search: searchWithSerper },
    { key: braveKey ?? "", source: "brave", search: searchWithBrave },
    { key: tavilyKey ?? "", source: "tavily", search: searchWithTavily },
  ];

  for (const provider of providers) {
    if (!provider.key) {
      continue;
    }
    try {
      const snippets = await provider.search(query, provider.key);
      if (snippets.length > 0) {
        return { snippets, source: provider.source };
      }
    } catch {
      continue;
    }
  }

  return { snippets: [], source: "none" };
}

export function buildCompanySearchQuery(
  companyName: string,
  country?: string | null,
  website?: string | null
): string {
  const parts = [companyName.trim()];
  if (website?.trim()) {
    parts.push(website.trim());
  }
  if (country?.trim()) {
    parts.push(country.trim());
  }
  parts.push("company industry");
  return parts.filter(Boolean).join(" ");
}
