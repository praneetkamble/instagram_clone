import { io } from "socket.io-client";
import { BACKEND_URL } from "./axios";
// Never auto-connects; reconnection is bounded so a missing socket server just degrades to polling.
export const socket = io(BACKEND_URL, { autoConnect: false, transports: ["websocket"], reconnectionAttempts: 5, reconnectionDelayMax: 10000 });
