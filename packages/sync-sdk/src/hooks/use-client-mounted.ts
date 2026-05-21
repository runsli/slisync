"use client";

import { useEffect, useState } from "react";

/** True only after the client has committed post-hydration (safe for window-only UI). */
export function useClientMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
