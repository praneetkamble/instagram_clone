import "dotenv/config";
import http from "http";
import app from "./app.js";
import connectDB from "./config/db.js";
import { initSocket } from "./socket.js";
import { startJobs } from "./jobs/scheduler.js";
const PORT = process.env.PORT || 5000;
if (!process.env.JWT_SECRET) { console.warn("⚠️  JWT_SECRET not set – using an insecure development secret"); process.env.JWT_SECRET = "dev_insecure_secret_change_me"; }
const server = http.createServer(app);
initSocket(server);
const startServer = async () => {
  try {
    await connectDB();
    if (process.env.SEED_ON_START === "true") { const { seed } = await import("./seed.js"); await seed(); }
    if (process.env.DISABLE_JOBS !== "true") startJobs();
    server.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
  } catch (error) { console.error("Server failed:", error); process.exit(1); }
};
startServer();
