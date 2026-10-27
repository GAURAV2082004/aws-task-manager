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
    body: body ? JSON.stringify(body) : undefined,
  });

test("create, list, update, delete a task", async () => {
  let res = await call("/tasks", "POST", { title: "  Learn IAM  " });
  assert.equal(res.status, 201);
  const task = await res.json();
  assert.equal(task.title, "Learn IAM");
  assert.equal(task.done, false);

  res = await call("/tasks");
  assert.equal((await res.json()).length, 1);

  res = await call(`/tasks/${task.taskId}`, "PUT", { done: true });
  assert.equal((await res.json()).done, true);

  res = await call(`/tasks/${task.taskId}`, "PUT", { title: "Learn IAM roles" });
  assert.equal((await res.json()).title, "Learn IAM roles");

  res = await call(`/tasks/${task.taskId}`, "DELETE");
  assert.equal(res.status, 204);

  res = await call("/tasks");
  assert.equal((await res.json()).length, 0);
});

test("rejects bad input", async () => {
  assert.equal((await call("/tasks", "POST", { title: "" })).status, 400);
  assert.equal((await call("/tasks", "POST", { title: "x".repeat(201) })).status, 400);
  assert.equal((await call("/tasks", "POST", { title: 42 })).status, 400);
});

test("unknown task returns 404", async () => {
  assert.equal((await call("/tasks/nope", "PUT", { done: true })).status, 404);
  assert.equal((await call("/tasks/nope", "DELETE")).status, 404);
});
