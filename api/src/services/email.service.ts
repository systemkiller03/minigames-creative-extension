import nodemailer from 'nodemailer';
import { env } from '@/config/env';

const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  ...(env.SMTP_USER &&
    env.SMTP_PASSWORD && {
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASSWORD,
      },
    }),
});

export class EmailService {
  async sendPasswordResetCode(email: string, code: string) {
    await transporter.sendMail({
      from: env.SMTP_FROM,
      to: email,
      subject: 'Your password reset code',
      text: `Your password reset code is ${code}. It expires in 10 minutes.`,
    });
  }

  async sendEmailVerificationCode(email: string, code: string) {
    await transporter.sendMail({
      from: env.SMTP_FROM,
      to: email,
      subject: 'Verify your email address',
      text: `Your email verification code is ${code}. It expires in 10 minutes.`,
    });
  }
}

export const emailService = new EmailService();
