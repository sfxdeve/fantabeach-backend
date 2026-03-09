import Stripe from "stripe";
import { prisma } from "../../prisma/index.js";
import { AppError } from "../../lib/errors.js";
import { env } from "../../lib/env.js";
import { paginationMeta, paginationOptions } from "../../lib/pagination.js";
import {
  CreditTransactionType,
  CreditTransactionSource,
} from "../../prisma/generated/enums.js";
import {
  auditLogSelector,
  creditPackSelector,
  creditTransactionSelector,
  userSelector,
  walletSelector,
} from "../../prisma/selectors.js";
import type {
  CheckoutBodyType,
  CreditPackParamsType,
  CreateCreditPackBodyType,
  GrantCreditsBodyType,
  WalletQueryType,
} from "./schema.js";

const stripe = new Stripe(env.STRIPE_SECRET_KEY);

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

export async function listPacks() {
  const items = await prisma.creditPack.findMany({
    where: { isActive: true },
    orderBy: { credits: "asc" },
    select: creditPackSelector,
  });

  return { message: "Credit packs fetched successfully", items };
}

export async function createCheckout({
  userId,
  ...body
}: { userId: string } & CheckoutBodyType) {
  const pack = await prisma.creditPack.findUnique({
    where: { id: body.creditPackId },
    select: creditPackSelector,
  });

  if (!pack || !pack.isActive) {
    throw new AppError("NOT_FOUND", "Credit pack not found or inactive");
  }

  const wallet = await prisma.wallet.findUnique({
    where: { userId },
    select: walletSelector,
  });

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

  const pendingTransaction = await prisma.creditTransaction.create({
    data: {
      walletId: wallet.id,
      type: CreditTransactionType.PURCHASE,
      source: CreditTransactionSource.STRIPE,
      amount: pack.credits,
      newBalance: wallet.balance + pack.credits,
      meta: { creditPackId: pack.id, status: "pending" },
    },
    select: creditTransactionSelector,
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
      transactionRef: pendingTransaction.id,
      userId,
      credits: String(pack.credits),
    },
  });

  await prisma.creditTransaction.update({
    where: { id: pendingTransaction.id },
    data: {
      meta: {
        ...asObject(pendingTransaction.meta),
        stripeSessionId: session.id,
      },
    },
    select: creditTransactionSelector,
  });

  return { message: "Checkout session created successfully", url: session.url };
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
      const pendingTransaction = await tx.creditTransaction.findUnique({
        where: {
          id: transactionRef,
          type: CreditTransactionType.PURCHASE,
          source: CreditTransactionSource.STRIPE,
          meta: { path: ["status"], equals: "pending" },
        },
        select: {
          ...creditTransactionSelector,
          wallet: { select: walletSelector },
        },
      });

      if (!pendingTransaction) {
        return;
      }

      const claim = await tx.creditTransaction.updateMany({
        where: {
          id: pendingTransaction.id,
          type: CreditTransactionType.PURCHASE,
          source: CreditTransactionSource.STRIPE,
          meta: { path: ["status"], equals: "pending" },
        },
        data: {
          meta: {
            ...asObject(pendingTransaction.meta),
            status: "processing",
            stripeSessionId: session.id,
          },
        },
      });

      if (claim.count !== 1) {
        return;
      }

      const credits = pendingTransaction.amount;

      if (credits <= 0) {
        return;
      }

      const wallet = await tx.wallet.findUnique({
        where: { id: pendingTransaction.wallet.id },
        select: walletSelector,
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
        select: walletSelector,
      });

      await tx.creditTransaction.update({
        where: { id: pendingTransaction.id },
        data: {
          newBalance,
          meta: {
            ...asObject(pendingTransaction.meta),
            status: "fulfilled",
            stripeSessionId: session.id,
          },
        },
        select: creditTransactionSelector,
      });
    });
  }

  return { message: "Webhook processed successfully", received: true };
}

export async function getWallet({
  userId,
  page,
  limit,
}: { userId: string } & WalletQueryType) {
  const wallet = await prisma.wallet.findUnique({
    where: { userId },
    select: walletSelector,
  });

  if (!wallet) {
    throw new AppError("NOT_FOUND", "Wallet not found");
  }

  const options = paginationOptions({ page, limit });

  const [transactions, total, totalsByType] = await Promise.all([
    prisma.creditTransaction.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: "desc" },
      skip: options.skip,
      take: options.take,
      select: creditTransactionSelector,
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
      totalSpent += amount;
    }
  }

  return {
    message: "Wallet fetched successfully",
    wallet: {
      ...wallet,
      totalPurchased,
      totalSpent,
    },
    transactions,
    meta: paginationMeta(total, { page, limit }),
  };
}

export async function createPack({
  adminId,
  ...data
}: { adminId: string } & CreateCreditPackBodyType) {
  const pack = await prisma.creditPack.create({
    data,
    select: creditPackSelector,
  });

  await prisma.auditLog.create({
    data: {
      action: "CREATE_CREDIT_PACK",
      before: {},
      after: pack,
      entityId: pack.id,
      entity: "CreditPack",
      adminId,
    },
    select: auditLogSelector,
  });

  return { message: "Credit pack created successfully", pack };
}

export async function togglePack({
  adminId,
  id,
}: { adminId: string } & CreditPackParamsType) {
  const existingPack = await prisma.creditPack.findUnique({
    where: { id },
    select: creditPackSelector,
  });

  if (!existingPack) {
    throw new AppError("NOT_FOUND", "Credit pack not found");
  }

  const updatedPack = await prisma.creditPack.update({
    where: { id },
    data: { isActive: !existingPack.isActive },
    select: creditPackSelector,
  });

  await prisma.auditLog.create({
    data: {
      action: "TOGGLE_CREDIT_PACK",
      before: existingPack,
      after: updatedPack,
      entityId: id,
      entity: "CreditPack",
      adminId,
    },
    select: auditLogSelector,
  });

  return { message: "Credit pack updated successfully", pack: updatedPack };
}

export async function grantCredits({
  adminId,
  ...body
}: { adminId: string } & GrantCreditsBodyType) {
  const existingUser = await prisma.user.findUnique({
    where: { id: body.userId },
    select: userSelector,
  });

  if (!existingUser) {
    throw new AppError("NOT_FOUND", "User not found");
  }

  const existingWallet = await prisma.wallet.findUnique({
    where: { userId: body.userId },
    select: walletSelector,
  });

  if (!existingWallet) {
    throw new AppError("NOT_FOUND", "Wallet not found");
  }

  await prisma.$transaction(async (tx) => {
    const updatedWallet = await tx.wallet.update({
      where: { id: existingWallet.id },
      data: {
        balance: { increment: body.amount },
      },
      select: walletSelector,
    });

    await tx.creditTransaction.create({
      data: {
        walletId: existingWallet.id,
        type: CreditTransactionType.BONUS,
        source: CreditTransactionSource.ADMIN,
        amount: body.amount,
        newBalance: updatedWallet.balance,
      },
      select: creditTransactionSelector,
    });

    await tx.auditLog.create({
      data: {
        action: "GRANT_CREDITS",
        before: existingWallet,
        after: updatedWallet,
        entityId: updatedWallet.id,
        entity: "Wallet",
        reason: body.reason,
        adminId,
      },
      select: auditLogSelector,
    });
  });

  return { message: "Credits granted successfully" };
}
