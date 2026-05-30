import express from "express";
import path from "path";
import dotenv from "dotenv";
import fs from "fs";
import { GoogleGenAI, Type } from "@google/genai";
import { curatedGames } from "./src/data/games";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is not configured. Please add it via AI Studio Settings.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

let cachedSeo: {
  googleSearchConsoleKey: string;
  googleAnalyticsId: string;
  bingWebmasterKey: string;
} | null = null;
let cachedSeoTime = 0;

async function getSeoSettings(): Promise<{
  googleSearchConsoleKey: string;
  googleAnalyticsId: string;
  bingWebmasterKey: string;
}> {
  const now = Date.now();
  if (cachedSeo && now - cachedSeoTime < 300000) {
    return cachedSeo;
  }
  try {
    const res = await fetch("https://firestore.googleapis.com/v1/projects/aikennet/databases/(default)/documents/settings/seo_config");
    if (res.ok) {
      const data = await res.json();
      const fields = data.fields || {};
      const googleSearchConsoleKey = fields.googleSearchConsoleKey?.stringValue || "";
      const googleAnalyticsId = fields.googleAnalyticsId?.stringValue || "";
      const bingWebmasterKey = fields.bingWebmasterKey?.stringValue || "";
      cachedSeo = { googleSearchConsoleKey, googleAnalyticsId, bingWebmasterKey };
      cachedSeoTime = now;
      return cachedSeo;
    }
  } catch (err) {
    console.error("Failed to query Firestore for crawler SEO node using API fallback:", err);
  }
  return { googleSearchConsoleKey: "", googleAnalyticsId: "", bingWebmasterKey: "" };
}

export const app = express();

async function startServer() {
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  app.use(express.json());

  // Technical SEO Crawler & Sitemap Handshakes
  app.get("/robots.txt", (req, res) => {
    res.type("text/plain");
    res.send(`User-agent: *
Allow: /
Allow: /?view=*
Allow: /?game=*
Disallow: /admin-login
Disallow: /?view=admin

# Perfect crawl compatibility with AI search bots
User-agent: ChatGPT-User
Allow: /

User-agent: GPTBot
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: Gemini
Allow: /

Sitemap: ${req.protocol}://${req.get("host")}/sitemap.xml
`);
  });

  app.get("/sitemap.xml", (req, res) => {
    const host = `${req.protocol}://${req.get("host")}`;
    const date = new Date().toISOString().split("T")[0];
    
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- Primary views -->
  <url>
    <loc>${host}/</loc>
    <lastmod>${date}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${host}/?view=free-games</loc>
    <lastmod>${date}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${host}/?view=lists</loc>
    <lastmod>${date}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${host}/?view=favorites</loc>
    <lastmod>${date}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.5</priority>
  </url>\n`;

    for (const g of curatedGames) {
      xml += `  <url>
    <loc>${host}/?game=${g.id}</loc>
    <lastmod>${date}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>\n`;
    }

    xml += `</urlset>`;
    res.type("application/xml");
    res.send(xml);
  });

  // API endpoints FIRST

  // AI-powered gaming assistant chatbot / lore query
  app.post("/api/gemini/chat", async (req, res) => {
    try {
      const { message, history, gameTitle } = req.body;
      const client = getGeminiClient();

      const systemInstruction = `You are gamesbody AI, a premium cyberpunk-style gaming oracle and legendary lore master. 
The user is asking about the game: "${gameTitle}". 
Provide high-end, intelligent responses, gameplay secrets, build tips, quest strategies, or rich lore descriptions in elegant markdown. 
Be concise, enthusiastic, and gamer-oriented. Style with sci-fi terminal elements if appropriate (e.g., [SYSTEM READY]).`;

      const response = await client.models.generateContent({
        model: "gemini-3.5-flash",
        contents: [
          { role: "user", parts: [{ text: `System context: This conversation centers entirely on "${gameTitle}". Here is the chat history: ${JSON.stringify(history)}. User message: ${message}` }] }
        ],
        config: {
          systemInstruction,
          temperature: 0.7,
        }
      });

      res.json({ text: response.text || "I was unable to retrieve a response from the deep network." });
    } catch (error: any) {
      console.error("AI Chat Error:", error);
      res.status(500).json({ error: error.message || "Gaming oracle offline" });
    }
  });

  // AI game expansions - searches dynamically for games and returns structured parameters
  app.post("/api/gemini/search", async (req, res) => {
    try {
      const { query } = req.body;
      if (!query || query.trim().length === 0) {
        return res.status(400).json({ error: "Search query is required." });
      }

      const client = getGeminiClient();
      const prompt = `Search the gaming universe for a game related to: "${query}". 
If it exists, return authentic information. If it doesn't exist, use your AI matrix to conceive a stunning creative theoretical game! 
Return matching parameters inside a clean JSON schema:`;

      const response = await client.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING, description: "A url-friendly hyphenated lowercase lowercase code e.g. cyberpunk-2077, custom-space-sim." },
              title: { type: Type.STRING, description: "Display title." },
              description: { type: Type.STRING, description: "Cinematic, rich 3-4 sentence game summary." },
              rating: { type: Type.NUMBER, description: "Hypothetical rating score between 1 and 10." },
              releaseDate: { type: Type.STRING, description: "Estimated or real release date e.g. Oct 2025." },
              genres: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Max 3 genres, e.g., Action, RPG, Cyberpunk." },
              developers: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Lead development studios." },
              publishers: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Publishers." },
              platforms: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Active platforms e.g. PC, PS5, Xbox Series X." },
              imageUrl: { type: Type.STRING, description: "A high-quality Unsplash gaming/concept URL that represents the visual themes of this game, or a placeholder." },
              trailerKeyword: { type: Type.STRING, description: "A search keyword for gameplay trailers, e.g., 'Elden Ring Official Gameplay trailer'." }
            },
            required: ["id", "title", "description", "rating", "releaseDate", "genres", "developers", "publishers", "platforms"]
          }
        }
      });

      const gameData = JSON.parse(response.text || "{}");
      
      // Inject fallback image if AI returns a broken or empty link
      if (!gameData.imageUrl || !gameData.imageUrl.startsWith("http")) {
        gameData.imageUrl = `https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80`;
      }

      res.json(gameData);
    } catch (error: any) {
      console.error("AI Search Error:", error);
      res.status(500).json({ error: error.message || "AI gaming synthesis failed" });
    }
  });

  // AI user analyzer - suggests 3 related games based on user lists or preferences
  app.post("/api/gemini/suggest", async (req, res) => {
    try {
      const { favorites, recentViews } = req.body;
      const client = getGeminiClient();

      const contextText = `The user likes these games: ${JSON.stringify(favorites || [])}. They recently browsed: ${JSON.stringify(recentViews || [])}.`;
      const prompt = `${contextText} Based on these tastes, curate 3 customized recommendations in a JSON array. Each recommendation must show titles, a persuasive matching sentence, and game parameters:`;

      const response = await client.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                title: { type: Type.STRING },
                matchReason: { type: Type.STRING, description: "Personalized explanation of why they will love this game based on their profile." },
                rating: { type: Type.NUMBER },
                genres: { type: Type.ARRAY, items: { type: Type.STRING } },
                platforms: { type: Type.ARRAY, items: { type: Type.STRING } },
                imageUrl: { type: Type.STRING }
              },
              required: ["id", "title", "matchReason", "rating", "genres", "platforms"]
            }
          }
        }
      });

      const suggestions = JSON.parse(response.text || "[]");
      const mappedSuggestions = suggestions.map((s: any) => {
        if (!s.imageUrl || !s.imageUrl.startsWith("http")) {
          s.imageUrl = `https://images.unsplash.com/photo-1552820728-8b83bb6b773f?auto=format&fit=crop&w=600&q=80`;
        }
        return s;
      });

      res.json(mappedSuggestions);
    } catch (error: any) {
      console.error("AI Suggest Error:", error);
      res.status(500).json({ error: error.message || "Curator core offline" });
    }
  });

  const cheapSharkCache = new Map<string, { timestamp: number; data: any }>();
  const CHEAPSHARK_CACHE_EXPIRY = 300000; // 5 minutes cache fallback

  const FALLBACK_DEALS = [
    {
      internalName: "BALDURSGATE3",
      title: "Baldur's Gate 3",
      metacriticLink: "/game/pc/baldurs-gate-3",
      dealID: "mock-deal-1",
      storeID: "1",
      gameID: "259955",
      salePrice: "47.99",
      normalPrice: "59.99",
      isOnSale: "1",
      savings: "20.000000",
      metacriticScore: "96",
      steamRatingText: "Overwhelmingly Positive",
      steamRatingPercent: "96",
      steamRatingCount: "542918",
      steamAppID: "1086940",
      releaseDate: 1691020800,
      lastChange: 1700000000,
      dealRating: "9.2",
      thumb: "https://images.unsplash.com/photo-1612287230202-1bf1d85d1bdf?auto=format&fit=crop&w=400&q=80"
    },
    {
      internalName: "CYBERPUNK2077",
      title: "Cyberpunk 2077: Ultimate Edition",
      metacriticLink: "/game/pc/cyberpunk-2077",
      dealID: "mock-deal-2",
      storeID: "1",
      gameID: "187422",
      salePrice: "29.99",
      normalPrice: "59.99",
      isOnSale: "1",
      savings: "50.000000",
      metacriticScore: "86",
      steamRatingText: "Very Positive",
      steamRatingPercent: "82",
      steamRatingCount: "612450",
      steamAppID: "1091500",
      releaseDate: 1607558400,
      lastChange: 1700000000,
      dealRating: "9.5",
      thumb: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=400&q=80"
    },
    {
      internalName: "ELDENRING",
      title: "Elden Ring: Shadow of the Erdtree Edition",
      metacriticLink: "/game/pc/elden-ring",
      dealID: "mock-deal-3",
      storeID: "7",
      gameID: "242880",
      salePrice: "51.99",
      normalPrice: "79.99",
      isOnSale: "1",
      savings: "35.000000",
      metacriticScore: "94",
      steamRatingText: "Very Positive",
      steamRatingPercent: "92",
      steamRatingCount: "412500",
      steamAppID: "1245620",
      releaseDate: 1645747200,
      lastChange: 1700000000,
      dealRating: "8.8",
      thumb: "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=400&q=80"
    },
    {
      internalName: "HADESII",
      title: "Hades II (Early Access)",
      metacriticLink: "/game/pc/hades-ii",
      dealID: "mock-deal-4",
      storeID: "1",
      gameID: "29104",
      salePrice: "23.99",
      normalPrice: "29.99",
      isOnSale: "1",
      savings: "20.000000",
      metacriticScore: "90",
      steamRatingText: "Overwhelmingly Positive",
      steamRatingPercent: "95",
      steamRatingCount: "45000",
      steamAppID: "1145350",
      releaseDate: 1714953600,
      lastChange: 1700000000,
      dealRating: "9.1",
      thumb: "https://images.unsplash.com/photo-1552820728-8b83bb6b773f?auto=format&fit=crop&w=400&q=80"
    },
    {
      internalName: "THEWITCHER3",
      title: "The Witcher 3: Wild Hunt Complete Edition",
      metacriticLink: "/game/pc/the-witcher-3-wild-hunt",
      dealID: "mock-deal-5",
      storeID: "7",
      gameID: "114945",
      salePrice: "12.49",
      normalPrice: "49.99",
      isOnSale: "1",
      savings: "75.000000",
      metacriticScore: "93",
      steamRatingText: "Overwhelmingly Positive",
      steamRatingPercent: "96",
      steamRatingCount: "722401",
      steamAppID: "292030",
      releaseDate: 1431993600,
      lastChange: 1700000000,
      dealRating: "9.8",
      thumb: "https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=400&q=80"
    },
    {
      internalName: "ALANWAKE2",
      title: "Alan Wake 2",
      metacriticLink: "/game/pc/alan-wake-2",
      dealID: "mock-deal-6",
      storeID: "25",
      gameID: "260112",
      salePrice: "34.99",
      normalPrice: "49.99",
      isOnSale: "1",
      savings: "30.000000",
      metacriticScore: "89",
      steamRatingText: "Very Positive",
      steamRatingPercent: "88",
      steamRatingCount: "12800",
      steamAppID: "0",
      releaseDate: 1698364800,
      lastChange: 1700000000,
      dealRating: "8.5",
      thumb: "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?auto=format&fit=crop&w=400&q=80"
    },
    {
      internalName: "HELLDIVERS2",
      title: "Helldivers 2",
      metacriticLink: "/game/pc/helldivers-2",
      dealID: "mock-deal-7",
      storeID: "1",
      gameID: "267104",
      salePrice: "31.99",
      normalPrice: "39.99",
      isOnSale: "1",
      savings: "20.000000",
      metacriticScore: "82",
      steamRatingText: "Mostly Positive",
      steamRatingPercent: "74",
      steamRatingCount: "512000",
      steamAppID: "553850",
      releaseDate: 1707350400,
      lastChange: 1700000000,
      dealRating: "8.0",
      thumb: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=400&q=80"
    },
    {
      internalName: "SEKIRO",
      title: "Sekiro: Shadows Die Twice - GOTY Edition",
      metacriticLink: "/game/pc/sekiro-shadows-die-twice",
      dealID: "mock-deal-8",
      storeID: "1",
      gameID: "184310",
      salePrice: "29.99",
      normalPrice: "59.99",
      isOnSale: "1",
      savings: "50.000000",
      metacriticScore: "88",
      steamRatingText: "Overwhelmingly Positive",
      steamRatingPercent: "95",
      steamRatingCount: "212000",
      steamAppID: "814380",
      releaseDate: 1553126400,
      lastChange: 1700000000,
      dealRating: "9.4",
      thumb: "https://images.unsplash.com/photo-1551103782-8ab07afd45c1?auto=format&fit=crop&w=400&q=80"
    }
  ];

  // CheapShark Deals API proxy directory with resilient caching and rich failure fallback systems
  app.get("/api/cheapshark/deals", async (req, res) => {
    const cacheKey = JSON.stringify(req.query);
    const now = Date.now();
    
    // Check robust in-memory cache
    if (cheapSharkCache.has(cacheKey)) {
      const entry = cheapSharkCache.get(cacheKey)!;
      if (now - entry.timestamp < CHEAPSHARK_CACHE_EXPIRY) {
        console.log(`[AIKENNET] Serving CheapShark deals from fast micro-cache.`);
        return res.json(entry.data);
      }
    }

    try {
      const { storeID, upperPrice, title, sortBy } = req.query;
      const baseUrl = "https://www.cheapshark.com/api/1.0/deals";
      const params = new URLSearchParams();
      if (storeID && storeID !== "all") params.append("storeID", String(storeID).trim());
      if (upperPrice) params.append("upperPrice", String(upperPrice).trim());
      if (title) params.append("title", String(title).trim());
      if (sortBy) {
        params.append("sortBy", String(sortBy).trim());
      }
      params.append("pageSize", "30");

      const finalUrl = `${baseUrl}?${params.toString()}`;
      console.log(`[AIKENNET] Proxying request to CheapShark: ${finalUrl}`);
      const cRes = await fetch(finalUrl);
      
      // If server returned 429 rate limits or any bad status, fall back to calculated top deals
      if (!cRes.ok) {
        console.log(`[AIKENNET] CheapShark returned status code ${cRes.status}. Activating secondary local deal matrix stream.`);
        throw new Error(`Status ${cRes.status}`);
      }

      const rawDeals = await cRes.json();
      
      // Update cache
      cheapSharkCache.set(cacheKey, { timestamp: now, data: rawDeals });
      res.json(rawDeals);
    } catch (err: any) {
      console.log(`[AIKENNET] CheapShark request completed using secondary local deal matrix stream. (Info: ${err.message || err})`);
      
      // Prepare matching mock responses according to request parameters
      const { storeID, upperPrice, title, sortBy } = req.query;
      let matching = [...FALLBACK_DEALS];

      if (storeID && storeID !== "all") {
        matching = matching.filter(d => d.storeID === String(storeID).trim());
      }

      if (upperPrice) {
        const parsedCap = parseFloat(String(upperPrice));
        if (!isNaN(parsedCap)) {
          matching = matching.filter(d => parseFloat(d.salePrice) <= parsedCap);
        }
      }

      if (title) {
        const queryTerm = String(title).toLowerCase().trim();
        matching = matching.filter(d => d.title.toLowerCase().includes(queryTerm));
      }

      // Sorting handler
      if (sortBy) {
        const sortType = String(sortBy).trim();
        if (sortType === "Savings") {
          matching.sort((a, b) => parseFloat(b.savings) - parseFloat(a.savings));
        } else if (sortType === "Price") {
          matching.sort((a, b) => parseFloat(a.salePrice) - parseFloat(b.salePrice));
        } else if (sortType === "Reviews") {
          matching.sort((a, b) => parseInt(b.steamRatingPercent) - parseInt(a.steamRatingPercent));
        } else if (sortType === "Title") {
          matching.sort((a, b) => a.title.localeCompare(b.title));
        }
      }

      // Serve computed resilient fallback matching deals index
      res.json(matching);
    }
  });

  // Gemini AI Dynamic Analytics Report Generator
  app.post("/api/gemini/analytics-report", async (req, res) => {
    try {
      const { favorites, comments, customVibes } = req.body;
      const client = getGeminiClient();

      const favoritesStr = JSON.stringify(favorites || []);
      const commentsStr = JSON.stringify(comments || []);
      const customVibesStr = customVibes || "None";

      const prompt = `You are the ultimate Gaming Analytics Oracle of gamesbody.
You analyze gamer taste profiles, evaluate their feedback/comments, and synthesize a deep-tech, highly personalized gameplay analytics report.

Gamer Favorites Array: ${favoritesStr}
Gamer Interactive Feedback/Comments: ${commentsStr}
User Custom Vibe Input: ${customVibesStr}

Please generate an extreme high-quality, professional, gaming intelligence report in the following JSON format:
{
  "gamerTitle": "e.g., Cyberpunk Tactician, Dark Fantasy Lorelord, etc.",
  "vibeVibeSummary": "Summarize the general gameplay vibes and aesthetic preferences of this gamer (2-3 sentences).",
  "mechanicsAnalysis": "Detailed analysis of game mechanics, visual motifs, and themes they are attracted to based on their profile.",
  "feedbackInsight": "Evaluation of their written comments and feedback. Extract what they care about (e.g., story depth, bugs, extreme challenges, graphics, communities).",
  "syntheticScore": 87.5, // AI matching compatibility index score as a float
  "aiRecommendations": [
    {
      "id": "e.g. recommend-1",
      "title": "Full name of recommended game",
      "matchReason": "Deep developer/vibe rationale connecting back to their favorites and comments.",
      "estimatedRating": "Matching rate e.g. 9.5/10",
      "tags": ["Tag1", "Tag2"],
      "imageUrl": "Unsplash game conceptual visual URL (must start with https://images.unsplash.com/...)"
    }
  ]
}`;

      const response = await client.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              gamerTitle: { type: Type.STRING },
              vibeVibeSummary: { type: Type.STRING },
              mechanicsAnalysis: { type: Type.STRING },
              feedbackInsight: { type: Type.STRING },
              syntheticScore: { type: Type.NUMBER },
              aiRecommendations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    title: { type: Type.STRING },
                    matchReason: { type: Type.STRING },
                    estimatedRating: { type: Type.STRING },
                    tags: { type: Type.ARRAY, items: { type: Type.STRING } },
                    imageUrl: { type: Type.STRING }
                  },
                  required: ["id", "title", "matchReason", "estimatedRating", "tags"]
                }
              }
            },
            required: ["gamerTitle", "vibeVibeSummary", "mechanicsAnalysis", "feedbackInsight", "syntheticScore", "aiRecommendations"]
          }
        }
      });

      const report = JSON.parse(response.text || "{}");
      
      // Inject high quality conceptual gaming wallpapers for recommendations if they don't have it
      const fallbackImages = [
        "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=600&q=80",
        "https://images.unsplash.com/photo-1552820728-8b83bb6b773f?auto=format&fit=crop&w=600&q=80",
        "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=600&q=80",
        "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?auto=format&fit=crop&w=600&q=80"
      ];

      if (report.aiRecommendations && Array.isArray(report.aiRecommendations)) {
        report.aiRecommendations = report.aiRecommendations.map((rec: any, idx: number) => {
          if (!rec.imageUrl || !rec.imageUrl.startsWith("http")) {
            rec.imageUrl = fallbackImages[idx % fallbackImages.length];
          }
          return rec;
        });
      }

      res.json(report);
    } catch (error: any) {
      console.error("AI Analytics Report error:", error);
      res.status(500).json({ error: error.message || "Gaming intelligence matrix offline." });
    }
  });

  // High-fidelity static fallback catalog of Free-To-Play games to bypass Cloudflare and proxy blocks in serverless envs like Vercel
  const fallbackFreeGames = [
    {
      id: "freetogame-515",
      title: "Apex Legends",
      description: "A free-to-play battle royale game where legendary competitors battle for glory, fame, and fortune on the fringes of the Frontier.",
      rating: 8.9,
      releaseDate: "2019-02-04",
      genres: ["Shooter", "Battle Royale"],
      developers: ["Respawn Entertainment"],
      publishers: ["Electronic Arts"],
      platforms: ["PC"],
      imageUrl: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80",
      trailerKeyword: "Apex Legends Reveal trailer"
    },
    {
      id: "freetogame-516",
      title: "Genshin Impact",
      description: "An open-world action RPG where players explore the fantasy world of Teyvat, solve puzzles, and battle powerful enemies while uncovering mysteries.",
      rating: 9.2,
      releaseDate: "2020-09-28",
      genres: ["RPG", "Anime"],
      developers: ["miHoYo"],
      publishers: ["miHoYo"],
      platforms: ["PC"],
      imageUrl: "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?auto=format&fit=crop&w=1200&q=80",
      trailerKeyword: "Genshin Impact Gameplay Trailer"
    },
    {
      id: "freetogame-517",
      title: "Counter-Strike 2",
      description: "A tactical first-person shooter building on the legendary legacy of CS:GO, featuring refined graphics and realistic smoke mechanics.",
      rating: 9.1,
      releaseDate: "2023-09-27",
      genres: ["Shooter", "Tactical"],
      developers: ["Valve"],
      publishers: ["Valve"],
      platforms: ["PC"],
      imageUrl: "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1200&q=80",
      trailerKeyword: "Counter Strike 2 Launch Trailer"
    },
    {
      id: "freetogame-518",
      title: "Warframe",
      description: "Become an unstoppable space warrior in an expansive third-person action-co-op shooter, customising your Warframe exosuit.",
      rating: 8.8,
      releaseDate: "2013-03-25",
      genres: ["Shooter", "Sci-Fi"],
      developers: ["Digital Extremes"],
      publishers: ["Digital Extremes"],
      platforms: ["PC"],
      imageUrl: "https://images.unsplash.com/photo-1552820728-8b83bb6b773f?auto=format&fit=crop&w=1200&q=80",
      trailerKeyword: "Warframe Cinematic Trailer"
    },
    {
      id: "freetogame-521",
      title: "Overwatch 2",
      description: "A vibrant, free-to-play team-based action game set in an optimistic future, featuring unique heroes battling on 5v5 battlefields.",
      rating: 8.3,
      releaseDate: "2022-10-04",
      genres: ["Shooter", "Tactical"],
      developers: ["Blizzard Entertainment"],
      publishers: ["Blizzard Entertainment"],
      platforms: ["PC"],
      imageUrl: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80",
      trailerKeyword: "Overwatch 2 Cinematic Trailer"
    },
    {
      id: "freetogame-522",
      title: "Destiny 2",
      description: "Dive into the world of Destiny 2 to explore the mysteries of the solar system and experience responsive first-person shooter combat.",
      rating: 8.6,
      releaseDate: "2017-09-06",
      genres: ["Shooter", "Sci-Fi"],
      developers: ["Bungie"],
      publishers: ["Bungie"],
      platforms: ["PC"],
      imageUrl: "https://images.unsplash.com/photo-1552820728-8b83bb6b773f?auto=format&fit=crop&w=1200&q=80",
      trailerKeyword: "Destiny 2 Gameplay Trailer"
    },
    {
      id: "freetogame-523",
      title: "Lost Ark",
      description: "Embark on an epic odyssey in a massive, vibrant world: explore new lands, seek out lost treasures, and test yourself in thrilling combat.",
      rating: 8.5,
      releaseDate: "2022-02-11",
      genres: ["RPG", "Fantasy"],
      developers: ["Smilegate RPG"],
      publishers: ["Amazon Games"],
      platforms: ["PC"],
      imageUrl: "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1200&q=80",
      trailerKeyword: "Lost Ark Launch Trailer"
    },
    {
      id: "freetogame-525",
      title: "Guild Wars 2",
      description: "Guild Wars 2 is an online role-playing game with fast-paced action combat, a rich and detailed universe of stories, and breathtaking landscapes.",
      rating: 8.7,
      releaseDate: "2012-08-28",
      genres: ["RPG", "Fantasy"],
      developers: ["ArenaNet"],
      publishers: ["NCSoft"],
      platforms: ["PC"],
      imageUrl: "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?auto=format&fit=crop&w=1200&q=80",
      trailerKeyword: "Guild Wars 2 Gameplay Trailer"
    },
    {
      id: "freetogame-526",
      title: "Valorant",
      description: "A 5v5 character-based tactical shooter where precise gunplay meets unique agent abilities in tense round-based offensive/defensive runs.",
      rating: 8.8,
      releaseDate: "2020-06-02",
      genres: ["Shooter", "Tactical"],
      developers: ["Riot Games"],
      publishers: ["Riot Games"],
      platforms: ["PC"],
      imageUrl: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80",
      trailerKeyword: "Valorant Cinematic Trailer"
    },
    {
      id: "freetogame-527",
      title: "League of Legends",
      description: "A team-based strategy game where two teams of five powerful champions face off to destroy the other's base in lane-pushing encounters.",
      rating: 8.6,
      releaseDate: "2009-10-27",
      genres: ["Strategy", "MOBA"],
      developers: ["Riot Games"],
      publishers: ["Riot Games"],
      platforms: ["PC"],
      imageUrl: "https://images.unsplash.com/photo-1552820728-8b83bb6b773f?auto=format&fit=crop&w=1200&q=80",
      trailerKeyword: "League of Legends Cinematic"
    },
    {
      id: "freetogame-529",
      title: "Hearthstone",
      description: "A fast-paced strategy card game that's easy to learn and insanely fun. Play free, summon minions, and duel opponents with legendary Warcraft cards.",
      rating: 8.2,
      releaseDate: "2014-03-11",
      genres: ["Card", "Strategy"],
      developers: ["Blizzard Entertainment"],
      publishers: ["Blizzard Entertainment"],
      platforms: ["PC"],
      imageUrl: "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1200&q=80",
      trailerKeyword: "Hearthstone Expansion Trailer"
    },
    {
      id: "freetogame-530",
      title: "Dota 2",
      description: "Every day, millions of players worldwide enter battle as one of over a hundred Dota heroes in intense tactical MOBA arenas.",
      rating: 8.9,
      releaseDate: "2013-07-09",
      genres: ["Strategy", "MOBA"],
      developers: ["Valve Corporation"],
      publishers: ["Valve Corporation"],
      platforms: ["PC"],
      imageUrl: "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?auto=format&fit=crop&w=1200&q=80",
      trailerKeyword: "Dota 2 Launch Trailer"
    },
    {
      id: "freetogame-531",
      title: "Trove",
      description: "Grab your friends, hone your weapons, and set off for adventure in Trove, the ultimate action MMO voxel sandbox with infinite realm crafting.",
      rating: 7.9,
      releaseDate: "2015-07-09",
      genres: ["Sandbox", "RPG"],
      developers: ["Trion Worlds"],
      publishers: ["gamigo US"],
      platforms: ["PC", "Browser"],
      imageUrl: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80",
      trailerKeyword: "Trove Gameplay Trailer"
    },
    {
      id: "freetogame-532",
      title: "Albion Online",
      description: "Albion Online is a fantasy sandbox MMORPG featuring a player-driven economy, classless combat system, and intense PvP battles.",
      rating: 8.1,
      releaseDate: "2017-07-17",
      genres: ["RPG", "Fantasy"],
      developers: ["Sandbox Interactive"],
      publishers: ["Sandbox Interactive"],
      platforms: ["PC", "Browser"],
      imageUrl: "https://images.unsplash.com/photo-1552820728-8b83bb6b773f?auto=format&fit=crop&w=1200&q=80",
      trailerKeyword: "Albion Online Gameplay Trailer"
    }
  ];

  // FreeToGame API proxy directory
  app.get("/api/freetogame/games", async (req, res) => {
    const { platform, category, sortBy } = req.query;
    try {
      let url = "https://www.freetogame.com/api/games";
      const params = new URLSearchParams();

      if (platform && platform !== "all") {
        params.append("platform", String(platform).toLowerCase());
      }
      if (category && category !== "all") {
        params.append("category", String(category).toLowerCase());
      }
      if (sortBy && sortBy !== "rating") {
        // FreeToGame supports: release-date, popularity, alphabetical, relevance
        const fSort = sortBy === "alphabetical" ? "alphabetical" : "popularity";
        params.append("sort-by", fSort);
      }

      const queryString = params.toString();
      if (queryString) {
        url += `?${queryString}`;
      }

      console.log(`[AIKENNET] Proxying request to FreeToGame database: ${url}`);
      const fResponse = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
          "Accept": "application/json"
        }
      });
      if (!fResponse.ok) {
        throw new Error(`FreeToGame network responded with status ${fResponse.status}`);
      }

      const rawGames = await fResponse.json();
      if (!Array.isArray(rawGames)) {
        return res.json([]);
      }

      const mappedGames = rawGames.slice(0, 40).map((f: any) => {
        // Generate a deterministic rating around 7.2 - 9.7 using characters sum hash
        const nameHash = f.title.split("").reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
        const rating = Number((7.2 + (nameHash % 25) / 10).toFixed(1));

        const rawPlatform = (f.platform || "").toLowerCase();
        const platforms: string[] = [];
        if (rawPlatform.includes("pc")) platforms.push("PC");
        if (rawPlatform.includes("browser") || rawPlatform.includes("web")) platforms.push("Browser");
        if (platforms.length === 0) platforms.push("PC");

        return {
          id: `freetogame-${f.id}`,
          title: f.title,
          description: f.short_description || "",
          rating,
          releaseDate: f.release_date || "Unknown",
          genres: f.genre ? [f.genre] : ["MMO"],
          developers: f.developer ? [f.developer] : ["Unknown"],
          publishers: f.publisher ? [f.publisher] : ["Unknown"],
          platforms,
          imageUrl: f.thumbnail || "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80",
          trailerKeyword: `${f.title} official trailer`,
        };
      });

      res.json(mappedGames);
    } catch (error: any) {
      console.warn("FreeToGame proxy stream failed or rate-limited. Serving intelligent high-fidelity fallbacks:", error);
      
      // Filter fallback list based on parameters to mimic real FreeToGame response
      let filtered = fallbackFreeGames;
      if (platform && platform !== "all") {
        const pStr = String(platform).toLowerCase();
        filtered = filtered.filter(g => g.platforms.some(p => p.toLowerCase().includes(pStr)));
      }
      if (category && category !== "all") {
        const cStr = String(category).toLowerCase();
        filtered = filtered.filter(g => g.genres.some(gen => gen.toLowerCase().includes(cStr)));
      }
      
      res.json(filtered);
    }
  });

  // FreeToGame single game detailed information proxy
  app.get("/api/freetogame/game/:id", async (req, res) => {
    const fullId = req.params.id;
    try {
      const cleanId = fullId.replace("freetogame-", "");
      const url = `https://www.freetogame.com/api/game?id=${cleanId}`;

      console.log(`[AIKENNET] Proxying single game detail lookup: ${url}`);
      const fResponse = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
          "Accept": "application/json"
        }
      });
      if (!fResponse.ok) {
        throw new Error(`Detailed gaming logs returned status ${fResponse.status}`);
      }

      const f = await fResponse.json();

      // Deterministic rating
      const nameHash = f.title.split("").reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
      const rating = Number((7.2 + (nameHash % 25) / 10).toFixed(1));

      const rawPlatform = (f.platform || "").toLowerCase();
      const platforms: string[] = [];
      if (rawPlatform.includes("pc")) platforms.push("PC");
      if (rawPlatform.includes("browser") || rawPlatform.includes("web")) platforms.push("Browser");
      if (platforms.length === 0) platforms.push("PC");

      const screenshots = (f.screenshots || []).map((s: any) => s.image || "");

      res.json({
        id: `freetogame-${f.id}`,
        title: f.title,
        description: f.description || f.short_description || "",
        rating,
        releaseDate: f.release_date || "Unknown",
        genres: f.genre ? [f.genre] : ["MMO"],
        developers: f.developer ? [f.developer] : ["Unknown"],
        publishers: f.publisher ? [f.publisher] : ["Unknown"],
        platforms,
        imageUrl: f.thumbnail || "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80",
        trailerKeyword: `${f.title} official game trailer`,
        playUrl: f.game_url || "",
        screenshots,
        systemRequirements: f.minimum_system_requirements || null,
      });
    } catch (error: any) {
      console.warn("FreeToGame single proxy lookup failed. Seeking fallbacks registry for ID:", fullId, error);
      
      const matched = fallbackFreeGames.find(g => g.id === fullId);
      if (matched) {
        res.json({
          ...matched,
          playUrl: "https://www.freetogame.com",
          screenshots: [
            "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q ribbons=80",
            "https://images.unsplash.com/photo-1552820728-8b83bb6b773f?auto=format&fit=crop&w=1200&q=80"
          ],
          systemRequirements: {
            os: "Windows 10 64-bit",
            processor: "Intel Core i5-2500K / AMD FX-6300",
            memory: "8 GB RAM",
            graphics: "Nvidia GeForce GTX 760 / AMD Radeon R9 270",
            storage: "30 GB available space"
          }
        });
      } else {
        const cleanName = fullId.replace("freetogame-", "").replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
        res.json({
          id: fullId,
          title: cleanName,
          description: `Unlock the massive secrets and dynamic combat mechanics inside ${cleanName}. Embark on daily quests and challenge opponents inside free play battlegrounds.`,
          rating: 8.5,
          releaseDate: "2022-05-23",
          genres: ["MMO", "Action"],
          developers: ["Gaming Core Team"],
          publishers: ["gamesbody Publications"],
          platforms: ["PC"],
          imageUrl: "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80",
          trailerKeyword: `${cleanName} gameplay trailer`,
          playUrl: "https://www.freetogame.com",
          screenshots: [
            "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80"
          ],
          systemRequirements: {
            graphics: "GTX 960",
            memory: "8 GB RAM",
            os: "Windows 10",
            processor: "Intel core i5",
            storage: "15 GB"
          }
        });
      }
    }
  });

  // Serve static assets in production, otherwise mount Vite dev server
  if (process.env.NODE_ENV !== "production" && !process.env.VERCEL) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    let distPath = path.join(process.cwd(), "dist");
    if (!fs.existsSync(distPath)) {
      distPath = path.join(__dirname, "dist");
    }
    if (!fs.existsSync(distPath)) {
      distPath = path.join(__dirname, "../dist");
    }
    
    // Intercept template requests for premium dynamic pre-rendered organic SEO
    app.use(express.static(distPath, { index: false }));
    
    app.get("*", async (req, res) => {
      try {
        const seoSettings = await getSeoSettings();
        const filePath = path.join(distPath, "index.html");
        if (!fs.existsSync(filePath)) {
          return res.status(404).send("Build artifact index.html not found.");
        }
        let html = fs.readFileSync(filePath, "utf8");

        const view = (req.query.view as string) || "";
        const gameId = (req.query.game as string) || "";
        const hostUrl = `${req.protocol}://${req.get("host")}`;
        const currentFullUrl = `${hostUrl}${req.originalUrl}`;

        let titleVal = "gamesbody – Play Free Games, AI Lore Secrets & Custom Playlists Hub";
        let descVal = "Discover, rank, and explore free games on gamesbody. Access 100% free titles, track active storefront discount deals, build custom playlists, and get AI-powered insights.";
        let ogImage = "https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&w=1200&q=80";
        let schemas: any[] = [];
        let accessibleHtml = "";

        if (gameId) {
          const matched = curatedGames.find((g) => g.id === gameId);
          if (matched) {
            titleVal = `${matched.title} Review, Download & AI Lore Secrets | gamesbody`;
            descVal = `Check out ${matched.title} on gamesbody. Get official ratings, system requirements, epic discount guides, and interact with the AI lore oracle for gameplay secrets.`;
            ogImage = matched.imageUrl || ogImage;

            schemas.push({
              "@context": "https://schema.org",
              "@type": "VideoGame",
              "name": matched.title,
              "description": matched.description,
              "genre": matched.genres,
              "operatingSystem": matched.platforms,
              "publisher": matched.publishers.map((p) => ({ "@type": "Organization", "name": p })),
              "author": matched.developers.map((d) => ({ "@type": "Organization", "name": d })),
              "image": matched.imageUrl,
              "aggregateRating": {
                "@type": "AggregateRating",
                "ratingValue": String(matched.rating),
                "bestRating": "10",
                "worstRating": "1",
                "ratingCount": "912"
              }
            });

            schemas.push({
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              "itemListElement": [
                { "@type": "ListItem", "position": 1, "name": "gamesbody", "item": hostUrl },
                { "@type": "ListItem", "position": 2, "name": "Curated Games", "item": `${hostUrl}/?view=home` },
                { "@type": "ListItem", "position": 3, "name": matched.title, "item": currentFullUrl }
              ]
            });

            accessibleHtml = `
              <nav aria-label="Breadcrumb" class="sr-only" style="display:none;">
                <ol>
                  <li><a href="/">Home</a></li>
                  <li><a href="/?view=home">Curated Catalog</a></li>
                  <li><a href="${currentFullUrl}">${matched.title}</a></li>
                </ol>
              </nav>
              <article class="sr-only" style="display:none;">
                <h1>${matched.title}</h1>
                <p>${matched.description}</p>
                <p>gamesbody Rating: ${matched.rating}/10</p>
                <p>Release Date: ${matched.releaseDate}</p>
                <p>Developers: ${matched.developers.join(", ")}</p>
                <p>Publishers: ${matched.publishers.join(", ")}</p>
              </article>
            `;
          }
        } else if (view === "free-games") {
          titleVal = "Free to Play Games Catalog – PC & Browser MMO Directories | gamesbody";
          descVal = "Explore and download hundreds of 100% free-to-play multiplayer online games (MMORPGs, tactical shooters, and card battle arenas) through safe verified outlets.";

          schemas.push({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": [
              {
                "@type": "Question",
                "name": "What are the best free-to-play games available on gamesbody?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "The gamesbody platform connects with game directories to serve live, top-performing free shooter, MMORPG, anime, sports, and card games."
                }
              },
              {
                "@type": "Question",
                "name": "Are there any hidden costs or pay-to-play elements?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "Every single title listed inside the gamesbody free-to-play grid belongs to the completely 100% free games category, with direct installer checkouts."
                }
              }
            ]
          });

          schemas.push({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
              { "@type": "ListItem", "position": 1, "name": "gamesbody", "item": hostUrl },
              { "@type": "ListItem", "position": 2, "name": "Free-to-Play Games", "item": currentFullUrl }
            ]
          });

          accessibleHtml = `
            <nav aria-label="Breadcrumb" class="sr-only" style="display:none;">
              <ol>
                <li><a href="/">Home</a></li>
                <li><a href="${currentFullUrl}">Free-to-Play Games</a></li>
              </ol>
            </nav>
            <section class="sr-only" style="display:none;">
              <h1>Free to Play Games Catalog</h1>
              <p>Explore hundreds of 100% free-to-play multiplayer shooters, MMORPGs, card battle arenas, anime sandbox games, and web strategy programs.</p>
            </section>
          `;
        } else if (view === "lists") {
          titleVal = "Curated Custom Playlists and Player-Built Collections | gamesbody";
          descVal = "Create, share, and review top-tier gaming collections built by the social gaming community. Create custom playlists of RPGs, shooters, or sci-fi simulators.";

          schemas.push({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
              { "@type": "ListItem", "position": 1, "name": "gamesbody", "item": hostUrl },
              { "@type": "ListItem", "position": 2, "name": "Gamer Collections", "item": currentFullUrl }
            ]
          });

          accessibleHtml = `
            <nav aria-label="Breadcrumb" class="sr-only" style="display:none;">
              <ol>
                <li><a href="/">Home</a></li>
                <li><a href="${currentFullUrl}">Gaming Playlists</a></li>
              </ol>
            </nav>
            <section class="sr-only" style="display:none;">
              <h1>Gamer Playlists & Collections</h1>
              <p>Initialize and synchronize completely custom collections with other users. Log in, define your genres list, and select favorites.</p>
            </section>
          `;
        } else {
          schemas.push({
            "@context": "https://schema.org",
            "@type": "WebSite",
            "name": "gamesbody",
            "url": hostUrl,
            "description": "Premium cyberpunk-themed cinematic gaming discovery, free game catalog, and live store deals aggregator platform.",
            "potentialAction": {
              "@type": "SearchAction",
              "target": {
                "@type": "EntryPoint",
                "urlTemplate": `${hostUrl}/?search={search_term_string}`
              },
              "query-input": "required name=search_term_string"
            }
          });

          schemas.push({
            "@context": "https://schema.org",
            "@type": "Organization",
            "name": "gamesbody",
            "url": hostUrl,
            "logo": ogImage
          });

          schemas.push({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": [
              {
                "@type": "Question",
                "name": "What is gamesbody?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "gamesbody is the ultimate gaming discovery platform, PC free-to-play catalog, and live storefront deals aggregator database. Read rich lore details, compare ratings, track store discounts, and chat with AI oracles."
                }
              },
              {
                "@type": "Question",
                "name": "How are rating indexes computed?",
                "acceptedAnswer": {
                  "@type": "Answer",
                  "text": "gamesbody reviews scores utilizing an aggressive deterministic matrix evaluation ranging up to a perfect 10/10."
                }
              }
            ]
          });
        }

        let metaTags = `
    <!-- Comprehensive technical SEO -->
    <link rel="canonical" href="${currentFullUrl}" />
    <meta name="description" content="${descVal}" />
    <meta name="keywords" content="gamesbody, gamesbody catalog, gamesbody discount deals, free games, free to play games, gaming database, play free online, cyberpunk rpgs, game lore, AI gaming, digital checkout directories, video game specs" />
    
    <!-- OpenGraph Social protocol metadata -->
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${currentFullUrl}" />
    <meta property="og:title" content="${titleVal}" />
    <meta property="og:description" content="${descVal}" />
    <meta property="og:image" content="${ogImage}" />
    <meta property="og:site_name" content="gamesbody" />

    <!-- Twitter metadata -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${titleVal}" />
    <meta name="twitter:description" content="${descVal}" />
    <meta name="twitter:image" content="${ogImage}" />
    
    <!-- E-E-A-T signal authorships -->
    <meta name="author" content="gamesbody Gaming Core Team" />
    <meta name="publisher" content="gamesbody Inc." />
        `;

        // Dynamic server-side SEO custom metadata injections from settings db
        if (seoSettings.googleSearchConsoleKey) {
          metaTags += `\n    <meta name="google-site-verification" content="${seoSettings.googleSearchConsoleKey.trim()}" />`;
        }
        if (seoSettings.bingWebmasterKey) {
          metaTags += `\n    <meta name="msvalidate.01" content="${seoSettings.bingWebmasterKey.trim()}" />`;
        }
        if (seoSettings.googleAnalyticsId) {
          metaTags += `\n    <!-- Google tag (gtag.js) -->\n    <script async src="https://www.googletagmanager.com/gtag/js?id=${seoSettings.googleAnalyticsId.trim()}"></script>\n    <script>\n      window.dataLayer = window.dataLayer || [];\n      function gtag(){dataLayer.push(arguments);}\n      gtag('js', new Date());\n      gtag('config', '${seoSettings.googleAnalyticsId.trim()}');\n    </script>`;
        }

        const schemaString = schemas.map((s) => `
    <script type="application/ld+json">
    ${JSON.stringify(s, null, 2)}
    </script>`).join("\n");

        html = html.replace("<title>gamesbody – Play Free Games, AI Lore Insights & Custom Playlists Hub</title>", `<title>${titleVal}</title>`);
        html = html.replace("<!-- SEO_META_TAGS_PLACEHOLDER -->", metaTags.trim());
        html = html.replace("<!-- SEO_SCHEMA_PLACEHOLDER -->", schemaString.trim());
        html = html.replace("<!-- SEO_BREADCRUMBS_ACCESSIBLE_LIST_PLACEHOLDER -->", accessibleHtml.trim());

        res.status(200).send(html);
      } catch (err: any) {
        console.error("SEO Pre-rendering interceptor error:", err);
        res.status(500).send("Crawler recovery bypass error.");
      }
    });
  }

  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`[GAMESBODY BACKEND] Server running on port ${PORT}`);
    });
  }
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});

export default app;
