const express = require("express");
const db = require("./db");

// Until Cognito is added, every request belongs to one fixed user.
const USER_ID = "demo-user";

const PRIORITIES = ["high", "medium", "low"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const app = express();
app.use((req, res, next) => {
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
app.use(express.json({ limit: "10kb" }));

/* ─── validation ───────────────────────────────────────────────────────── */

const isRealDate = (s) => {
  if (typeof s !== "string" || !DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

const todayUTC = () => new Date().toISOString().slice(0, 10);

/**
 * Validate task fields. With `partial` true (PUT) only supplied fields are
 * checked. Returns { value } or { error }.
 */
function validateTask(body, { partial }) {
  if (!body || typeof body !== "object" || Array.isArray(body))
    return { error: "Request body must be a JSON object." };

  const out = {};
  const has = (k) => body[k] !== undefined;

  if (has("title") || !partial) {
    const t = typeof body.title === "string" ? body.title.trim() : "";
    if (t.length < 1 || t.length > 200)
      return { error: "title must be 1-200 characters." };
    out.title = t;
  }
  if (has("description")) {
    if (typeof body.description !== "string" || body.description.length > 2000)
      return { error: "description must be a string up to 2000 characters." };
    out.description = body.description.trim();
  }
  if (has("priority")) {
    if (!PRIORITIES.includes(body.priority))
      return { error: `priority must be one of: ${PRIORITIES.join(", ")}.` };
    out.priority = body.priority;
  }
  if (has("dueDate")) {
    if (body.dueDate === null || body.dueDate === "") out.dueDate = null;
    else if (isRealDate(body.dueDate)) out.dueDate = body.dueDate;
    else return { error: "dueDate must be a valid YYYY-MM-DD date or null." };
  }
  if (has("category")) {
    const c = typeof body.category === "string" ? body.category.trim() : "";
    if (c.length < 1 || c.length > 50)
      return { error: "category must be 1-50 characters." };
    out.category = c;
  }
  if (has("done")) {
    if (typeof body.done !== "boolean")
      return { error: "done must be true or false." };
    out.done = body.done;
  }

  if (partial && Object.keys(out).length === 0)
    return { error: "Send at least one task field to update." };
  return { value: out };
}

function parseFilters(q) {
  const f = {};
  if (q.done !== undefined && q.done !== "") {
    if (q.done !== "true" && q.done !== "false")
      return { error: "done must be true or false." };
    f.done = q.done === "true";
  }
  if (q.priority !== undefined && q.priority !== "") {
    if (!PRIORITIES.includes(q.priority))
      return { error: `priority must be one of: ${PRIORITIES.join(", ")}.` };
    f.priority = q.priority;
  }
  if (typeof q.category === "string" && q.category) f.category = q.category;
  if (typeof q.search === "string" && q.search.trim()) f.search = q.search.trim();
  return { value: f };
}

/* ─── routes ───────────────────────────────────────────────────────────── */

app.get("/health", (_req, res) => res.json({ ok: true }));

app.get("/tasks", async (req, res, next) => {
  try {
    const { value, error } = parseFilters(req.query);
    if (error) return res.status(400).json({ error });
    res.json(await db.list(USER_ID, value));
  } catch (err) {
    next(err);
  }
});

app.post("/tasks", async (req, res, next) => {
  try {
    const { value, error } = validateTask(req.body, { partial: false });
    if (error) return res.status(400).json({ error });
    res.status(201).json(await db.create(USER_ID, value));
  } catch (err) {
    next(err);
  }
});

app.put("/tasks/:taskId", async (req, res, next) => {
  try {
    const { value, error } = validateTask(req.body, { partial: true });
    if (error) return res.status(400).json({ error });
    const task = await db.update(USER_ID, req.params.taskId, value);
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

app.get("/categories", async (_req, res, next) => {
  try {
    res.json(await db.categories(USER_ID));
  } catch (err) {
    next(err);
  }
});

// Optional ?today=YYYY-MM-DD lets a browser in another timezone define "today".
app.get("/stats", async (req, res, next) => {
  try {
    let today = todayUTC();
    if (req.query.today !== undefined) {
      if (!isRealDate(req.query.today))
        return res.status(400).json({ error: "today must be a valid YYYY-MM-DD date." });
      today = req.query.today;
    }
    const tasks = await db.list(USER_ID);
    const count = (fn) => tasks.filter(fn).length;
    res.json({
      total: tasks.length,
      done: count((t) => t.done),
      overdue: count((t) => !t.done && t.dueDate && t.dueDate < today),
      high: count((t) => t.priority === "high"),
      medium: count((t) => t.priority === "medium"),
      low: count((t) => t.priority === "low"),
    });
  } catch (err) {
    next(err);
  }
});

app.use((_req, res) => res.status(404).json({ error: "Not found." }));

// Log the real error (CloudWatch), return a generic message to the client.
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  if (err.type === "entity.parse.failed")
    return res.status(400).json({ error: "Invalid JSON." });
  if (err.type === "entity.too.large")
    return res.status(413).json({ error: "Request body too large." });
  console.error(err);
  res.status(500).json({ error: "Something went wrong." });
});

module.exports = app;
