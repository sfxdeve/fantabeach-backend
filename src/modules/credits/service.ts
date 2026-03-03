import Stripe from "stripe";
import { Wallet, CreditPack, CreditTransaction } from "../../models/Credits.js";
import { AdminAuditLog } from "../../models/Admin.js";
import { User } from "../../models/Auth.js";
import { AppError } from "../../lib/errors.js";
import { env } from "../../lib/env.js";
import { withMongoTransaction } from "../../lib/tx.js";
import { paginationMeta } from "../../lib/pagination.js";
import {
  CreditTransactionType,
  CreditTransactionSource,
} from "../../models/enums.js";
import type {
  CheckoutBodyType,
  CreateCreditPackBodyType,
  GrantCreditsBodyType,
  WalletQueryParamsType,
} from "./schema.js";

const stripe = new Stripe(env.STRIPE_SECRET_KEY);

export async function listPacks() {
  return CreditPack.find({ active: true }).sort({ credits: 1 }).lean();
}

export async function createCheckout(userId: string, body: CheckoutBodyType) {
  const pack = await CreditPack.findById(body.creditPackId).lean();
  if (!pack || !pack.active) {
    throw new AppError("NOT_FOUND", "Credit pack not found or inactive");
  }

  const wallet = await Wallet.findOne({ userId }).lean();
  if (!wallet) throw new AppError("NOT_FOUND", "Wallet not found");

  // Expire any previously pending checkouts for this pack — prevents duplicate pending rows
  await CreditTransaction.updateMany(
    {
      walletId: wallet._id,
      type: CreditTransactionType.PURCHASE,
      "meta.creditPackId": String(pack._id),
      "meta.status": "pending",
    },
    { $set: { "meta.status": "expired" } },
  );

  // Create a pending transaction to track this checkout
  const pending = await CreditTransaction.create({
    walletId: wallet._id,
    type: CreditTransactionType.PURCHASE,
    source: CreditTransactionSource.STRIPE,
    amount: pack.credits,
    balanceAfter: wallet.balance + pack.credits,
    meta: { creditPackId: String(pack._id), status: "pending" },
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
      transactionRef: String(pending._id),
      userId,
      credits: String(pack.credits),
    },
  });

  // Store Stripe session ID in transaction meta
  await CreditTransaction.updateOne(
    { _id: pending._id },
    { $set: { "meta.stripeSessionId": session.id } },
  );

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

    // Only fulfill sessions where payment actually succeeded
    if (session.payment_status !== "paid") return { received: true };

    const transactionRef = session.metadata?.transactionRef;

    if (!transactionRef) return { received: true };

    await withMongoTransaction(async (dbSession) => {
      // Claim this pending transaction exactly once.
      const claimed = await CreditTransaction.findOneAndUpdate(
        {
          _id: transactionRef,
          type: CreditTransactionType.PURCHASE,
          source: CreditTransactionSource.STRIPE,
          "meta.status": "pending",
        },
        {
          $set: {
            "meta.status": "processing",
            "meta.stripeSessionId": session.id,
          },
        },
        { new: true, session: dbSession },
      );
      if (!claimed) return;

      const credits = claimed.amount;
      if (credits <= 0) return;

      const wallet = await Wallet.findById(claimed.walletId).session(dbSession);
      if (!wallet) return;

      const newBalance = wallet.balance + credits;

      await Wallet.updateOne(
        { _id: wallet._id },
        {
          $inc: { balance: credits, totalPurchased: credits },
        },
        { session: dbSession },
      );

      await CreditTransaction.updateOne(
        { _id: claimed._id },
        {
          $set: {
            balanceAfter: newBalance,
            "meta.status": "fulfilled",
            "meta.stripeSessionId": session.id,
          },
        },
        { session: dbSession },
      );
    });
  }

  return { received: true };
}

export async function getWallet(userId: string, query: WalletQueryParamsType) {
  const wallet = await Wallet.findOne({ userId }).lean();
  if (!wallet) throw new AppError("NOT_FOUND", "Wallet not found");

  const skip = (query.page - 1) * query.limit;
  const [transactions, total] = await Promise.all([
    CreditTransaction.find({ walletId: wallet._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(query.limit)
      .lean(),
    CreditTransaction.countDocuments({ walletId: wallet._id }),
  ]);

  return {
    wallet,
    transactions,
    meta: paginationMeta(total, { page: query.page, limit: query.limit }),
  };
}

export async function createPack(body: CreateCreditPackBodyType) {
  return CreditPack.create(body);
}

export async function togglePack(id: string) {
  const pack = await CreditPack.findById(id);
  if (!pack) throw new AppError("NOT_FOUND", "Credit pack not found");
  pack.active = !pack.active;
  await pack.save();
  return pack;
}

export async function grantCredits(
  body: GrantCreditsBodyType,
  adminId: string,
) {
  const user = await User.findById(body.userId).lean();
  if (!user) throw new AppError("NOT_FOUND", "User not found");

  const wallet = await Wallet.findOne({ userId: body.userId }).lean();
  if (!wallet) throw new AppError("NOT_FOUND", "Wallet not found");

  await withMongoTransaction(async (session) => {
    const newBalance = wallet.balance + body.amount;

    await Wallet.updateOne(
      { _id: wallet._id },
      { $inc: { balance: body.amount, totalPurchased: body.amount } },
      { session },
    );

    await CreditTransaction.create(
      [
        {
          walletId: wallet._id,
          type: CreditTransactionType.BONUS,
          source: CreditTransactionSource.ADMIN,
          amount: body.amount,
          balanceAfter: newBalance,
          meta: { adminId, reason: body.reason },
        },
      ],
      { session },
    );

    await AdminAuditLog.create(
      [
        {
          adminId,
          action: "GRANT_CREDITS",
          entity: "Wallet",
          entityId: String(wallet._id),
          after: { userId: body.userId, amount: body.amount },
          reason: body.reason,
        },
      ],
      { session },
    );
  });

  return { message: `Granted ${body.amount} credits to user` };
}
