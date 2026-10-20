import mongoose from "mongoose";
const connectDB = async () => {
  let uri = process.env.MONGODB_URI || process.env.MONGO_URL;
  if (!uri || process.env.USE_MEMORY_DB === "true") {
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    const mem = await MongoMemoryServer.create();
    uri = mem.getUri("instagram_clone");
    console.log("⚠️  No MONGODB_URI set – using in-memory MongoDB (data is lost on restart)");
  }
  await mongoose.connect(uri);
  await mongoose.connection.syncIndexes().catch((e) => console.warn("index sync:", e.message));
  console.log("MongoDB connected");
};
export default connectDB;
