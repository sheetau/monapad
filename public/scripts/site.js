// download buttons
      const downloadButtons = document.querySelectorAll(".app-download");
      function trackClickEvent() {
        if (typeof gtag === "function") {
          gtag("event", "download_click", {
            event_category: "Download",
            event_label: "Windows Setup",
          });
        }
      }
      async function handleWindowsDownload(event) {
        event.preventDefault();
        trackClickEvent();

        try {
          const response = await fetch("https://api.github.com/repos/sheetau/monapad/releases/latest");
          const data = await response.json();
          const asset = data.assets.find((item) => item.name.match(/^Monapad-Setup-.*\.exe$/));

          if (asset) {
            setTimeout(() => {
              window.location.href = asset.browser_download_url;
            }, 200);
          } else {
            alert("Windows installer not found.");
          }
        } catch (error) {
          console.error("Download error:", error);
          alert("Failed to fetch the latest release information.");
        }
      }
      downloadButtons.forEach((button) => {
        button.addEventListener("click", handleWindowsDownload);
      });

      // tabs video
      const video = document.getElementById("tabsVideo");
      const workflowSlider = document.getElementById("workflowSlider");
      const workflowTrack = workflowSlider?.querySelector(".card-slider-track");
      const sliderDots = document.querySelectorAll("[data-slider-index]");
      const sliderToggle = document.querySelector(".card-slider-toggle");
      let workflowSliderIndex = 0;
      let sliderPaused = false;
      let sliderUserPaused = false;
      let sliderInView = true;
      let sliderVideoVisible = true;
      let sliderTimerStartedAt = performance.now();
      let sliderTimerElapsed = 0;
      let sliderTimerDuration = 8000;
      let activeSliderDot = null;
      let lastSliderProgress = -1;
      let lastSliderProgressUpdateAt = 0;
      const defaultSliderDuration = 8000;
      const sliderProgressMinInterval = 50;

      function getSliderCards() {
        return workflowSlider ? [...workflowSlider.querySelectorAll(".slider-card")] : [];
      }

      function isWorkflowVideoCard(index = workflowSliderIndex) {
        return getSliderCards()[index]?.classList.contains("tabs-card") ?? false;
      }

      function setSliderProgress(progress = 0, force = false, now = performance.now()) {
        const clampedProgress = Math.min(Math.max(progress, 0), 1);
        const progressStep = activeSliderDot ? 0.5 / Math.max(activeSliderDot.offsetWidth, 1) : 0.01;
        if (
          !force &&
          (Math.abs(clampedProgress - lastSliderProgress) < progressStep ||
            now - lastSliderProgressUpdateAt < sliderProgressMinInterval)
        ) {
          return;
        }
        lastSliderProgress = clampedProgress;
        lastSliderProgressUpdateAt = now;
        activeSliderDot?.style.setProperty("--slider-progress", clampedProgress);
      }

      function updateSliderControls(progress = 0) {
        activeSliderDot = null;
        lastSliderProgress = -1;
        sliderDots.forEach((dot, index) => {
          const isActive = index === workflowSliderIndex;
          dot.classList.toggle("is-active", isActive);
          dot.setAttribute("aria-disabled", String(isActive));
          if (isActive) {
            activeSliderDot = dot;
          } else {
            dot.style.setProperty("--slider-progress", 0);
          }
        });
        setSliderProgress(progress, true);
      }

      function getVideoSliderProgress() {
        if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return 0;
        return Math.min(video.currentTime / video.duration, 1);
      }

      function resetSliderTimer(progress = 0) {
        sliderTimerElapsed = 0;
        sliderTimerStartedAt = performance.now();
        sliderTimerDuration = defaultSliderDuration;
        updateSliderControls(progress);
      }

      function syncSliderVideo() {
        if (!video) return;
        if (!sliderPaused && sliderVideoVisible && isWorkflowVideoCard()) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      }

      function showWorkflowCard(index, resetTimer = true) {
        if (!workflowSlider) return;
        const cards = getSliderCards();
        if (cards.length === 0) return;

        workflowSliderIndex = (index + cards.length) % cards.length;
        if (workflowTrack) {
          workflowTrack.style.transform = `translateX(${-cards[workflowSliderIndex].offsetLeft}px)`;
        }
        let initialProgress = 0;
        if (isWorkflowVideoCard() && resetTimer && video && video.duration - video.currentTime < 0.05) {
          video.currentTime = 0;
        }
        if (isWorkflowVideoCard()) {
          initialProgress = getVideoSliderProgress();
        }
        syncSliderVideo();
        if (resetTimer) {
          resetSliderTimer(initialProgress);
        } else {
          updateSliderControls(initialProgress);
        }
      }

      function setSliderPaused(paused) {
        if (paused === sliderPaused) return;
        sliderPaused = paused;
        sliderToggle?.setAttribute("aria-pressed", String(paused));
        sliderToggle?.setAttribute("aria-label", paused ? "Play slider" : "Pause slider");
        sliderToggle?.querySelector(".pause-icon")?.classList.toggle("hidden", paused);
        sliderToggle?.querySelector(".play-icon")?.classList.toggle("hidden", !paused);

        if (paused) {
          sliderTimerElapsed = performance.now() - sliderTimerStartedAt;
          syncSliderVideo();
          return;
        }

        sliderTimerStartedAt = performance.now() - sliderTimerElapsed;
        syncSliderVideo();
      }

      function syncSliderPausedState() {
        setSliderPaused(sliderUserPaused || !sliderInView);
      }

      function isElementInViewport(element) {
        const rect = element.getBoundingClientRect();
        return rect.bottom >= 0 && rect.right >= 0 && rect.top <= window.innerHeight && rect.left <= window.innerWidth;
      }

      function updateSliderTimer(now) {
        if (!sliderPaused) {
          const hasVideoProgress =
            isWorkflowVideoCard() && video && !video.paused && Number.isFinite(video.duration) && video.duration > 0;
          const progress = hasVideoProgress
            ? Math.min(video.currentTime / video.duration, 1)
            : Math.min((now - sliderTimerStartedAt) / sliderTimerDuration, 1);
          setSliderProgress(progress, false, now);

          if (progress >= 1) {
            showWorkflowCard(workflowSliderIndex + 1);
          }
        }

        window.requestAnimationFrame(updateSliderTimer);
      }

      sliderDots.forEach((dot) => {
        dot.addEventListener("click", () => {
          const targetIndex = Number(dot.dataset.sliderIndex);
          if (targetIndex === workflowSliderIndex) return;
          showWorkflowCard(targetIndex);
        });
      });

      sliderToggle?.addEventListener("click", () => {
        sliderUserPaused = !sliderUserPaused;
        syncSliderPausedState();
      });

      if (workflowSlider) {
        let touchStartX = 0;
        let touchStartY = 0;
        workflowSlider.addEventListener(
          "touchstart",
          (event) => {
            const touch = event.changedTouches[0];
            touchStartX = touch.clientX;
            touchStartY = touch.clientY;
          },
          { passive: true },
        );
        workflowSlider.addEventListener(
          "touchend",
          (event) => {
            const touch = event.changedTouches[0];
            const deltaX = touch.clientX - touchStartX;
            const deltaY = touch.clientY - touchStartY;
            if (Math.abs(deltaX) < 48 || Math.abs(deltaX) < Math.abs(deltaY) * 1.4) return;
            showWorkflowCard(workflowSliderIndex + (deltaX < 0 ? 1 : -1));
          },
          { passive: true },
        );
      }

      if (workflowSlider) {
        workflowSlider.style.overflow = "visible";
        workflowSlider.scrollLeft = 0;
      }
      if (video) {
        video.loop = false;
      }
      if (workflowTrack) {
        workflowTrack.style.transition = "transform 0.45s var(--ease-out-soft)";
        workflowTrack.style.willChange = "transform";
      }
      if (workflowSlider) {
        resetSliderTimer();
        window.requestAnimationFrame(updateSliderTimer);
      }

      video?.addEventListener("loadedmetadata", () => {
        if (isWorkflowVideoCard()) resetSliderTimer(getVideoSliderProgress());
        syncSliderVideo();
      });
      video?.addEventListener("ended", () => {
        if (!sliderPaused && isWorkflowVideoCard()) {
          showWorkflowCard(workflowSliderIndex + 1);
        }
      });

      // shortcuts
      const commandSearchInput = document.getElementById("commandSearchInput");
      const commandSearchResults = document.getElementById("commandSearchResults");
      const shortcutCommands = [
        ["Alt + ArrowUp", "Move Line Up"],
        ["Alt + ArrowDn", "Move Line Down"],
        ["Shift + Alt + ArrowDn", "Copy Line Down"],
        ["Shift + Alt + ArrowUp", "Copy Line Up"],
        ["Ctrl + Shift + K", "Delete Line"],
        ["Ctrl + Enter", "Insert Line Below"],
        ["Ctrl + Shift + Enter", "Insert Line Above"],
        ["Ctrl + ]", "Indent Line"],
        ["Ctrl + [", "Outdent Line"],
        ["Ctrl + ArrowUp", "Scroll Line Up"],
        ["Ctrl + ArrowDn", "Scroll Line Down"],
        ["Alt + PageUp", "Scroll Page Up"],
        ["Alt + PageDn", "Scroll Page Down"],
        ["Ctrl + Shift + [", "Fold"],
        ["Ctrl + Shift + ]", "Unfold"],
        ["Ctrl + K Ctrl + [", "Fold Recursively"],
        ["Ctrl + K Ctrl + ]", "Unfold Recursively"],
        ["Ctrl + K Ctrl + 0", "Fold All"],
        ["Ctrl + K Ctrl + J", "Unfold All"],
        ["Ctrl + /", "Toggle Line Comment"],
        ["Alt + Z", "Toggle Word Wrap"],
        ["Ctrl + F", "Find"],
        ["Ctrl + H", "Replace"],
        ["Alt + Click", "Add Cursor"],
        ["Ctrl + Alt + ArrowUp", "Add Cursor Above"],
        ["Ctrl + Alt + ArrowDn", "Add Cursor Below"],
        ["Ctrl + U", "Undo Last Cursor Operation"],
        ["Shift + Alt + I", "Add Cursors to Line Ends"],
        ["Ctrl + L", "Select Line"],
        ["Ctrl + Shift + L", "Select All Occurrences of Find Match"],
        ["Ctrl + F2", "Change All Occurrences"],
        ["Shift + Alt + ArrowRight", "Expand Selection"],
        ["Shift + Alt + ArrowLeft", "Shrink Selection"],
        ["Shift + Alt + MouseDrag", "Column Selection"],
        ["Ctrl + Shift + Alt + ArrowKey", "Column Select"],
        ["Ctrl + Shift + Alt + PgUp", "Column Select Page Up"],
        ["Ctrl + Shift + Alt + PgDn", "Column Select Page Down"],
        ["Ctrl + G", "Go to Line/Column"],
        ["Ctrl + Shift + O", "Go to Symbol in Editor"],
      ].map(([key, name]) => ({ key, name }));
      function cycleCommandSearch(commands) {
        if (!commandSearchInput || !commandSearchResults) return;

        const queries = [
          "line",
          "add",
          "move",
          "select",
          "cursor",
          "fold",
          "scroll",
          "go to",
          "find",
          "insert",
          "column",
          "toggle",
          "replace",
          "change",
          "copy",
          "unfold",
        ];
        const typeDelay = 70;
        const deleteDelay = 45;
        const holdDelay = 1400;
        let queryIndex = 0;
        let isCommandListVisible = false;
        let isDocumentVisible = !document.hidden;
        let lastRenderedQuery = null;
        const activeResolvers = new Set();

        const isActive = () => isCommandListVisible && isDocumentVisible;
        const notifyActivityChange = () => {
          activeResolvers.forEach((resolve) => resolve());
          activeResolvers.clear();
        };
        const waitForActivityChange = () => new Promise((resolve) => activeResolvers.add(resolve));
        const waitForActive = async () => {
          while (!isActive()) await waitForActivityChange();
        };
        const wait = async (ms) => {
          let remaining = ms;

          while (remaining > 0) {
            await waitForActive();
            const startedAt = performance.now();
            let timedOut = false;
            let timeoutId = 0;

            await Promise.race([
              new Promise(
                (resolve) =>
                  (timeoutId = setTimeout(() => {
                    timedOut = true;
                    resolve();
                  }, remaining)),
              ),
              waitForActivityChange(),
            ]);
            if (!timedOut) clearTimeout(timeoutId);

            if (timedOut) {
              remaining = 0;
            } else {
              remaining -= performance.now() - startedAt;
            }
          }
        };
        const normalize = (value) => value.toLowerCase();
        const sortedCommands = [...commands]
          .map((command) => ({ ...command, normalizedName: normalize(command.name) }))
          .sort((a, b) => a.name.localeCompare(b.name));
        const matchCache = new Map();
        const resultCache = new Map();
        const getMatches = (query) => {
          const normalizedQuery = normalize(query);
          if (!matchCache.has(normalizedQuery)) {
            matchCache.set(
              normalizedQuery,
              sortedCommands.filter((command) => !normalizedQuery || command.normalizedName.includes(normalizedQuery)),
            );
          }

          return matchCache.get(normalizedQuery);
        };

        const appendHighlightedText = (parent, text, query) => {
          const normalizedText = normalize(text);
          const normalizedQuery = normalize(query);
          const matchIndex = normalizedText.indexOf(normalizedQuery);

          if (!query || matchIndex === -1) {
            parent.append(text);
            return;
          }

          parent.append(text.slice(0, matchIndex));
          const mark = document.createElement("mark");
          mark.textContent = text.slice(matchIndex, matchIndex + query.length);
          parent.append(mark, text.slice(matchIndex + query.length));
        };

        const renderResults = (query) => {
          if (!resultCache.has(query)) {
            const fragment = document.createDocumentFragment();
            const matches = getMatches(query);

            matches.forEach((match, index) => {
              const row = document.createElement("div");
              row.className = `command-label${index === 0 ? " active" : ""}`;

              const name = document.createElement("span");
              name.className = "command-name";
              const key = document.createElement("span");
              key.className = "command-key";

              appendHighlightedText(name, match.name, query);
              key.textContent = match.key;
              row.append(name, key);
              fragment.append(row);
            });

            resultCache.set(query, fragment);
          }

          commandSearchResults.replaceChildren(resultCache.get(query).cloneNode(true));
        };

        const prompt = document.createElement("span");
        const queryText = document.createElement("span");
        const caret = document.createElement("span");
        prompt.className = "command-input-mark";
        queryText.className = "command-query";
        caret.className = "command-input-mark";
        prompt.textContent = ">";
        caret.textContent = "|";
        commandSearchInput.replaceChildren(prompt, queryText, caret);

        const renderInput = (query) => {
          if (query === lastRenderedQuery) return;
          lastRenderedQuery = query;
          queryText.textContent = query;
          renderResults(query);
        };

        async function typeQuery(query) {
          for (let length = 1; length <= query.length; length += 1) {
            await waitForActive();
            renderInput(query.slice(0, length));
            await wait(typeDelay);
          }
        }

        async function deleteQuery(query) {
          for (let length = query.length - 1; length >= 0; length -= 1) {
            await waitForActive();
            renderInput(query.slice(0, length));
            await wait(deleteDelay);
          }
        }

        async function run() {
          while (true) {
            const query = queries[queryIndex];
            queryIndex = (queryIndex + 1) % queries.length;
            await typeQuery(query);
            await wait(holdDelay);
            await deleteQuery(query);
            await wait(260);
          }
        }

        const commandList = commandSearchInput.closest(".command-list");
        const commandListObserver = new IntersectionObserver(
          ([entry]) => {
            isCommandListVisible = entry.isIntersecting;
            notifyActivityChange();
          },
          { threshold: 0 },
        );
        if (commandList) commandListObserver.observe(commandList);
        document.addEventListener("visibilitychange", () => {
          isDocumentVisible = !document.hidden;
          notifyActivityChange();
        });

        renderInput("");
        run();
      }
      cycleCommandSearch(shortcutCommands);
      // themes
      const syncHover = (buttonClass, shadowIndex) => {
        const button = document.querySelector(`.theme-button.${buttonClass}`);
        const shadow = document.querySelector(`.themes-shadow:nth-child(${shadowIndex})`);

        if (!button || !shadow) return;

        button.addEventListener("mouseenter", () => shadow.classList.add("hover"));
        button.addEventListener("mouseleave", () => shadow.classList.remove("hover"));
        shadow.addEventListener("mouseenter", () => button.classList.add("hover"));
        shadow.addEventListener("mouseleave", () => button.classList.remove("hover"));
      };
      [
        ["onyx", 3],
        ["dark", 2],
        ["ash", 1],
      ].forEach(([buttonClass, shadowIndex]) => syncHover(buttonClass, shadowIndex));

      const languageSwitcher = document.querySelector("[data-language-switcher]");
      const languageSwitcherButton = languageSwitcher?.querySelector("[data-language-switcher-button]");
      const languageOptions = languageSwitcher ? [...languageSwitcher.querySelectorAll("[data-language-value]")] : [];
      const setLanguageMenuOpen = (isOpen) => {
        languageSwitcher?.classList.toggle("is-open", isOpen);
        languageSwitcherButton?.setAttribute("aria-expanded", String(isOpen));
      };
      languageSwitcherButton?.addEventListener("click", () => {
        setLanguageMenuOpen(!languageSwitcher.classList.contains("is-open"));
      });
      languageOptions.forEach((option) => {
        option.addEventListener("click", () => {
          const value = option.dataset.languageValue;
          if (!value) return;
          localStorage.setItem("monapad-locale", option.dataset.languageCode ?? (value.includes("/ja/") ? "ja" : "en"));
          window.location.href = value;
        });
      });
      document.addEventListener("click", (event) => {
        if (!languageSwitcher?.contains(event.target)) setLanguageMenuOpen(false);
      });
      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") setLanguageMenuOpen(false);
      });

      const workflowObserver = new IntersectionObserver(
        ([entry]) => {
          sliderInView = entry.isIntersecting;
          sliderVideoVisible = sliderInView;
          syncSliderPausedState();
        },
        { threshold: 0 },
      );

      const observeWorkflowSlider = () => {
        if (!workflowSlider) return;
        workflowObserver.observe(workflowSlider);
        sliderInView = isElementInViewport(workflowSlider);
        sliderVideoVisible = sliderInView;
        syncSliderPausedState();
        syncSliderVideo();
      };
      if (document.readyState === "complete") {
        observeWorkflowSlider();
      } else {
        window.addEventListener("load", observeWorkflowSlider, { once: true });
      }
