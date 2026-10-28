/**
 * db.js — data access layer.
 * Uses DynamoDB when TABLE_NAME is set, otherwise an in-memory Map (local dev / tests).
 *
 * Task schema:
 *   userId (PK) string          taskId (SK) string, time-sortable
 *   title string                description string
 *   done boolean                priority "high" | "medium" | "low"
 *   dueDate "YYYY-MM-DD" | null category string
 *   createdAt ISO-8601          updatedAt ISO-8601
 */
const { randomBytes } = require("crypto");

const now = () => new Date().toISOString();

// Time-sortable id: base36 timestamp + random suffix. No dependencies.
function newId() {
  const ts = Date.now().toString(36).padStart(9, "0");
  return `${ts}-${randomBytes(6).toString("base64url")}`;
}

function buildTask(userId, f) {
  const ts = now();
  return {
    userId,
    taskId: newId(),
    title: f.title,
    description: f.description ?? "",
    done: f.done ?? false,
    priority: f.priority ?? "medium",
    dueDate: f.dueDate ?? null,
    category: f.category ?? "General",
    createdAt: ts,
    updatedAt: ts,
  };
}

// Shared by both backends. Filters are already validated by app.js.
function applyFilters(items, { done, priority, category, search } = {}) {
  let out = items;
  if (done !== undefined) out = out.filter((t) => t.done === done);
  if (priority) out = out.filter((t) => t.priority === priority);
  if (category) out = out.filter((t) => t.category === category);
  if (search) {
    const q = search.toLowerCase();
    out = out.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        (t.description || "").toLowerCase().includes(q)
    );
  }
  return out;
}

const uniqueCategories = (items) =>
  [...new Set(items.map((t) => t.category).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  );

if (process.env.TABLE_NAME) {
  /* ─── DynamoDB ─────────────────────────────────────────────────────── */
  const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
  const {
    DynamoDBDocumentClient,
    QueryCommand,
    PutCommand,
    UpdateCommand,
    DeleteCommand,
  } = require("@aws-sdk/lib-dynamodb");

  const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
  const TABLE = process.env.TABLE_NAME;
  const isConditionFailure = (e) => e?.name === "ConditionalCheckFailedException";

  // One Query per user, paginated. Filtering happens in memory: a personal task
  // list is small, and this avoids a GSI per filter combination.
  async function all(userId) {
    const items = [];
    let ExclusiveStartKey;
    do {
      const res = await ddb.send(
        new QueryCommand({
          TableName: TABLE,
          KeyConditionExpression: "userId = :u",
          ExpressionAttributeValues: { ":u": userId },
          ExclusiveStartKey,
        })
      );
      items.push(...(res.Items ?? []));
      ExclusiveStartKey = res.LastEvaluatedKey;
    } while (ExclusiveStartKey);
    return items;
  }

  module.exports = {
    async list(userId, filters) {
      return applyFilters(await all(userId), filters);
    },

    async create(userId, fields) {
      const task = buildTask(userId, fields);
      await ddb.send(new PutCommand({ TableName: TABLE, Item: task }));
      return task;
    },

    async update(userId, taskId, patch) {
      const names = { "#updatedAt": "updatedAt" };
      const values = { ":updatedAt": now() };
      const sets = ["#updatedAt = :updatedAt"];
      for (const [k, v] of Object.entries(patch)) {
        names[`#${k}`] = k;
        values[`:${k}`] = v;
        sets.push(`#${k} = :${k}`);
      }
      try {
        const res = await ddb.send(
          new UpdateCommand({
            TableName: TABLE,
            Key: { userId, taskId },
            ConditionExpression: "attribute_exists(taskId)", // 404 instead of silently creating
            UpdateExpression: `SET ${sets.join(", ")}`,
            ExpressionAttributeNames: names,
            ExpressionAttributeValues: values,
            ReturnValues: "ALL_NEW",
          })
        );
        return res.Attributes ?? null;
      } catch (e) {
        if (isConditionFailure(e)) return null;
        throw e;
      }
    },

    async remove(userId, taskId) {
      try {
        await ddb.send(
          new DeleteCommand({
            TableName: TABLE,
            Key: { userId, taskId },
            ConditionExpression: "attribute_exists(taskId)",
          })
        );
        return true;
      } catch (e) {
        if (isConditionFailure(e)) return false;
        throw e;
      }
    },

    async categories(userId) {
      return uniqueCategories(await all(userId));
    },
  };
} else {
  /* ─── In-memory (local dev, tests) ─────────────────────────────────── */
  const store = new Map(); // userId -> task[]
  const tasksOf = (userId) => {
    if (!store.has(userId)) store.set(userId, []);
    return store.get(userId);
  };

  module.exports = {
    async list(userId, filters) {
      return applyFilters([...tasksOf(userId)], filters);
    },

    async create(userId, fields) {
      const task = buildTask(userId, fields);
      tasksOf(userId).push(task);
      return task;
    },

    async update(userId, taskId, patch) {
      const tasks = tasksOf(userId);
      const i = tasks.findIndex((t) => t.taskId === taskId);
      if (i === -1) return null;
      tasks[i] = { ...tasks[i], ...patch, updatedAt: now() };
      return tasks[i];
    },

    async remove(userId, taskId) {
      const tasks = tasksOf(userId);
      const i = tasks.findIndex((t) => t.taskId === taskId);
      if (i === -1) return false;
      tasks.splice(i, 1);
      return true;
    },

    async categories(userId) {
      return uniqueCategories(tasksOf(userId));
    },
  };
}
