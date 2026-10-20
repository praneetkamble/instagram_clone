import "dotenv/config";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import User from "./models/User.model.js";
export const ADMIN = { email: process.env.ADMIN_EMAIL || "admin@instai.dev", password: process.env.ADMIN_PASSWORD || "Admin@12345", username: "admin" };
export async function seed() {
  let u = await User.findOne({ email: ADMIN.email });
  if (!u) u = await User.create({ username: ADMIN.username, fullName: "Platform Admin", email: ADMIN.email, password: await bcrypt.hash(ADMIN.password, 10), role: "admin", isVerified: true, phone: "+910000000000" });
  else { u.role = "admin"; await u.save(); }
  console.log(`✅ Admin ready: ${ADMIN.email} / ${ADMIN.password}`);
  return u;
}
if (process.argv[1] && process.argv[1].endsWith("seed.js")) {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URL;
  if (!uri) { console.error("Set MONGODB_URI first"); process.exit(1); }
  await mongoose.connect(uri); await seed(); await mongoose.disconnect();
}
