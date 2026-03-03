import { User } from "../models/Auth.js";
import { CreditPack, Wallet } from "../models/Credits.js";
import { hashSecret } from "./hash.js";
import { env } from "./env.js";
import { logger } from "./logger.js";

export async function seedAdmin(): Promise<void> {
  const existing = await User.findOne({ role: "ADMIN" }).lean();

  if (existing) {
    await Wallet.updateOne(
      { userId: existing._id },
      {
        $setOnInsert: {
          userId: existing._id,
          balance: 0,
          totalPurchased: 0,
          totalSpent: 0,
        },
      },
      { upsert: true },
    );
    return;
  }

  const passwordHash = await hashSecret(env.ADMIN_PASSWORD);

  const admin = await User.create({
    email: env.ADMIN_EMAIL,
    name: env.ADMIN_NAME,
    passwordHash,
    role: "ADMIN",
    isVerified: true,
    isBlocked: false,
  });

  await Wallet.updateOne(
    { userId: admin._id },
    {
      $setOnInsert: {
        userId: admin._id,
        balance: 0,
        totalPurchased: 0,
        totalSpent: 0,
      },
    },
    { upsert: true },
  );

  logger.info({ email: env.ADMIN_EMAIL }, "Default admin created");
}

export async function seedCreditPacks(): Promise<void> {
  const count = await CreditPack.countDocuments().lean();
  if (count > 0) return;

  await CreditPack.insertMany([
    {
      name: "Starter",
      credits: 100,
      stripePriceId: "price_placeholder_starter",
      active: true,
    },
    {
      name: "Medium",
      credits: 500,
      stripePriceId: "price_placeholder_medium",
      active: true,
    },
    {
      name: "Premium",
      credits: 1200,
      stripePriceId: "price_placeholder_premium",
      active: true,
    },
  ]);

  logger.info("Credit packs seeded");
}
