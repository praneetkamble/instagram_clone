// Time helpers. TEST_NOW (ISO) lets QA simulate a time; ignored in production.
export const now = () => (process.env.NODE_ENV !== "production" && process.env.TEST_NOW ? new Date(process.env.TEST_NOW) : new Date());
export function istHour(d = now()) {
  const ist = new Date(d.getTime() + 330 * 60000);
  return ist.getUTCHours() + ist.getUTCMinutes() / 60;
}
// "Server time": APP_TZ (e.g. Asia/Kolkata) when set — Vercel always runs in UTC and TZ can't be changed there.
export function serverHour(d = now()) {
  const tz = process.env.APP_TZ;
  if (!tz) return d.getHours() + d.getMinutes() / 60;
  const [h, m] = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d).split(":").map(Number);
  return h + m / 60;
}
export const isPaymentWindowOpen = (d = now()) => { const h = istHour(d); return h >= 5 && h < 11; };
export const isMobileLoginWindowOpen = (d = now()) => { const h = serverHour(d); return h >= 10 && h < 13; };
