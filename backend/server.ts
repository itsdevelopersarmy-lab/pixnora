import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // Proxy endpoint to bypass CORS
  app.post("/api/proxy", async (req, res) => {
    const { url, method, headers, body } = req.body;

    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    try {
      console.log(`[PROXY] ${method || 'GET'} ${url}`);
      
      const fetchOptions: any = {
        method: method || 'GET',
        headers: {
          'User-Agent': 'Pixnora-AI-Orchestrator/1.0',
          'Client-Agent': 'Pixnora-AI:1.0:itsdevelopersarmy@gmail.com',
          ...headers
        }
      };

      if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body);
        if (!fetchOptions.headers['Content-Type']) {
          fetchOptions.headers['Content-Type'] = 'application/json';
        }
      }

      const response = await fetch(url, fetchOptions);
      const contentType = response.headers.get("content-type");
      
      let responseData;
      if (contentType && contentType.includes("application/json")) {
        responseData = await response.json();
      } else {
        responseData = { text: await response.text() };
      }

      console.log(`[PROXY] Response from ${url}: ${response.status}`);
      res.status(response.status).json(responseData);
    } catch (error) {
      console.error(`[PROXY] Error requesting ${url}:`, error);
      res.status(500).json({ 
        error: "Proxy request failed", 
        details: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
