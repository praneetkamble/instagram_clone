import { create } from "zustand";
const useAuthStore = create((set) => ({
  user: null,
  token: null,
  hydrated: false,
  loading: false,
  login: ({ user, token }) => {
    localStorage.setItem("accessToken", token);
    localStorage.setItem("user", JSON.stringify(user));
    set({ user, token });
  },
  logout: () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("user");
    set({ user: null, token: null });
  },
  loadUser: () => {
    const token = localStorage.getItem("accessToken");
    const user = localStorage.getItem("user");
    if (token && user) set({ token, user: JSON.parse(user), hydrated: true });
    else set({ hydrated: true });
  },
  setUser: (user) => {
    localStorage.setItem("user", JSON.stringify(user));
    set({ user });
  },
}));
export default useAuthStore;
