export type UserRole = "ADMIN" | "EMPLOYEE";
export type UserStatus = "PENDING" | "APPROVED" | "REJECTED" | "DISABLED";
export type ReportStatus = "SUBMITTED" | "MISSING" | "HOLIDAY" | "LEAVE";

export interface UserRecord {
  id: string;
  fullName: string;
  username: string;
  passwordHash: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  approvedAt?: string;
  approvedBy?: string;
  lastLoginAt?: string;
}

export interface SafeUser {
  id: string;
  fullName: string;
  username: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
}

export interface ReportRecord {
  id: string;
  userId: string;
  reportDate: string;
  jalaliDate: string;
  jalaliYear: number;
  jalaliMonth: number;
  jalaliDay: number;
  reportText: string;
  status: ReportStatus;
  createdAt: string;
  updatedAt: string;
}
