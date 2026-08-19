/**
 * Cognito Lambda: Create Auth Challenge
 * Generates a 6-digit OTP and sends it via SES.
 *
 * Deploy: AWS Console → Lambda → Create function
 * Trigger: Cognito User Pool → Create auth challenge
 *
 * Required env vars on this Lambda:
 *   SES_FROM_EMAIL   — verified SES sender, e.g. noreply@srmist.edu.in
 *   AWS_REGION       — e.g. ap-south-1
 *
 * Required IAM permission: ses:SendEmail
 */
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const ses = new SESClient({ region: process.env.AWS_REGION ?? "ap-south-1" });

export const handler = async (event) => {
  const otp = Math.floor(100_000 + Math.random() * 900_000).toString();
  const email = event.request.userAttributes.email;

  await ses.send(
    new SendEmailCommand({
      Source: process.env.SES_FROM_EMAIL,
      Destination: { ToAddresses: [email] },
      Message: {
        Subject: { Data: "SeatFinderSRM — Your Login Code" },
        Body: {
          Text: {
            Data: `Your SeatFinderSRM login code is:\n\n${otp}\n\nValid for 10 minutes. Do not share this code.`,
          },
          Html: {
            Data: `
              <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
                <h2 style="color:#1a2137;margin-bottom:8px">SeatFinderSRM</h2>
                <p style="color:#5e6e8a;margin-bottom:24px">Your login code is:</p>
                <div style="background:#f5f7fa;border-radius:8px;padding:24px;text-align:center">
                  <span style="font-size:36px;font-weight:700;letter-spacing:12px;color:#2355d4;font-family:monospace">${otp}</span>
                </div>
                <p style="color:#5e6e8a;margin-top:24px;font-size:14px">
                  Valid for <strong>10 minutes</strong>. Do not share this code with anyone.
                </p>
              </div>`,
          },
        },
      },
    })
  );

  // OTP stored in privateChallengeParameters — Cognito passes this to VerifyAuthChallenge
  event.response.publicChallengeParameters = { email };
  event.response.privateChallengeParameters = { otp };
  event.response.challengeMetadata = "OTP_CHALLENGE";

  return event;
};
