"use client";

import { useEffect, useState } from "react";

export function VisitorCounter({
  initialTotal,
  projectId,
}: {
  initialTotal: number;
  projectId?: string;
}) {
  const [total, setTotal] = useState(initialTotal);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/visitors/claim", {
      body: JSON.stringify(
        projectId ? { projectId, scope: "project" } : { scope: "site" },
      ),
      headers: { "Content-Type": "application/json" },
      method: "POST",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return;
        const data = (await response.json()) as { total?: number };
        if (typeof data.total === "number") setTotal(data.total);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [projectId]);

  return (
    <span
      aria-label={`累計訪問者 ${total}人`}
      className="font-mono tabular-nums"
    >
      {total.toLocaleString("ja-JP")}
    </span>
  );
}
