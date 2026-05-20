# Internationalization and Localization Guidelines

To maintain translation consistency, please reuse existing phrases found in **Win32 Notepad.exe**, **VS Code**, or **Notepad++** as much as possible.

Start by using the [English JSON file](https://github.com/sheetau/monapad/tree/main/locales/en-US.json) as a reference. Then, create a new JSON file named according to the appropriate language code (e.g., `zh-CH.json` or `fr-FR.json`), and place it in the [`locales`](https://github.com/sheetau/monapad/tree/main/locales) folder.

When submitting a pull request, prefix your PR title with `lang:`  
**Example:** `lang: Added zh-CH translation`

To manage translator progress and ensure proper credit, please post your pull request link in [GitHub Discussions](https://github.com/sheetau/monapad/discussions/1) using the provided template.

I will use this thread to notify contributors when new texts are added in updates (subscribe to notifications). Once reviewed and approved, your translation will be merged and included in the next release.
