import axios from "axios";
export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || "http://localhost:5000";
const axiosInstance = axios.create({ baseURL: BACKEND_URL, withCredentials: true });
axiosInstance.interceptors.request.use(
  (config) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error),
);
axiosInstance.interceptors.response.use(
  (r) => r,
  (error) => {
    const code = error?.response?.data?.code;
    if (typeof window !== "undefined" && (code === "SESSION_EXPIRED" || code === "ACCOUNT_SUSPENDED" || (error?.response?.status === 401 && code === "UNAUTHORIZED" && localStorage.getItem("accessToken")))) {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("user");
      if (!location.pathname.startsWith("/login")) location.href = "/login";
    }
    return Promise.reject(error);
  },
);
export default axiosInstance;
