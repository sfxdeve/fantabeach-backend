import Stripe from "stripe";
import { prisma } from "../../prisma/index.js";
import { AppError } from "../../lib/errors.js";
import { env } from "../../lib/env.js";
import { paginationMeta } from "../../lib/pagination.js";
import {
  CreditTransactionType,
  CreditTransactionSource,
} from "../../prisma/generated/enums.js";
import { walletSelector } from "../../prisma/selectors.js";
import type {
  CheckoutBodyType,
  CreateCreditPackBodyType,
  GrantCreditsBodyType,
  WalletQueryParamsType,
} from "./schema.js";

const stripe = new Stripe(env.STRIPE_SECRET_KEY);

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

export async function listPacks() {
  return prisma.creditPack.findMany({
    where: { isActive: true },
    orderBy: { credits: "asc" },
  });
}

export async function createCheckout(userId: string, body: CheckoutBodyType) {
  const pack = await prisma.creditPack.findUnique({
    where: { id: body.creditPackId },
  });

  if (!pack || !pack.isActive) {
    throw new AppError("NOT_FOUND", "Credit pack not found or inactive");
  }

  const wallet = await prisma.wallet.findUnique({ where: { userId } });

  if (!wallet) {
    throw new AppError("NOT_FOUND", "Wallet not found");
  }

  await prisma.creditTransaction.updateMany({
    where: {
      walletId: wallet.id,
      type: CreditTransactionType.PURCHASE,
      AND: [
        { meta: { path: ["creditPackId"], equals: pack.id } },
        { meta: { path: ["status"], equals: "pending" } },
      ],
    },
    data: {
      meta: {
        creditPackId: pack.id,
        status: "expired",
      },
    },
  });

  const pending = await prisma.creditTransaction.create({
    data: {
      walletId: wallet.id,
      type: CreditTransactionType.PURCHASE,
      source: CreditTransactionSource.STRIPE,
      amount: pack.credits,
      balanceAfter: wallet.balance + pack.credits,
      meta: { creditPackId: pack.id, status: "pending" },
    },
  });

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price: pack.stripePriceId,
        quantity: 1,
      },
    ],
    success_url: env.PAYMENT_SUCCESS_URL,
    cancel_url: env.PAYMENT_CANCEL_URL,
    metadata: {
      transactionRef: pending.id,
      userId,
      credits: String(pack.credits),
    },
  });

  await prisma.creditTransaction.update({
    where: { id: pending.id },
    data: {
      meta: {
        ...asObject(pending.meta),
        stripeSessionId: session.id,
      },
    },
  });

  return { url: session.url };
}

export async function handleWebhook(rawBody: Buffer, signature: string) {
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch {
    throw new AppError("BAD_REQUEST", "Invalid webhook signature");
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    if (session.payment_status !== "paid") {
      return { received: true };
    }

    const transactionRef = session.metadata?.transactionRef;

    if (!transactionRef) {
      return { received: true };
    }

    await prisma.$transaction(async (tx) => {
      const pending = await tx.creditTransaction.findFirst({
        where: {
          id: transactionRef,
          type: CreditTransactionType.PURCHASE,
          source: CreditTransactionSource.STRIPE,
          meta: { path: ["status"], equals: "pending" },
        },
      });

      if (!pending) {
        return;
      }

      const claim = await tx.creditTransaction.updateMany({
        where: {
          id: pending.id,
          type: CreditTransactionType.PURCHASE,
          source: CreditTransactionSource.STRIPE,
          meta: { path: ["status"], equals: "pending" },
        },
        data: {
          meta: {
            ...asObject(pending.meta),
            status: "processing",
            stripeSessionId: session.id,
          },
        },
      });

      if (claim.count !== 1) {
        return;
      }

      const credits = pending.amount;

      if (credits <= 0) {
        return;
      }

      const wallet = await tx.wallet.findUnique({
        where: { id: pending.walletId },
      });

      if (!wallet) {
        return;
      }

      const newBalance = wallet.balance + credits;

      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: { increment: credits },
        },
      });

      await tx.creditTransaction.update({
        where: { id: pending.id },
        data: {
          balanceAfter: newBalance,
          meta: {
            ...asObject(pending.meta),
            status: "fulfilled",
            stripeSessionId: session.id,
          },
        },
      });
    });
  }

  return { received: true };
}

export async function getWallet(userId: string, query: WalletQueryParamsType) {
  const wallet = await prisma.wallet.findUnique({ where: { userId } });

  if (!wallet) {
    throw new AppError("NOT_FOUND", "Wallet not found");
  }

  const skip = (query.page - 1) * query.limit;
  const [transactions, total, totalsByType] = await Promise.all([
    prisma.creditTransaction.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: "desc" },
      skip,
      take: query.limit,
    }),
    prisma.creditTransaction.count({ where: { walletId: wallet.id } }),
    prisma.creditTransaction.groupBy({
      by: ["type"],
      where: { walletId: wallet.id },
      _sum: { amount: true },
    }),
  ]);

  let totalPurchased = 0;
  let totalSpent = 0;

  for (const item of totalsByType) {
    const amount = item._sum.amount ?? 0;

    if (
      item.type === CreditTransactionType.PURCHASE ||
      item.type === CreditTransactionType.BONUS
    ) {
      totalPurchased += amount;
    }

    if (item.type === CreditTransactionType.SPEND) {
      totalSpent += Math.abs(amount);
    }
  }

  return {
    wallet: {
      ...wallet,
      totalPurchased,
      totalSpent,
    },
    transactions,
    meta: paginationMeta(total, { page: query.page, limit: query.limit }),
  };
}

export async function createPack(body: CreateCreditPackBodyType) {
  return prisma.creditPack.create({ data: body });
}

export async function togglePack(id: string) {
  const pack = await prisma.creditPack.findUnique({ where: { id } });

  if (!pack) {
    throw new AppError("NOT_FOUND", "Credit pack not found");
  }

  return prisma.creditPack.update({
    where: { id },
    data: { isActive: !pack.isActive },
  });
}

export async function grantCredits(
  body: GrantCreditsBodyType,
  adminId: string,
) {
  const user = await prisma.user.findUnique({ where: { id: body.userId } });

  if (!user) {
    throw new AppError("NOT_FOUND", "User not found");
  }

  const wallet = await prisma.wallet.findUnique({
    where: { userId: body.userId },
  });

  if (!wallet) {
    throw new AppError("NOT_FOUND", "Wallet not found");
  }

  await prisma.$transaction(async (tx) => {
    const updatedWallet = await tx.wallet.update({
      where: { id: wallet.id },
      data: {
        balance: { increment: body.amount },
      },
      select: walletSelector,
    });

    await tx.creditTransaction.create({
      data: {
        walletId: wallet.id,
        type: CreditTransactionType.BONUS,
        source: CreditTransactionSource.ADMIN,
        amount: body.amount,
        balanceAfter: updatedWallet.balance,
        meta: { adminId, reason: body.reason },
      },
    });

    await tx.adminAuditLog.create({
      data: {
        adminId,
        action: "GRANT_CREDITS",
        entity: "Wallet",
        entityId: wallet.id,
        after: { userId: body.userId, amount: body.amount },
        reason: body.reason,
      },
    });
  });

  return { message: `Granted ${body.amount} credits to user` };
}
