# Contributing Guidelines

_Pull requests, bug reports, and all other forms of contribution are welcomed and highly encouraged!_

- [Internationalization and Localization Guidelines](#internationalization-and-localization-guidelines)
- [How to Setup Custom Theme](#how-to-setup-custom-theme)
  - [Official Custom Themes (How to Submit)](#official-custom-themes-how-to-submit)
  - [Creating Your Own Theme](#creating-your-own-theme)

## Internationalization and Localization Guidelines

To maintain translation consistency, please reuse existing phrases found in **Win32 Notepad.exe**, **VS Code**, or **Notepad++** as much as possible.

Start by using the [English JSON file](https://github.com/sheetau/monapad/tree/main/src/locales/en-US.json) as a reference. Then, create a new JSON file named according to the appropriate language code (e.g., `zh-CN.json` or `fr-FR.json`), and place it in the [`src/locales`](https://github.com/sheetau/monapad/tree/main/src/locales) folder.

When submitting a pull request, prefix your PR title with `lang:`  
**Example:** `lang: Added zh-CN translation`

To manage translator progress and ensure proper credit, please post your pull request link in [GitHub Discussions](https://github.com/sheetau/monapad/discussions/1) using the provided template.

I will use this thread to notify contributors when new texts are added in updates (subscribe to notifications). Once reviewed and approved, your translation will be merged and included in the next release.

## How to Setup Custom Theme

Monapad supports custom themes that allow you to personalize the appearance of the app.

To use a custom theme, place a `.css` file inside the **themes folder**, usually located at: `
%APPDATA%\monapad\themes`  
You can also open the themes folder directly from the settings in the app.

Once the CSS file is added, it will appear in the theme selection menu with file name within Monapad.  
**Note:** You must reload the app (press `Ctrl + R`) for the new theme file to be recognized. After that, any changes to the theme file will be applied simply by saving the file

### Official Custom Themes (How to Submit)

Approved and community-submitted custom themes can be found in [README.md](https://github.com/sheetau/monapad/blob/main/README.md#custom-themes) or in the [official repository](https://github.com/sheetau/monapad/tree/main/customthemes).  
You can download and use any of these themes, or use them as a base to create your own.

If you create a decent quality theme, feel free to submit a pull request to the [repository](https://github.com/sheetau/monapad/tree/main/customthemes).  
Please create a folder contains following files for your theme inside the repository before submitting a pull request:

- `theme-name` (folder)
  - `theme-name.css`
  - `preview.png` (multiple images allowed)
  - `README.md` (include preview image and link to the CSS file)

Note: Theme filenames like `custom-theme_name.css` will be displayed in the menu as `Custom Theme Name`.

When submitting a pull request, prefix your PR title with `theme:`  
**Example:** `theme: Made Light theme`  
If approved, all users will be able to download and use it from the repository.

### Creating Your Own Theme

You can either edit the official custom themes, or open the developer tools with `Shift + Ctrl + I` and inspect elements as you create your own theme.

Changing color can be done simply by redefining the default variables.  
Below are all the default variables available for customization (redefine and use them within the `:root` selector).  
You can also refer to [this official theme](https://github.com/sheetau/monapad/tree/main/customthemes/ayu/Ayu.css) to see more in-depth how it's done.

#### Monapad Theme Customization Variables

##### Default Theme Color Variables

These are only used in CSS, so if you want more precise control, you can directly set colors on the elements themselves.

| Variable         | Description                                                             |
| ---------------- | ----------------------------------------------------------------------- |
| `--color1`       | Background of toolbar, editor and modal (`!important` required)         |
| `--color2`       | Background of statusbar, menu, and messages (`!important` required)     |
| `--color3`       | Background of hovered buttons and modal buttons (`!important` required) |
| `--editorText`   | Primary text color                                                      |
| `--grayOut`      | Grayed out text and element colors                                      |
| `--highlight`    | Accent color                                                            |
| `--btnHighlight` | Background of highlighted buttons                                       |
| `--windowClose`  | Window Close button color                                               |
| `--warn`         | Text color for deleted files                                            |

##### Editor Font Override

You can also override the font used in the editor by setting the `--editor-font` variable.

If this variable is defined, it will take precedence over the in-app font settings.  
You can specify one or more fonts in order of priority. Fonts imported via `@import` are also supported.  
Make sure to always include a fallback font to ensure compatibility across environments.

Example:

```css
--editor-font: "Yu Gothic UI", "Meiryo", "Hiragino Sans", sans-serif;
```

##### Monapad Syntax Highlighting

Use hex colors (6 digits), or variables that contain them.

| Variable           | Description                         |
| ------------------ | ----------------------------------- |
| `--heading1`       | Color for `# heading 1`             |
| `--heading2`       | Color for `## heading 2`            |
| `--heading3`       | Color for `### heading 3`           |
| `--bulletPoint`    | Color for `- bullet points`         |
| `--numberList`     | Color for `- numbered lists`        |
| `--subText`        | Color for `-# subtext`              |
| `--blockQuote`     | Color for `> blockquotes`           |
| `--inlineCode`     | Color for `` `inline code` ``       |
| `--codeBlockFence` | Color for code block fences (```)   |
| `--codeBlock`      | Color for the actual code in blocks |

You can specify font styles by adding a `Style` to each variable name.  
Supported styles are `bold`, `italic`, and `underline`. Use spaces to combine multiple styles.

Example:

```css
--heading1: var(--highlight);
--heading1Style: bold italic underline;
```

Also, the `.marker-transparent` class is used to adjust the opacity of some syntax markers.

#### Monaco Editor Theme Color Variables

Use hex colors (6 or 8 digits), or variables that contain them.  
Inspect the elements to find variables starting with `--vscode-` or Refer to the VS Code theme color tokens in this document:  
https://code.visualstudio.com/api/references/theme-color#lists-and-trees

For example, use `--vscode-editor-background` to theme the `editor.background` token, like:

```css
--vscode-editor-background: #0b0e14;
--vscode-editor-foreground: #bfbdb6;
```

#### Markdown Syntax Highlighting

Use hex colors (6 digits), or variables that contain them.  
These specify the syntax highlight colors used when Markdown mode is enabled.  
Refer to:  
https://github.com/trofimander/monaco-markdown/blob/master/src/ts/markdown.ts

For example, use `--md-string-link` to theme the `string.link` token, like:

```css
--md-keyword: #aad94c;
--md-string-link: #39bae6;
```
