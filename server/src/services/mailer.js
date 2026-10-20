import nodemailer from "nodemailer";
let transporter = null;
const hasSmtp = () => process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;
const getTransport = () => {
  if (!transporter && hasSmtp()) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 12000,
    });
  }
  return transporter;
};
export const outbox = []; // last messages, useful in dev/tests
export async function sendEmail({ to, subject, text, html }) {
  const entry = { channel: "email", to, subject, text, at: new Date() };
  outbox.push(entry); if (outbox.length > 200) outbox.shift();
  const t = getTransport();
  if (!t) {
    console.log(`\n📧 [DEV EMAIL] to=${to}\n   subject: ${subject}\n   ${text.replace(/\n/g, "\n   ")}\n`);
    return { dev: true };
  }
  try {
    await t.sendMail({ from: process.env.MAIL_FROM || process.env.SMTP_USER, to, subject, text, html: html || `<pre style="font-family:sans-serif">${text}</pre>` });
    return { sent: true };
  } catch (e) {
    console.error("Email send failed:", e.message);
    console.log(`📧 [EMAIL FALLBACK LOG] to=${to} subject=${subject}\n${text}`);
    return { error: e.message };
  }
}
