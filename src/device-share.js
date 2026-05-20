import QRCode from "qrcode";

const DEVICE_SHARE_DIRECT_URL_MAX_BYTES = 1500;

function formatRemainingTime(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function getDirectShareUrl(text) {
  const trimmed = (typeof text === "string" ? text : "").trim();
  if (!trimmed || /\s/.test(trimmed)) return null;
  if (new Blob([trimmed]).size > DEVICE_SHARE_DIRECT_URL_MAX_BYTES) return null;

  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.href;
  } catch {
    return null;
  }
}

export function createDeviceShareController({
  i18next,
  electronAPI,
  getCSSVar,
  getCurrentEditorText,
  getSharePayload,
  focusEditor,
  setModalDisplayed,
}) {
  const elements = {
    confirmBox: document.getElementById("confirm-save-background"),
    button: document.getElementById("device-share-btn"),
    title: document.getElementById("device-share-title"),
    modal: document.getElementById("device-share-modal"),
    close: document.getElementById("device-share-close"),
    qr: document.getElementById("device-share-qr"),
    qrWrap: document.getElementById("device-share-qr-wrap"),
    urlRow: document.getElementById("device-share-url-row"),
    url: document.getElementById("device-share-url"),
    copy: document.getElementById("device-share-copy"),
    regenerate: document.getElementById("device-share-regenerate"),
    description: document.getElementById("device-share-description"),
    error: document.getElementById("device-share-error"),
  };

  let activeUrl = null;
  let expiresAt = null;
  let countdownTimer = null;
  let statusSyncing = false;
  let copyResetTimer = null;

  function stopCountdown() {
    if (countdownTimer) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }
  }

  function updateRegenerateButton() {
    if (!elements.regenerate) return;

    if (!expiresAt && !activeUrl) {
      elements.regenerate.disabled = true;
      elements.regenerate.textContent = i18next.t("deviceShare.regenerate");
      return;
    }

    const remainingMs = expiresAt ? expiresAt - Date.now() : 0;
    if (remainingMs > 0) {
      elements.regenerate.disabled = true;
      elements.regenerate.textContent = `${i18next.t("deviceShare.regenerate")} (${formatRemainingTime(remainingMs)})`;
      return;
    }

    stopCountdown();
    elements.regenerate.disabled = false;
    elements.regenerate.innerHTML = `${i18next.t("deviceShare.regenerate")} <span id="device-share-expired">(${i18next.t(
      "deviceShare.expired",
    )})</span>`;
  }

  async function syncStatus() {
    if (!activeUrl || statusSyncing) return;

    statusSyncing = true;
    try {
      const status = await electronAPI.getMobileShareStatus(activeUrl);
      if (!status?.exists || status.expired) {
        expiresAt = Date.now();
        updateRegenerateButton();
        return;
      }
      if (typeof status.expiresAt === "number" && status.expiresAt !== expiresAt) {
        expiresAt = status.expiresAt;
        updateRegenerateButton();
      }
    } finally {
      statusSyncing = false;
    }
  }

  function startCountdown(nextExpiresAt) {
    expiresAt = nextExpiresAt || null;
    stopCountdown();
    updateRegenerateButton();
    countdownTimer = setInterval(() => {
      updateRegenerateButton();
      syncStatus();
    }, 1000);
  }

  function resetCopyButton() {
    if (!elements.copy) return;
    clearTimeout(copyResetTimer);
    elements.copy.textContent = i18next.t("deviceShare.copyLink");
  }

  function setCopyButtonCopied() {
    if (!elements.copy) return;
    clearTimeout(copyResetTimer);
    elements.copy.textContent = i18next.t("deviceShare.copied");
    copyResetTimer = setTimeout(resetCopyButton, 1200);
  }

  function setLinkContentVisible(visible) {
    if (elements.qrWrap) elements.qrWrap.style.display = visible ? "flex" : "none";
    if (elements.urlRow) elements.urlRow.style.display = visible ? "flex" : "none";
  }

  function resetModal() {
    elements.qr?.removeAttribute("src");
    if (elements.url) elements.url.value = "";
    if (elements.error) {
      elements.error.style.display = "none";
      elements.error.textContent = "";
    }
    if (elements.description) elements.description.textContent = i18next.t("deviceShare.description");
    resetCopyButton();
    stopCountdown();
    expiresAt = null;
    if (elements.regenerate) {
      elements.regenerate.disabled = true;
      elements.regenerate.textContent = i18next.t("deviceShare.regenerate");
    }
    setLinkContentVisible(true);
  }

  function getErrorMessage(result) {
    if (result?.errorKey === "tooLarge") {
      return i18next.t("deviceShare.tooLarge", { maxMb: result.maxMb || 2 });
    }
    return i18next.t("deviceShare.createError");
  }

  async function closeModal() {
    if (elements.confirmBox) elements.confirmBox.style.display = "none";
    if (elements.modal) elements.modal.style.display = "none";
    setModalDisplayed(false);
    stopCountdown();
    expiresAt = null;

    if (activeUrl) {
      await electronAPI.revokeMobileShare(activeUrl);
      activeUrl = null;
    }

    focusEditor();
  }

  async function createLink() {
    const payload = getSharePayload();
    if (!payload?.text) return;

    if (activeUrl) {
      await electronAPI.revokeMobileShare(activeUrl);
      activeUrl = null;
    }

    if (elements.description) elements.description.textContent = i18next.t("deviceShare.preparing");
    setLinkContentVisible(false);
    if (elements.regenerate) {
      elements.regenerate.disabled = true;
      elements.regenerate.textContent = i18next.t("deviceShare.regenerate");
    }
    resetCopyButton();

    const directUrl = getDirectShareUrl(payload.text);

    if (directUrl) {
      activeUrl = null;
      elements.url.value = directUrl;
      elements.qr.src = await QRCode.toDataURL(directUrl, {
        errorCorrectionLevel: "M",
        margin: 1,
        width: 220,
        color: {
          dark: getCSSVar("--editorText") || "#ffffff",
          light: getCSSVar("--color2") || "#000000",
        },
      });
      setLinkContentVisible(true);
      stopCountdown();
      expiresAt = null;
      if (elements.description) elements.description.textContent = i18next.t("deviceShare.directLinkDescription");
      if (elements.regenerate) {
        elements.regenerate.disabled = true;
        elements.regenerate.textContent = i18next.t("deviceShare.regenerate");
      }
      return;
    }

    const result = await electronAPI.createMobileShare({
      title: payload.title || "Monapad Note",
      text: payload.text,
      labels: {
        copy: i18next.t("deviceShare.pageCopy"),
        copied: i18next.t("deviceShare.pageCopied"),
      },
    });

    if (!result?.success) {
      if (elements.description) elements.description.textContent = "";
      if (elements.error) {
        elements.error.textContent = getErrorMessage(result);
        elements.error.style.display = "block";
      }
      if (elements.regenerate) {
        elements.regenerate.disabled = false;
        elements.regenerate.textContent = i18next.t("deviceShare.regenerate");
      }
      return;
    }

    activeUrl = result.url;
    elements.url.value = result.url;
    elements.qr.src = await QRCode.toDataURL(result.url, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 220,
      color: {
        dark: getCSSVar("--editorText") || "#ffffff",
        light: getCSSVar("--color2") || "#000000",
      },
    });
    setLinkContentVisible(true);
    if (elements.description) elements.description.textContent = i18next.t("deviceShare.description");
    startCountdown(result.expiresAt);
  }

  async function openModal() {
    if (!getCurrentEditorText().trim()) {
      updateButtonState();
      return;
    }

    if (elements.confirmBox) elements.confirmBox.style.display = "flex";
    if (elements.modal) elements.modal.style.display = "flex";
    setModalDisplayed(true);
    resetModal();
    await createLink();
  }

  function updateButtonState() {
    if (!elements.button) return;
    const hasMeaningfulText = getCurrentEditorText().trim().length > 0;
    elements.button.disabled = !hasMeaningfulText;
  }

  function updateLabels() {
    if (elements.button) elements.button.title = i18next.t("deviceShare.tooltip");
    if (elements.title) elements.title.textContent = i18next.t("deviceShare.title");
    if (elements.copy) elements.copy.textContent = i18next.t("deviceShare.copyLink");
    if (elements.close) elements.close.textContent = i18next.t("deviceShare.close");
    if (elements.description) elements.description.textContent = i18next.t("deviceShare.description");
    updateRegenerateButton();
  }

  elements.button?.addEventListener("click", openModal);
  elements.close?.addEventListener("click", closeModal);
  elements.regenerate?.addEventListener("click", async () => {
    if (elements.regenerate.disabled) return;
    await createLink();
  });
  elements.copy?.addEventListener("click", async () => {
    if (!elements.url.value) return;

    try {
      await navigator.clipboard.writeText(elements.url.value);
      setCopyButtonCopied();
    } catch {
      elements.url.focus();
      elements.url.select();
    }
  });

  return {
    closeModal,
    updateButtonState,
    updateLabels,
    isOpen() {
      return elements.modal?.style.display !== "none" && elements.modal?.style.display !== "";
    },
  };
}
