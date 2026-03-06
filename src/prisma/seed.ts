import { hashSecret } from "../lib/hash.js";
import { env } from "../lib/env.js";
import { Role } from "./generated/client.js";
import { prisma } from "./index.js";
import { userSelector } from "./selectors.js";

const DEFAULT_CREDIT_PACKS: Array<{
  name: string;
  credits: number;
  stripePriceId: string;
  isActive: boolean;
}> = [
  {
    name: "Starter",
    credits: 100,
    stripePriceId: "price_placeholder_starter",
    isActive: true,
  },
  {
    name: "Medium",
    credits: 500,
    stripePriceId: "price_placeholder_medium",
    isActive: true,
  },
  {
    name: "Premium",
    credits: 1200,
    stripePriceId: "price_placeholder_premium",
    isActive: true,
  },
];

async function seedAdmin() {
  const existingAdmin = await prisma.user.findFirst({
    where: { role: Role.ADMIN },
    select: userSelector,
  });

  if (existingAdmin) {
    await prisma.wallet.upsert({
      where: { userId: existingAdmin.id },
      update: {},
      create: {
        userId: existingAdmin.id,
        balance: 0,
      },
    });

    return;
  }

  const passHash = await hashSecret(env.ADMIN_PASSWORD);

  const admin = await prisma.user.create({
    data: {
      email: env.ADMIN_EMAIL,
      name: env.ADMIN_NAME,
      passHash,
      role: Role.ADMIN,
      isVerified: true,
      isBlocked: false,
    },
    select: userSelector,
  });

  await prisma.wallet.create({
    data: {
      userId: admin.id,
      balance: 0,
    },
  });
}

async function seedCreditPacks() {
  const count = await prisma.creditPack.count();

  if (count > 0) {
    return;
  }

  await prisma.creditPack.createMany({ data: DEFAULT_CREDIT_PACKS });
}

async function main() {
  await seedAdmin();
  await seedCreditPacks();
}

main()
  .catch((error) => {
    console.error("Error seeding database:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
