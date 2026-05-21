import "./server-globals";
import type { NextConfig } from "next";
import { getLanIPv4Addresses } from "@slisync/sync-server";

const lanIp =
  process.env.NEXT_DEV_HOST?.trim() || getLanIPv4Addresses()[0] || "127.0.0.1";

const nextConfig: NextConfig = {
  transpilePackages: ["@slisync/sync-sdk"],
  serverExternalPackages: ["ioredis", "@slisync/sync-server"],
  /**
   * Phone opens http://192.168.x.x:3000 — Next must allow that host for /_next/*
   * and dev WebSockets, otherwise JS chunks fail and Socket.IO never starts.
   */
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    lanIp,
    "*.local",
  ],
};

export default nextConfig;
