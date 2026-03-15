import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

// Fix __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// If Node < 18 install node-fetch
let fetchFn = global.fetch;
if (!fetchFn) {
  fetchFn = (...args) =>
    import("node-fetch").then(({ default: fetch }) => fetch(...args));
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 10000;

  app.use(express.json({ limit: "50mb" }));

  // =========================
  // CORS PROXY API
  // =========================
  app.post("/api/proxy", async (req, res) => {
    const { url, method, headers, body } = req.body;

    if (!url) {
      return res.status(400).json({
        error: "URL is required",
      });
    }

    try {
      console.log(`[PROXY] ${method || "GET"} ${url}`);

      const fetchOptions = {
        method: method || "GET",
        headers: {
          "User-Agent": "Pixnora-AI-Orchestrator/1.0",
          "Client-Agent": "Pixnora-AI:1.0:itsdevelopersarmy@gmail.com",
          ...(headers || {}),
        },
      };

      if (body && ["POST", "PUT", "PATCH"].includes(method)) {
        fetchOptions.body =
          typeof body === "string" ? body : JSON.stringify(body);

        if (!fetchOptions.headers["Content-Type"]) {
          fetchOptions.headers["Content-Type"] = "application/json";
        }
      }

      const response = await fetchFn(url, fetchOptions);
      const contentType = response.headers.get("content-type");

      let responseData;

      if (contentType && contentType.includes("application/json")) {
        responseData = await response.json();
      } else {
        responseData = {
          text: await response.text(),
        };
      }

      console.log(`[PROXY] Response ${response.status}`);

      res.status(response.status).json(responseData);
    } catch (error) {
      console.error("[PROXY ERROR]", error);

      res.status(500).json({
        error: "Proxy request failed",
        details: error.message,
      });
    }
  });

  // =========================
  // DEVELOPMENT (VITE)
  // =========================
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });

    app.use(vite.middlewares);
  }

  // =========================
  // PRODUCTION BUILD
  // =========================
  else {
    const distPath = path.join(process.cwd(), "dist");

    app.use(express.static(distPath));

    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // =========================
  // START SERVER
  // =========================
  app.listen(PORT, "0.0.0.0", () => {
    console.log("================================");
    console.log(`Server running on port ${PORT}`);
    console.log(`http://localhost:${PORT}`);
    console.log("================================");
  });
}

startServer();
