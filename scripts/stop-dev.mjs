import { readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

const root = process.cwd();
const lockPath = join(root, ".next/dev/lock");

function killPid(pid) {
  try {
    process.kill(pid, "SIGTERM");
    return true;
  } catch {
    return false;
  }
}

function killPort(port) {
  try {
    const out = execSync(`lsof -t -i:${port}`, { encoding: "utf8" }).trim();
    if (!out) return;
    for (const pid of out.split("\n")) {
      if (pid) killPid(Number(pid));
    }
  } catch {
    // port free
  }
}

let stopped = false;

try {
  const lock = JSON.parse(readFileSync(lockPath, "utf8"));
  if (lock.pid) {
    stopped = killPid(lock.pid) || stopped;
  }
  if (lock.port) killPort(lock.port);
  unlinkSync(lockPath);
  console.log(`[infra] Removed dev lock (was pid ${lock.pid ?? "?"}).`);
  stopped = true;
} catch (err) {
  if (err && typeof err === "object" && "code" in err && err.code !== "ENOENT") {
    console.warn("[infra] Could not read lock file:", err);
  }
}

killPort(3000);

try {
  const ps = execSync("pgrep -f 'tsx watch server.ts'", { encoding: "utf8" }).trim();
  for (const pid of ps.split("\n")) {
    if (pid) {
      killPid(Number(pid));
      stopped = true;
    }
  }
} catch {
  // none
}

if (stopped) {
  console.log("[infra] Dev server stopped. Run: npm run dev");
} else {
  console.log("[infra] No dev server found on port 3000.");
}
