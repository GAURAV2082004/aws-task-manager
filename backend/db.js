// All table access lives in this file so the routes stay clean.
//
// Table design (Day 1):
//   partition key  userId  (fixed "demo-user" until Cognito arrives on Day 3)
//   sort key       taskId  (time-sortable, so a Query returns tasks in creation order)
//
// Locally, when TABLE_NAME is not set, an in-memory store is used so you can
// build the UI without touching AWS.

const { randomUUID } = require("node:crypto");

const TABLE = process.env.TABLE_NAME;

// Sortable id: base36 timestamp + random suffix.
const newTaskId = () =>
  `${Date.now().toString(36).padStart(9, "0")}-${randomUUID().slice(0, 8)}`;

// ---------- DynamoDB implementation ----------
function dynamoStore() {
  const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
  const {
    DynamoDBDocumentClient,
    QueryCommand,
    PutCommand,
    UpdateCommand,
    DeleteCommand,
  } = require("@aws-sdk/lib-dynamodb");

  // Created outside the handler so warm Lambda invocations reuse the client.
  const doc = DynamoDBDocumentClient.from(new DynamoDBClient({}));

  return {
    async list(userId) {
      const out = await doc.send(
        new QueryCommand({
          TableName: TABLE,
          KeyConditionExpression: "userId = :u",
          ExpressionAttributeValues: { ":u": userId },
        })
      );
      return out.Items ?? [];
    },

    async create(userId, { title }) {
      const now = new Date().toISOString();
      const item = {
        userId,
        taskId: newTaskId(),
        title,
        done: false,
        createdAt: now,
        updatedAt: now,
      };
      await doc.send(new PutCommand({ TableName: TABLE, Item: item }));
      return item;
    },

    async update(userId, taskId, patch) {
      const names = { "#u": "updatedAt" };
      const values = { ":u": new Date().toISOString() };
      const sets = ["#u = :u"];
      if (patch.title !== undefined) {
        names["#t"] = "title";
        values[":t"] = patch.title;
        sets.push("#t = :t");
      }
      if (patch.done !== undefined) {
        names["#d"] = "done";
        values[":d"] = patch.done;
        sets.push("#d = :d");
      }
      try {
        const out = await doc.send(
          new UpdateCommand({
            TableName: TABLE,
            Key: { userId, taskId },
            UpdateExpression: `SET ${sets.join(", ")}`,
            // Without this, UpdateItem would silently create a new item (upsert).
            ConditionExpression: "attribute_exists(taskId)",
            ExpressionAttributeNames: names,
            ExpressionAttributeValues: values,
            ReturnValues: "ALL_NEW",
          })
        );
        return out.Attributes;
      } catch (err) {
        if (err.name === "ConditionalCheckFailedException") return null;
        throw err;
      }
    },

    async remove(userId, taskId) {
      try {
        await doc.send(
          new DeleteCommand({
            TableName: TABLE,
            Key: { userId, taskId },
            ConditionExpression: "attribute_exists(taskId)",
          })
        );
        return true;
      } catch (err) {
        if (err.name === "ConditionalCheckFailedException") return false;
        throw err;
      }
    },
  };
}

// ---------- In-memory implementation (local dev and tests) ----------
function memoryStore() {
  const rows = new Map(); // key: `${userId}|${taskId}`
  const key = (u, t) => `${u}|${t}`;

  return {
    async list(userId) {
      return [...rows.values()]
        .filter((r) => r.userId === userId)
        .sort((a, b) => a.taskId.localeCompare(b.taskId));
    },
    async create(userId, { title }) {
      const now = new Date().toISOString();
      const item = {
        userId,
        taskId: newTaskId(),
        title,
        done: false,
        createdAt: now,
        updatedAt: now,
      };
      rows.set(key(userId, item.taskId), item);
      return item;
    },
    async update(userId, taskId, patch) {
      const row = rows.get(key(userId, taskId));
      if (!row) return null;
      Object.assign(row, patch, { updatedAt: new Date().toISOString() });
      return row;
    },
    async remove(userId, taskId) {
      return rows.delete(key(userId, taskId));
    },
  };
}

module.exports = TABLE ? dynamoStore() : memoryStore();
