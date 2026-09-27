const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");

async function hashFile(filePath) {
  const hash = crypto.createHash("sha512");
  for await (const chunk of fs.createReadStream(filePath)) hash.update(chunk);
  return hash.digest("base64");
}

class PendingUpdate {
  constructor(root, { spawnProcess = spawn } = {}) {
    this.root = root;
    this.manifestPath = path.join(root, "pending.json");
    this.spawnProcess = spawnProcess;
  }

  async stage(info, currentVersion) {
    if (!info?.downloadedFile || !info.version) throw new Error("Missing downloaded update information.");
    const sha512 = await hashFile(info.downloadedFile);
    const expected = info.files?.find((file) => file.sha512 === sha512);
    if (!expected && info.sha512 !== sha512) throw new Error("Downloaded update checksum mismatch.");
    await fs.promises.mkdir(this.root, { recursive: true });
    // Content-addressed copies survive updater cache cleanup and interrupted staging.
    const fileName = `${crypto.createHash("sha256").update(sha512).digest("hex")}.exe`;
    const installer = path.join(this.root, fileName);
    await fs.promises.copyFile(info.downloadedFile, `${installer}.tmp`);
    if (await hashFile(`${installer}.tmp`) !== sha512) throw new Error("Staged update checksum mismatch.");
    await fs.promises.rename(`${installer}.tmp`, installer);
    let cached = {};
    try {
      cached = JSON.parse(await fs.promises.readFile(path.join(path.dirname(info.downloadedFile), "update-info.json"), "utf8"));
    } catch { /* Elevation can also be requested after an access error. */ }
    const record = {
      fileName, sha512, version: info.version, fromVersion: currentVersion,
      isAdminRightsRequired: expected?.isAdminRightsRequired === true || cached.isAdminRightsRequired === true,
    };
    await fs.promises.writeFile(`${this.manifestPath}.tmp`, JSON.stringify(record), "utf8");
    await fs.promises.rename(`${this.manifestPath}.tmp`, this.manifestPath);
    return record;
  }

  async launch(currentVersion, resourcesPath) {
    let record;
    try {
      record = JSON.parse(await fs.promises.readFile(this.manifestPath, "utf8"));
    } catch (error) {
      if (error.code === "ENOENT") return false;
      throw error;
    }
    // A manual upgrade must never be replaced with a previously scheduled release.
    if (record.version === currentVersion || record.fromVersion !== currentVersion) {
      await fs.promises.unlink(this.manifestPath);
      if (/^[a-f0-9]{64}\.exe$/.test(record.fileName)) {
        await fs.promises.unlink(path.join(this.root, record.fileName)).catch(() => {});
      }
      return false;
    }
    if (!/^[a-f0-9]{64}\.exe$/.test(record.fileName)) throw new Error("Invalid pending update filename.");
    const installer = path.join(this.root, record.fileName);
    if (await hashFile(installer) !== record.sha512) throw new Error("Pending update checksum mismatch.");
    const args = ["--updated", "/S", "--force-run"];
    const elevated = () => this.start(path.join(resourcesPath, "elevate.exe"), [installer, ...args]);
    if (record.isAdminRightsRequired) await elevated();
    else {
      try { await this.start(installer, args); }
      catch (error) {
        if (!["EACCES", "EPERM", "UNKNOWN"].includes(error.code)) throw error;
        await elevated();
      }
    }
    // Keep the manifest until the updated version starts; cancelled UAC remains retryable.
    return true;
  }

  start(executable, args) {
    return new Promise((resolve, reject) => {
      const child = this.spawnProcess(executable, args, { detached: true, stdio: "ignore", windowsHide: true });
      child.once("error", reject);
      child.once("spawn", () => { child.unref(); resolve(); });
    });
  }
}

module.exports = { PendingUpdate, hashFile };
