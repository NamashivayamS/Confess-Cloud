const urlParams = new URLSearchParams(window.location.search);
const adminKey = urlParams.get("admin");
const isAdmin = adminKey === 'CIT_ADMIN_98765';

let activeConfessionId = null;
let selectedTag = "General";
let allConfessions = []; // Cache for filtering

/* ---------- VIEW TOGGLE ---------- */

function showBubbleView() {
    document.getElementById("bubble-container").style.display = "block";
    document.getElementById("list-container").style.display = "none";
    document.body.classList.remove("feed-active");

    // Update Active Buttons
    document.getElementById("btnBubble").classList.add("active");
    document.getElementById("btnList").classList.remove("active");
}

function showListView() {
    document.getElementById("bubble-container").style.display = "none";
    document.getElementById("list-container").style.display = "block";
    document.body.classList.add("feed-active");

    // Update Active Buttons
    document.getElementById("btnList").classList.add("active");
    document.getElementById("btnBubble").classList.remove("active");

    loadList("latest");
}

/* ---------- THEME TOGGLE ---------- */
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute("data-theme");
    const newTheme = currentTheme === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme);
}

// Init Theme
const savedTheme = localStorage.getItem("theme") || "dark";
document.documentElement.setAttribute("data-theme", savedTheme);

/* ---------- TAG SELECTION ---------- */
function selectTag(element) {
    document.querySelectorAll(".tag-chip").forEach(c => c.classList.remove("active"));
    element.classList.add("active");
    selectedTag = element.innerText;
}

/* ---------- FORM TOGGLE ---------- */
function toggleForm() {
    const form = document.getElementById("form-container");
    const btn = document.getElementById("formToggleBtn");

    form.classList.toggle("active");

    if (form.classList.contains("active")) {
        btn.innerHTML = "❌ Close Form";
        btn.classList.add("active");
    } else {
        btn.innerHTML = "✍️ Make a Confession";
        btn.classList.remove("active");
    }
}

/* ---------- CONFESSION ---------- */

function submitConfession() {
    const confession = document.getElementById("confessionText").value;
    const author = document.getElementById("authorName").value;          // hidden
    const display_name = document.getElementById("displayName").value;   // public

    if (!confession || !author || !display_name) {
        alert("Please fill in all fields to share your confession.");
        return;
    }

    const fingerprint = `${navigator.userAgent} | ${navigator.language} | ${screen.width}x${screen.height} | ${Intl.DateTimeFormat().resolvedOptions().timeZone}`;

    fetch("/add_confession", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confession, author, display_name, tag: selectedTag, fingerprint })
    }).then(res => {
        if (res.status === 429) {
            return res.json().then(data => { throw new Error(data.error) });
        }
        return res.json();
    }).then(() => {
        // location.reload() // Don't reload, just reset and close
        document.getElementById("confessionText").value = "";

        // If mobile (check if toggle btn is visible/active logic, or just always try to close)
        const form = document.getElementById("form-container");
        if (form.classList.contains("active")) {
            toggleForm(); // Close it
        }

        // Refresh bubbles
        if (document.getElementById("bubble-container").style.display !== "none") {
            loadBubbles();
        } else {
            loadList("latest");
        }

        // Optional: show thank you msg
        alert("Confession floating in the cloud! ☁️");
    }).catch(err => {
        alert(err.message);
    });
}

/* ---------- LIKES ---------- */

function likeConfession(id) {
    fetch(`/like/${id}`, { method: "POST" })
        .then(res => res.json())
        .then(data => {
            if (data.error) alert(data.error);
            // Refresh current view only
            if (document.getElementById("bubble-container").style.display !== "none") {
                loadBubbles();
            } else {
                loadList("latest"); // Or keep current filter... for now default to latest
            }
        });
}

/* ---------- COMMENTS (MODAL for BUBBLES) ---------- */

function openComments(id, text, author) {
    activeConfessionId = id;
    document.getElementById("commentModal").style.display = "block";

    // Set text and author
    const textField = document.getElementById("modalConfessionText");
    textField.innerHTML = ""; // Clear existing

    // Author
    if (author) {
        const authorDiv = document.createElement("div");
        authorDiv.className = "modal-author";
        authorDiv.innerText = author;
        textField.appendChild(authorDiv);
    }

    // Text
    if (text) {
        const quote = document.createElement("div");
        quote.className = "modal-quote";
        quote.innerText = `"${text}"`;
        textField.appendChild(quote);
    }

    loadComments();
}

function closeComments() {
    document.getElementById("commentModal").style.display = "none";
}

function loadComments() {
    fetch(`/get_comments/${activeConfessionId}`)
        .then(res => res.json())
        .then(data => {
            const list = document.getElementById("commentsList");
            list.innerHTML = "";

            if (data.length === 0) {
                list.innerHTML = "<div style='text-align:center; opacity:0.5; padding:20px;'>No thoughts yet. Be the first.</div>";
                return;
            }

            data.forEach(c => {
                const div = document.createElement("div");
                div.className = "comment-item";
                div.innerHTML = `
                    <div class="comment-content">
                        <strong class="comment-author">${c.display_name || 'Anonymous'}</strong>
                        <p>${c.text}</p>
                    </div>
                    ${adminKey ? `<button class="delete-comment-btn" onclick="deleteComment('${c.id}')">🗑</button>` : ""}
                `;
                list.appendChild(div);
            });
        });
}

function deleteComment(commentId) {
    if (!confirm("Delete this comment?")) return;

    fetch(`/delete_comment/${commentId}?key=${adminKey}`, { method: "DELETE" })
        .then(() => loadComments());
}

function postComment() {
    const comment = document.getElementById("commentInput").value;
    const display_name = document.getElementById("commentNameInput").value;
    if (!comment) return;

    fetch(`/add_comment/${activeConfessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment, display_name })
    }).then(() => {
        document.getElementById("commentInput").value = "";
        // Optional: clear name as well? Usually keep it for convenience
        loadComments();
        // Refresh counts in background
        loadBubbles();
    });
}

/* ---------- BUBBLE VIEW ---------- */

function loadBubbles() {
    fetch("/get_confessions")
        .then(res => res.json())
        .then(data => {
            allConfessions = data; // Cache

            // SMART SELECTION (Limit 40)
            if (data.length > 40) {
                // 1. 15 Most Recent
                const recent = [...data].reverse().slice(0, 15);

                // 2. 15 Trending (Top Interacted)
                const trending = [...data].sort((a, b) => (b.likes + b.comment_count) - (a.likes + a.comment_count)).slice(0, 15);

                // 3. 10 Random Discoveries
                const remaining = data.filter(c => !recent.find(r => r.id === c.id) && !trending.find(t => t.id === c.id));
                const random = remaining.sort(() => 0.5 - Math.random()).slice(0, 10);

                // Merge and unique
                const merged = [...recent, ...trending, ...random];
                const uniqueIds = new Set();
                const limited = merged.filter(c => {
                    if (uniqueIds.has(c.id)) return false;
                    uniqueIds.add(c.id);
                    return true;
                });

                renderBubbles(limited);
            } else {
                renderBubbles(data);
            }
        });
}

function renderBubbles(data) {
    const container = document.getElementById("bubble-container");
    container.innerHTML = "";
    if (window.bubbleSystem) window.bubbleSystem.clear();

    data.forEach(c => {
        const bubble = document.createElement("div");
        bubble.className = "bubble";

        // Size based on likes, clamped
        const isMobile = window.innerWidth < 768;
        const baseSize = isMobile ? 70 : 120; // Slightly smaller base
        const interactionWeight = c.likes + (c.comment_count * 2);
        const sizeIncrement = Math.min(interactionWeight * 4, 80); // Clamp growth
        const size = baseSize + sizeIncrement;

        bubble.style.width = size + "px";
        bubble.style.height = size + "px";

        bubble.innerHTML = `
            <div class="card-tag" style="margin-bottom: 5px; opacity: 0.8;">${c.tag}</div>
            <div class="confession-text">"${c.confession}"</div>
            <small>— ${c.display_name}</small>
            <div class="actions">
                <button onclick="event.stopPropagation(); likeConfession('${c.id}')">❤️ ${c.likes}</button>
                <button onclick="event.stopPropagation(); openComments('${c.id}', \`${c.confession.replace(/`/g, "\\`")}\`, \`${c.display_name.replace(/`/g, "\\`")}\`)">💬 ${c.comment_count}</button>
                ${isAdmin ? `
                    <button onclick="event.stopPropagation(); deleteConfession('${c.id}')">🗑</button>
                ` : `
                    <button onclick="event.stopPropagation(); shareConfession('${c.id}', '${c.display_name}')">🔗</button>
                `}
            </div>
        `;

        bubble.onclick = () => openComments(c.id, c.confession, c.display_name);
        container.appendChild(bubble);
        if (window.bubbleSystem) window.bubbleSystem.add(bubble);
    });
}

/* ---------- LIST VIEW ---------- */

function loadList(mode) {
    // Update toggle buttons for list filter
    const buttons = document.querySelectorAll('.list-header .filter-btn');
    buttons.forEach(b => b.classList.remove('active'));
    if (mode === 'latest') buttons[0].classList.add('active');
    else buttons[1].classList.add('active');

    fetch("/get_confessions")
        .then(res => res.json())
        .then(data => {
            allConfessions = data;
            if (mode === "latest") data.reverse();
            else data.sort((a, b) => b.likes - a.likes);

            renderList(data);
        });
}

function renderList(data) {
    const list = document.getElementById("confession-list");
    list.innerHTML = "";

    data.forEach(c => {
        const card = document.createElement("div");
        card.className = "confession-card";
        card.onclick = () => openComments(c.id, c.confession, c.display_name);

        card.innerHTML = `
            <div class="card-header">
                <span class="card-author">${c.display_name}</span>
                <span class="card-tag">${c.tag}</span>
            </div>
            <div class="card-body">"${c.confession}"</div>
            <div class="card-footer">
                <button class="card-action-btn" onclick="event.stopPropagation(); likeConfession('${c.id}')">❤️ ${c.likes}</button>
                <button class="card-action-btn" onclick="event.stopPropagation(); openComments('${c.id}', \`${c.confession.replace(/`/g, "\\`")}\`, \`${c.display_name.replace(/`/g, "\\`")}\`)">💬 ${c.comment_count}</button>
                <button class="card-action-btn" onclick="event.stopPropagation(); shareConfession('${c.id}', '${c.display_name}')">🔗</button>
                ${isAdmin ? `<button class="card-action-btn delete" onclick="event.stopPropagation(); deleteConfession('${c.id}')">🗑</button>` : ""}
            </div>
        `;
        list.appendChild(card);
    });
}


/* ---------- SEARCH & FILTER ---------- */
let currentFilterTag = "All";

function filterByTag(tag) {
    currentFilterTag = tag;
    document.querySelectorAll(".filter-tag").forEach(b => b.classList.remove("active"));
    event.target.classList.add("active");
    filterConfessions();
}

function filterConfessions() {
    const query = document.getElementById("searchInput").value.toLowerCase();
    const filtered = allConfessions.filter(c => {
        const matchesSearch = c.confession.toLowerCase().includes(query) ||
            c.display_name.toLowerCase().includes(query);
        const matchesTag = currentFilterTag === "All" || c.tag === currentFilterTag;
        return matchesSearch && matchesTag;
    });

    if (document.getElementById("bubble-container").style.display !== "none") {
        renderBubbles(filtered);
    } else {
        renderList(filtered);
    }
}

/* ---------- SHARING ---------- */
function shareConfession(id, author) {
    const url = `${window.location.origin}/?id=${id}`;
    if (navigator.share) {
        navigator.share({
            title: `Confession by ${author}`,
            text: `Check out this confession on CIT Confess Cloud!`,
            url: url
        });
    } else {
        navigator.clipboard.writeText(url).then(() => {
            alert("Sharable link copied to clipboard! 🔗");
        });
    }
}

/* ---------- ADMIN DELETE ---------- */

async function deleteConfession(id) {
    const confirmDelete = confirm('Delete this confession?');
    if (!confirmDelete) return;

    const res = await fetch('/api/admin/delete-confession', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            id,
            adminKey: 'CIT_ADMIN_98765'
        })
    });

    const data = await res.json();

    if (!res.ok) {
        alert(data.error || 'Failed to delete');
        return;
    }

    location.reload();
}

/* ---------- INIT ---------- */

window.onload = () => {
    showBubbleView();

    // Initial Load
    fetch("/get_confessions")
        .then(res => res.json())
        .then(data => {
            allConfessions = data;
            renderBubbles(data);

            // Deep Linking Check
            const urlId = urlParams.get("id");
            if (urlId) {
                const conf = data.find(c => c.id == urlId);
                if (conf) openComments(conf.id, conf.confession);
            }
        });
};
