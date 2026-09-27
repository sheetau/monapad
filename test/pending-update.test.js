const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { EventEmitter } = require("node:events");
const test = require("node:test");
const { PendingUpdate, hashFile } = require("../src/pending-update");

async function fixture(run) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "monapad-update-test-"));
  const calls = [];
  const pending = new PendingUpdate(path.join(root, "pending"), {
    spawnProcess(executable, args, options) {
      calls.push({ executable, args, options });
      const child = new EventEmitter();
      child.unref = () => {};
      queueMicrotask(() => child.emit("spawn"));
      return child;
    },
  });
  const downloadedFile = path.join(root, "download.exe");
  await fs.writeFile(downloadedFile, "fake installer, never executed");
  const info = { downloadedFile, version: "2.0.0", files: [{ sha512: await hashFile(downloadedFile) }] };
  try { await run({ root, pending, info, calls }); }
  finally { await fs.rm(root, { recursive: true, force: true }); }
}

test("staging never installs, next launch verifies and starts a silent offline install", async () => {
  await fixture(async ({ pending, info, calls }) => {
    await pending.stage(info, "1.0.0");
    assert.equal(calls.length, 0);
    await fs.unlink(info.downloadedFile);
    assert.equal(await pending.launch("1.0.0", "resources"), true);
    assert.deepEqual(calls[0].args, ["--updated", "/S", "--force-run"]);
    assert.equal(calls[0].options.windowsHide, true);
    assert.equal(await pending.launch("2.0.0", "resources"), false);
    assert.equal(await pending.launch("2.0.0", "resources"), false);
    assert.equal(calls.length, 1);
  });
});

test("tampered download and tampered pending installer are never run", async () => {
  await fixture(async ({ pending, info, calls }) => {
    await assert.rejects(pending.stage({ ...info, files: [{ sha512: "wrong" }] }, "1.0.0"), /checksum/);
    const record = await pending.stage(info, "1.0.0");
    await fs.writeFile(path.join(pending.root, record.fileName), "changed");
    await assert.rejects(pending.launch("1.0.0", "resources"), /checksum/);
    assert.equal(calls.length, 0);
  });
});

test("manual upgrades supersede queued updates and elevation uses the bundled helper", async () => {
  await fixture(async ({ pending, info, calls }) => {
    await pending.stage(info, "1.0.0");
    assert.equal(await pending.launch("3.0.0", "resources"), false);
    assert.equal(calls.length, 0);
    info.files[0].isAdminRightsRequired = true;
    await pending.stage(info, "1.0.0");
    assert.equal(await pending.launch("1.0.0", "resources"), true);
    assert.equal(calls[0].executable, path.join("resources", "elevate.exe"));
  });
});
