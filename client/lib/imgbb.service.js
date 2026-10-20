import axiosInstance from "./axios";
// Uploads to our own backend (/api/upload) so images AND videos work without third-party keys.
export const uploadFiles = async (files) => {
  const fd = new FormData();
  for (const f of files) fd.append("files", f);
  const res = await axiosInstance.post("/api/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
  return res.data.files;
};
export const uploadImage = async (file) => {
  const [f] = await uploadFiles([file]);
  return { url: f.url, type: f.type };
};
