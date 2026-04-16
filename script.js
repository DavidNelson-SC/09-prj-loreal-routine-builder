/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const productSearch = document.getElementById("productSearch");
const rtlToggle = document.getElementById("rtlToggle");
const webSearchToggle = document.getElementById("webSearchToggle");
const productsContainer = document.getElementById("productsContainer");
const selectedProductsList = document.getElementById("selectedProductsList");
const generateRoutineBtn = document.getElementById("generateRoutine");
const clearSelectionsBtn = document.getElementById("clearSelections");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const userInput = document.getElementById("userInput");
const sendBtn = document.getElementById("sendBtn");
const assistantStatus = document.getElementById("assistantStatus");

/* App state */
let allProducts = [];
let selectedProductIds = [];
let currentCategory = "";
let searchTerm = "";
let conversationHistory = [];
let hasGeneratedRoutine = false;

const STORAGE_KEY = "lorealSelectedProducts";
const RTL_STORAGE_KEY = "lorealRtlMode";

/* Your Cloudflare Worker endpoint: add this in secrets.js as WORKER_URL */
const workerUrl = window.WORKER_URL || window.workerUrl || "";

/* Show initial placeholder until user starts browsing */
productsContainer.innerHTML = `
  <div class="placeholder-message">
    Choose a category or type in search to explore products.
  </div>
`;

/* Chat welcome message */
appendChatMessage(
  "assistant",
  "Select products, click Generate Routine, then ask follow-up beauty questions.",
);

/* Load product data from JSON file */
async function loadProducts() {
  const response = await fetch("products.json");
  const data = await response.json();
  return data.products;
}

/* Read selected product IDs from localStorage */
function loadSavedSelections() {
  const saved = localStorage.getItem(STORAGE_KEY);

  if (!saved) {
    selectedProductIds = [];
    return;
  }

  try {
    const parsed = JSON.parse(saved);
    selectedProductIds = Array.isArray(parsed)
      ? parsed.map((id) => Number(id)).filter((id) => Number.isInteger(id))
      : [];
  } catch (error) {
    selectedProductIds = [];
  }
}

/* Save selected product IDs so they persist on refresh */
function saveSelections() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(selectedProductIds));
}

/* Apply RTL/LTR mode to the whole page and persist preference */
function applyRtlMode(isRtl) {
  document.documentElement.dir = isRtl ? "rtl" : "ltr";
  rtlToggle.setAttribute("aria-pressed", String(isRtl));
  rtlToggle.textContent = isRtl ? "Switch to LTR" : "Switch to RTL";
  localStorage.setItem(RTL_STORAGE_KEY, isRtl ? "rtl" : "ltr");
}

/* Load saved RTL preference */
function loadRtlMode() {
  const savedMode = localStorage.getItem(RTL_STORAGE_KEY);
  applyRtlMode(savedMode === "rtl");
}

/* Turn category text into cleaner display labels */
function toDisplayCategory(category) {
  if (!category) {
    return "General";
  }

  return category
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/* Check if a product matches the current keyword search */
function matchesSearch(product, keyword) {
  if (!keyword) {
    return true;
  }

  const searchableText =
    `${product.name} ${product.brand} ${product.category} ${product.description}`.toLowerCase();
  return searchableText.includes(keyword.toLowerCase());
}

/* Build filtered products using category + keyword search */
function getFilteredProducts() {
  return allProducts.filter((product) => {
    const categoryMatch = currentCategory
      ? product.category === currentCategory
      : true;
    const keywordMatch = matchesSearch(product, searchTerm);
    return categoryMatch && keywordMatch;
  });
}

/* Create HTML for displaying product cards */
function displayProducts(products) {
  if (!products.length) {
    productsContainer.innerHTML = `
      <div class="placeholder-message">
        No products match your current filters.
      </div>
    `;
    return;
  }

  productsContainer.innerHTML = products
    .map((product) => {
      const isSelected = selectedProductIds.includes(product.id);

      return `
        <article class="product-card ${isSelected ? "selected" : ""}" data-id="${product.id}" role="button" tabindex="0" aria-pressed="${isSelected}">
          <img src="${product.image}" alt="${product.name}">
          <div class="product-info">
            <h3>${product.name}</h3>
            <p class="product-brand">${product.brand}</p>
            <p class="product-category">${toDisplayCategory(product.category)}</p>
            <button class="description-toggle" type="button" data-action="toggle-description" aria-expanded="false">
              Show details
            </button>
            <div class="product-description" hidden>
              ${product.description}
            </div>
          </div>
        </article>
      `;
    })
    .join("");

  applyCardRevealAnimation();
}

/* Add a staggered reveal animation to product cards */
function applyCardRevealAnimation() {
  const cards = productsContainer.querySelectorAll(".product-card");

  cards.forEach((card, index) => {
    card.style.animationDelay = `${index * 55}ms`;
    card.classList.add("card-reveal");
  });
}

/* Render products from current category/search filters */
function renderCurrentProducts() {
  if (!currentCategory && !searchTerm) {
    productsContainer.innerHTML = `
      <div class="placeholder-message">
        Choose a category or type in search to explore products.
      </div>
    `;
    return;
  }

  const filteredProducts = getFilteredProducts();
  displayProducts(filteredProducts);
}

/* Update selected products area */
function renderSelectedProducts() {
  const selectedProducts = allProducts.filter((product) =>
    selectedProductIds.includes(product.id),
  );

  if (!selectedProducts.length) {
    selectedProductsList.innerHTML = `
      <p class="empty-selected">No products selected yet.</p>
    `;
    clearSelectionsBtn.disabled = true;
    return;
  }

  selectedProductsList.innerHTML = selectedProducts
    .map(
      (product) => `
        <div class="selected-item">
          <div>
            <h4>${product.name}</h4>
            <p>${product.brand} • ${toDisplayCategory(product.category)}</p>
          </div>
          <button type="button" data-remove-id="${product.id}" aria-label="Remove ${product.name}">
            Remove
          </button>
        </div>
      `,
    )
    .join("");

  clearSelectionsBtn.disabled = false;
}

/* Toggle one product in/out of selected list */
function toggleProductSelection(productId) {
  if (selectedProductIds.includes(productId)) {
    selectedProductIds = selectedProductIds.filter((id) => id !== productId);
  } else {
    selectedProductIds.push(productId);
  }

  saveSelections();
  renderSelectedProducts();
  renderCurrentProducts();
}

/* Build selected product payload for routine generation */
function getSelectedProductPayload() {
  return allProducts
    .filter((product) => selectedProductIds.includes(product.id))
    .map((product) => ({
      id: product.id,
      name: product.name,
      brand: product.brand,
      category: product.category,
      description: product.description,
    }));
}

/* Add one message bubble to chat window */
function appendChatMessage(role, text) {
  const safeRole = role === "user" ? "user" : "assistant";
  const messageElement = document.createElement("div");
  messageElement.className = `chat-message ${safeRole}`;
  messageElement.textContent = text;
  chatWindow.appendChild(messageElement);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

/* Show/remove typing indicator while waiting for Worker response */
function showTypingIndicator() {
  const typingElement = document.createElement("div");
  typingElement.className = "chat-message assistant typing-indicator";
  typingElement.innerHTML = "<span></span><span></span><span></span>";
  chatWindow.appendChild(typingElement);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return typingElement;
}

function removeTypingIndicator(typingElement) {
  if (typingElement && typingElement.parentElement) {
    typingElement.remove();
  }
}

/* Show Worker and web-search mode status in the chat area */
function updateAssistantStatus() {
  const workerConfigured = Boolean(workerUrl);
  const webSearchEnabled = webSearchToggle.checked;

  assistantStatus.innerHTML = `
    <span class="status-chip ${workerConfigured ? "ok" : "warn"}">
      Worker: ${workerConfigured ? "Connected" : "Not configured"}
    </span>
    <span class="status-chip ${webSearchEnabled ? "ok" : "muted"}">
      Web Search: ${webSearchEnabled ? "On" : "Off"}
    </span>
  `;
}

/* Format citations/links from Worker for display in chat */
function formatAssistantReply(text, citations) {
  if (!citations || !citations.length) {
    return text;
  }

  const sourcesBlock = citations
    .map((citation, index) => {
      const label = citation.title || `Source ${index + 1}`;
      const url = citation.url || "";
      return `${index + 1}. ${label}${url ? `: ${url}` : ""}`;
    })
    .join("\n");

  return `${text}\n\nSources:\n${sourcesBlock}`;
}

/* Send chat messages to Cloudflare Worker */
async function callWorker(messages, useWebSearch) {
  if (!workerUrl) {
    throw new Error("Worker URL not found. Add WORKER_URL in secrets.js.");
  }

  const response = await fetch(workerUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages,
      useWebSearch,
    }),
  });

  if (!response.ok) {
    throw new Error(`Worker request failed with status ${response.status}`);
  }

  return response.json();
}

/* Build and generate routine from selected products */
async function generateRoutine() {
  const selectedProducts = getSelectedProductPayload();

  if (!selectedProducts.length) {
    appendChatMessage(
      "assistant",
      "Please select at least one product before generating a routine.",
    );
    return;
  }

  generateRoutineBtn.disabled = true;
  generateRoutineBtn.textContent = "Generating...";

  const systemMessage = {
    role: "system",
    content:
      "You are a helpful L'Oreal beauty advisor. Build safe, beginner-friendly routines. Only answer questions about the generated routine, skincare, haircare, makeup, fragrance, and closely related beauty topics. If a question is unrelated, politely refuse and redirect to beauty topics.",
  };

  const userMessage = {
    role: "user",
    content: `Create a personalized routine based on these selected products: ${JSON.stringify(
      selectedProducts,
      null,
      2,
    )}. Include a clear morning/evening or usage order, why each product fits, and simple tips.`,
  };

  const typingIndicator = showTypingIndicator();

  try {
    const data = await callWorker(
      [systemMessage, userMessage],
      webSearchToggle.checked,
    );
    const routineText = formatAssistantReply(data.reply, data.citations);

    hasGeneratedRoutine = true;
    conversationHistory = [
      systemMessage,
      userMessage,
      { role: "assistant", content: routineText },
    ];

    removeTypingIndicator(typingIndicator);
    appendChatMessage("assistant", routineText);
  } catch (error) {
    removeTypingIndicator(typingIndicator);
    appendChatMessage("assistant", `Error: ${error.message}`);
  } finally {
    generateRoutineBtn.disabled = false;
    generateRoutineBtn.innerHTML =
      '<i class="fa-solid fa-wand-magic-sparkles"></i> Generate Routine';
  }
}

/* Category filter change */
categoryFilter.addEventListener("change", (event) => {
  currentCategory = event.target.value;
  renderCurrentProducts();
});

/* Keyword product search as user types */
productSearch.addEventListener("input", (event) => {
  searchTerm = event.target.value.trim();
  renderCurrentProducts();
});

webSearchToggle.addEventListener("change", updateAssistantStatus);

/* RTL toggle button */
rtlToggle.addEventListener("click", () => {
  const isCurrentlyRtl = document.documentElement.dir === "rtl";
  applyRtlMode(!isCurrentlyRtl);
});

/* Product card interactions */
productsContainer.addEventListener("click", (event) => {
  const toggleButton = event.target.closest(
    '[data-action="toggle-description"]',
  );

  if (toggleButton) {
    const card = toggleButton.closest(".product-card");
    const description = card.querySelector(".product-description");
    const isExpanded = toggleButton.getAttribute("aria-expanded") === "true";

    toggleButton.setAttribute("aria-expanded", String(!isExpanded));
    toggleButton.textContent = isExpanded ? "Show details" : "Hide details";
    description.hidden = isExpanded;
    return;
  }

  const card = event.target.closest(".product-card");

  if (!card) {
    return;
  }

  toggleProductSelection(Number(card.dataset.id));
});

/* Keyboard support for card selection */
productsContainer.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }

  if (event.target.closest("button")) {
    return;
  }

  const card = event.target.closest(".product-card");

  if (!card) {
    return;
  }

  event.preventDefault();
  toggleProductSelection(Number(card.dataset.id));
});

/* Remove one selected product from selected list */
selectedProductsList.addEventListener("click", (event) => {
  const removeButton = event.target.closest("button[data-remove-id]");

  if (!removeButton) {
    return;
  }

  const productId = Number(removeButton.dataset.removeId);
  selectedProductIds = selectedProductIds.filter((id) => id !== productId);
  saveSelections();
  renderSelectedProducts();
  renderCurrentProducts();
});

/* Clear all selected products */
clearSelectionsBtn.addEventListener("click", () => {
  selectedProductIds = [];
  saveSelections();
  renderSelectedProducts();
  renderCurrentProducts();
});

/* Generate routine button */
generateRoutineBtn.addEventListener("click", generateRoutine);

/* Follow-up chat with full conversation history */
chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const messageText = userInput.value.trim();

  if (!messageText) {
    return;
  }

  appendChatMessage("user", messageText);
  userInput.value = "";

  if (!hasGeneratedRoutine) {
    appendChatMessage(
      "assistant",
      "Generate a routine first, then I can answer follow-up questions.",
    );
    return;
  }

  sendBtn.disabled = true;
  const typingIndicator = showTypingIndicator();

  try {
    conversationHistory.push({ role: "user", content: messageText });
    const data = await callWorker(conversationHistory, webSearchToggle.checked);
    const assistantText = formatAssistantReply(data.reply, data.citations);

    conversationHistory.push({ role: "assistant", content: assistantText });
    removeTypingIndicator(typingIndicator);
    appendChatMessage("assistant", assistantText);
  } catch (error) {
    removeTypingIndicator(typingIndicator);
    appendChatMessage("assistant", `Error: ${error.message}`);
  } finally {
    sendBtn.disabled = false;
  }
});

/* App startup */
async function init() {
  allProducts = await loadProducts();
  loadSavedSelections();
  loadRtlMode();
  renderSelectedProducts();
  renderCurrentProducts();
  updateAssistantStatus();
}

init();
