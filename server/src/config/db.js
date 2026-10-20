import mongoose from "mongoose";
// Cached across serverless invocations (Vercel reuses warm instances) and safe to call repeatedly.
const g = globalThis;
g.__mongo ||= { promise: null };
const connectDB = async () => {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (!g.__mongo.promise) {
    g.__mongo.promise = (async () => {
      let uri = process.env.MONGODB_URI || process.env.MONGO_URL;
      // Atlas copy-paste URIs keep a "<db_password>" placeholder; fill it from a separate (secret) env var.
      if (uri && process.env.MONGODB_DB_PASSWORD && /<db_password>|<password>/.test(uri))
        uri = uri.replace(/<db_password>|<password>/g, encodeURIComponent(process.env.MONGODB_DB_PASSWORD));
      if (!uri || process.env.USE_MEMORY_DB === "true") {
        if (process.env.VERCEL) throw new Error("MONGODB_URI is required on Vercel");
        const { MongoMemoryServer } = await import("mongodb-memory-server");
        const mem = await MongoMemoryServer.create();
        uri = mem.getUri("instagram_clone");
        console.log("⚠️  No MONGODB_URI set – using in-memory MongoDB (data is lost on restart)");
      }
      mongoose.set("bufferCommands", true);
      await mongoose.connect(uri, { maxPoolSize: process.env.VERCEL ? 5 : 20, serverSelectionTimeoutMS: 10000 });
      // index sync is slow; on serverless do it only when asked (seed endpoint) or once per cold start in background
      if (!process.env.VERCEL) await mongoose.connection.syncIndexes().catch((e) => console.warn("index sync:", e.message));
      console.log("MongoDB connected");
      return mongoose.connection;
    })().catch((e) => { g.__mongo.promise = null; throw e; });
  }
  return g.__mongo.promise;
};
export default connectDB;
