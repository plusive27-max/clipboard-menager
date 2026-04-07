let allHistory = [];
let activeTab = "all";
let searchTerm = "";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function timeAgo(isoString) {
  const diff = Date.now() - new Date(isoString).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Render ───────────────────────────────────────────────────────────────────
function renderList() {
  const list = document.getElementById("clip-list");
  const empty = document.getElementById("empty-state");

  let items = allHistory;

  // Filter by tab
  if (activeTab === "pinned") {
    items = items.filter(i => i.pinned);
  }

  // Filter by search
  if (searchTerm) {
    items = items.filter(i =>
      i.text.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }

  // Clear existing items (keep empty state node)
  [...list.querySelectorAll(".clip-item")].forEach(el => el.remove());

  if (!items.length) {
    empty.style.display = "flex";
    empty.querySelector("p").textContent =
      searchTerm ? "No clips match your search" :
      activeTab === "pinned" ? "No pinned clips yet" :
      "Copy something to get started";
    return;
  }

  empty.style.display = "none";

  items.forEach(item => {
    const el = document.createElement("div");
    el.className = "clip-item" + (item.pinned ? " pinned" : "");
    el.dataset.id = item.id;

    el.innerHTML = `
      <div class="clip-content">
        <div class="clip-text">${escapeHtml(item.text)}</div>
        <div class="clip-meta">${timeAgo(item.timestamp)}</div>
      </div>
      <div class="clip-actions">
        <button class="pin-btn ${item.pinned ? "active" : ""}" title="${item.pinned ? "Unpin" : "Pin"}">📌</button>
        <button class="copy-btn" title="Copy">📋</button>
        <button class="del-btn" title="Delete">✕</button>
      </div>
    `;

    // Click row → copy
    el.addEventListener("click", (e) => {
      if (e.target.closest(".clip-actions")) return;
      copyItem(item.id, el);
    });

    // Copy button
    el.querySelector(".copy-btn").addEventListener("click", () => {
      copyItem(item.id, el);
    });

    // Pin button
    el.querySelector(".pin-btn").addEventListener("click", () => {
      window.clipboardAPI.pinItem(item.id);
    });

    // Delete button
    el.querySelector(".del-btn").addEventListener("click", () => {
      window.clipboardAPI.deleteItem(item.id);
    });

    list.appendChild(el);
  });
}

function copyItem(id, el) {
  window.clipboardAPI.copyItem(id);
  el.classList.add("copied");
  setTimeout(() => el.classList.remove("copied"), 600);
}

// ─── Events ───────────────────────────────────────────────────────────────────
document.getElementById("search").addEventListener("input", e => {
  searchTerm = e.target.value;
  renderList();
});

document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    activeTab = btn.dataset.tab;
    renderList();
  });
});

document.getElementById("clear-btn").addEventListener("click", () => {
  if (confirm("Clear all unpinned clips?")) {
    window.clipboardAPI.clearHistory();
  }
});

document.getElementById("close-btn").addEventListener("click", () => {
  window.clipboardAPI.hideWindow();  // ✅ Just hides it
});

// ─── IPC ──────────────────────────────────────────────────────────────────────
window.clipboardAPI.onHistoryUpdated(data => {
  allHistory = data;
  renderList();
});

// Ask for history on load
window.clipboardAPI.requestHistory();