import bcrypt from "bcryptjs";
import prisma from "../lib/prisma";

async function main() {
  const username = (process.env.BOOTSTRAP_ADMIN_USERNAME || "admin").trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD || "ChangeMe123!";
  const fullName = process.env.BOOTSTRAP_ADMIN_NAME || "مدیر سامانه";
  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.user.upsert({
    where: { username },
    update: {
      fullName,
      passwordHash,
      role: "ADMIN",
      status: "APPROVED",
      approvedAt: new Date(),
      approvedBy: "bootstrap",
    },
    create: {
      fullName,
      username,
      passwordHash,
      role: "ADMIN",
      status: "APPROVED",
      approvedAt: new Date(),
      approvedBy: "bootstrap",
    },
  });
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
