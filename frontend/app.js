/*
 * Flashwise frontend. The browser talks only to the Express API.
 * Set API_BASE_URL only if your backend runs on a different origin.
 */
const API_BASE_URL = "";
const $ = (selector) => document.querySelector(selector);
const form = $("#cardForm");
const cardsList = $("#cardsList");
const emptyState = $("#emptyState");
const notice = $("#notice");
const studyDialog = $("#studyDialog");
let cards = [];
let studyCards = [];
let studyIndex = 0;
let answerVisible = false;
let noticeTimeout;

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}/api${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
  return payload;
}

function showNotice(message, isError = false) {
  notice.textContent = message;
  notice.classList.toggle("error", isError);
  notice.classList.remove("hidden");
  clearTimeout(noticeTimeout);
  noticeTimeout = setTimeout(() => notice.classList.add("hidden"), 4000);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function visibleCards() {
  const search = $("#searchInput").value.trim().toLowerCase();
  const category = $("#categoryFilter").value;
  const status = $("#statusFilter").value;
  return cards.filter((card) => {
    const matchesSearch = `${card.question} ${card.answer} ${card.category}`.toLowerCase().includes(search);
    return matchesSearch && (!category || card.category === category) &&
      (!status || (status === "known" ? card.known : !card.known));
  });
}

function render() {
  $("#totalCards").textContent = cards.length;
  $("#knownCards").textContent = cards.filter((card) => card.known).length;
  $("#reviewCards").textContent = cards.filter((card) => !card.known).length;

  const currentCategory = $("#categoryFilter").value;
  const categories = [...new Set(cards.map((card) => card.category).filter(Boolean))].sort();
  $("#categoryFilter").innerHTML = '<option value="">All subjects</option>' +
    categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("");
  if (categories.includes(currentCategory)) $("#categoryFilter").value = currentCategory;

  const filtered = visibleCards();
  cardsList.innerHTML = filtered.map((card) => `
    <article class="flashcard-row">
      <div class="card-row-top">
        <span class="category-chip">${escapeHtml(card.category || "General")}</span>
        <span class="status-chip ${card.known ? "" : "review"}">${card.known ? "✓ Known" : "↻ To review"}</span>
      </div>
      <h3>${escapeHtml(card.question)}</h3>
      <p class="answer-preview">${escapeHtml(card.answer)}</p>
      <div class="row-actions">
        <button class="text-button" data-action="study" data-id="${card.id}">Study ↗</button>
        <button class="text-button" data-action="edit" data-id="${card.id}">Edit</button>
        <button class="text-button delete" data-action="delete" data-id="${card.id}">Delete</button>
        <span class="difficulty">${escapeHtml(card.difficulty)}</span>
      </div>
    </article>`).join("");
  emptyState.classList.toggle("hidden", filtered.length > 0);
  if (cards.length > 0 && filtered.length === 0) {
    emptyState.classList.remove("hidden");
    emptyState.querySelector("h3").textContent = "No matching cards";
    emptyState.querySelector("p").textContent = "Try a different search or filter.";
    $("#emptyAddBtn").classList.add("hidden");
  } else {
    emptyState.querySelector("h3").textContent = "Your first card starts here";
    emptyState.querySelector("p").textContent = "Add a question and answer, then test what you remember.";
    $("#emptyAddBtn").classList.remove("hidden");
  }
}

async function loadCards() {
  try {
    const result = await api("/cards");
    cards = result.data;
    $("#connectionLabel").textContent = "Connected to Supabase";
    render();
  } catch (error) {
    $("#connectionLabel").textContent = "Backend connection issue";
    showNotice(`${error.message}. Start the backend and check your Supabase configuration.`, true);
    cardsList.innerHTML = "";
    emptyState.classList.remove("hidden");
    emptyState.querySelector("h3").textContent = "Can't load your cards yet";
    emptyState.querySelector("p").textContent = "Start the server and configure Supabase, then refresh this page.";
    $("#emptyAddBtn").classList.add("hidden");
  }
}

function openForm(card = null) {
  form.classList.remove("hidden");
  $("#formTitle").textContent = card ? "Edit flashcard" : "Create a flashcard";
  $("#editingId").value = card ? card.id : "";
  $("#question").value = card ? card.question : "";
  $("#answer").value = card ? card.answer : "";
  $("#category").value = card ? card.category : "";
  $("#difficulty").value = card ? card.difficulty : "Medium";
  $("#formError").textContent = "";
  form.scrollIntoView({ behavior: "smooth", block: "start" });
  $("#question").focus();
}
function closeForm() { form.classList.add("hidden"); form.reset(); $("#editingId").value = ""; }

$("#showFormBtn").addEventListener("click", () => openForm());
$("#emptyAddBtn").addEventListener("click", () => openForm());
$("#cancelFormBtn").addEventListener("click", closeForm);
$("#cancelFormBottom").addEventListener("click", closeForm);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const id = $("#editingId").value;
  const body = {
    question: $("#question").value.trim(),
    answer: $("#answer").value.trim(),
    category: $("#category").value.trim() || "General",
    difficulty: $("#difficulty").value
  };
  if (!body.question || !body.answer) {
    $("#formError").textContent = "Please enter both a question and an answer.";
    return;
  }
  try {
    const result = await api(id ? `/cards/${id}` : "/cards", {
      method: id ? "PATCH" : "POST", body: JSON.stringify(body)
    });
    if (id) cards = cards.map((card) => card.id === id ? result.data : card);
    else cards.unshift(result.data);
    closeForm();
    render();
    showNotice(id ? "Flashcard updated successfully." : "Flashcard created successfully.");
  } catch (error) { $("#formError").textContent = error.message; }
});

cardsList.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const card = cards.find((item) => item.id === button.dataset.id);
  if (!card) return;
  if (button.dataset.action === "edit") return openForm(card);
  if (button.dataset.action === "study") return startStudy(cards.filter((item) => item.id === card.id));
  if (button.dataset.action === "delete") {
    if (!window.confirm("Delete this flashcard? This cannot be undone.")) return;
    try {
      await api(`/cards/${card.id}`, { method: "DELETE" });
      cards = cards.filter((item) => item.id !== card.id);
      render();
      showNotice("Flashcard deleted.");
    } catch (error) { showNotice(error.message, true); }
  }
});

$("#searchInput").addEventListener("input", render);
$("#categoryFilter").addEventListener("change", render);
$("#statusFilter").addEventListener("change", render);

function startStudy(source = cards) {
  if (!source.length) { showNotice("Create a flashcard before starting a study session.", true); return; }
  studyCards = [...source];
  studyIndex = 0;
  answerVisible = false;
  showStudyCard();
  studyDialog.showModal();
}
function showStudyCard() {
  const card = studyCards[studyIndex];
  $("#studyProgress").textContent = `CARD ${studyIndex + 1} OF ${studyCards.length}`;
  $("#studySide").textContent = answerVisible ? "ANSWER" : "QUESTION";
  $("#studyText").textContent = answerVisible ? card.answer : card.question;
  $("#flipHint").textContent = answerVisible ? "Take a moment to remember it." : "Click or press Enter to reveal answer ↗";
  $("#flipStudyBtn").textContent = answerVisible ? "Show question" : "Reveal answer";
  $("#prevStudyBtn").disabled = studyIndex === 0;
  $("#nextStudyBtn").disabled = studyIndex === studyCards.length - 1;
  $("#prevStudyBtn").style.opacity = studyIndex === 0 ? ".45" : "1";
  $("#nextStudyBtn").style.opacity = studyIndex === studyCards.length - 1 ? ".45" : "1";
}
function flipStudyCard() { answerVisible = !answerVisible; showStudyCard(); }
$("#startStudyBtn").addEventListener("click", () => startStudy(cards));
$("#closeStudyBtn").addEventListener("click", () => studyDialog.close());
$("#studyCard").addEventListener("click", flipStudyCard);
$("#studyCard").addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") { event.preventDefault(); flipStudyCard(); }
});
$("#flipStudyBtn").addEventListener("click", flipStudyCard);
$("#prevStudyBtn").addEventListener("click", () => { if (studyIndex > 0) { studyIndex--; answerVisible = false; showStudyCard(); } });
$("#nextStudyBtn").addEventListener("click", () => { if (studyIndex < studyCards.length - 1) { studyIndex++; answerVisible = false; showStudyCard(); } });

async function markCurrentCard(known) {
  const card = studyCards[studyIndex];
  try {
    const result = await api(`/cards/${card.id}`, { method: "PATCH", body: JSON.stringify({ known }) });
    cards = cards.map((item) => item.id === card.id ? result.data : item);
    studyCards[studyIndex] = result.data;
    render();
    showNotice(known ? "Marked as known." : "Added to your review list.");
    if (studyIndex < studyCards.length - 1) { studyIndex++; answerVisible = false; showStudyCard(); }
    else { studyDialog.close(); }
  } catch (error) { showNotice(error.message, true); }
}
$("#markReviewBtn").addEventListener("click", () => markCurrentCard(false));
$("#markKnownBtn").addEventListener("click", () => markCurrentCard(true));

loadCards();
