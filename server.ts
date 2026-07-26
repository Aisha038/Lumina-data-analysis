import express from "express";
import path from "path";
import cors from "cors";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const PORT = 3000;

// Lazy initialize Gemini API client
let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required. Please set it in the Secrets panel.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

async function startServer() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // API Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // API Route to analyze data using Gemini 3.5 Flash
  app.post("/api/analyze", async (req, res) => {
    try {
      const { tableName, columns, rowCount, summaryStats, sampleRows } = req.body;

      if (!columns || !sampleRows) {
        res.status(400).json({ error: "Missing columns or sampleRows in request body" });
        return;
      }

      const client = getGeminiClient();

      const prompt = `
        You are an expert Data Analyst and BI Dashboard specialist.
        Analyze the following dataset metadata and sample rows to extract deep insights, summarize the dataset, and suggest the best visualizations.

        Dataset Name: ${tableName || "Uploaded File"}
        Total Records: ${rowCount}
        Columns Metadata: ${JSON.stringify(columns, null, 2)}
        Summary Statistics: ${JSON.stringify(summaryStats, null, 2)}
        Sample Rows Preview (First few rows): ${JSON.stringify(sampleRows, null, 2)}

        Provide your expert assessment in a highly structured, professional, and practical manner.
        Your response must strictly conform to the requested JSON structure.
      `;

      // Helper function to query with retry and fallback
      let response: any = null;
      let lastError: any = null;
      const modelsToTry = ["gemini-3.5-flash", "gemini-3.1-flash-lite"];
      
      for (const modelName of modelsToTry) {
        let attempts = 0;
        const maxAttempts = 3;
        
        while (attempts < maxAttempts) {
          try {
            console.log(`Attempting Gemini analysis with model: ${modelName} (attempt ${attempts + 1}/${maxAttempts})`);
            response = await client.models.generateContent({
              model: modelName,
              contents: prompt,
              config: {
                systemInstruction: `You are a world-class analytics engine. Analyze datasets provided, detect trends, assess data quality, and output exact structured JSON. Never return plain text.`,
                responseMimeType: "application/json",
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    datasetOverview: {
                      type: Type.STRING,
                      description: "A professional, high-level summary of what the dataset is about, its likely domain, and primary purpose.",
                    },
                    keyInsights: {
                      type: Type.ARRAY,
                      description: "A list of key findings, trends, correlations, or interesting patterns in the data.",
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          title: { type: Type.STRING },
                          description: { type: Type.STRING },
                          metric: { type: Type.STRING, description: "Optional highlighted metric or change (e.g. '+24% growth', '$150k avg')" },
                        },
                        required: ["title", "description"],
                      },
                    },
                    dataQualityReport: {
                      type: Type.STRING,
                      description: "Observations on data health, highlighting missing values, anomalies, outliers, or columns that were cleaned well.",
                    },
                    chartSuggestions: {
                      type: Type.ARRAY,
                      description: "Recommended chart configurations to build on the dashboard based on columns.",
                      items: {
                        type: Type.OBJECT,
                        properties: {
                          title: { type: Type.STRING, description: "Title of the suggested chart" },
                          chartType: { type: Type.STRING, description: "Must be one of: 'bar', 'line', 'area', 'pie', 'scatter'" },
                          xAxis: { type: Type.STRING, description: "The column name to use for X-axis" },
                          yAxis: { type: Type.STRING, description: "The column name to use for Y-axis (typically numeric)" },
                          reason: { type: Type.STRING, description: "Why this visual shows value to the business/user" },
                        },
                        required: ["title", "chartType", "xAxis", "yAxis", "reason"],
                      },
                    },
                    recommendations: {
                      type: Type.ARRAY,
                      description: "A list of actionable steps or business suggestions based on the findings.",
                      items: { type: Type.STRING },
                    },
                  },
                  required: ["datasetOverview", "keyInsights", "dataQualityReport", "chartSuggestions", "recommendations"],
                },
              },
            });

            if (response && response.text) {
              break;
            }
          } catch (err: any) {
            lastError = err;
            attempts++;
            console.warn(`Error on model ${modelName}, attempt ${attempts}:`, err.message || err);
            
            // Check if it's a 503 or rate limit / high demand error
            const errStr = JSON.stringify(err);
            const isTemporary = errStr.includes("503") || errStr.includes("UNAVAILABLE") || errStr.includes("RESOURCE_EXHAUSTED") || errStr.includes("high demand") || (err.message && (err.message.includes("503") || err.message.includes("UNAVAILABLE") || err.message.includes("high demand")));
            
            if (isTemporary && attempts < maxAttempts) {
              const waitTime = 1500 * attempts;
              console.log(`Temporary high demand error encountered. Retrying in ${waitTime}ms...`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
            } else {
              break;
            }
          }
        }
        
        if (response && response.text) {
          break;
        }
      }

      if (!response || !response.text) {
        throw lastError || new Error("Failed to generate content from any Gemini models");
      }

      if (!response.text) {
        throw new Error("No response text returned from Gemini API");
      }

      const analysisResult = JSON.parse(response.text);
      res.json(analysisResult);
    } catch (error: any) {
      console.error("Gemini analysis error:", error);
      res.status(500).json({ 
        error: "Failed to analyze data with Gemini", 
        message: error.message || "Unknown error" 
      });
    }
  });

  // Serve static assets in production, otherwise mount Vite dev middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
