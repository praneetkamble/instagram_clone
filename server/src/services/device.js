// Lightweight UA parsing. NOTE: Edge UA contains "Chrome", so detect Edg/ first.
export function parseUA(ua = "") {
  let browser = "Unknown", browserVersion = "";
  const m = (re) => { const r = ua.match(re); return r ? r[1] : ""; };
  if (/Edg(e|A|iOS)?\//.test(ua)) { browser = "Microsoft Edge"; browserVersion = m(/Edg(?:e|A|iOS)?\/([\d.]+)/); }
  else if (/OPR\/|Opera/.test(ua)) { browser = "Opera"; browserVersion = m(/OPR\/([\d.]+)/); }
  else if (/SamsungBrowser\//.test(ua)) { browser = "Samsung Internet"; browserVersion = m(/SamsungBrowser\/([\d.]+)/); }
  else if (/Firefox\/|FxiOS\//.test(ua)) { browser = "Firefox"; browserVersion = m(/(?:Firefox|FxiOS)\/([\d.]+)/); }
  else if (/CriOS\//.test(ua)) { browser = "Chrome"; browserVersion = m(/CriOS\/([\d.]+)/); }
  else if (/Chrome\//.test(ua)) { browser = "Chrome"; browserVersion = m(/Chrome\/([\d.]+)/); }
  else if (/Safari\//.test(ua)) { browser = "Safari"; browserVersion = m(/Version\/([\d.]+)/); }
  else if (/curl\//i.test(ua)) { browser = "curl"; }

  let os = "Unknown";
  if (/Windows NT/.test(ua)) os = "Windows";
  else if (/Android/.test(ua)) os = "Android";
  else if (/iPhone|iPad|iPod/.test(ua)) os = "iOS";
  else if (/Mac OS X|Macintosh/.test(ua)) os = "macOS";
  else if (/CrOS/.test(ua)) os = "Chrome OS";
  else if (/Linux/.test(ua)) os = "Linux";

  let deviceType = "Desktop";
  if (/iPad|Tablet/.test(ua) || (/Android/.test(ua) && !/Mobile/.test(ua))) deviceType = "Tablet";
  else if (/Mobi|iPhone|iPod|Android.*Mobile|Windows Phone/.test(ua)) deviceType = "Mobile";
  else if (/Macintosh|Windows NT|CrOS/.test(ua) && /Laptop|Touch/.test(ua)) deviceType = "Laptop";
  return { browser, browserVersion, os, deviceType, isMobile: deviceType === "Mobile" || deviceType === "Tablet" };
}
export function clientIp(req) {
  // Vercel: x-vercel-forwarded-for / x-real-ip carry the real client; otherwise first x-forwarded-for hop.
  const h = req.headers;
  const fwd = h["x-vercel-forwarded-for"] || h["x-forwarded-for"] || h["x-real-ip"];
  return (fwd ? String(fwd).split(",")[0].trim() : req.socket?.remoteAddress || "").replace(/^::ffff:/, "");
}
