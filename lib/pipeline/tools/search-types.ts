export type WebSearchProvider = "exa" | "google_search" | "none";

export type WebSearchResult = {
  title: string;
  url: string;
  publishedDate?: string;
  summary: string;
  highlights: string[];
  text?: string;
};

export type WebSearchOutput = {
  query: string;
  provider: WebSearchProvider;
  results: WebSearchResult[];
  warnings?: string[];
};
