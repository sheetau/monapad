const fs = require("fs");

function createAppSettingsStore(StoreModule, userDataPath, legacyConfigPath) {
  // electron-store 8 exports its constructor directly. Its inherited .default
  // is Conf, which otherwise writes into a shared electron-store-nodejs folder.
  const Store = typeof StoreModule === "function" ? StoreModule : StoreModule.default;
  const store = new Store({ cwd: userDataPath });
  if (!store.get("appSettingsMigrated")) {
    let legacy = {};
    try { legacy = JSON.parse(fs.readFileSync(legacyConfigPath, "utf8")); }
    catch (error) { if (error.code !== "ENOENT") console.warn("Could not read legacy app settings:", error.message); }
    if (!legacy || typeof legacy !== "object" || Array.isArray(legacy)) legacy = {};
    const keys = ["windowBounds"];
    if (!store.has("sessionRestoreMode") && !store.has("sessionRestoreEnabled")) {
      keys.push("sessionRestoreMode", "sessionRestoreEnabled");
    }
    for (const key of keys) {
      if (!store.has(key) && Object.hasOwn(legacy, key)) store.set(key, legacy[key]);
    }
    store.set("appSettingsMigrated", true);
  }
  return store;
}

module.exports = { createAppSettingsStore };
