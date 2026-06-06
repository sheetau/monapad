let formattingActionDisposables = [];
let quickInputActionDisposables = [];

function disposeMonacoActions(disposables) {
  disposables.forEach((disposable) => disposable?.dispose?.());
  disposables.length = 0;
}

function createToggleHeadingAction({ monaco, t }, level) {
  const id = `toggle-h${level}`;
  const label = t("monaco.actions.toggleHeading", { level });
  const keyCode = monaco.KeyCode.Digit1 + (level - 1);
  const prefix = "#".repeat(level) + " ";

  return {
    id,
    label,
    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | keyCode],
    precondition: null,
    keybindingContext: null,
    run: function (ed) {
      const model = ed.getModel();
      const selections = ed.getSelections();

      ed.pushUndoStop();
      ed.executeEdits(
        id,
        selections
          .map((selection) => {
            const startLine = selection.startLineNumber;
            const endLine = selection.endLineNumber;
            const edits = [];

            for (let line = startLine; line <= endLine; line++) {
              const lineContent = model.getLineContent(line);
              const trimmed = lineContent.trimStart();
              const leadingSpaces = lineContent.slice(0, lineContent.length - trimmed.length);

              const isCurrentHeading = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(trimmed);

              let newText;
              if (isCurrentHeading) {
                newText = trimmed.replace(new RegExp(`^${prefix}`), "");
              } else {
                newText = trimmed.replace(/^#{1,6}\s*/, "");
                newText = prefix + newText;
              }

              edits.push({
                range: new monaco.Range(line, 1, line, lineContent.length + 1),
                text: leadingSpaces + newText,
              });
            }

            return edits;
          })
          .flat(),
      );
      ed.pushUndoStop();
    },
  };
}

export function registerMonacoFormattingActions({
  monaco,
  monacoEditor,
  t,
  getCurrentTab,
  keepOpenNoteTab,
  toggleTabPinned,
  toggleWordWrap,
}) {
  if (!monacoEditor) return;
  disposeMonacoActions(formattingActionDisposables);

  formattingActionDisposables.push(
    monacoEditor.addAction({
      id: "toggle-subtext",
      label: t("monaco.actions.toggleSubtext"),
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Slash],
      precondition: null,
      keybindingContext: null,
      run: function (ed) {
        const model = ed.getModel();
        const selections = ed.getSelections();

        ed.pushUndoStop();
        ed.executeEdits(
          "toggle-subtext",
          selections
            .map((selection) => {
              const startLine = selection.startLineNumber;
              const endLine = selection.endLineNumber;
              const edits = [];

              for (let line = startLine; line <= endLine; line++) {
                const lineContent = model.getLineContent(line);
                if (/^\s*-# /.test(lineContent)) {
                  const newText = lineContent.replace(/^(\s*)-# /, "$1");
                  edits.push({
                    range: new monaco.Range(line, 1, line, lineContent.length + 1),
                    text: newText,
                  });
                } else {
                  edits.push({
                    range: new monaco.Range(line, 1, line, lineContent.length + 1),
                    text: `-# ${lineContent}`,
                  });
                }
              }

              return edits;
            })
            .flat(),
        );
        ed.pushUndoStop();
      },
    }),
  );

  formattingActionDisposables.push(
    monacoEditor.addAction({
      id: "monapad.keepOpenNotePreview",
      label: t("monaco.actions.keepOpen"),
      keybindings: [monaco.KeyMod.chord(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, monaco.KeyCode.Enter)],
      precondition: null,
      keybindingContext: null,
      run: function () {
        keepOpenNoteTab(getCurrentTab());
      },
    }),
  );

  formattingActionDisposables.push(
    monacoEditor.addAction({
      id: "monapad.toggleTabPin",
      label: t("monaco.actions.toggleTabPin"),
      keybindings: [
        monaco.KeyMod.chord(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, monaco.KeyMod.Shift | monaco.KeyCode.Enter),
      ],
      precondition: null,
      keybindingContext: null,
      run: function () {
        toggleTabPinned(getCurrentTab());
      },
    }),
  );

  formattingActionDisposables.push(
    monacoEditor.addAction({
      id: "monapad.scrollLineUp",
      label: t("monaco.actions.scrollLineUp"),
      precondition: null,
      keybindingContext: null,
      run: function (ed) {
        ed.trigger("keyboard", "scrollLineUp", { source: "keyboard" });
      },
    }),
  );

  formattingActionDisposables.push(
    monacoEditor.addAction({
      id: "monapad.scrollLineDown",
      label: t("monaco.actions.scrollLineDown"),
      precondition: null,
      keybindingContext: null,
      run: function (ed) {
        ed.trigger("keyboard", "scrollLineDown", { source: "keyboard" });
      },
    }),
  );

  formattingActionDisposables.push(
    monacoEditor.addAction({
      id: "monapad.toggleWordWrap",
      label: t("monaco.actions.toggleWordWrap"),
      keybindings: [monaco.KeyMod.Alt | monaco.KeyCode.KeyZ],
      precondition: null,
      keybindingContext: null,
      run: function () {
        toggleWordWrap();
      },
    }),
  );

  [1, 2, 3].forEach((level) => {
    formattingActionDisposables.push(monacoEditor.addAction(createToggleHeadingAction({ monaco, t }, level)));
  });
}

export function registerMonacoQuickInputActions({ monaco, monacoEditor, t, openQuickOpenPicker, triggerShowCommands }) {
  if (!monacoEditor) return;
  disposeMonacoActions(quickInputActionDisposables);

  quickInputActionDisposables.push(
    monacoEditor.addAction({
      id: "monapad.quickOpen",
      label: t("monaco.actions.quickOpen"),
      alias: "Quick Open",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyP],
      run: () => {
        openQuickOpenPicker();
      },
    }),
  );

  quickInputActionDisposables.push(
    monacoEditor.addAction({
      id: "monapad.showCommands",
      label: t("monaco.actions.showCommands"),
      alias: "Command List",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyP],
      run: () => {
        triggerShowCommands();
      },
    }),
  );
}
