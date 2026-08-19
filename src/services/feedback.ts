import { GetCommand, PutCommand, UpdateCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { docClient, TABLES } from "@/lib/aws";
import type { FeedbackTicket, FeedbackFilters, FeedbackResponse } from "@/types";

export async function submitFeedback(
  ticket: Omit<FeedbackTicket, "id" | "status" | "responses" | "createdAt" | "updatedAt">
): Promise<string> {
  const feedbackId = `feedback-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const now = new Date().toISOString();

  const newTicket: FeedbackTicket = {
    ...ticket,
    id: feedbackId,
    status: "pending",
    responses: [],
    createdAt: now,
    updatedAt: now,
  };

  await docClient.send(new PutCommand({ TableName: TABLES.FEEDBACK, Item: { ...newTicket, feedbackId } }));
  return feedbackId;
}

export async function getUserFeedback(userId: string): Promise<FeedbackTicket[]> {
  try {
    const { Items = [] } = await docClient.send(
      new ScanCommand({
        TableName: TABLES.FEEDBACK,
        FilterExpression: "userId = :uid",
        ExpressionAttributeValues: { ":uid": userId },
      })
    );
    return (Items as FeedbackTicket[]).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch {
    return [];
  }
}

export async function getAllFeedback(filters?: FeedbackFilters): Promise<FeedbackTicket[]> {
  try {
    const { Items = [] } = await docClient.send(new ScanCommand({ TableName: TABLES.FEEDBACK }));
    let tickets = Items as FeedbackTicket[];
    if (filters?.status) tickets = tickets.filter((t) => t.status === filters.status);
    if (filters?.category) tickets = tickets.filter((t) => t.category === filters.category);
    return tickets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch {
    return [];
  }
}

export async function addResponse(
  ticketId: string,
  authorId: string,
  authorName: string,
  message: string
): Promise<void> {
  const { Item } = await docClient.send(
    new GetCommand({ TableName: TABLES.FEEDBACK, Key: { feedbackId: ticketId } })
  );
  if (!Item) throw new Error("Ticket not found");

  const ticket = Item as FeedbackTicket;
  const response: FeedbackResponse = {
    id: `resp-${Date.now()}`,
    authorId,
    authorName,
    message,
    timestamp: new Date().toISOString(),
  };

  await docClient.send(
    new UpdateCommand({
      TableName: TABLES.FEEDBACK,
      Key: { feedbackId: ticketId },
      UpdateExpression: "SET responses = :r, #s = :s, updatedAt = :now",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: {
        ":r": [...ticket.responses, response],
        ":s": ticket.status === "pending" ? "in-progress" : ticket.status,
        ":now": new Date().toISOString(),
      },
    })
  );
}

export async function updateTicketStatus(
  ticketId: string,
  status: FeedbackTicket["status"]
): Promise<void> {
  await docClient.send(
    new UpdateCommand({
      TableName: TABLES.FEEDBACK,
      Key: { feedbackId: ticketId },
      UpdateExpression: "SET #s = :s, updatedAt = :now",
      ExpressionAttributeNames: { "#s": "status" },
      ExpressionAttributeValues: { ":s": status, ":now": new Date().toISOString() },
    })
  );
}

export async function getTicketById(ticketId: string): Promise<FeedbackTicket | null> {
  try {
    const { Item } = await docClient.send(
      new GetCommand({ TableName: TABLES.FEEDBACK, Key: { feedbackId: ticketId } })
    );
    return (Item as FeedbackTicket) ?? null;
  } catch {
    return null;
  }
}
