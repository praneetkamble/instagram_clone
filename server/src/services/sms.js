import axios from "axios";
import { outbox } from "./mailer.js";
export async function sendSMS(to, text) {
  outbox.push({ channel: "sms", to, text, at: new Date() });
  try {
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM) {
      const sid = process.env.TWILIO_ACCOUNT_SID;
      await axios.post(
        `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
        new URLSearchParams({ To: to, From: process.env.TWILIO_FROM, Body: text }),
        { auth: { username: sid, password: process.env.TWILIO_AUTH_TOKEN } },
      );
      return { sent: true, provider: "twilio" };
    }
    if (process.env.FAST2SMS_API_KEY) {
      await axios.post(
        "https://www.fast2sms.com/dev/bulkV2",
        { route: "q", message: text, numbers: to.replace(/^\+91/, "").replace(/\D/g, "") },
        { headers: { authorization: process.env.FAST2SMS_API_KEY } },
      );
      return { sent: true, provider: "fast2sms" };
    }
  } catch (e) {
    console.error("SMS send failed:", e.response?.data || e.message);
  }
  console.log(`\n📱 [DEV SMS] to=${to}: ${text}\n`);
  return { dev: true };
}
