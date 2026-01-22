const urlParams = new URLSearchParams(window.location.search);
const adminKey = urlParams.get("admin");

let activeConfessionId = null;

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

/* ---------- CONFESSION ---------- */

function submitConfession() {
    const confession = document.getElementById("confessionText").value;
    const author = document.getElementById("authorName").value;          // hidden
    const display_name = document.getElementById("displayName").value;   // public

    if (!confession || !author || !display_name) {
        alert("Please fill in all fields to share your confession.");
        return;
    }

    fetch("/add_confession", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confession, author, display_name })
    }).then(() => location.reload());
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

function openComments(id, text) {
    activeConfessionId = id;
    document.getElementById("commentModal").style.display = "block";

    // Set text (handle if text is missing for some reason)
    const textField = document.getElementById("modalConfessionText");
    if (text) textField.innerText = `"${text}"`;
    else textField.innerText = "";

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
                div.textContent = c.text;
                list.appendChild(div);
            });
        });
}

function postComment() {
    const comment = document.getElementById("commentInput").value;
    if (!comment) return;

    fetch(`/add_comment/${activeConfessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment })
    }).then(() => {
        document.getElementById("commentInput").value = "";
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
            const container = document.getElementById("bubble-container");
            container.innerHTML = "";
            if (window.bubbleSystem) window.bubbleSystem.clear();

            data.forEach(c => {
                const bubble = document.createElement("div");
                bubble.className = "bubble";

                // Size based on likes, clamped
                const isMobile = window.innerWidth < 768;
                const baseSize = isMobile ? 80 : 140; // Smaller base on mobile
                const likesFactor = Math.min(c.likes * 5, 100);
                const size = baseSize + likesFactor;

                bubble.style.width = size + "px";
                bubble.style.height = size + "px";

                bubble.innerHTML = `
                    <div class="confession-text">"${c.confession}"</div>
                    <small>— ${c.display_name}</small>
                    <div class="actions">
                        <button onclick="event.stopPropagation(); likeConfession('${c.id}')">❤️ ${c.likes}</button>
                        <button onclick="event.stopPropagation(); openComments('${c.id}', \`${c.confession.replace(/`/g, "\\`")}\`)">💬 ${c.comment_count}</button>
                        ${adminKey ? `<button onclick="event.stopPropagation(); deleteConfession('${c.id}')">🗑</button>` : ""}
                    </div>
                `;

                // Add click to open comments as main action
                bubble.onclick = () => openComments(c.id, c.confession);

                container.appendChild(bubble);
                if (window.bubbleSystem) {
                    window.bubbleSystem.add(bubble);
                }
            });
        });
}

/* ---------- LIST VIEW ---------- */

function loadList(mode) {
    // Update toggle buttons for list filter
    const buttons = document.querySelectorAll('.list-controls .filter-btn');
    buttons.forEach(b => b.classList.remove('active'));
    if (mode === 'latest') buttons[0].classList.add('active');
    else buttons[1].classList.add('active');

    fetch("/get_confessions")
        .then(res => res.json())
        .then(data => {
            if (mode === "latest") {
                data.reverse();
            } else {
                // simple sort logic for trending
                data.sort((a, b) => b.likes - a.likes);
            }

            const list = document.getElementById("confession-list");
            list.innerHTML = "";

            data.forEach(c => {
                const card = document.createElement("div");
                card.className = "confession-card";

                card.innerHTML = `
                    <div style="font-weight:700; color:var(--accent); margin-bottom:5px;">${c.display_name}</div>
                    <div style="font-size:1.1rem; margin-bottom:15px;">"${c.confession}"</div>

                    <div class="actions" style="display:flex; gap:10px;">
                        <button style="background:none; border:1px solid var(--glass-border); color:white; padding:5px 10px; border-radius:10px; cursor:pointer;" onclick="likeConfession('${c.id}')">❤️ ${c.likes}</button>
                        <span style="padding:5px;">💬 ${c.comment_count} comments</span>
                        ${adminKey ? `<button onclick="deleteConfession('${c.id}')" style="color:red; background:none; border:none; cursor:pointer;">🗑</button>` : ""}
                    </div>

                    <div id="comments_${c.id}" class="list-comments"></div>

                    <div style="margin-top:10px; display:flex; gap:5px;">
                        <textarea placeholder="Write a comment..." id="c_${c.id}" style="height:40px;"></textarea>
                        <button onclick="postListComment('${c.id}')" style="height:40px; padding:0 15px; background:var(--glass-border); border:none; color:white; border-radius:8px; cursor:pointer;">Post</button>
                    </div>
                `;

                list.appendChild(card);
                loadListComments(c.id);
            });
        });
}

function postListComment(id) {
    const input = document.getElementById(`c_${id}`);
    const comment = input.value;
    if (!comment) return;

    fetch(`/add_comment/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment })
    }).then(() => {
        input.value = "";
        // Refresh just the comments for this card would be optimal, but for now simple:
        loadListComments(id);
    });
}

/* ---------- ADMIN DELETE ---------- */

function deleteConfession(id) {
    if (!confirm("Delete this confession?")) return;

    fetch(`/delete/${id}?key=${adminKey}`, { method: "DELETE" })
        .then(() => {
            if (document.getElementById("bubble-container").style.display !== "none") {
                loadBubbles();
            } else {
                loadList("latest");
            }
        });
}

/* ---------- LIST VIEW COMMENTS ---------- */

function loadListComments(confessionId) {
    fetch(`/get_comments/${confessionId}`)
        .then(res => res.json())
        .then(data => {
            const container = document.getElementById(`comments_${confessionId}`);
            container.innerHTML = "";

            // Show only last 3 comments for list view
            const recent = data.slice(-3);

            recent.forEach(c => {
                const div = document.createElement("div");
                div.textContent = "• " + c.text;
                div.style.padding = "4px 8px";
                div.style.background = "rgba(0,0,0,0.2)";
                div.style.marginTop = "4px";
                div.style.borderRadius = "4px";
                div.style.fontSize = "0.9rem";
                container.appendChild(div);
            });
        });
}

/* ---------- INIT ---------- */

window.onload = () => {
    showBubbleView();   // default view
    loadBubbles();

    // Background setup if we want dynamic stars in future
    // const canvas = document.getElementById('cosmosCanvas');
    // ... setup canvas ...
};
