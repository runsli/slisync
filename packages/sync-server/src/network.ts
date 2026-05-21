import { networkInterfaces } from "node:os";

/** IPv4 LAN addresses for dev hints (en0/wlan/eth). */
export function getLanIPv4Addresses(): string[] {
  const nets = networkInterfaces();
  const ips: string[] = [];

  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (net.family === "IPv4" && !net.internal) {
        ips.push(net.address);
      }
    }
  }

  return [...new Set(ips)];
}
