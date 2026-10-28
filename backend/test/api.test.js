const test = require("node:test");
const assert = require("node:assert/strict");
const app = require("../app");

let server;
let base;

test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => server.close());

const call = (path, method = "GET", body) =>
  fetch(base + path, {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

const json = async (path, method, body) => {
  const res = await call(path, method, body);
  return { status: res.status, body: await res.json() };
};

async function clearAll() {
  const { body } = await json("/tasks");
  for (const t of body) await call(`/tasks/${t.taskId}`, "DELETE");
}

// Dates relative to today so tests never go stale.
const day = (offset) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
};

test.beforeEach(clearAll);

/* ─── CRUD ─────────────────────────────────────────────────────────────── */

test("full CRUD cycle with all fields", async () => {
  let r = await json("/tasks", "POST", {
    title: "  Learn IAM  ",
    description: "Read the policy evaluation docs",
    priority: "high",
    dueDate: "2030-01-31",
    category: "Study",
  });
  assert.equal(r.status, 201);
  const task = r.body;
  assert.equal(task.title, "Learn IAM");
  assert.equal(task.description, "Read the policy evaluation docs");
  assert.equal(task.priority, "high");
  assert.equal(task.dueDate, "2030-01-31");
  assert.equal(task.category, "Study");
  assert.equal(task.done, false);
  assert.equal(task.userId, "demo-user");
  assert.ok(task.taskId);
  assert.ok(!Number.isNaN(Date.parse(task.createdAt)));
  assert.ok(!Number.isNaN(Date.parse(task.updatedAt)));

  r = await json("/tasks");
  assert.equal(r.body.length, 1);
  assert.equal(r.body[0].taskId, task.taskId);

  r = await json(`/tasks/${task.taskId}`, "PUT", {
    title: "Learn IAM roles",
    description: "Updated",
    priority: "low",
    dueDate: null,
    category: "Work",
    done: true,
  });
  assert.equal(r.status, 200);
  assert.equal(r.body.title, "Learn IAM roles");
  assert.equal(r.body.description, "Updated");
  assert.equal(r.body.priority, "low");
  assert.equal(r.body.dueDate, null);
  assert.equal(r.body.category, "Work");
  assert.equal(r.body.done, true);
  assert.equal(r.body.createdAt, task.createdAt);
  assert.equal(r.body.taskId, task.taskId);

  // partial update leaves the other fields alone
  r = await json(`/tasks/${task.taskId}`, "PUT", { done: false });
  assert.equal(r.body.done, false);
  assert.equal(r.body.title, "Learn IAM roles");

  const del = await call(`/tasks/${task.taskId}`, "DELETE");
  assert.equal(del.status, 204);
  r = await json("/tasks");
  assert.equal(r.body.length, 0);
});

test("create applies defaults", async () => {
  const r = await json("/tasks", "POST", { title: "Just a title" });
  assert.equal(r.status, 201);
  assert.equal(r.body.description, "");
  assert.equal(r.body.priority, "medium");
  assert.equal(r.body.dueDate, null);
  assert.equal(r.body.category, "General");
  assert.equal(r.body.done, false);
});

test("update and delete of a missing task return 404", async () => {
  let r = await json("/tasks/nope", "PUT", { done: true });
  assert.equal(r.status, 404);
  r = await json("/tasks/nope", "DELETE");
  assert.equal(r.status, 404);
});

/* ─── filters ──────────────────────────────────────────────────────────── */

async function seed() {
  const defs = [
    { title: "Write report", priority: "high", category: "Work", description: "Quarterly numbers" },
    { title: "Buy milk", priority: "low", category: "Home" },
    { title: "Fix bug #12", priority: "high", category: "Work" },
    { title: "Plan trip", priority: "medium", category: "Home", description: "Book the REPORT card" },
  ];
  const out = [];
  for (const d of defs) out.push((await json("/tasks", "POST", d)).body);
  await json(`/tasks/${out[1].taskId}`, "PUT", { done: true });
  return out;
}

test("filter by priority", async () => {
  await seed();
  const r = await json("/tasks?priority=high");
  assert.equal(r.body.length, 2);
  assert.ok(r.body.every((t) => t.priority === "high"));
});

test("filter by done", async () => {
  await seed();
  let r = await json("/tasks?done=true");
  assert.deepEqual(r.body.map((t) => t.title), ["Buy milk"]);
  r = await json("/tasks?done=false");
  assert.equal(r.body.length, 3);
});

test("filter by category", async () => {
  await seed();
  const r = await json("/tasks?category=Home");
  assert.deepEqual(r.body.map((t) => t.title).sort(), ["Buy milk", "Plan trip"]);
});

test("search matches title and description, case-insensitively", async () => {
  await seed();
  let r = await json("/tasks?search=report");
  assert.deepEqual(r.body.map((t) => t.title).sort(), ["Plan trip", "Write report"]);
  r = await json("/tasks?search=BUG");
  assert.deepEqual(r.body.map((t) => t.title), ["Fix bug #12"]);
  r = await json("/tasks?search=zzz");
  assert.equal(r.body.length, 0);
});

test("filters combine", async () => {
  await seed();
  const r = await json("/tasks?priority=high&category=Work&done=false&search=bug");
  assert.deepEqual(r.body.map((t) => t.title), ["Fix bug #12"]);
});

/* ─── stats + categories ───────────────────────────────────────────────── */

test("/stats returns correct counts", async () => {
  const mk = (b) => json("/tasks", "POST", b);
  await mk({ title: "a", priority: "high", dueDate: day(-3) }); // overdue
  const b = (await mk({ title: "b", priority: "high", dueDate: day(-3) })).body; // done, so not overdue
  await mk({ title: "c", priority: "medium", dueDate: day(5) }); // future
  await mk({ title: "d", priority: "low" }); // no due date
  await mk({ title: "e", priority: "low", dueDate: day(0) }); // due today is not overdue
  await json(`/tasks/${b.taskId}`, "PUT", { done: true });

  const r = await json("/stats");
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { total: 5, done: 1, overdue: 1, high: 2, medium: 1, low: 2 });
});

test("/stats honours ?today= and rejects a bad one", async () => {
  await json("/tasks", "POST", { title: "a", dueDate: "2030-06-10" });
  let r = await json("/stats?today=2030-06-11");
  assert.equal(r.body.overdue, 1);
  r = await json("/stats?today=2030-06-10");
  assert.equal(r.body.overdue, 0);
  r = await json("/stats?today=garbage");
  assert.equal(r.status, 400);
});

test("/stats on an empty list is all zeros", async () => {
  const r = await json("/stats");
  assert.deepEqual(r.body, { total: 0, done: 0, overdue: 0, high: 0, medium: 0, low: 0 });
});

test("/categories returns a unique, sorted list", async () => {
  for (const category of ["Work", "Home", "Work", "Study", "Home"])
    await json("/tasks", "POST", { title: "t", category });
  const r = await json("/categories");
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, ["Home", "Study", "Work"]);
});

test("a category disappears once its last task is deleted", async () => {
  const t = (await json("/tasks", "POST", { title: "t", category: "Temp" })).body;
  await call(`/tasks/${t.taskId}`, "DELETE");
  assert.deepEqual((await json("/categories")).body, []);
});

/* ─── validation ───────────────────────────────────────────────────────── */

test("POST rejects bad inputs with 400", async () => {
  const bad = [
    {},
    { title: "" },
    { title: "   " },
    { title: 42 },
    { title: "x".repeat(201) },
    { title: "ok", priority: "urgent" },
    { title: "ok", dueDate: "31/12/2030" },
    { title: "ok", dueDate: "2030-02-30" },
    { title: "ok", dueDate: 20301231 },
    { title: "ok", category: "" },
    { title: "ok", category: "c".repeat(51) },
    { title: "ok", description: "d".repeat(2001) },
    { title: "ok", description: 5 },
    { title: "ok", done: "yes" },
  ];
  for (const body of bad) {
    const r = await json("/tasks", "POST", body);
    assert.equal(r.status, 400, `expected 400 for ${JSON.stringify(body).slice(0, 60)}`);
    assert.ok(r.body.error);
  }
  assert.equal((await json("/tasks")).body.length, 0);
});

test("PUT rejects bad inputs with 400", async () => {
  const t = (await json("/tasks", "POST", { title: "keep me" })).body;
  const bad = [
    {},
    { title: "" },
    { priority: "nope" },
    { dueDate: "tomorrow" },
    { category: "  " },
    { done: 1 },
  ];
  for (const body of bad) {
    const r = await json(`/tasks/${t.taskId}`, "PUT", body);
    assert.equal(r.status, 400, `expected 400 for ${JSON.stringify(body)}`);
  }
  assert.equal((await json("/tasks")).body[0].title, "keep me");
});

test("PUT cannot overwrite userId, taskId or createdAt", async () => {
  const t = (await json("/tasks", "POST", { title: "x" })).body;
  const r = await json(`/tasks/${t.taskId}`, "PUT", {
    title: "y",
    userId: "someone-else",
    taskId: "hijack",
    createdAt: "1999-01-01T00:00:00.000Z",
  });
  assert.equal(r.status, 200);
  assert.equal(r.body.userId, "demo-user");
  assert.equal(r.body.taskId, t.taskId);
  assert.equal(r.body.createdAt, t.createdAt);
});

test("invalid filter values are rejected", async () => {
  assert.equal((await call("/tasks?priority=urgent")).status, 400);
  assert.equal((await call("/tasks?done=maybe")).status, 400);
});

test("malformed JSON and unknown routes", async () => {
  const res = await fetch(base + "/tasks", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{not json",
  });
  assert.equal(res.status, 400);
  assert.equal((await call("/nope")).status, 404);
});
