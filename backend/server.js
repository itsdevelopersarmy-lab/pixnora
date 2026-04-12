import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { MongoClient } from "mongodb";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/pixnora";
const PORT = 3000;

async function startServer() {
  const app = express();
  app.use(express.json());
  app.use(cors());

  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    console.log("Connected to MongoDB");
  } catch (err) {
    console.error("Failed to connect to MongoDB", err);
  }
  const db = client.db();

  const usersColl = db.collection("users");
  const sessionsColl = db.collection("sessions");

  // API Routes
  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    const user = await usersColl.findOne({ email, password });
    if (user) {
      res.json({ success: true, user });
    } else {
      res.status(401).json({ success: false, message: "Invalid credentials" });
    }
  });

  app.post("/api/auth/signup", async (req, res) => {
    const { email, password, displayName, role } = req.body;
    const existing = await usersColl.findOne({ email });
    if (existing) {
      return res.status(400).json({ success: false, message: "User already exists" });
    }
    const newUser = {
      email,
      password,
      displayName,
      role,
      walletBalance: 10,
      subscriptionTier: "FREE",
      transactions: [{
        id: `TX-INIT-${Date.now()}`,
        type: 'Onboarding Bonus',
        amount: 10,
        timestamp: new Date(),
        status: 'success'
      }],
      createdAt: new Date()
    };
    await usersColl.insertOne(newUser);
    res.json({ success: true, user: newUser });
  });

  app.get("/api/user/:email", async (req, res) => {
    const user = await usersColl.findOne({ email: req.params.email });
    res.json(user);
  });

  app.put("/api/user/:email", async (req, res) => {
    const { walletBalance, subscriptionTier, transactions } = req.body;
    await usersColl.updateOne(
      { email: req.params.email },
      { $set: { walletBalance, subscriptionTier, transactions } }
    );
    res.json({ success: true });
  });

  app.get("/api/sessions/:email", async (req, res) => {
    const sessions = await sessionsColl.find({ userEmail: req.params.email }).toArray();
    res.json(sessions);
  });

  app.post("/api/sessions/:email", async (req, res) => {
    const { sessions } = req.body;
    await sessionsColl.deleteMany({ userEmail: req.params.email });
    if (sessions && sessions.length > 0) {
      await sessionsColl.insertMany(sessions.map((s) => {
        const { _id, ...rest } = s;
        return { ...rest, userEmail: req.params.email };
      }));
    }
    res.json({ success: true });
  });

  // Vite middleware
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

startServer().catch(console.error);
