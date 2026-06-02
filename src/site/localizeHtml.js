function replaceAll(value, search, replacement) {
  return value.split(search).join(replacement);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceText(value, search, replacement) {
  const pattern = escapeRegExp(search).replace(/\s+/g, "\\s+");
  return value.replace(new RegExp(pattern, "g"), replacement);
}

function createLanguageSwitcher(locale, assetBase) {
  const label = locale.code === "ja" ? "言語" : "Language";
  const currentLabel = locale.code === "ja" ? "日本語" : "English";
  const enSelected = locale.code === "en" ? "true" : "false";
  const jaSelected = locale.code === "ja" ? "true" : "false";

  return `<div class="language-switcher" data-language-switcher>
            <button class="language-switcher-button" type="button" aria-label="${label}" aria-expanded="false" data-language-switcher-button>
              <span data-language-switcher-current>${currentLabel}</span>
              <svg viewBox="0 0 8 13" fill="none" aria-hidden="true">
                <path d="M1 12L7 6.5L1 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
            <div class="language-switcher-menu" role="menu" data-language-switcher-menu>
              <button class="language-switcher-option" type="button" role="menuitemradio" aria-checked="${enSelected}" data-language-value="${assetBase}/" data-language-code="en">
                <span>English</span>
                <span class="language-switcher-check" aria-hidden="true">✓</span>
              </button>
              <button class="language-switcher-option" type="button" role="menuitemradio" aria-checked="${jaSelected}" data-language-value="${assetBase}/ja/" data-language-code="ja">
                <span>日本語</span>
                <span class="language-switcher-check" aria-hidden="true">✓</span>
              </button>
            </div>
          </div>`;
}

export function localizeHtml(template, locale) {
  const assetBase = process.env.NEXT_PUBLIC_BASE_PATH ?? "/monapad";
  let html = template
    .replaceAll('src="media/', `src="${assetBase}/media/`)
    .replaceAll('href="media/', `href="${assetBase}/media/`);

  const replacements = [...locale.replacements].sort(([a], [b]) => b.length - a.length);

  for (const [source, translation] of replacements) {
    html = replaceText(html, source, translation);
  }

  return html.replace(
    "</div>\n      </div>\n    </footer>",
    `${createLanguageSwitcher(locale, assetBase)}\n        </div>\n      </div>\n    </footer>`,
  );
}
