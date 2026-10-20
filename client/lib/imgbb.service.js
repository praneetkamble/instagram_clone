import axiosInstance from "./axios";
// Uploads go through our backend (/api/upload), which stores them in Cloudinary / imgbb / MongoDB / disk.
// Files bigger than the backend's request limit (Vercel: 4.5 MB) are sent straight to Cloudinary
// with a signature from /api/upload/sign, when Cloudinary is configured on the server.
let cfg;
const getCfg = async () => (cfg ||= axiosInstance.get("/api/upload/config").then((r) => r.data).catch(() => ({ maxRequestMB: 4.4 })));
async function direct(file) {
  const s = (await axiosInstance.get("/api/upload/sign")).data;
  const fd = new FormData();
  fd.append("file", file); fd.append("api_key", s.apiKey); fd.append("timestamp", s.timestamp); fd.append("folder", s.folder); fd.append("signature", s.signature);
  const r = await fetch(`https://api.cloudinary.com/v1_1/${s.cloudName}/auto/upload`, { method: "POST", body: fd });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error?.message || "Upload failed");
  return { url: j.secure_url, type: file.type.startsWith("video") ? "video" : "image", size: file.size, width: j.width, height: j.height };
}
export const uploadFiles = async (files) => {
  const c = await getCfg();
  const limit = (c.maxRequestMB || 4.4) * 1024 * 1024;
  const out = [];
  let batch = [], batchSize = 0;
  const flush = async () => {
    if (!batch.length) return;
    const fd = new FormData();
    for (const f of batch) fd.append("files", f);
    const res = await axiosInstance.post("/api/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
    out.push(...res.data.files); batch = []; batchSize = 0;
  };
  for (const f of files) {
    if (f.size > limit) {
      if (!c.cloudinary) throw Object.assign(new Error(`File too large (max ${c.maxRequestMB} MB)`), { response: { data: { code: "FILE_TOO_LARGE" } } });
      out.push(await direct(f)); continue;
    }
    if (batchSize + f.size > limit) await flush();
    batch.push(f); batchSize += f.size;
  }
  await flush();
  return out;
};
export const uploadImage = async (file) => {
  const [f] = await uploadFiles([file]);
  return { url: f.url, type: f.type };
};
