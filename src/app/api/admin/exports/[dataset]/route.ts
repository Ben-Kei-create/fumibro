import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  AdminApiAuthorizationError,
  requireAdminApi,
} from "@/modules/auth/application/require-admin-api";
import {
  exportDatasetSchema,
  getExportDataset,
} from "@/modules/export/application/get-export-dataset";
import { serializeCsv } from "@/modules/export/domain/csv";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  context: RouteContext<"/api/admin/exports/[dataset]">,
) {
  const { dataset: rawDataset } = await context.params;
  const dataset = exportDatasetSchema.safeParse(rawDataset);
  const format = z
    .enum(["csv", "json"])
    .safeParse(request.nextUrl.searchParams.get("format") ?? "csv");
  if (!dataset.success || !format.success)
    return NextResponse.json(
      { error: "invalid_export_request" },
      { status: 400 },
    );

  try {
    const { supabase } = await requireAdminApi();
    const result = await getExportDataset(
      supabase,
      dataset.data,
      request.nextUrl.searchParams.get("projectId") ?? undefined,
    );
    const date = new Date().toISOString().slice(0, 10);
    const filename = `fumibro-${result.datasetLabel}-${date}.${format.data}`;
    const body =
      format.data === "csv"
        ? serializeCsv(result.rows, result.columns)
        : JSON.stringify(
            {
              dataset: result.datasetLabel,
              exportedAt: new Date().toISOString(),
              records: result.rows,
              schemaVersion: 1,
            },
            null,
            2,
          );
    return new Response(body, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Type":
          format.data === "csv"
            ? "text/csv; charset=utf-8"
            : "application/json; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof AdminApiAuthorizationError)
      return NextResponse.json(
        { error: "admin_authorization_required" },
        { status: error.status },
      );
    const status =
      error instanceof Error &&
      ["project_id_required", "project_not_found"].includes(error.message)
        ? 400
        : 500;
    return NextResponse.json({ error: "export_failed" }, { status });
  }
}
