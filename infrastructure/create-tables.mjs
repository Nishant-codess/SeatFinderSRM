/**
 * Run once to create all DynamoDB tables:
 *   AWS_ACCESS_KEY_ID=xxx AWS_SECRET_ACCESS_KEY=xxx node infrastructure/create-tables.mjs
 */

import { DynamoDBClient, CreateTableCommand, DescribeTableCommand } from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({ region: process.env.AWS_REGION ?? "ap-south-1" });

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
    GlobalSecondaryIndexes: [
      {
        IndexName: "seatId-index",
        KeySchema: [{ AttributeName: "seatId", KeyType: "HASH" }],
        Projection: { ProjectionType: "ALL" },
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
      },
    ],
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
    GlobalSecondaryIndexes: [
      {
        IndexName: "userId-index",
        KeySchema: [{ AttributeName: "userId", KeyType: "HASH" }],
        Projection: { ProjectionType: "ALL" },
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
      },
    ],
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
    // Admin whitelist — replaces NEXT_PUBLIC_ADMIN_EMAILS env var
    TableName: "seatfinder-admins",
    KeySchema: [{ AttributeName: "email", KeyType: "HASH" }],
    AttributeDefinitions: [{ AttributeName: "email", AttributeType: "S" }],
  },
];

for (const def of tables) {
  try {
    await client.send(new DescribeTableCommand({ TableName: def.TableName }));
    console.log(`✓ ${def.TableName} already exists`);
  } catch {
    await client.send(
      new CreateTableCommand({
        ...def,
        BillingMode: "PAY_PER_REQUEST",
      })
    );
    console.log(`✓ Created ${def.TableName}`);
  }
}

console.log("\nAll DynamoDB tables ready.");
