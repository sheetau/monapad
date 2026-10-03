import monacoPackage from "monaco-editor/package.json";

// Monaco 0.55's advanced wrapper measures every model line in the DOM on each
// width change. Its public API cannot defer offscreen wrapping. Keep this small
// per-view adapter version-gated: other versions retain Monaco's normal path.
// Text models, edit events, selections, undo stacks and folding are untouched.
export function installViewportWrapping(editor) {
  if (!monacoPackage.version.startsWith("0.55.")) return { dispose() {} };
  let attached = null, pending = null, timer = null, frame = null, replay = null;
  let invalidated = false, refreshing = false, disposed = false;
  let contentSubscription = null;

  function cancel() {
    clearTimeout(timer); timer = null;
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null; pending = null; invalidated = false;
  }
  function visible() {
    return editor.getVisibleRanges().map(range => ({
      start: Math.max(1, range.startLineNumber - 8), end: range.endLineNumber + 8,
    }));
  }
  function isVisible(ranges, line) {
    return ranges.some(range => line >= range.start && line <= range.end);
  }
  function computer(job) {
    return job.factory.createLineBreaksComputer(...job.args);
  }
  function measure(job, indices) {
    if (!indices.length) return;
    const batch = computer(job);
    for (const index of indices) {
      const entry = job.entries[index];
      batch.addRequest(entry.text, entry.injected, null);
    }
    const results = batch.finalize();
    indices.forEach((index, i) => {
      job.entries[index].data = results[i];
      job.entries[index].exact = true;
    });
  }
  function valid(job) {
    return !disposed && pending === job && attached?.vm === editor._getViewModel() &&
      attached.lines.model.getVersionId() === job.version;
  }
  function refresh(job) {
    if (!attached || refreshing) return;
    const { vm, lines } = attached;
    refreshing = true;
    replay = job;
    // Reuse Monaco's own wrapping-change notification and stable viewport
    // recovery, including cursor mapping, decorations, view zones and minimap.
    const column = lines.wrappingColumn;
    lines.wrappingColumn = -2;
    try {
      const events = vm._eventDispatcher.beginEmitViewEvents();
      vm._onConfigurationChanged(events, { hasChanged: () => false });
    } finally {
      if (lines.wrappingColumn === -2) lines.wrappingColumn = column;
      vm._eventDispatcher.endEmitViewEvents();
      replay = null; refreshing = false;
    }
  }
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(work, 120);
  }
  function work() {
    timer = null;
    if (invalidated) {
      // Edits/injected text can change line identities while a job is pending.
      // Discard those measurements and rebuild from the current model instead.
      invalidated = false;
      refresh(null);
      return;
    }
    const job = pending;
    if (!job || !valid(job)) return;
    // Bound each DOM batch by both line count and character count. A single
    // exceptionally long model line remains Monaco's indivisible work unit.
    const indices = [];
    let characters = 0;
    while (job.next < job.entries.length && indices.length < job.batchSize && characters < 16000) {
      const index = job.next++;
      if (job.entries[index].exact) continue;
      indices.push(index); characters += job.entries[index].text.length;
    }
    const start = performance.now();
    measure(job, indices);
    const elapsed = performance.now() - start;
    if (elapsed > 8) job.batchSize = Math.max(1, Math.floor(job.batchSize / 2));
    else if (elapsed < 4) job.batchSize = Math.min(128, job.batchSize + 8);
    if (job.next < job.entries.length) timer = setTimeout(work, 0);
    else {
      refresh(job);
      if (pending === job) pending = null;
    }
  }
  function attach() {
    cancel();
    contentSubscription?.dispose(); contentSubscription = null;
    if (attached) attached.lines.setWrappingSettings = attached.original;
    attached = null;
    const vm = editor._getViewModel?.(), lines = vm?._lines;
    if (!lines?._domLineBreaksComputerFactory || !lines.modelLineProjections ||
        !vm._onConfigurationChanged || !vm._eventDispatcher || !lines.setWrappingSettings ||
        !lines.model.onDidChangeContentOrInjectedText) return;
    const original = lines.setWrappingSettings;
    attached = { vm, lines, original };
    contentSubscription = lines.model.onDidChangeContentOrInjectedText(invalidate);
    lines.setWrappingSettings = function (font, strategy, column, indent, wordBreak) {
      const sameSettings = this.fontInfo.equals(font) && this.wrappingStrategy === strategy &&
        this.wrappingIndent === indent && this.wordBreak === wordBreak;
      if (sameSettings && this.wrappingColumn === column) return false;
      const reuse = replay;
      const defer = sameSettings && strategy === "advanced" &&
        (this.wrappingColumn > 0 || refreshing) && column > 0 && this.model.getValueLength() >= 100000;
      if (!reuse && !defer) {
        cancel();
        return original.apply(this, arguments);
      }
      const ranges = visible();
      const job = reuse || { entries: [], next: 0, batchSize: 64,
        version: this.model.getVersionId(), factory: this._domLineBreaksComputerFactory };
      if (!reuse) { cancel(); pending = job; }
      const create = this.createLineBreaksComputer;
      this.createLineBreaksComputer = function () {
        job.args = [this.fontInfo, this.tabSize, this.wrappingColumn, this.wrappingIndent, this.wordBreak, this.wrapOnEscapedLineFeeds];
        let index = 0;
        const eager = [];
        return {
          addRequest(text, injected, previous) {
            if (!reuse) job.entries.push({ text, injected, data: previous, applied: previous, exact: false });
            if (!job.entries[index].exact && isVisible(ranges, index + 1)) eager.push(index);
            index++;
          },
          finalize() {
            measure(job, eager);
            return job.entries.map(entry => (entry.applied = entry.data));
          },
        };
      };
      try { return original.apply(this, arguments); }
      finally {
        this.createLineBreaksComputer = create;
        if (!reuse) schedule();
      }
    };
  }
  function invalidate() {
    if (!pending && !invalidated) return;
    cancel(); invalidated = true; schedule();
  }
  function viewportChanged() {
    if ((!pending && !invalidated) || refreshing || frame !== null) return;
    frame = requestAnimationFrame(() => {
      frame = null;
      if (invalidated) {
        refresh(null);
        return;
      }
      const job = pending;
      if (!job || !valid(job)) return;
      const needsRefresh = visible().some(range => {
        for (let i = range.start - 1; i < Math.min(range.end, job.entries.length); i++) {
          const entry = job.entries[i];
          if (!entry.exact || entry.data !== entry.applied) return true;
        }
        return false;
      });
      if (needsRefresh) refresh(job);
    });
  }
  const subscriptions = [
    editor.onDidChangeModel(attach),
    editor.onDidChangeModelOptions(invalidate),
    editor.onDidScrollChange(viewportChanged),
    editor.onDidLayoutChange(viewportChanged),
    editor.onDidChangeHiddenAreas(viewportChanged),
    editor.onDidDispose(() => dispose()),
  ];
  function dispose() {
    if (disposed) return;
    disposed = true; cancel();
    contentSubscription?.dispose(); contentSubscription = null;
    if (attached) attached.lines.setWrappingSettings = attached.original;
    attached = null;
    subscriptions.forEach(subscription => subscription.dispose());
  }
  attach();
  return { dispose };
}
