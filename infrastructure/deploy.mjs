/**
 * SeatFinderSRM — Full AWS Infrastructure Deploy
 *
 * Creates (idempotent — safe to re-run):
 *   • IAM role for Lambda (CloudWatch Logs + SES SendEmail)
 *   • 3 Cognito Lambda trigger functions
 *   • Cognito User Pool (CUSTOM_AUTH, OTP-only)
 *   • Cognito App Client
 *   • DynamoDB tables (7 tables)
 *   • SES email identity verification request
 *   • Seeds first admin (tp6382@srmist.edu.in)
 *
 * Usage:
 *   node infrastructure/deploy.mjs
 *
 * Prerequisites:
 *   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY in env or ~/.aws/credentials
 *   AWS_REGION set (default: ap-south-1)
 *   SES_FROM_EMAIL set (the email address you want OTPs sent from)
 *
 * Example:
 *   SES_FROM_EMAIL=noreply@yourdomain.com node infrastructure/deploy.mjs
 */

import {
  IAMClient,
  CreateRoleCommand,
  AttachRolePolicyCommand,
  PutRolePolicyCommand,
  GetRoleCommand,
} from "@aws-sdk/client-iam";
import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";
import {
  LambdaClient,
  CreateFunctionCommand,
  UpdateFunctionCodeCommand,
  GetFunctionCommand,
  AddPermissionCommand,
} from "@aws-sdk/client-lambda";
import {
  CognitoIdentityProviderClient,
  CreateUserPoolCommand,
  CreateUserPoolClientCommand,
  DescribeUserPoolCommand,
  UpdateUserPoolCommand,
  ListUserPoolsCommand,
} from "@aws-sdk/client-cognito-identity-provider";
import {
  DynamoDBClient,
  CreateTableCommand,
  DescribeTableCommand,
} from "@aws-sdk/client-dynamodb";
import {
  SESClient,
  VerifyEmailIdentityCommand,
  GetIdentityVerificationAttributesCommand,
} from "@aws-sdk/client-ses";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { execSync } from "child_process";
import { writeFileSync, readFileSync, mkdirSync, rmSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REGION = process.env.AWS_REGION ?? "ap-south-1";
const SES_FROM_EMAIL = process.env.SES_FROM_EMAIL;

const iam = new IAMClient({ region: REGION });
const sts = new STSClient({ region: REGION });
const lambda = new LambdaClient({ region: REGION });
const cognito = new CognitoIdentityProviderClient({ region: REGION });
const dynamo = new DynamoDBClient({ region: REGION });
const ses = new SESClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(dynamo);

// ─── Utilities ───────────────────────────────────────────────────────────────

function log(msg) { console.log(`  ${msg}`); }
function section(title) { console.log(`\n${"─".repeat(60)}\n  ${title}\n${"─".repeat(60)}`); }
async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

/** Zips a single .mjs file using PowerShell (Windows) or zip (Linux/Mac). */
function zipLambda(handlerCode, handlerFilename = "index.mjs") {
  const tmp = join(tmpdir(), `seatfinder-${Date.now()}`);
  mkdirSync(tmp, { recursive: true });
  const srcPath = join(tmp, handlerFilename);
  const zipPath = join(tmp, "function.zip");
  writeFileSync(srcPath, handlerCode);

  if (process.platform === "win32") {
    execSync(
      `powershell -Command "Compress-Archive -Path '${srcPath}' -DestinationPath '${zipPath}' -Force"`,
      { stdio: "pipe" }
    );
  } else {
    execSync(`cd "${tmp}" && zip function.zip "${handlerFilename}"`, { stdio: "pipe" });
  }

  const buf = readFileSync(zipPath);
  rmSync(tmp, { recursive: true, force: true });
  return buf;
}

// ─── Lambda handler code ──────────────────────────────────────────────────────

const DEFINE_HANDLER = `
export const handler = async (event) => {
  const session = event.request.session;
  if (session.length === 0) {
    event.response.issueTokens = false;
    event.response.failAuthentication = false;
    event.response.challengeName = "CUSTOM_CHALLENGE";
  } else if (
    session.length === 1 &&
    session[0].challengeName === "CUSTOM_CHALLENGE" &&
    session[0].challengeResult === true
  ) {
    event.response.issueTokens = true;
    event.response.failAuthentication = false;
  } else {
    event.response.issueTokens = false;
    event.response.failAuthentication = true;
  }
  return event;
};
`;

const CREATE_HANDLER = (fromEmail) => `
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
const ses = new SESClient({ region: process.env.AWS_REGION ?? "${REGION}" });
export const handler = async (event) => {
  const otp = Math.floor(100_000 + Math.random() * 900_000).toString();
  const email = event.request.userAttributes.email;
  await ses.send(new SendEmailCommand({
    Source: "${fromEmail || "SES_FROM_EMAIL not set"}",
    Destination: { ToAddresses: [email] },
    Message: {
      Subject: { Data: "SeatFinderSRM — Your Login Code" },
      Body: {
        Text: { Data: \`Your SeatFinderSRM login code is:\\n\\n\${otp}\\n\\nValid for 10 minutes.\` },
        Html: { Data: \`<div style="font-family:sans-serif;padding:32px"><h2>SeatFinderSRM</h2><p>Your login code:</p><div style="background:#f5f7fa;border-radius:8px;padding:24px;text-align:center"><span style="font-size:36px;font-weight:700;letter-spacing:12px;color:#2355d4;font-family:monospace">\${otp}</span></div><p style="margin-top:24px;font-size:14px">Valid for <strong>10 minutes</strong>.</p></div>\` },
      },
    },
  }));
  event.response.publicChallengeParameters = { email };
  event.response.privateChallengeParameters = { otp };
  event.response.challengeMetadata = "OTP_CHALLENGE";
  return event;
};
`;

const VERIFY_HANDLER = `
export const handler = async (event) => {
  const expected = event.request.privateChallengeParameters.otp;
  const provided  = event.request.challengeAnswer?.trim();
  event.response.answerCorrect = expected === provided;
  return event;
};
`;

// ─── Step 1: IAM Role ─────────────────────────────────────────────────────────

async function ensureIamRole() {
  section("1. IAM Role for Lambda");
  const roleName = "SeatFinderLambdaRole";

  try {
    const { Role } = await iam.send(new GetRoleCommand({ RoleName: roleName }));
    log(`✓ Role already exists: ${Role.Arn}`);
    return Role.Arn;
  } catch {}

  const trustPolicy = JSON.stringify({
    Version: "2012-10-17",
    Statement: [{
      Effect: "Allow",
      Principal: { Service: "lambda.amazonaws.com" },
      Action: "sts:AssumeRole",
    }],
  });

  const { Role } = await iam.send(new CreateRoleCommand({
    RoleName: roleName,
    AssumeRolePolicyDocument: trustPolicy,
    Description: "SeatFinderSRM Lambda execution role",
  }));

  // Basic Lambda execution (CloudWatch Logs)
  await iam.send(new AttachRolePolicyCommand({
    RoleName: roleName,
    PolicyArn: "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
  }));

  // SES send permission
  await iam.send(new PutRolePolicyCommand({
    RoleName: roleName,
    PolicyName: "SeatFinderSESSendEmail",
    PolicyDocument: JSON.stringify({
      Version: "2012-10-17",
      Statement: [{
        Effect: "Allow",
        Action: ["ses:SendEmail", "ses:SendRawEmail"],
        Resource: "*",
      }],
    }),
  }));

  log(`✓ Created role: ${Role.Arn}`);
  log("  Waiting 10s for IAM propagation...");
  await sleep(10_000);
  return Role.Arn;
}

// ─── Step 2: Lambda Functions ─────────────────────────────────────────────────

async function ensureLambda(name, handlerCode, roleArn) {
  try {
    const { Configuration } = await lambda.send(new GetFunctionCommand({ FunctionName: name }));
    // Update code
    const zip = zipLambda(handlerCode);
    await lambda.send(new UpdateFunctionCodeCommand({ FunctionName: name, ZipFile: zip }));
    log(`✓ Updated Lambda: ${name} → ${Configuration.FunctionArn}`);
    return Configuration.FunctionArn;
  } catch {}

  const zip = zipLambda(handlerCode);
  const { FunctionArn } = await lambda.send(new CreateFunctionCommand({
    FunctionName: name,
    Runtime: "nodejs20.x",
    Role: roleArn,
    Handler: "index.handler",
    Code: { ZipFile: zip },
    Timeout: 30,
    MemorySize: 128,
    Environment: {
      Variables: {
        AWS_REGION_ENV: REGION,
        ...(SES_FROM_EMAIL ? { SES_FROM_EMAIL } : {}),
      },
    },
  }));
  log(`✓ Created Lambda: ${name} → ${FunctionArn}`);
  return FunctionArn;
}

async function addCognitoPermission(functionArn, userPoolArn, statementId) {
  try {
    await lambda.send(new AddPermissionCommand({
      FunctionName: functionArn,
      StatementId: statementId,
      Action: "lambda:InvokeFunction",
      Principal: "cognito-idp.amazonaws.com",
      SourceArn: userPoolArn,
    }));
  } catch (e) {
    if (!e.message?.includes("already exists")) throw e;
  }
}

// ─── Step 3: Cognito User Pool ────────────────────────────────────────────────

async function ensureUserPool(lambdaArns) {
  section("3. Cognito User Pool");
  const poolName = "SeatFinderSRM";

  // Check if pool already exists
  let nextToken;
  do {
    const { UserPools, NextToken } = await cognito.send(
      new ListUserPoolsCommand({ MaxResults: 60, NextToken: nextToken })
    );
    const existing = UserPools.find((p) => p.Name === poolName);
    if (existing) {
      log(`✓ User Pool already exists: ${existing.Id}`);
      return existing.Id;
    }
    nextToken = NextToken;
  } while (nextToken);

  const { Account: accountId } = await sts.send(new GetCallerIdentityCommand({}));

  const { UserPool } = await cognito.send(new CreateUserPoolCommand({
    PoolName: poolName,
    Policies: {
      PasswordPolicy: {
        MinimumLength: 20,
        RequireUppercase: true,
        RequireLowercase: true,
        RequireNumbers: true,
        RequireSymbols: true,
      },
    },
    Schema: [
      {
        Name: "email",
        AttributeDataType: "String",
        Required: true,
        Mutable: false,
      },
      {
        Name: "role",
        AttributeDataType: "String",
        Required: false,
        Mutable: true,
        StringAttributeConstraints: { MinLength: "0", MaxLength: "50" },
      },
    ],
    AutoVerifiedAttributes: ["email"],
    UsernameAttributes: ["email"],
    MfaConfiguration: "OFF",
    LambdaConfig: {
      DefineAuthChallenge: lambdaArns.define,
      CreateAuthChallenge: lambdaArns.create,
      VerifyAuthChallengeResponse: lambdaArns.verify,
    },
    AccountRecoverySetting: {
      RecoveryMechanisms: [{ Name: "verified_email", Priority: 1 }],
    },
    AdminCreateUserConfig: {
      AllowAdminCreateUserOnly: false,
    },
  }));

  // Grant Cognito permission to invoke each Lambda
  const poolArn = `arn:aws:cognito-idp:${REGION}:${accountId}:userpool/${UserPool.Id}`;
  await Promise.all([
    addCognitoPermission(lambdaArns.define, poolArn, "CognitoDefine"),
    addCognitoPermission(lambdaArns.create, poolArn, "CognitoCreate"),
    addCognitoPermission(lambdaArns.verify, poolArn, "CognitoVerify"),
  ]);

  log(`✓ Created User Pool: ${UserPool.Id}`);
  return UserPool.Id;
}

// ─── Step 4: App Client ───────────────────────────────────────────────────────

async function ensureAppClient(userPoolId) {
  section("4. Cognito App Client");

  const { UserPool } = await cognito.send(new DescribeUserPoolCommand({ UserPoolId: userPoolId }));

  // List existing clients
  if (UserPool.EstimatedNumberOfUsers !== undefined) {
    // Pool exists, try to create/find client
  }

  const { UserPoolClient } = await cognito.send(new CreateUserPoolClientCommand({
    UserPoolId: userPoolId,
    ClientName: "seatfinder-web",
    GenerateSecret: false,
    ExplicitAuthFlows: [
      "ALLOW_CUSTOM_AUTH",
      "ALLOW_USER_SRP_AUTH",
      "ALLOW_REFRESH_TOKEN_AUTH",
    ],
    PreventUserExistenceErrors: "ENABLED",
    EnableTokenRevocation: true,
    AccessTokenValidity: 60,
    IdTokenValidity: 60,
    RefreshTokenValidity: 30,
    TokenValidityUnits: {
      AccessToken: "minutes",
      IdToken: "minutes",
      RefreshToken: "days",
    },
  }));

  log(`✓ Created App Client: ${UserPoolClient.ClientId}`);
  return UserPoolClient.ClientId;
}

// ─── Step 5: DynamoDB Tables ──────────────────────────────────────────────────

async function ensureDynamoTables() {
  section("5. DynamoDB Tables");

  const tables = [
    {
      TableName: "seatfinder-seats",
      KeySchema: [{ AttributeName: "seatId", KeyType: "HASH" }],
      AttributeDefinitions: [{ AttributeName: "seatId", AttributeType: "S" }],
    },
    {
      TableName: "seatfinder-bookings",
      KeySchema: [
        { AttributeName: "userId", KeyType: "HASH" },
        { AttributeName: "bookingId", KeyType: "RANGE" },
      ],
      AttributeDefinitions: [
        { AttributeName: "userId", AttributeType: "S" },
        { AttributeName: "bookingId", AttributeType: "S" },
        { AttributeName: "seatId", AttributeType: "S" },
      ],
      GlobalSecondaryIndexes: [{
        IndexName: "seatId-index",
        KeySchema: [{ AttributeName: "seatId", KeyType: "HASH" }],
        Projection: { ProjectionType: "ALL" },
      }],
    },
    {
      TableName: "seatfinder-users",
      KeySchema: [{ AttributeName: "userId", KeyType: "HASH" }],
      AttributeDefinitions: [{ AttributeName: "userId", AttributeType: "S" }],
    },
    {
      TableName: "seatfinder-feedback",
      KeySchema: [{ AttributeName: "feedbackId", KeyType: "HASH" }],
      AttributeDefinitions: [
        { AttributeName: "feedbackId", AttributeType: "S" },
        { AttributeName: "userId", AttributeType: "S" },
      ],
      GlobalSecondaryIndexes: [{
        IndexName: "userId-index",
        KeySchema: [{ AttributeName: "userId", KeyType: "HASH" }],
        Projection: { ProjectionType: "ALL" },
      }],
    },
    {
      TableName: "seatfinder-audit-logs",
      KeySchema: [
        { AttributeName: "logId", KeyType: "HASH" },
        { AttributeName: "timestamp", KeyType: "RANGE" },
      ],
      AttributeDefinitions: [
        { AttributeName: "logId", AttributeType: "S" },
        { AttributeName: "timestamp", AttributeType: "S" },
      ],
    },
    {
      TableName: "seatfinder-settings",
      KeySchema: [{ AttributeName: "settingKey", KeyType: "HASH" }],
      AttributeDefinitions: [{ AttributeName: "settingKey", AttributeType: "S" }],
    },
    {
      TableName: "seatfinder-admins",
      KeySchema: [{ AttributeName: "email", KeyType: "HASH" }],
      AttributeDefinitions: [{ AttributeName: "email", AttributeType: "S" }],
    },
  ];

  for (const def of tables) {
    try {
      await dynamo.send(new DescribeTableCommand({ TableName: def.TableName }));
      log(`✓ ${def.TableName} — already exists`);
    } catch {
      await dynamo.send(new CreateTableCommand({ ...def, BillingMode: "PAY_PER_REQUEST" }));
      log(`✓ ${def.TableName} — created`);
    }
  }
}

// ─── Step 6: SES Email Verification ──────────────────────────────────────────

async function verifySesEmail() {
  section("6. SES Email Verification");

  if (!SES_FROM_EMAIL) {
    log("⚠  SES_FROM_EMAIL not set — skipping.");
    log("   Set it later: aws ses verify-email-identity --email-address you@domain.com");
    return;
  }

  const { VerificationAttributes } = await ses.send(
    new GetIdentityVerificationAttributesCommand({ Identities: [SES_FROM_EMAIL] })
  );

  const status = VerificationAttributes[SES_FROM_EMAIL]?.VerificationStatus;

  if (status === "Success") {
    log(`✓ ${SES_FROM_EMAIL} already verified`);
  } else if (status === "Pending") {
    log(`⏳ ${SES_FROM_EMAIL} verification email already sent — check inbox`);
  } else {
    await ses.send(new VerifyEmailIdentityCommand({ EmailAddress: SES_FROM_EMAIL }));
    log(`✓ Verification email sent to ${SES_FROM_EMAIL}`);
    log("  Check your inbox and click the verification link before OTPs will send.");
  }
}

// ─── Step 7: Seed Admin ───────────────────────────────────────────────────────

async function seedAdmin() {
  section("7. Seed Admin");
  const admins = [
    { email: "tp6382@srmist.edu.in", name: "Tanish Poddar" },
  ];
  for (const admin of admins) {
    await docClient.send(new PutCommand({
      TableName: "seatfinder-admins",
      Item: {
        email: admin.email,
        name: admin.name,
        addedBy: "deploy-script",
        addedAt: new Date().toISOString(),
        isActive: true,
      },
      ConditionExpression: "attribute_not_exists(email)",
    })).catch(() => {}); // ignore ConditionalCheckFailed (already exists)
    log(`✓ Admin seeded: ${admin.email}`);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n🚀  SeatFinderSRM AWS Deploy");
  console.log(`    Region: ${REGION}`);
  if (SES_FROM_EMAIL) console.log(`    SES sender: ${SES_FROM_EMAIL}`);

  const roleArn = await ensureIamRole();

  section("2. Lambda Trigger Functions");
  const defineArn = await ensureLambda("SeatFinderDefineAuthChallenge", DEFINE_HANDLER, roleArn);
  const createArn = await ensureLambda("SeatFinderCreateAuthChallenge", CREATE_HANDLER(SES_FROM_EMAIL), roleArn);
  const verifyArn = await ensureLambda("SeatFinderVerifyAuthChallenge", VERIFY_HANDLER, roleArn);

  const userPoolId = await ensureUserPool({ define: defineArn, create: createArn, verify: verifyArn });
  const clientId = await ensureAppClient(userPoolId);

  await ensureDynamoTables();
  await verifySesEmail();
  await seedAdmin();

  // ─── Output .env.local ────────────────────────────────────────────────────
  const envContent = `# ── AWS Region ────────────────────────────────────────────────
AWS_REGION=${REGION}

# ── AWS Credentials (server-side only) ────────────────────────
AWS_ACCESS_KEY_ID=${process.env.AWS_ACCESS_KEY_ID ?? "your-access-key-id"}
AWS_SECRET_ACCESS_KEY=${process.env.AWS_SECRET_ACCESS_KEY ?? "your-secret-access-key"}

# ── Cognito ────────────────────────────────────────────────────
NEXT_PUBLIC_COGNITO_USER_POOL_ID=${userPoolId}
NEXT_PUBLIC_COGNITO_CLIENT_ID=${clientId}
`;

  console.log("\n" + "═".repeat(60));
  console.log("  ✅  DEPLOY COMPLETE — paste into .env.local:");
  console.log("═".repeat(60));
  console.log(envContent);

  // Also write to .env.local.generated (don't overwrite existing .env.local)
  const envPath = join(__dirname, "..", ".env.local.generated");
  writeFileSync(envPath, envContent);
  console.log(`  (Also saved to ${envPath})`);
}

main().catch((err) => {
  console.error("\n❌  Deploy failed:", err.message ?? err);
  process.exit(1);
});
