const express = require("express");
const db = require("./db");

// Until Cognito is added on Day 3 every request belongs to one fixed user.
const USER_ID = "demo-user";

const app = express();
app.use((req, res, next) => {
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
app.use(express.json({ limit: "10kb" }));

app.get("/health", (_req, res) => res.json({ ok: true }));

app.get("/tasks", async (_req, res, next) => {
  try {
    res.json(await db.list(USER_ID));
  } catch (err) {
    next(err);
  }
});

app.post("/tasks", async (req, res, next) => {
  try {
    const title = cleanTitle(req.body?.title);
    if (!title) return res.status(400).json({ error: "Title must be 1-200 characters." });
    res.status(201).json(await db.create(USER_ID, { title }));
  } catch (err) {
    next(err);
  }
});

app.put("/tasks/:taskId", async (req, res, next) => {
  try {
    const patch = {};
    if (req.body?.title !== undefined) {
      const title = cleanTitle(req.body.title);
      if (!title) return res.status(400).json({ error: "Title must be 1-200 characters." });
      patch.title = title;
    }
    if (req.body?.done !== undefined) {
      if (typeof req.body.done !== "boolean")
        return res.status(400).json({ error: "done must be true or false." });
      patch.done = req.body.done;
    }
    if (Object.keys(patch).length === 0)
      return res.status(400).json({ error: "Send title and/or done." });

    const task = await db.update(USER_ID, req.params.taskId, patch);
    if (!task) return res.status(404).json({ error: "Task not found." });
    res.json(task);
  } catch (err) {
    next(err);
  }
});

app.delete("/tasks/:taskId", async (req, res, next) => {
  try {
    const removed = await db.remove(USER_ID, req.params.taskId);
    if (!removed) return res.status(404).json({ error: "Task not found." });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

app.use((_req, res) => res.status(404).json({ error: "Not found." }));

// Log the real error to CloudWatch, return a generic message to the client.
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err.type === "entity.parse.failed")
    return res.status(400).json({ error: "Invalid JSON." });
  console.error(err);
  res.status(500).json({ error: "Something went wrong." });
});

function cleanTitle(value) {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t.length >= 1 && t.length <= 200 ? t : null;
}

module.exports = app;
