import jwt from "jsonwebtoken";
export const generateAccessToken = (userId, extra = {}) =>
  jwt.sign({ id: userId, ...extra }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "1d" });
export const generateRefreshToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET + "_refresh", { expiresIn: "7d" });
export const generateChallengeToken = (payload) =>
  jwt.sign({ ...payload, typ: "challenge" }, process.env.JWT_SECRET, { expiresIn: "10m" });
