import { SingleModelEditStackElement } from "monaco-editor/esm/vs/editor/common/model/editStack.js";

// Monaco 0.55 has no public history serialization API. Keep the version-dependent
// adapter here and fail the transfer if its shape changes, rather than lose Undo.
function historyService(model) {
  const service = model?._undoRedoService;
  if (!service?.getElements || !service?._editStacks || !service?.getUriComparisonKey) {
    throw new Error("This Monaco version cannot transfer editing history.");
  }
  return service;
}

export function captureEditorHistory(model) {
  const { past, future } = historyService(model).getElements(model.uri);
  const encode = (element) => {
    if (!(element instanceof SingleModelEditStackElement)) {
      throw new Error("This editing operation cannot be moved to another window.");
    }
    element.close();
    return { label: element.label, code: element.code, data: new Uint8Array(element._data) };
  };
  return {
    format: 1, past: past.map(encode), future: future.map(encode),
    version: model.getVersionId(), alternativeVersion: model.getAlternativeVersionId(), eol: model.getEOL(),
  };
}

export function restoreEditorHistory(model, history) {
  if (!history) return;
  if (history.format !== 1) throw new Error("Unsupported editing history format.");
  const service = historyService(model);
  const decode = (record) => {
    const element = new SingleModelEditStackElement(record.label, record.code, model, null);
    element._data = new Uint8Array(record.data).buffer;
    return element;
  };
  const past = history.past.map(decode);
  const future = history.future.map(decode);
  model.setEOL(history.eol === "\r\n" ? 1 : 0);
  service.removeElements(model.uri);
  // pushElement creates Monaco's resource wrappers; split them without replaying
  // edits (which would trigger autosave and overwrite the received document).
  for (const element of [...past, ...future.slice().reverse()]) service.pushElement(element);
  const stack = service._editStacks.get(service.getUriComparisonKey(model.uri));
  if (stack) {
    stack._future = stack._past.splice(past.length).reverse();
    stack.versionId++;
  }
  model._overwriteVersionId(history.version);
  model._overwriteAlternativeVersionId(history.alternativeVersion);
}
