import { io } from "socket.io-client";
import { BACKEND_URL } from "./axios";
export const socket = io(BACKEND_URL, { autoConnect: false, transports: ["websocket"] });
