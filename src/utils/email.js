import { Resend } from 'resend';
import { env } from "../config/env.js"
const resend = new Resend(env.RESEND_API_KEY);

export const sendVerificationEmail = async (email, verificationUrl) => {

    await resend.emails.send({
        from: env.EMAIL_FROM,
        to: email,
        subject: 'Verify Your Email',
        html: `
            <h2>Verify your email</h2>

            <p>Click the button below to verify your account</p>

            <a href="${verificationUrl}"> Verify Email </a>
        
        `
    });
}

export const sendResetPasswordEmail = async (email, resetUrl) => {
    await resend.emails.send({
        from: env.EMAIL_FROM,
        to: email,
        subject: "Reset your Password",
        html: `
        <h2>Reset your password</h2>

            <p>
                Click the button below to reset your password.
            </p>

            <a href="${resetUrl}">
                Reset Password
            </a>

            <p>
                This link will expire in 15 minutes.
            </p>
        `
    })
}
