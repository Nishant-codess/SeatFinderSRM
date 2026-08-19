/**
 * Attaches the 3 OTP Lambda triggers to the existing Cognito User Pool.
 * Run this once after deploy.mjs if the pool already existed.
 */
import { CognitoIdentityProviderClient, UpdateUserPoolCommand } from "@aws-sdk/client-cognito-identity-provider";
import { LambdaClient, AddPermissionCommand } from "@aws-sdk/client-lambda";

const REGION = process.env.AWS_REGION ?? "ap-south-1";
const USER_POOL_ID = "ap-south-1_XeKMnowqc";
const ACCOUNT_ID = "985539786472";

const LAMBDA_ARNS = {
  define: `arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:SeatFinderDefineAuthChallenge`,
  create: `arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:SeatFinderCreateAuthChallenge`,
  verify: `arn:aws:lambda:${REGION}:${ACCOUNT_ID}:function:SeatFinderVerifyAuthChallenge`,
};

const cognito = new CognitoIdentityProviderClient({ region: REGION });
const lambda  = new LambdaClient({ region: REGION });

const poolArn = `arn:aws:cognito-idp:${REGION}:${ACCOUNT_ID}:userpool/${USER_POOL_ID}`;

// Grant Cognito permission to invoke each Lambda
for (const [key, arn] of Object.entries(LAMBDA_ARNS)) {
  try {
    await lambda.send(new AddPermissionCommand({
      FunctionName: arn,
      StatementId: `Cognito-${key}-${Date.now()}`,
      Action: "lambda:InvokeFunction",
      Principal: "cognito-idp.amazonaws.com",
      SourceArn: poolArn,
    }));
    console.log(`✓ Permission granted: ${key}`);
  } catch (e) {
    if (e.message?.includes("already exists")) {
      console.log(`✓ Permission already exists: ${key}`);
    } else throw e;
  }
}

// Attach triggers to User Pool
await cognito.send(new UpdateUserPoolCommand({
  UserPoolId: USER_POOL_ID,
  LambdaConfig: {
    DefineAuthChallenge: LAMBDA_ARNS.define,
    CreateAuthChallenge: LAMBDA_ARNS.create,
    VerifyAuthChallengeResponse: LAMBDA_ARNS.verify,
  },
}));

console.log("✓ Lambda triggers attached to User Pool");
console.log("\n✅ Done — OTP auth is now wired up.");
