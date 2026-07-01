// Tavily · web search para agentes
import dotenv from "dotenv";
dotenv.config();

const API_KEY = process.env.TAVILY_API_KEY;

export const tavily = {
  search: async ({ query, maxResults = 5, includeAnswer = true }) => {
    if (!API_KEY) throw new Error("Tavily no configurado (TAVILY_API_KEY)");
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: API_KEY,
        query,
        max_results: maxResults,
        include_answer: includeAnswer,
        include_raw_content: false,
        search_depth: "basic",
      }),
    });
    if (!res.ok) throw new Error(`Tavily error ${res.status}`);
    const data = await res.json();
    return {
      answer:  data.answer || null,
      results: (data.results || []).map(r => ({
        title:   r.title,
        url:     r.url,
        content: r.content?.slice(0, 500),
        score:   r.score,
      })),
    };
  },
};

export const tavilyAvailable = () => !!API_KEY;
