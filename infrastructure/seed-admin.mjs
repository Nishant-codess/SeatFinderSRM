/**
 * Seeds the first admin into seatfinder-admins table.
 * Run ONCE after create-tables.mjs:
 *   AWS_ACCESS_KEY_ID=xxx AWS_SECRET_ACCESS_KEY=xxx node infrastructure/seed-admin.mjs
 */
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const client = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION ?? "ap-south-1" })
);

const admins = [
  { email: "tp6382@srmist.edu.in", name: "Tanish Poddar" },
  // Add more initial admins here if needed
];

for (const admin of admins) {
  await client.send(
    new PutCommand({
      TableName: "seatfinder-admins",
      Item: {
        email: admin.email,
        name: admin.name,
        addedBy: "system",
        addedAt: new Date().toISOString(),
        isActive: true,
      },
    })
  );
  console.log(`✓ Seeded admin: ${admin.email}`);
}
