import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { AdminUpdateUserAttributesCommand } from "@aws-sdk/client-cognito-identity-provider";
import { docClient, cognitoAdmin, TABLES } from "./aws";

async function isAdminEmail(email: string): Promise<boolean> {
  try {
    const { Item } = await docClient.send(
      new GetCommand({ TableName: TABLES.ADMINS, Key: { email } })
    );
    return !!(Item?.isActive);
  } catch {
    return false;
  }
}

export async function initializeUserRole(
  userId: string,
  email: string,
  displayName?: string
) {
  try {
    const { Item } = await docClient.send(
      new GetCommand({ TableName: TABLES.USERS, Key: { userId } })
    );

    if (!Item) {
      const role = (await isAdminEmail(email)) ? "admin" : "user";

      await docClient.send(
        new PutCommand({
          TableName: TABLES.USERS,
          Item: {
            userId,
            email,
            displayName: displayName ?? email.split("@")[0],
            role,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            stats: {
              totalBookings: 0,
              noShowCount: 0,
              overstayCount: 0,
              totalHoursBooked: 0,
            },
          },
          ConditionExpression: "attribute_not_exists(userId)",
        })
      );

      await cognitoAdmin.send(
        new AdminUpdateUserAttributesCommand({
          UserPoolId: process.env.COGNITO_USER_POOL_ID!,
          Username: email,
          UserAttributes: [{ Name: "custom:role", Value: role }],
        })
      ).catch(() => {});
    }
  } catch (error) {
    console.error("Error initializing user role:", error);
  }
}

export async function getUserRole(userId: string): Promise<"admin" | "user" | null> {
  try {
    const { Item } = await docClient.send(
      new GetCommand({ TableName: TABLES.USERS, Key: { userId } })
    );
    return (Item?.role as "admin" | "user") ?? null;
  } catch {
    return null;
  }
}

export async function isAdmin(userId: string): Promise<boolean> {
  return (await getUserRole(userId)) === "admin";
}
