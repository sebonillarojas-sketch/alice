// Tavily · web search para agentes
import dotenv from "dotenv";
dotenv.config();

const API_KEY = (process.env.TAVILY_API_KEY || "").trim();

export const tavily = {
  search: async ({ query, maxResults = 5, includeAnswer = true }) => {
    if (!API_KEY) throw new Error("Tavily no configurado (TAVILY_API_KEY)");
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,   // método actual de Tavily
      },
      body: JSON.stringify({
        api_key: API_KEY,                       // compat con endpoint viejo
        query,
        max_results: maxResults,
        include_answer: includeAnswer,
        include_raw_content: false,
        search_depth: "basic",
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Tavily error ${res.status}${detail ? ` — ${detail.slice(0, 160)}` : ""}`);
    }
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
