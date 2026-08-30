const NO_FUZZY_SCORE = [0, []];

function isUpper(code) {
  return code >= 65 && code <= 90;
}

function separatorScore(code) {
  switch (code) {
    case 32:
    case 39:
    case 45:
    case 46:
    case 47:
    case 92:
    case 95:
      return 5;
    default:
      return 0;
  }
}

function scoreFuzzy(target, query, allowNonContiguousMatches = true) {
  if (!target || !query || target.length < query.length) return NO_FUZZY_SCORE;

  const targetLower = target.toLowerCase();
  const queryLower = query.toLowerCase();
  const targetLength = target.length;
  const queryLength = query.length;
  const scores = [];
  const sequences = [];

  for (let queryIndex = 0; queryIndex < queryLength; queryIndex++) {
    const queryOffset = queryIndex * targetLength;
    const previousQueryOffset = queryOffset - targetLength;
    const hasPreviousQuery = queryIndex > 0;
    const queryChar = query[queryIndex];
    const queryLowerChar = queryLower[queryIndex];

    for (let targetIndex = 0; targetIndex < targetLength; targetIndex++) {
      const hasPreviousTarget = targetIndex > 0;
      const currentIndex = queryOffset + targetIndex;
      const leftIndex = currentIndex - 1;
      const diagIndex = previousQueryOffset + targetIndex - 1;
      const leftScore = hasPreviousTarget ? scores[leftIndex] : 0;
      const diagScore = hasPreviousQuery && hasPreviousTarget ? scores[diagIndex] : 0;
      const sequenceLength = hasPreviousQuery && hasPreviousTarget ? sequences[diagIndex] : 0;

      let charScore = 0;
      if (!hasPreviousQuery || diagScore) {
        charScore = computeFuzzyCharScore(queryChar, queryLowerChar, target, targetLower, targetIndex, sequenceLength);
      }

      const validScore =
        charScore &&
        diagScore + charScore >= leftScore &&
        (allowNonContiguousMatches || hasPreviousQuery || targetLower.startsWith(queryLower, targetIndex));

      if (validScore) {
        sequences[currentIndex] = sequenceLength + 1;
        scores[currentIndex] = diagScore + charScore;
      } else {
        sequences[currentIndex] = 0;
        scores[currentIndex] = leftScore;
      }
    }
  }

  const positions = [];
  let queryIndex = queryLength - 1;
  let targetIndex = targetLength - 1;
  while (queryIndex >= 0 && targetIndex >= 0) {
    const currentIndex = queryIndex * targetLength + targetIndex;
    if (!sequences[currentIndex]) {
      targetIndex--;
    } else {
      positions.push(targetIndex);
      queryIndex--;
      targetIndex--;
    }
  }

  return [scores[queryLength * targetLength - 1] || 0, positions.reverse()];
}

function computeFuzzyCharScore(queryChar, queryLowerChar, target, targetLower, targetIndex, sequenceLength) {
  if (queryLowerChar !== targetLower[targetIndex]) return 0;

  let score = 1;
  if (sequenceLength > 0) score += Math.min(sequenceLength, 3) * 6 + Math.max(0, sequenceLength - 3) * 3;
  if (queryChar === target[targetIndex]) score += 1;
  if (targetIndex === 0) {
    score += 8;
  } else {
    const boundaryScore = separatorScore(target.charCodeAt(targetIndex - 1));
    if (boundaryScore) score += boundaryScore;
    else if (isUpper(target.charCodeAt(targetIndex)) && sequenceLength === 0) score += 2;
  }

  return score;
}

function normalizeSearch(value) {
  return String(value).trim().replace(/\s{2,}/g, " ");
}

function toPlainLabel(label) {
  const text = String(label ?? "");
  const template = document.createElement("template");
  template.innerHTML = text;
  return template.content.textContent || text;
}

export class CustomSelect {
  constructor(element, options = {}) {
    this.element = element;
    const initialValue = element.value;
    this.config = {
      searchEnabled: false,
      combobox: false,
      searchResultLimit: 4,
      noResultsText: "No results found",
      shouldSort: false,
      renderOption: null,
      onBeforeOpen: null,
      ...options,
    };
    this.options = [];
    this.filteredOptions = [];
    this.value = "";
    this.highlightIndex = -1;
    this.isOpen = false;
    this.searchValue = "";
    this.idBase = element.id || `custom-select-${Math.random().toString(36).slice(2)}`;

    this.build();
    this.readOptionsFromElement();
    this.setChoiceByValue(initialValue || this.options[0]?.value || "", { silent: true });
  }

  build() {
    this.element.classList.add("custom-select-source");
    this.element.tabIndex = -1;
    this.element.setAttribute("aria-hidden", "true");

    this.containerOuter = { element: document.createElement("div") };
    this.root = this.containerOuter.element;
    this.root.className = `custom-select${this.config.combobox ? " custom-select--combobox" : ""}`;

    if (this.config.combobox) {
      this.trigger = document.createElement("input");
      this.trigger.type = "text";
      this.trigger.spellcheck = false;
      this.trigger.autocomplete = "off";
      this.trigger.className = "custom-select__trigger custom-select__input";
      this.trigger.setAttribute("role", "combobox");
    } else {
      this.trigger = document.createElement("button");
      this.trigger.type = "button";
      this.trigger.className = "custom-select__trigger";
    }
    this.trigger.setAttribute("aria-haspopup", "listbox");
    this.trigger.setAttribute("aria-expanded", "false");
    this.trigger.setAttribute("aria-controls", `${this.idBase}-listbox`);

    this.arrow = document.createElement("button");
    this.arrow.type = "button";
    this.arrow.className = "custom-select__arrow";
    this.arrow.tabIndex = -1;
    this.arrow.setAttribute("aria-hidden", "true");

    this.dropdown = document.createElement("div");
    this.dropdown.className = "custom-select__dropdown";
    this.dropdown.setAttribute("role", "presentation");

    this.list = document.createElement("div");
    this.list.className = "custom-select__list scrollable";
    this.list.id = `${this.idBase}-listbox`;
    this.list.setAttribute("role", "listbox");
    this.dropdown.appendChild(this.list);

    this.root.append(this.trigger, this.arrow, this.dropdown);
    this.element.insertAdjacentElement("afterend", this.root);
    this.bindEvents();
  }

  bindEvents() {
    this.root.addEventListener("click", (event) => event.stopPropagation());

    this.trigger.addEventListener("mousedown", (event) => {
      if (event.button !== 0) return;
      if (!this.config.combobox) event.preventDefault();
      if (this.config.combobox) {
        if (!this.isOpen) this.showDropdown();
      } else {
        this.toggleDropdown();
      }
    });

    const onArrowPress = (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      this.toggleDropdown();
    };
    this.arrow.addEventListener("mousedown", onArrowPress);
    this.arrow.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });

    this.trigger.addEventListener("focus", () => {
      if (this.config.combobox) this.showDropdown();
    });

    this.trigger.addEventListener("input", () => {
      if (!this.config.combobox) return;
      this.searchValue = this.trigger.value;
      this.renderOptions();
      this.list.scrollTop = 0;
      if (!this.isOpen) this.showDropdown();
    });

    this.trigger.addEventListener("keydown", (event) => this.onKeyDown(event));

    document.addEventListener("mousedown", (event) => {
      if (!this.root.contains(event.target)) this.hideDropdown();
    });
  }

  readOptionsFromElement() {
    const options = Array.from(this.element.options || []).map((option) => ({
      value: option.value,
      label: option.textContent,
      customProperties: { title: option.title },
    }));
    this.setChoices(options, "value", "label", true, { silent: true });
  }

  setChoices(choices, valueKey = "value", labelKey = "label", replaceChoices = false, options = {}) {
    if (replaceChoices) {
      this.options = [];
      this.element.replaceChildren();
    }

    const nextOptions = choices.map((choice) => {
      const value = String(choice[valueKey] ?? "");
      const rawLabel = choice[labelKey] ?? value;
      return {
        value,
        label: choice.html ? toPlainLabel(rawLabel) : String(rawLabel),
        rawLabel,
        customProperties: choice.customProperties || {},
      };
    });

    this.options.push(...nextOptions);
    const fragment = document.createDocumentFragment();
    nextOptions.forEach((choice) => {
      const option = document.createElement("option");
      option.value = choice.value;
      option.textContent = choice.label;
      if (typeof choice.customProperties.title === "string") option.title = choice.customProperties.title;
      fragment.appendChild(option);
    });
    this.element.appendChild(fragment);

    if (!this.value && this.options.length) this.setChoiceByValue(this.options[0].value, { silent: true });
    this.renderSelection();
    this.renderOptions();
    if (!options.silent && this.isOpen) this.showDropdown();
  }

  setChoiceByValue(value, options = {}) {
    const normalizedValue = String(value ?? "");
    const found = this.options.find((choice) => choice.value === normalizedValue) || this.options[0];
    if (!found) return;

    this.value = found.value;
    this.element.value = found.value;
    const previousScrollTop = options.preserveScroll ? this.list.scrollTop : null;
    this.renderSelection();
    if (options.updateInput && this.config.combobox) this.trigger.value = found.label;
    this.renderOptions();
    if (previousScrollTop !== null) {
      this.list.scrollTop = previousScrollTop;
      requestAnimationFrame(() => {
        this.list.scrollTop = previousScrollTop;
      });
    }

    if (!options.silent) {
      this.element.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }

  getValue(valueOnly = false) {
    const found = this.options.find((choice) => choice.value === this.value);
    return valueOnly ? this.value : found || null;
  }

  showDropdown() {
    if (this.isOpen) return;
    if (typeof this.config.onBeforeOpen === "function") this.config.onBeforeOpen(this);
    this.isOpen = true;
    this.root.classList.add("is-open");
    this.dropdown.classList.add("is-active");
    this.trigger.setAttribute("aria-expanded", "true");
    if (this.config.combobox) {
      this.searchValue = "";
      this.trigger.value = this.getSelectedLabel();
    }
    this.renderOptions();
    this.element.dispatchEvent(new Event("showDropdown"));
  }

  hideDropdown() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.root.classList.remove("is-open");
    this.dropdown.classList.remove("is-active");
    this.trigger.setAttribute("aria-expanded", "false");
    this.searchValue = "";
    this.renderSelection();
    if (this.config.combobox) {
      this.trigger.setSelectionRange?.(0, 0);
      this.trigger.blur();
    }
    this.element.dispatchEvent(new Event("hideDropdown"));
  }

  toggleDropdown() {
    if (this.isOpen) this.hideDropdown();
    else this.showDropdown();
  }

  renderSelection() {
    const selected = this.options.find((choice) => choice.value === this.value);
    const label = selected?.label || "";
    if (this.config.combobox) {
      if (!this.isOpen) this.trigger.value = label;
    } else {
      this.trigger.textContent = label;
    }
    this.trigger.setAttribute("aria-label", label);
    if (typeof selected?.customProperties?.title === "string") {
      this.trigger.title = selected.customProperties.title;
    }
  }

  getSelectedLabel() {
    const selected = this.options.find((choice) => choice.value === this.value);
    return selected?.label || "";
  }

  getVisibleOptions() {
    const query = normalizeSearch(this.searchValue);
    if (!this.config.searchEnabled || !query) return this.options;

    return this.options
      .map((choice, index) => {
        const [score, positions] = scoreFuzzy(choice.label, query, true);
        return { choice, index, score, positions };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .slice(0, this.config.searchResultLimit)
      .map((entry) => entry.choice);
  }

  renderOptions() {
    this.filteredOptions = this.getVisibleOptions();
    this.list.replaceChildren();

    if (!this.filteredOptions.length) {
      const notice = document.createElement("div");
      notice.className = "custom-select__notice";
      notice.textContent = this.config.noResultsText;
      this.list.appendChild(notice);
      this.highlightIndex = -1;
      return;
    }

    const selectedIndex = this.filteredOptions.findIndex((choice) => choice.value === this.value);
    this.highlightIndex = selectedIndex >= 0 ? selectedIndex : 0;
    const fragment = document.createDocumentFragment();

    this.filteredOptions.forEach((choice, index) => {
      const item = document.createElement("div");
      item.className = "custom-select__item";
      item.id = `${this.idBase}-option-${index}`;
      item.dataset.value = choice.value;
      item.setAttribute("role", "option");
      item.setAttribute("aria-selected", choice.value === this.value ? "true" : "false");
      if (typeof choice.customProperties.title === "string") item.title = choice.customProperties.title;
      if (choice.value === this.value) item.classList.add("is-selected");
      if (index === this.highlightIndex) item.classList.add("is-highlighted");

      if (typeof this.config.renderOption === "function") {
        const rendered = this.config.renderOption(choice);
        if (rendered) item.appendChild(rendered);
      } else {
        item.textContent = choice.label;
      }

      item.addEventListener("mouseenter", () => this.highlightOption(index));
      item.addEventListener("mousedown", (event) => event.preventDefault());
      item.addEventListener("click", () =>
        this.chooseOption(index, { keepOpen: true, preserveScroll: true, updateInput: true }),
      );
      fragment.appendChild(item);
    });

    this.list.appendChild(fragment);
    this.syncActiveDescendant();
  }

  highlightOption(index, scroll = false) {
    if (index < 0 || index >= this.filteredOptions.length) return;
    this.highlightIndex = index;
    this.list.querySelectorAll(".custom-select__item").forEach((item, itemIndex) => {
      item.classList.toggle("is-highlighted", itemIndex === index);
    });
    this.syncActiveDescendant();
    if (scroll) this.scrollHighlightedIntoView();
  }

  chooseOption(index = this.highlightIndex, options = {}) {
    const choice = this.filteredOptions[index];
    if (!choice) return;
    this.setChoiceByValue(choice.value, { preserveScroll: options.preserveScroll, updateInput: options.updateInput });
    if (!options.keepOpen) {
      this.hideDropdown();
      this.trigger.focus({ preventScroll: true });
    }
  }

  syncActiveDescendant() {
    const item = this.list.querySelector(".custom-select__item.is-highlighted");
    if (item) this.trigger.setAttribute("aria-activedescendant", item.id);
    else this.trigger.removeAttribute("aria-activedescendant");
  }

  scrollHighlightedIntoView(block = "nearest") {
    const item = this.list.querySelector(".custom-select__item.is-highlighted");
    item?.scrollIntoView({ block, behavior: "auto" });
  }

  onKeyDown(event) {
    const key = event.key;
    if (key === "ArrowDown" || key === "ArrowUp") {
      event.preventDefault();
      if (!this.isOpen) this.showDropdown();
      const direction = key === "ArrowDown" ? 1 : -1;
      const nextIndex = Math.min(this.filteredOptions.length - 1, Math.max(0, this.highlightIndex + direction));
      this.highlightOption(nextIndex, true);
    } else if (key === "Home" || key === "End") {
      if (!this.isOpen) return;
      event.preventDefault();
      this.highlightOption(key === "Home" ? 0 : this.filteredOptions.length - 1, true);
    } else if (key === "Enter") {
      event.preventDefault();
      if (this.isOpen) this.chooseOption();
      else this.showDropdown();
    } else if (key === "Escape") {
      if (!this.isOpen) return;
      event.preventDefault();
      event.stopPropagation();
      this.hideDropdown();
    } else if (key === "Tab") {
      this.hideDropdown();
    } else if (!this.config.combobox && key.length === 1) {
      this.showDropdown();
    }
  }
}
