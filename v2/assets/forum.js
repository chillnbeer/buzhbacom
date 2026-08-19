const forumRows = document.getElementById("forumRows");

function escapeHtml(value){
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  }[char]));
}

function latestPostForForum(state, forumId){
  const topicIds = state.topics.filter((topic) => topic.forumId === forumId).map((topic) => topic.id);
  return state.posts
    .filter((post) => topicIds.includes(post.topicId))
    .slice()
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0];
}

function topicById(state, id){
  return state.topics.find((topic) => topic.id === id);
}

function renderForum(state){
  if (!forumRows || !state?.sections) return;

  forumRows.innerHTML = state.sections
    .filter((section) => section.status !== "скрыт")
    .slice()
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
    .map((section) => {
      const topics = state.topics.filter((topic) => topic.forumId === section.id && topic.status !== "скрыта");
      const posts = state.posts.filter((post) => topics.some((topic) => topic.id === post.topicId));
      const latest = latestPostForForum(state, section.id);
      const latestTopic = latest ? topicById(state, latest.topicId) : null;

      return `
        <tr>
          <td class="forum-cell">
            <a class="forum-link" href="#${escapeHtml(section.name)}"><span class="forum-icon"></span><span>${escapeHtml(section.name)}</span></a>
            <p class="forum-desc">${escapeHtml(section.description)}</p>
          </td>
          <td class="count">${topics.length}</td>
          <td class="count">${posts.length}</td>
          <td class="last">
            ${latest ? `
              <div class="last-post">
                <span class="avatar" aria-hidden="true"></span>
                <span><a href="#${escapeHtml(section.name)}">${escapeHtml(latestTopic?.title || "последнее сообщение")}</a><br>${escapeHtml(latest.createdAt)} - ${escapeHtml(latest.author)}</span>
              </div>
            ` : `<span class="muted">Нет сообщений</span>`}
          </td>
        </tr>
      `;
    }).join("");

  document.getElementById("publicTopicCount").textContent = state.topics.length;
  document.getElementById("publicPostCount").textContent = state.posts.length;
  document.getElementById("publicUserCount").textContent = state.users.length;
}

async function init(){
  try {
    const response = await fetch("/api/forum/state", { cache: "no-store" });
    const payload = await response.json();
    if (payload.ok && payload.state) renderForum(payload.state);
  } catch (_) {
    // Static HTML remains the fallback before Cloudflare D1 is configured.
  }
}

init();
