import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";

const region = process.env.AWS_REGION ?? "ap-south-1";

const dynamo = new DynamoDBClient({
  region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export const docClient = DynamoDBDocumentClient.from(dynamo, {
  marshallOptions: { removeUndefinedValues: true },
});

export const cognitoAdmin = new CognitoIdentityProviderClient({
  region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

export const TABLES = {
  SEATS:      "seatfinder-seats",
  BOOKINGS:   "seatfinder-bookings",
  USERS:      "seatfinder-users",
  FEEDBACK:   "seatfinder-feedback",
  AUDIT_LOGS: "seatfinder-audit-logs",
  SETTINGS:   "seatfinder-settings",
  ADMINS:     "seatfinder-admins",
} as const;
