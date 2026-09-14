import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { gregorianIsoToJalali, getTehranDate } from "@/lib/date";
import type { ReportRecord, UserRecord } from "@/lib/types";

export interface Database {
  ensureReady(): Promise<void>;
  findUserByUsername(username: string): Promise<UserRecord | null>;
  findUserById(id: string): Promise<UserRecord | null>;
  createUser(input: Pick<UserRecord, "fullName" | "username" | "passwordHash"> & Partial<Pick<UserRecord, "role" | "status">>): Promise<UserRecord>;
  updateLastLogin(id: string): Promise<void>;
  listUsers(): Promise<UserRecord[]>;
  listPendingUsers(): Promise<UserRecord[]>;
  setUserStatus(id: string, status: UserRecord["status"], approvedBy?: string): Promise<UserRecord | null>;
  upsertReport(userId: string, reportDate: string, reportText: string): Promise<ReportRecord>;
  listReportsForUser(userId: string, jalaliYear: number, jalaliMonth: number): Promise<ReportRecord[]>;
  listAllReports(jalaliYear?: number, jalaliMonth?: number): Promise<ReportRecord[]>;
  listReportsForAdmin(input: { userId?: string; fromDate?: string; toDate?: string }): Promise<ReportRecord[]>;
}

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function userToRecord(user: {
  id: string;
  fullName: string;
  username: string;
  passwordHash: string;
  role: "ADMIN" | "EMPLOYEE";
  status: "PENDING" | "APPROVED" | "REJECTED" | "DISABLED";
  createdAt: Date;
  approvedAt: Date | null;
  approvedBy: string | null;
  lastLoginAt: Date | null;
}): UserRecord {
  return {
    id: user.id,
    fullName: user.fullName,
    username: user.username,
    passwordHash: user.passwordHash,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
    approvedAt: user.approvedAt?.toISOString(),
    approvedBy: user.approvedBy || undefined,
    lastLoginAt: user.lastLoginAt?.toISOString(),
  };
}

function reportToRecord(report: {
  id: string;
  userId: string;
  reportDate: Date;
  jalaliDate: string;
  jalaliYear: number;
  jalaliMonth: number;
  jalaliDay: number;
  reportText: string;
  status: "SUBMITTED" | "LEAVE";
  createdAt: Date;
  updatedAt: Date;
}): ReportRecord {
  return {
    id: report.id,
    userId: report.userId,
    reportDate: isoDate(report.reportDate),
    jalaliDate: report.jalaliDate,
    jalaliYear: report.jalaliYear,
    jalaliMonth: report.jalaliMonth,
    jalaliDay: report.jalaliDay,
    reportText: report.reportText,
    status: report.status,
    createdAt: report.createdAt.toISOString(),
    updatedAt: report.updatedAt.toISOString(),
  };
}

class PrismaDatabase implements Database {
  private ready = false;

  async ensureReady() {
    if (this.ready) return;

    const adminExists = await prisma.user.findFirst({
      where: { role: "ADMIN" },
      select: { id: true },
    });

    if (!adminExists) {
      const username = process.env.BOOTSTRAP_ADMIN_USERNAME?.trim().toLowerCase();
      const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
      if (username && password) {
        const passwordHash = await bcrypt.hash(password, 12);
        await prisma.user.upsert({
          where: { username },
          update: {
            fullName: process.env.BOOTSTRAP_ADMIN_NAME || "مدیر سامانه",
            role: "ADMIN",
            status: "APPROVED",
          },
          create: {
            fullName: process.env.BOOTSTRAP_ADMIN_NAME || "مدیر سامانه",
            username,
            passwordHash,
            role: "ADMIN",
            status: "APPROVED",
            approvedAt: new Date(),
            approvedBy: "bootstrap",
          },
        });
      }
    }

    this.ready = true;
  }

  async findUserByUsername(username: string) {
    await this.ensureReady();
    const user = await prisma.user.findUnique({
      where: { username: username.trim().toLowerCase() },
    });
    return user ? userToRecord(user) : null;
  }

  async findUserById(id: string) {
    await this.ensureReady();
    const user = await prisma.user.findUnique({ where: { id } });
    return user ? userToRecord(user) : null;
  }

  async createUser(input: Pick<UserRecord, "fullName" | "username" | "passwordHash"> & Partial<Pick<UserRecord, "role" | "status">>) {
    await this.ensureReady();
    const user = await prisma.user.create({
      data: {
        fullName: input.fullName.trim(),
        username: input.username.trim().toLowerCase(),
        passwordHash: input.passwordHash,
        role: input.role || "EMPLOYEE",
        status: input.status || "PENDING",
      },
    });
    return userToRecord(user);
  }

  async updateLastLogin(id: string) {
    await this.ensureReady();
    await prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
  }

  async listUsers() {
    await this.ensureReady();
    const users = await prisma.user.findMany({
      orderBy: [{ role: "asc" }, { fullName: "asc" }],
    });
    return users.map(userToRecord);
  }

  async listPendingUsers() {
    await this.ensureReady();
    const users = await prisma.user.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
    });
    return users.map(userToRecord);
  }

  async setUserStatus(id: string, status: UserRecord["status"], approvedBy?: string) {
    await this.ensureReady();
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) return null;

    const user = await prisma.user.update({
      where: { id },
      data: {
        status,
        approvedAt: status === "APPROVED" ? new Date() : existing.approvedAt,
        approvedBy: status === "APPROVED" ? approvedBy || null : existing.approvedBy,
      },
    });
    return userToRecord(user);
  }

  async upsertReport(userId: string, reportDate: string, reportText: string) {
    await this.ensureReady();
    const jalali = gregorianIsoToJalali(reportDate);
    const date = new Date(`${reportDate}T00:00:00.000Z`);

    const report = await prisma.report.upsert({
      where: {
        userId_reportDate: { userId, reportDate: date },
      },
      update: {
        reportText: reportText.trim(),
        status: "SUBMITTED",
        jalaliDate: jalali.text,
        jalaliYear: jalali.year,
        jalaliMonth: jalali.month,
        jalaliDay: jalali.day,
      },
      create: {
        userId,
        reportDate: date,
        jalaliDate: jalali.text,
        jalaliYear: jalali.year,
        jalaliMonth: jalali.month,
        jalaliDay: jalali.day,
        reportText: reportText.trim(),
        status: "SUBMITTED",
      },
    });

    return reportToRecord(report);
  }

  async listReportsForUser(userId: string, jalaliYear: number, jalaliMonth: number) {
    await this.ensureReady();
    const reports = await prisma.report.findMany({
      where: { userId, jalaliYear, jalaliMonth },
      orderBy: { reportDate: "asc" },
    });
    return reports.map(reportToRecord);
  }

  async listAllReports(jalaliYear?: number, jalaliMonth?: number) {
    await this.ensureReady();
    const reports = await prisma.report.findMany({
      where: jalaliYear && jalaliMonth ? { jalaliYear, jalaliMonth } : undefined,
      orderBy: [{ reportDate: "asc" }, { userId: "asc" }],
    });
    return reports.map(reportToRecord);
  }

  async listReportsForAdmin(input: { userId?: string; fromDate?: string; toDate?: string }) {
    await this.ensureReady();
    const from = input.fromDate ? new Date(`${input.fromDate}T00:00:00.000Z`) : undefined;
    const to = input.toDate ? new Date(`${input.toDate}T00:00:00.000Z`) : undefined;

    const reports = await prisma.report.findMany({
      where: {
        ...(input.userId ? { userId: input.userId } : {}),
        ...(from || to
          ? {
              reportDate: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
      },
      orderBy: [{ reportDate: "asc" }, { userId: "asc" }],
    });

    return reports.map(reportToRecord);
  }
}

let dbInstance: Database | null = null;

export function getDb(): Database {
  if (!dbInstance) dbInstance = new PrismaDatabase();
  return dbInstance;
}

export function publicUser(user: UserRecord) {
  const { passwordHash: _passwordHash, ...safe } = user;
  return safe;
}

export { getTehranDate };
