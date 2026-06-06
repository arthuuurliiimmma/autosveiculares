const initialParams = new URLSearchParams(window.location.search);
const initialHash = window.location.hash.replace("#", "");

const state = {
  frontVisible: !initialParams.has("checkout") && !initialParams.has("internal") && initialHash === "",
  selected: false,
  paymentVisible: false,
  pixVisible: false,
  pixMode: false,
  paymentReturnOnly: false,
  expanded: false,
};

const amountOptionsCents = [3819, 4039, 4229, 4579, 4819];
const zeroText = "R$ 0,00";
const pixExpirationSeconds = 15 * 60;
const defaultEnteredCode = "BSF2345";
const codeStorageKey = "lojinhaEnteredCode";
const codeEnteredAtStorageKey = "lojinhaCodeEnteredAt";
const pixApiEndpoint = "../api/criar-pix.php";

const topbar = document.querySelector("[data-topbar]");
const paymentSection = document.querySelector('[data-screen="payment"]');
const pixSection = document.querySelector('[data-screen="pix"]');
const sheet = document.querySelector("[data-sheet]");
const sheetCard = sheet.querySelector(".sheet-card");
const collapsedBody = sheet.querySelector(".sheet-collapsed");
const expandedBody = sheet.querySelector(".sheet-expanded");
const totalLabel = document.querySelector("[data-total-label]");
const toast = document.querySelector("[data-toast]");
const pixField = document.querySelector(".pix-copy-field");
const pixTimer = document.querySelector("[data-pix-timer]");
const qrCode = document.querySelector(".qr-code");
const qrCodeImage = document.querySelector("[data-qr-image]");
const pixError = document.querySelector("[data-pix-error]");
const updatedAtLabel = document.querySelector("[data-updated-at]");
const entryPop = document.querySelector("[data-entry-pop]");
const entryCodeLabel = document.querySelector("[data-entry-code]");
const entryDateLabel = document.querySelector("[data-entry-date]");
const codeDisplays = document.querySelectorAll("[data-code-display]");
const priceDisplays = document.querySelectorAll("[data-price-display]");
const plainPriceDisplays = document.querySelectorAll("[data-price-plain]");
const frontPage = document.querySelector("[data-front-page]");
const checkoutUi = document.querySelectorAll("[data-checkout-ui]");
const frontCodeInput = document.querySelector("[data-front-code]");
const frontTerms = document.querySelector("[data-front-terms]");
const frontPrivacy = document.querySelector("[data-front-privacy]");
const frontSearch = document.querySelector("[data-front-search]");
let pixTimerId = null;
let pixExpiresAt = null;
let qrTimerId = null;
let currentPixCode = "";

function normalizeCode(value) {
  return value.trim().toUpperCase() || defaultEnteredCode;
}

function amountCentsForCode(code) {
  const normalizedCode = normalizeCode(code).replace(/[^A-Z0-9_-]/g, "");
  let amountIndex = 0;

  for (let index = 0; index < normalizedCode.length; index += 1) {
    amountIndex = (amountIndex * 31 + normalizedCode.charCodeAt(index)) % amountOptionsCents.length;
  }

  return amountOptionsCents[amountIndex];
}

function formatAmountCents(amountCents, withSymbol = true) {
  const cents = Math.max(0, Number.parseInt(amountCents, 10) || 0);
  const reais = Math.floor(cents / 100);
  const centavos = String(cents % 100).padStart(2, "0");
  const formatted = `${reais},${centavos}`;

  return withSymbol ? `R$ ${formatted}` : formatted;
}

function readEnteredAmountCents() {
  return amountCentsForCode(readEnteredCode());
}

function updateOrderAmount() {
  const amountCents = readEnteredAmountCents();
  const amountText = formatAmountCents(amountCents);
  const plainAmountText = formatAmountCents(amountCents, false);

  priceDisplays.forEach((item) => {
    item.textContent = amountText;
  });

  plainPriceDisplays.forEach((item) => {
    item.textContent = plainAmountText;
  });

  totalLabel.textContent = state.selected ? amountText : zeroText;
}

function readEnteredCode() {
  const urlCode = initialParams.get("code") || initialParams.get("codigo");

  if (urlCode) {
    const normalizedUrlCode = normalizeCode(urlCode);
    sessionStorage.setItem(codeStorageKey, normalizedUrlCode);
    return normalizedUrlCode;
  }

  return sessionStorage.getItem(codeStorageKey) || defaultEnteredCode;
}

function parseStoredDate(value) {
  if (!value) return null;

  const timestamp = Number(value);
  const date = Number.isFinite(timestamp) && value.trim() !== ""
    ? new Date(timestamp)
    : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function readCodeEnteredAt() {
  const params = new URLSearchParams(window.location.search);
  const urlValue = params.get("enteredAt") || params.get("codeEnteredAt");
  const urlDate = parseStoredDate(urlValue);

  if (urlDate) {
    sessionStorage.setItem(codeEnteredAtStorageKey, urlDate.toISOString());
    return urlDate;
  }

  const storedDate = parseStoredDate(sessionStorage.getItem(codeEnteredAtStorageKey));

  if (storedDate) {
    return storedDate;
  }

  const now = new Date();
  sessionStorage.setItem(codeEnteredAtStorageKey, now.toISOString());
  return now;
}

function formatDateTime(date) {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${day}/${month}/${year} - ${hours}:${minutes}`;
}

function formatEntryDateTime(date) {
  const weekdays = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return `Hoje, ${weekdays[date.getDay()]} Feira às , ${hours}:${minutes}:${seconds}`;
}

function updateCodeEnteredAt() {
  const enteredAt = readCodeEnteredAt();
  updatedAtLabel.textContent = formatDateTime(enteredAt);
  entryDateLabel.textContent = formatEntryDateTime(enteredAt);
}

function updateEnteredCode() {
  const enteredCode = readEnteredCode();
  codeDisplays.forEach((item) => {
    item.textContent = enteredCode;
  });
  entryCodeLabel.textContent = enteredCode;
  updateOrderAmount();
}

function openEntryPop() {
  updateEnteredCode();
  updateCodeEnteredAt();
  entryPop.hidden = false;
  document.body.classList.add("entry-pop-open");
}

function closeEntryPop() {
  entryPop.hidden = true;
  document.body.classList.remove("entry-pop-open");

  if (!state.paymentVisible && !state.pixVisible && !window.location.hash) {
    window.setTimeout(() => {
      scrollToOrderPreview();
    }, 30);
  }
}

function applyInitialHash() {
  const hash = window.location.hash.replace("#", "");
  if (!hash) return;

  if (hash.includes("selected")) {
    state.selected = true;
  }

  if (hash.includes("payment")) {
    state.selected = true;
    state.paymentVisible = true;
    state.paymentReturnOnly = true;
  }

  if (hash.includes("pix")) {
    state.selected = true;
    state.paymentVisible = true;
    state.pixVisible = true;
    state.pixMode = true;
    state.paymentReturnOnly = false;
  }

  if (hash.includes("expanded") && !state.pixMode) {
    state.expanded = true;
  }
}

function render() {
  document.body.classList.toggle("front-mode", state.frontVisible);
  document.body.classList.toggle("pix-mode", state.pixMode);
  frontPage.hidden = !state.frontVisible;
  checkoutUi.forEach((item) => {
    item.hidden = state.frontVisible;
  });

  if (state.frontVisible) {
    entryPop.hidden = true;
    return;
  }

  document.querySelectorAll(".checkmark").forEach((item) => {
    item.classList.toggle("is-selected", state.selected);
  });

  updateOrderAmount();
  paymentSection.hidden = !state.paymentVisible;
  pixSection.hidden = !state.pixVisible;
  topbar.hidden = state.pixMode;

  sheetCard.classList.remove("collapsed", "expanded", "minimal", "return-only");

  if (state.pixMode) {
    sheetCard.classList.add("return-only");
    collapsedBody.hidden = true;
    expandedBody.hidden = true;
    return;
  }

  if (state.paymentReturnOnly) {
    sheetCard.classList.add("return-only");
    collapsedBody.hidden = true;
    expandedBody.hidden = true;
    return;
  }

  sheetCard.classList.add(state.expanded ? "expanded" : "collapsed");
  collapsedBody.hidden = state.expanded;
  expandedBody.hidden = !state.expanded;
}

function updateFrontButton() {
  const hasCode = frontCodeInput.value.trim().length > 0;
  frontSearch.disabled = !(hasCode && frontTerms.checked && frontPrivacy.checked);
}

function startQrLoading() {
  qrCode.classList.add("is-loading");
  qrCode.classList.remove("has-error");
  qrCodeImage.hidden = true;
  qrCodeImage.removeAttribute("src");
  pixError.hidden = true;
  pixError.textContent = "";
  window.clearTimeout(qrTimerId);
  qrTimerId = null;
}

function resetQrLoading() {
  window.clearTimeout(qrTimerId);
  qrTimerId = null;
  currentPixCode = "";
  pixField.value = "";
  qrCode.classList.add("is-loading");
  qrCode.classList.remove("has-error");
  qrCodeImage.hidden = true;
  qrCodeImage.removeAttribute("src");
  pixError.hidden = true;
  pixError.textContent = "";
}

function normalizeQrImageSource(value) {
  if (!value) return "";
  const source = String(value).trim();

  if (source.startsWith("data:image") || source.startsWith("http://") || source.startsWith("https://")) {
    return source;
  }

  return `data:image/png;base64,${source}`;
}

function buildQrImageSourceFromPixCode(pixCode) {
  if (!pixCode) return "";

  return `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=8&data=${encodeURIComponent(pixCode)}`;
}

function showPixError(message) {
  currentPixCode = "";
  pixField.value = "";
  qrCode.classList.remove("is-loading");
  qrCode.classList.add("has-error");
  qrCodeImage.hidden = true;
  qrCodeImage.removeAttribute("src");
  pixError.textContent = message;
  pixError.hidden = false;
  window.clearInterval(pixTimerId);
  pixTimerId = null;
  pixExpiresAt = null;
  pixTimer.textContent = "--:--:--";
}

function applyPixPayment(payment) {
  const copyPaste = payment.pix_code || payment.copy_paste || payment.qr_code || payment.copyPaste;
  const qrImageSource = normalizeQrImageSource(
    payment.qr_code_base64 || payment.qrCodeBase64 || payment.qr_code_url || payment.qrCodeUrl
  ) || buildQrImageSourceFromPixCode(copyPaste);

  if (!copyPaste) {
    throw new Error("A gateway não retornou o código Pix.");
  }

  currentPixCode = copyPaste;
  pixField.value = copyPaste;
  qrCodeImage.src = qrImageSource;
  qrCodeImage.hidden = false;
  qrCode.classList.remove("is-loading", "has-error");
  pixError.hidden = true;
  pixError.textContent = "";
  startPixTimer();
}

function formatDuration(totalSeconds) {
  const seconds = Math.max(0, totalSeconds);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  return [hours, minutes, remainingSeconds]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
}

function updatePixTimer() {
  if (!pixExpiresAt) {
    pixTimer.textContent = formatDuration(pixExpirationSeconds);
    return;
  }

  const remaining = Math.ceil((pixExpiresAt - Date.now()) / 1000);
  pixTimer.textContent = formatDuration(remaining);

  if (remaining <= 0) {
    window.clearInterval(pixTimerId);
    pixTimerId = null;
  }
}

function startPixTimer() {
  pixExpiresAt = Date.now() + pixExpirationSeconds * 1000;
  window.clearInterval(pixTimerId);
  updatePixTimer();
  pixTimerId = window.setInterval(updatePixTimer, 1000);
}

function resetPixTimer() {
  window.clearInterval(pixTimerId);
  pixTimerId = null;
  pixExpiresAt = null;
  updatePixTimer();
}

function scrollToSection(section, behavior = "smooth") {
  const headerHeight = topbar.hidden ? 0 : topbar.offsetHeight;
  const y = section.getBoundingClientRect().top + window.scrollY - headerHeight;
  window.scrollTo({
    top: Math.max(0, y),
    behavior,
  });
}

function scrollToTop() {
  state.pixMode = false;
  state.paymentReturnOnly = false;
  state.expanded = false;
  render();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function scrollToOrderPreview(behavior = "auto") {
  window.scrollTo({
    top: 0,
    behavior,
  });
}

function setSelected(selected) {
  state.selected = selected;

  if (!selected) {
    state.paymentVisible = false;
    state.pixVisible = false;
    state.pixMode = false;
    state.paymentReturnOnly = false;
    state.expanded = false;
    resetPixTimer();
    resetQrLoading();
  }

  render();
}

function openCheckoutFromFront() {
  if (frontSearch.disabled) return;

  const enteredAt = new Date();
  sessionStorage.setItem(codeStorageKey, normalizeCode(frontCodeInput.value));
  sessionStorage.setItem(codeEnteredAtStorageKey, enteredAt.toISOString());
  updateEnteredCode();
  updateCodeEnteredAt();
  state.frontVisible = false;
  state.selected = false;
  state.paymentVisible = false;
  state.pixVisible = false;
  state.pixMode = false;
  state.paymentReturnOnly = false;
  state.expanded = false;
  resetPixTimer();
  resetQrLoading();
  render();
  window.scrollTo({ top: 0, behavior: "auto" });

  if (!initialParams.has("nopop")) {
    openEntryPop();
  }
}

function continueFlow() {
  if (!state.selected) {
    showToast("Selecione o código para continuar");
    return;
  }

  state.paymentVisible = true;
  state.pixMode = false;
  state.paymentReturnOnly = true;
  state.expanded = false;
  render();

  requestAnimationFrame(() => {
    scrollToSection(paymentSection);
  });
}

async function createPixPayment() {
  const response = await fetch(pixApiEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      code: readEnteredCode(),
    }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || !data || data.success === false) {
    throw new Error(data?.message || "Não foi possível gerar o Pix.");
  }

  return data;
}

async function showPixPayment() {
  if (!state.selected) {
    showToast("Selecione o código para continuar");
    return;
  }

  state.paymentVisible = true;
  state.pixVisible = true;
  state.pixMode = true;
  state.paymentReturnOnly = false;
  state.expanded = false;
  resetPixTimer();
  currentPixCode = "";
  pixField.value = "";
  startQrLoading();
  render();

  requestAnimationFrame(() => {
    scrollToSection(pixSection);
  });

  try {
    const payment = await createPixPayment();
    applyPixPayment(payment);
  } catch (error) {
    showPixError(error.message);
    showToast(error.message);
  }
}

function toggleSheet() {
  if (state.pixMode) {
    scrollToTop();
    return;
  }

  if (state.paymentReturnOnly) {
    scrollToTop();
    return;
  }

  if (!state.selected) return;
  state.expanded = !state.expanded;
  render();
}

async function copyPixCode() {
  if (!currentPixCode) {
    showToast("Gere o Pix primeiro");
    return;
  }

  try {
    await navigator.clipboard.writeText(currentPixCode);
  } catch {
    pixField.select();
    document.execCommand("copy");
    pixField.blur();
  }

  showToast("Código Pix copiado");
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 1800);
}

document.querySelector("[data-toggle-all]").addEventListener("click", () => {
  setSelected(!state.selected);
});

document.querySelector("[data-toggle-ticket]").addEventListener("click", () => {
  setSelected(!state.selected);
});

document.querySelector("[data-toggle-sheet]").addEventListener("click", toggleSheet);

document.querySelector("[data-continue]").addEventListener("click", continueFlow);
document.querySelector("[data-continue-expanded]").addEventListener("click", continueFlow);
document.querySelector("[data-pix-option]").addEventListener("click", showPixPayment);
document.querySelector("[data-copy-pix]").addEventListener("click", copyPixCode);
document.querySelector("[data-close-entry-pop]").addEventListener("click", closeEntryPop);
frontCodeInput.addEventListener("input", () => {
  frontCodeInput.value = frontCodeInput.value.toUpperCase();
  updateFrontButton();
});
frontTerms.addEventListener("change", updateFrontButton);
frontPrivacy.addEventListener("change", updateFrontButton);
frontSearch.addEventListener("click", openCheckoutFromFront);

document.querySelector("[data-back]").addEventListener("click", () => {
  if (state.pixMode) {
    state.pixMode = false;
    state.paymentReturnOnly = true;
    render();
    scrollToSection(paymentSection);
    return;
  }

  if (state.paymentVisible && window.scrollY > 20) {
    scrollToTop();
    return;
  }

  history.back();
});

pixField.value = "";
updateEnteredCode();
updateCodeEnteredAt();
applyInitialHash();
updateFrontButton();
if (!state.frontVisible && !initialParams.has("nopop")) {
  openEntryPop();
}
if (state.pixVisible) {
  startQrLoading();
} else {
  updatePixTimer();
  resetQrLoading();
}
render();

if (window.location.hash.includes("lower")) {
  state.paymentVisible = true;
  state.pixVisible = true;
  state.pixMode = true;
  state.paymentReturnOnly = false;
  startQrLoading();
  render();
  window.setTimeout(() => {
    window.scrollTo({ top: pixSection.offsetTop + 499, behavior: "instant" });
  }, 20);
} else if (window.location.hash.includes("list")) {
  window.setTimeout(() => {
    scrollToOrderPreview();
  }, 20);
} else if (state.pixMode) {
  window.setTimeout(() => {
    scrollToSection(pixSection, "instant");
  }, 20);
} else if (state.paymentVisible) {
  window.setTimeout(() => {
    scrollToSection(paymentSection, "instant");
  }, 20);
}
