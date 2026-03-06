import nodemailer from "nodemailer";
import { env } from "./env.js";

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});

export async function sendEmail(
  email: string,
  subject: string,
  text: string,
): Promise<void> {
  await transporter.sendMail({
    from: env.SMTP_FROM,
    to: email,
    subject,
    text,
  });
}

export async function sendVerificationOtp(
  email: string,
  otp: string,
): Promise<void> {
  const subject = "FantaBeach verification code";
  const text = `Your verification code is ${otp}. It expires in 10 minutes.`;

  await sendEmail(email, subject, text);
}

export async function sendResetPasswordOtp(
  email: string,
  code: string,
): Promise<void> {
  const subject = "Reset your FantaBeach password";
  const text = `Your password reset code is: ${code}\n\nThis code expires in 10 minutes.`;

  await sendEmail(email, subject, text);
}
