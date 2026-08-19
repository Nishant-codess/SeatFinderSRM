import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/verify-admin";
import { generateReport, exportReport } from "@/services/reports";
import { ReportConfig, ReportFormat } from "@/types";

export async function GET(request: NextRequest) {
  const authError = await requireAdmin(request);
  if (authError) return authError;

  try {
    const searchParams = request.nextUrl.searchParams;

    const metricsParam = searchParams.get("metrics");
    if (!metricsParam) {
      return NextResponse.json(
        { error: "Missing required parameter: metrics" },
        { status: 400 }
      );
    }

    const metrics = metricsParam.split(",") as ReportConfig["metrics"];
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "Missing required parameters: startDate, endDate" },
        { status: 400 }
      );
    }

    const config: ReportConfig = {
      metrics,
      dateRange: { start: new Date(startDate), end: new Date(endDate) },
      filters: {},
      groupBy: (searchParams.get("groupBy") as ReportConfig["groupBy"]) || undefined,
    };

    const section = searchParams.get("section");
    if (section) config.filters!.section = section;

    const reportData = await generateReport(config);
    const format = searchParams.get("format") as ReportFormat | null;

    if (format) {
      const blob = await exportReport(reportData, format);
      return new NextResponse(blob, {
        headers: {
          "Content-Type":
            format === "csv"
              ? "text/csv"
              : format === "pdf"
              ? "application/pdf"
              : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="report.${format}"`,
        },
      });
    }

    return NextResponse.json(reportData);
  } catch (error) {
    console.error("Error generating report:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
