function replaceAll(value, search, replacement) {
  return value.split(search).join(replacement);
}

function createLanguageSwitcher(locale, assetBase) {
  const label = locale.code === "ja" ? "言語" : "Language";
  const enSelected = locale.code === "en" ? " selected" : "";
  const jaSelected = locale.code === "ja" ? " selected" : "";

  return `<label class="language-switcher" aria-label="${label}">
            <select data-language-switcher>
              <option value="${assetBase}/"${enSelected}>English</option>
              <option value="${assetBase}/ja/"${jaSelected}>日本語</option>
            </select>
          </label>`;
}

export function localizeHtml(template, locale) {
  const assetBase = process.env.NEXT_PUBLIC_BASE_PATH ?? "/monapad";
  let html = template
    .replaceAll('src="media/', `src="${assetBase}/media/`)
    .replaceAll('href="media/', `href="${assetBase}/media/`);

  const replacements = [...locale.replacements].sort(([a], [b]) => b.length - a.length);

  for (const [source, translation] of replacements) {
    html = replaceAll(html, source, translation);
  }

  return html.replace("</div>\n      </div>\n    </footer>", `${createLanguageSwitcher(locale, assetBase)}\n        </div>\n      </div>\n    </footer>`);
}
