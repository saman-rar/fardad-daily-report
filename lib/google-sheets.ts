import { google, sheets_v4 } from "googleapis";
import {
  PERSIAN_MONTHS,
  getTehranDate,
  gregorianIsoToJalali,
  isFriday,
} from "@/lib/date";
import type { ReportRecord, UserRecord } from "@/lib/types";

const LEGACY_SYSTEM_SHEETS = ["کارمندان", "گزارش‌ها", "همگام‌سازی"] as const;
const MISSING_REPORT_TEXT = "گزارشی ثبت نشده است";
const PENDING_REPORT_TEXT = "در انتظار ثبت گزارش";
const HOLIDAY_TEXT = "تعطیل";
const LEAVE_TEXT = "مرخصی";

const MONTH_COLORS = [
  { row: "#D8FFE7", header: "#61E993" }, // Farvardin
  { row: "#EEFFD2", header: "#B9F35D" }, // Ordibehesht
  { row: "#D9FFF8", header: "#5CE7D5" }, // Khordad
  { row: "#FFE8D6", header: "#FFB36F" }, // Tir
  { row: "#FFF6B9", header: "#F3DA55" }, // Mordad
  { row: "#DCEEFF", header: "#74BAFF" }, // Shahrivar
  { row: "#FFE2C9", header: "#FFA15C" }, // Mehr
  { row: "#E4FFD2", header: "#8CE85F" }, // Aban
  { row: "#EADFFF", header: "#A382F4" }, // Azar
  { row: "#DDF7FF", header: "#69D7F1" }, // Dey
  { row: "#FFE0F1", header: "#F38BC0" }, // Bahman
  { row: "#DBFFD9", header: "#73DD7D" }, // Esfand
] as const;

const HEADER_COLOR = "#173F35";
const MISSING_COLOR = "#FF9E9E";
const MISSING_TEXT_COLOR = "#6E1111";
const GRID_COLOR = "#D8E1DE";

interface MonthSection {
  headerRowIndex: number;
  startDataRowIndex: number;
  endDataRowIndex: number;
  month: number;
}

interface SheetPlan {
  user: UserRecord;
  title: string;
  sheetId: number;
  rowCount: number;
  values: (string | number)[][];
  monthSections: MonthSection[];
  missingRowIndexes: number[];
}

export function isGoogleSheetsConfigured() {
  return Boolean(
    process.env.GOOGLE_SHEET_ID &&
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_PRIVATE_KEY,
  );
}

function quoteSheet(title: string) {
  return `'${title.replace(/'/g, "''")}'`;
}

function getClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  if (!email || !key || !spreadsheetId) {
    throw new Error("GOOGLE_SHEETS_NOT_CONFIGURED");
  }

  const auth = new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return {
    sheets: google.sheets({ version: "v4", auth }),
    spreadsheetId,
  };
}

function googleColor(hex: string): sheets_v4.Schema$Color {
  const normalized = hex.replace("#", "");
  const value = Number.parseInt(normalized, 16);
  return {
    red: ((value >> 16) & 255) / 255,
    green: ((value >> 8) & 255) / 255,
    blue: (value & 255) / 255,
  };
}

function sanitizeSheetTitle(value: string) {
  const safe = value
    .replace(/[\\/:?*\[\]]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 92);
  return safe || "کارمند";
}

function buildEmployeeSheetTitles(users: UserRecord[]) {
  const used = new Set<string>();
  const result = new Map<string, string>();

  for (const user of users) {
    let candidate = sanitizeSheetTitle(user.fullName);

    if (LEGACY_SYSTEM_SHEETS.includes(candidate as (typeof LEGACY_SYSTEM_SHEETS)[number])) {
      candidate = sanitizeSheetTitle(`${candidate} - ${user.username}`);
    }

    if (used.has(candidate)) {
      candidate = sanitizeSheetTitle(`${candidate} - ${user.username}`);
    }

    let unique = candidate;
    let suffix = 2;
    while (used.has(unique)) {
      unique = sanitizeSheetTitle(`${candidate} ${suffix}`);
      suffix += 1;
    }

    used.add(unique);
    result.set(user.id, unique);
  }

  return result;
}

function dateRangeInclusive(from: string, to: string) {
  const output: string[] = [];
  const cursor = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);

  while (cursor <= end) {
    output.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return output;
}

function getEmployeeTrackingStart(user: UserRecord, reports: ReportRecord[], todayIso: string) {
  const accountDate = getTehranDate(new Date(user.approvedAt || user.createdAt));
  const firstReportDate = reports[0]?.reportDate;
  const requestedStart = process.env.SHEET_TRACKING_START_DATE?.trim();

  const candidates = [accountDate, firstReportDate, requestedStart]
    .filter((value): value is string => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value)))
    .sort();

  const start = candidates[0] || todayIso;
  return start > todayIso ? todayIso : start;
}

function buildSheetContent(user: UserRecord, reports: ReportRecord[], todayIso: string) {
  const sortedReports = [...reports].sort((a, b) => a.reportDate.localeCompare(b.reportDate));
  const reportsByDate = new Map(sortedReports.map((report) => [report.reportDate, report]));
  const startDate = getEmployeeTrackingStart(user, sortedReports, todayIso);

  const values: (string | number)[][] = [["تاریخ", "گزارش"]];
  const monthSections: MonthSection[] = [];
  const missingRowIndexes: number[] = [];

  let activeMonthKey = "";
  let currentSection: MonthSection | null = null;

  for (const iso of dateRangeInclusive(startDate, todayIso)) {
    const jalali = gregorianIsoToJalali(iso);
    const monthKey = `${jalali.year}-${jalali.month}`;

    if (monthKey !== activeMonthKey) {
      if (currentSection) currentSection.endDataRowIndex = values.length;

      const headerRowIndex = values.length;
      values.push([`${PERSIAN_MONTHS[jalali.month - 1]} ${jalali.year}`, ""]);
      currentSection = {
        headerRowIndex,
        startDataRowIndex: headerRowIndex + 1,
        endDataRowIndex: headerRowIndex + 1,
        month: jalali.month,
      };
      monthSections.push(currentSection);
      activeMonthKey = monthKey;
    }

    const report = reportsByDate.get(iso);
    const isPast = iso < todayIso;
    let reportText = PENDING_REPORT_TEXT;
    let isMissing = false;

    if (report) {
      reportText = report.status === "LEAVE" ? LEAVE_TEXT : report.reportText;
    } else if (isFriday(iso)) {
      reportText = HOLIDAY_TEXT;
    } else if (isPast) {
      reportText = MISSING_REPORT_TEXT;
      isMissing = true;
    }

    const rowIndex = values.length;
    values.push([jalali.text, reportText]);
    if (isMissing) missingRowIndexes.push(rowIndex);
  }

  if (currentSection) currentSection.endDataRowIndex = values.length;

  return { values, monthSections, missingRowIndexes };
}

function contiguousRanges(indexes: number[]) {
  if (!indexes.length) return [] as Array<{ start: number; end: number }>;

  const sorted = [...indexes].sort((a, b) => a - b);
  const ranges: Array<{ start: number; end: number }> = [];
  let start = sorted[0];
  let previous = sorted[0];

  for (let i = 1; i < sorted.length; i += 1) {
    const current = sorted[i];
    if (current === previous + 1) {
      previous = current;
      continue;
    }
    ranges.push({ start, end: previous + 1 });
    start = current;
    previous = current;
  }

  ranges.push({ start, end: previous + 1 });
  return ranges;
}

async function getSpreadsheetMeta(sheets: sheets_v4.Sheets, spreadsheetId: string) {
  return sheets.spreadsheets.get({
    spreadsheetId,
    fields:
      "sheets(properties(sheetId,title,index,gridProperties(rowCount,columnCount)),conditionalFormats)",
  });
}

async function ensureEmployeeSheets(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  users: UserRecord[],
  titles: Map<string, string>,
) {
  let meta = await getSpreadsheetMeta(sheets, spreadsheetId);
  const existingTitles = new Set(
    (meta.data.sheets || [])
      .map((sheet) => sheet.properties?.title)
      .filter((title): title is string => Boolean(title)),
  );

  const missingTitles = users
    .map((user) => titles.get(user.id))
    .filter((title): title is string => Boolean(title && !existingTitles.has(title)));

  if (missingTitles.length) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: missingTitles.map((title) => ({
          addSheet: {
            properties: {
              title,
              rightToLeft: true,
              gridProperties: { rowCount: 1000, columnCount: 26, frozenRowCount: 1 },
            },
          },
        })),
      },
    });
    meta = await getSpreadsheetMeta(sheets, spreadsheetId);
  }

  const employeeTitles = new Set(titles.values());
  const unmanagedSheets = (meta.data.sheets || []).filter((sheet) => {
    const title = sheet.properties?.title;
    return Boolean(title && !employeeTitles.has(title));
  });

  // This spreadsheet is dedicated to daily reports: after employee tabs exist,
  // prune legacy aggregate tabs, default Sheet1 tabs, and stale former-user tabs.
  // Google Sheets must always contain at least one tab, so pruning only runs when
  // at least one approved employee tab is available.
  if (unmanagedSheets.length && users.length > 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: unmanagedSheets
          .map((sheet) => sheet.properties?.sheetId)
          .filter((sheetId): sheetId is number => sheetId !== undefined)
          .map((sheetId) => ({ deleteSheet: { sheetId } })),
      },
    });
    meta = await getSpreadsheetMeta(sheets, spreadsheetId);
  }

  return meta;
}

function buildPreWriteRequests(
  plan: SheetPlan,
  conditionalFormatCount: number,
): sheets_v4.Schema$Request[] {
  const neededRows = Math.max(plan.values.length + 30, plan.rowCount, 1000);
  const requests: sheets_v4.Schema$Request[] = [
    {
      updateSheetProperties: {
        properties: {
          sheetId: plan.sheetId,
          rightToLeft: true,
          gridProperties: { rowCount: neededRows, frozenRowCount: 1 },
        },
        fields: "rightToLeft,gridProperties.rowCount,gridProperties.frozenRowCount",
      },
    },
    {
      unmergeCells: {
        range: {
          sheetId: plan.sheetId,
          startRowIndex: 0,
          endRowIndex: neededRows,
          startColumnIndex: 0,
          endColumnIndex: 2,
        },
      },
    },
  ];

  // Remove old conditional formatting before values are rewritten so old rules cannot
  // override the explicit month/missing colors applied by the projection.
  for (let index = conditionalFormatCount - 1; index >= 0; index -= 1) {
    requests.push({ deleteConditionalFormatRule: { sheetId: plan.sheetId, index } });
  }

  return requests;
}

function buildFormattingRequests(
  plan: SheetPlan,
  gridColumnCount: number,
): sheets_v4.Schema$Request[] {
  const requests: sheets_v4.Schema$Request[] = [];
  const neededRows = Math.max(plan.values.length + 30, plan.rowCount, 1000);

  requests.push(
    {
      repeatCell: {
        range: {
          sheetId: plan.sheetId,
          startRowIndex: 0,
          endRowIndex: neededRows,
          startColumnIndex: 0,
          endColumnIndex: 2,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: googleColor("#FFFFFF"),
            textFormat: { bold: false, foregroundColor: googleColor("#1F2937") },
            horizontalAlignment: "RIGHT",
            verticalAlignment: "MIDDLE",
            wrapStrategy: "WRAP",
            borders: {
              top: { style: "SOLID", color: googleColor(GRID_COLOR) },
              bottom: { style: "SOLID", color: googleColor(GRID_COLOR) },
              left: { style: "SOLID", color: googleColor(GRID_COLOR) },
              right: { style: "SOLID", color: googleColor(GRID_COLOR) },
            },
          },
        },
        fields: "userEnteredFormat",
      },
    },
    {
      repeatCell: {
        range: { sheetId: plan.sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 2 },
        cell: {
          userEnteredFormat: {
            backgroundColor: googleColor(HEADER_COLOR),
            textFormat: { bold: true, foregroundColor: googleColor("#FFFFFF"), fontSize: 11 },
            horizontalAlignment: "CENTER",
            verticalAlignment: "MIDDLE",
          },
        },
        fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)",
      },
    },
    {
      repeatCell: {
        range: { sheetId: plan.sheetId, startRowIndex: 1, endRowIndex: plan.values.length, startColumnIndex: 0, endColumnIndex: 1 },
        cell: { userEnteredFormat: { horizontalAlignment: "CENTER" } },
        fields: "userEnteredFormat.horizontalAlignment",
      },
    },
    {
      updateDimensionProperties: {
        range: { sheetId: plan.sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: 1 },
        properties: { pixelSize: 155, hiddenByUser: false },
        fields: "pixelSize,hiddenByUser",
      },
    },
    {
      updateDimensionProperties: {
        range: { sheetId: plan.sheetId, dimension: "COLUMNS", startIndex: 1, endIndex: 2 },
        properties: { pixelSize: 720, hiddenByUser: false },
        fields: "pixelSize,hiddenByUser",
      },
    },
  );

  if (gridColumnCount > 2) {
    requests.push({
      updateDimensionProperties: {
        range: { sheetId: plan.sheetId, dimension: "COLUMNS", startIndex: 2, endIndex: gridColumnCount },
        properties: { hiddenByUser: true },
        fields: "hiddenByUser",
      },
    });
  }

  for (const section of plan.monthSections) {
    const colors = MONTH_COLORS[section.month - 1];

    requests.push(
      {
        repeatCell: {
          range: {
            sheetId: plan.sheetId,
            startRowIndex: section.startDataRowIndex,
            endRowIndex: section.endDataRowIndex,
            startColumnIndex: 0,
            endColumnIndex: 2,
          },
          cell: { userEnteredFormat: { backgroundColor: googleColor(colors.row) } },
          fields: "userEnteredFormat.backgroundColor",
        },
      },
      {
        mergeCells: {
          range: {
            sheetId: plan.sheetId,
            startRowIndex: section.headerRowIndex,
            endRowIndex: section.headerRowIndex + 1,
            startColumnIndex: 0,
            endColumnIndex: 2,
          },
          mergeType: "MERGE_ALL",
        },
      },
      {
        repeatCell: {
          range: {
            sheetId: plan.sheetId,
            startRowIndex: section.headerRowIndex,
            endRowIndex: section.headerRowIndex + 1,
            startColumnIndex: 0,
            endColumnIndex: 2,
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: googleColor(colors.header),
              textFormat: { bold: true, foregroundColor: googleColor("#122019"), fontSize: 12 },
              horizontalAlignment: "CENTER",
              verticalAlignment: "MIDDLE",
            },
          },
          fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)",
        },
      },
    );
  }

  for (const range of contiguousRanges(plan.missingRowIndexes)) {
    requests.push({
      repeatCell: {
        range: {
          sheetId: plan.sheetId,
          startRowIndex: range.start,
          endRowIndex: range.end,
          startColumnIndex: 0,
          endColumnIndex: 2,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: googleColor(MISSING_COLOR),
            textFormat: { bold: true, foregroundColor: googleColor(MISSING_TEXT_COLOR) },
          },
        },
        fields: "userEnteredFormat(backgroundColor,textFormat)",
      },
    });
  }

  return requests;
}

async function runBatchUpdates(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  requests: sheets_v4.Schema$Request[],
) {
  const chunkSize = 350;
  for (let index = 0; index < requests.length; index += chunkSize) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: requests.slice(index, index + chunkSize) },
    });
  }
}

export async function syncDatabaseToGoogleSheets(input: {
  users: UserRecord[];
  reports: ReportRecord[];
}) {
  const { sheets, spreadsheetId } = getClient();
  const syncedAt = new Date().toISOString();
  const todayIso = getTehranDate();

  const employees = input.users.filter(
    (user) => user.role === "EMPLOYEE" && user.status === "APPROVED",
  );
  const titles = buildEmployeeSheetTitles(employees);
  const meta = await ensureEmployeeSheets(sheets, spreadsheetId, employees, titles);

  const sheetsByTitle = new Map<string, sheets_v4.Schema$Sheet>();
  for (const sheet of meta.data.sheets || []) {
    const title = sheet.properties?.title;
    if (title && sheet.properties?.sheetId !== undefined) {
      sheetsByTitle.set(title, sheet);
    }
  }

  const reportsByUser = new Map<string, ReportRecord[]>();
  for (const report of input.reports) {
    const current = reportsByUser.get(report.userId) || [];
    current.push(report);
    reportsByUser.set(report.userId, current);
  }

  const plans: SheetPlan[] = [];
  for (const user of employees) {
    const title = titles.get(user.id);
    if (!title) continue;
    const sheet = sheetsByTitle.get(title);
    const sheetId = sheet?.properties?.sheetId;
    if (sheetId === undefined) continue;

    const content = buildSheetContent(user, reportsByUser.get(user.id) || [], todayIso);
    plans.push({
      user,
      title,
      sheetId,
      rowCount: sheet?.properties?.gridProperties?.rowCount || 1000,
      ...content,
    });
  }

  if (plans.length) {
    const preWriteRequests: sheets_v4.Schema$Request[] = [];
    for (const plan of plans) {
      const sheet = sheetsByTitle.get(plan.title);
      preWriteRequests.push(
        ...buildPreWriteRequests(plan, sheet?.conditionalFormats?.length || 0),
      );
    }
    await runBatchUpdates(sheets, spreadsheetId, preWriteRequests);

    await sheets.spreadsheets.values.batchClear({
      spreadsheetId,
      requestBody: {
        ranges: plans.map((plan) => `${quoteSheet(plan.title)}!A:Z`),
      },
    });

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: {
        valueInputOption: "RAW",
        data: plans.map((plan) => ({
          range: `${quoteSheet(plan.title)}!A1`,
          values: plan.values,
        })),
      },
    });

    const formattingRequests: sheets_v4.Schema$Request[] = [];
    for (const plan of plans) {
      const sheet = sheetsByTitle.get(plan.title);
      formattingRequests.push(
        ...buildFormattingRequests(
          plan,
          sheet?.properties?.gridProperties?.columnCount || 26,
        ),
      );
    }

    await runBatchUpdates(sheets, spreadsheetId, formattingRequests);
  }

  return {
    syncedAt,
    usersCount: employees.length,
    reportsCount: input.reports.filter((report) => titles.has(report.userId)).length,
    sheetCount: plans.length,
  };
}
