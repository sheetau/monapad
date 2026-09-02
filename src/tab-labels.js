function shortenPaths(paths, defaultPathSeparator = "\\") {
  const shortenedPaths = new Array(paths.length);
  let match = false;

  for (let pathIndex = 0; pathIndex < paths.length; pathIndex++) {
    let pathSeparator = defaultPathSeparator;
    const originalPath = paths[pathIndex];

    if (originalPath === "") {
      shortenedPaths[pathIndex] = `.${pathSeparator}`;
      continue;
    }
    if (!originalPath) {
      shortenedPaths[pathIndex] = originalPath;
      continue;
    }

    match = true;
    let prefix = "";
    let trimmedPath = originalPath;
    if (/^[^:/\\?#]+?:\/\//.test(trimmedPath)) {
      prefix = trimmedPath.slice(0, trimmedPath.indexOf("//") + 2);
      trimmedPath = trimmedPath.slice(trimmedPath.indexOf("//") + 2);
      pathSeparator = "/";
    } else if (trimmedPath.startsWith("\\\\")) {
      prefix = "\\\\";
      trimmedPath = trimmedPath.slice(2);
    } else if (trimmedPath.startsWith(pathSeparator)) {
      prefix = pathSeparator;
      trimmedPath = trimmedPath.slice(pathSeparator.length);
    } else if (trimmedPath.startsWith("~")) {
      prefix = "~";
      trimmedPath = trimmedPath.slice(1);
    }

    const segments = trimmedPath.split(pathSeparator);
    for (let subpathLength = 1; match && subpathLength <= segments.length; subpathLength++) {
      for (let start = segments.length - subpathLength; match && start >= 0; start--) {
        match = false;
        let subpath = segments.slice(start, start + subpathLength).join(pathSeparator);

        for (let otherPathIndex = 0; !match && otherPathIndex < paths.length; otherPathIndex++) {
          const otherPath = paths[otherPathIndex];
          if (otherPathIndex === pathIndex || !otherPath || !otherPath.includes(subpath)) continue;

          const isSubpathEnding = start + subpathLength === segments.length;
          const subpathWithSeparator = start > 0 && otherPath.includes(pathSeparator) ? pathSeparator + subpath : subpath;
          match = !isSubpathEnding || otherPath.endsWith(subpathWithSeparator);
        }

        if (!match) {
          let result = "";
          if (segments[0].endsWith(":") || prefix) {
            if (start === 1) {
              start = 0;
              subpathLength++;
              subpath = segments[0] + pathSeparator + subpath;
            }
            if (start > 0) result = segments[0] + pathSeparator;
            result = prefix + result;
          }
          if (start > 0) result += `…${pathSeparator}`;
          result += subpath;
          if (start + subpathLength < segments.length) {
            result +=
              start + subpathLength === segments.length - 1 && segments[segments.length - 1] === ""
                ? pathSeparator
                : `${pathSeparator}…`;
          }
          shortenedPaths[pathIndex] = result;
        }
      }
    }

    if (match) shortenedPaths[pathIndex] = originalPath;
  }

  return shortenedPaths;
}

function computeTabPathDescriptions(labels, separator = "\\", alwaysShow = false) {
  const groups = new Map();
  const result = new Map();

  for (const label of labels) {
    if (!label?.tab || typeof label.description !== "string") continue;
    const key = `${label.kind || "file"}\0${label.name || ""}`;
    const group = groups.get(key) || [];
    group.push(label);
    groups.set(key, group);
  }

  for (const group of groups.values()) {
    if (!alwaysShow && group.length < 2) continue;
    const descriptions = [...new Set(group.map((label) => label.description))];
    if (!alwaysShow && descriptions.length < 2) continue;

    const displayDescriptions = group[0].kind === "file" ? shortenPaths(descriptions, separator) : descriptions;
    for (let index = 0; index < descriptions.length; index++) {
      if (!descriptions[index]) continue;
      for (const label of group) {
        if (label.description === descriptions[index]) result.set(label.tab, displayDescriptions[index]);
      }
    }
  }

  return result;
}

module.exports = { computeTabPathDescriptions, shortenPaths };
