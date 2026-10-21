import Groq from "groq-sdk";
// Falls back to a placeholder so the server boots without a key; AI endpoints will return an error until it is set.
const groq = new Groq({ apiKey: process.env.GROQ_API || process.env.GROQ_API_KEY || "missing-groq-key" });
export default groq;
