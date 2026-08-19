const forumRows = document.getElementById("forumRows");
const forumContent = document.getElementById("forumContent");
let forumState = null;

function escapeHtml(value){
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  }[char]));
}

function visible(items, hiddenStatus){
  return (items || []).filter((item) => item.status !== hiddenStatus);
}

function forumById(id){
  return forumState.sections.find((section) => section.id === id);
}

function topicById(id){
  return forumState.topics.find((topic) => topic.id === id);
}

function topicsForForum(forumId){
  return visible(forumState.topics, "скрыта").filter((topic) => topic.forumId === forumId);
}

function postsForTopic(topicId){
  return visible(forumState.posts, "скрыто")
    .filter((post) => post.topicId === topicId)
    .slice()
    .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

function postsForForum(forumId){
  const ids = topicsForForum(forumId).map((topic) => topic.id);
  return forumState.posts.filter((post) => ids.includes(post.topicId));
}

function latestPostForForum(forumId){
  return postsForForum(forumId)
    .slice()
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0];
}

function videoEmbed(url){
  const value = String(url || "").trim();
  if (!value) return "";
  if (value.includes("<iframe")) return value;

  const youtube = value.match(/(?:v=|youtu\.be\/|shorts\/)([A-Za-z0-9_-]{11})/);
  if (youtube) {
    return `<iframe width="560" height="315" src="https://www.youtube.com/embed/${youtube[1]}" allowfullscreen></iframe>`;
  }

  const vimeo = value.match(/vimeo\.com\/(?:video\/)?([0-9]+)/);
  if (vimeo) {
    return `<iframe width="560" height="315" src="https://player.vimeo.com/video/${vimeo[1]}" allowfullscreen></iframe>`;
  }

  return `<a href="${escapeHtml(value)}" target="_blank" rel="noopener">${escapeHtml(value)}</a>`;
}

function renderPostBody(post){
  return `
    ${escapeHtml(post.body).replace(/\n/g, "<br>")}
    ${post.image ? `<img src="${escapeHtml(post.image)}" alt="">` : ""}
    ${post.video ? videoEmbed(post.video) : ""}
  `;
}

function renderForumIndex(){
  if (!forumRows || !forumState?.sections) return;

  forumRows.innerHTML = visible(forumState.sections, "скрыт")
    .slice()
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0))
    .map((section) => {
      const topics = topicsForForum(section.id);
      const posts = postsForForum(section.id);
      const latest = latestPostForForum(section.id);
      const latestTopic = latest ? topicById(latest.topicId) : null;

      return `
        <tr>
          <td class="forum-cell">
            <a class="forum-link" href="#forum/${section.id}"><span class="forum-icon"></span><span>${escapeHtml(section.name)}</span></a>
            <p class="forum-desc">${escapeHtml(section.description)}</p>
          </td>
          <td class="count">${topics.length}</td>
          <td class="count">${posts.length}</td>
          <td class="last">
            ${latest ? `
              <div class="last-post">
                <span class="avatar" aria-hidden="true"></span>
                <span><a href="#topic/${latestTopic?.id || ""}">${escapeHtml(latestTopic?.title || "последнее сообщение")}</a><br>${escapeHtml(latest.createdAt)} - ${escapeHtml(latest.author)}</span>
              </div>
            ` : `<span class="muted">Нет сообщений</span>`}
          </td>
        </tr>
      `;
    }).join("");

  document.getElementById("publicTopicCount").textContent = forumState.topics.length;
  document.getElementById("publicPostCount").textContent = forumState.posts.length;
  document.getElementById("publicUserCount").textContent = forumState.users.length;
}

function renderAllForums(){
  forumContent.innerHTML = visible(forumState.sections, "скрыт").map((section) => renderForumSection(section)).join("");
}

function renderForumSection(section){
  const topics = topicsForForum(section.id);
  return `
    <section class="category" id="${escapeHtml(section.id)}">
      <div class="category-title">${escapeHtml(section.name)}</div>
      <table aria-label="${escapeHtml(section.name)}">
        <thead>
          <tr>
            <th>Тема</th>
            <th class="count">Ответов</th>
            <th class="count">Сообщений</th>
            <th class="last">Последнее сообщение</th>
          </tr>
        </thead>
        <tbody>
          ${topics.map((topic) => renderTopicRow(topic)).join("") || `<tr><td colspan="4" class="muted">Тем пока нет</td></tr>`}
        </tbody>
      </table>
    </section>
  `;
}

function renderTopicRow(topic){
  const posts = postsForTopic(topic.id);
  const latest = posts[posts.length - 1];
  return `
    <tr>
      <td class="forum-cell">
        <a class="topic-table-title" href="#topic/${topic.id}"><span class="forum-icon"></span><span>${escapeHtml(topic.title)}</span></a>
        <p class="topic-meta">Автор: ${escapeHtml(topic.author)} · ${escapeHtml(topic.status)} · ${escapeHtml(topic.createdAt)}</p>
      </td>
      <td class="count">${Math.max(0, posts.length - 1)}</td>
      <td class="count">${posts.length}</td>
      <td class="last">${latest ? `${escapeHtml(latest.createdAt)} - ${escapeHtml(latest.author)}` : "нет сообщений"}</td>
    </tr>
  `;
}

function renderTopicPage(topic){
  const forum = forumById(topic.forumId);
  const posts = postsForTopic(topic.id);
  forumContent.innerHTML = `
    <section class="category">
      <div class="category-title">${escapeHtml(forum?.name || "тема")}</div>
      <table>
        <tbody>
          <tr>
            <td class="forum-cell">
              <a class="forum-link" href="#forum/${escapeHtml(forum?.id || "")}"><span class="forum-icon"></span><span>${escapeHtml(topic.title)}</span></a>
              <p class="forum-desc">Автор: ${escapeHtml(topic.author)} · ${escapeHtml(topic.status)} · ${escapeHtml(topic.createdAt)}</p>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="category">
      <div class="category-title">Сообщения</div>
      ${posts.map((post) => `
        <article class="post" id="${escapeHtml(post.id)}">
          <div class="post-head">
            <div class="post-author">${escapeHtml(post.author)}</div>
            <div class="post-date">${escapeHtml(post.createdAt)}</div>
          </div>
          <div class="post-body">${renderPostBody(post)}</div>
        </article>
      `).join("") || `<div class="post"><div class="post-body muted">Сообщений пока нет</div></div>`}
    </section>
  `;
}

function route(){
  if (!forumState || !forumContent) return;
  const hash = decodeURIComponent(location.hash.replace(/^#/, ""));
  const [type, id] = hash.split("/");

  if (type === "forum" && id) {
    const section = forumById(id);
    if (section) {
      forumContent.innerHTML = renderForumSection(section);
      return;
    }
  }

  if (type === "topic" && id) {
    const topic = topicById(id);
    if (topic) {
      renderTopicPage(topic);
      return;
    }
  }

  renderAllForums();
}

async function init(){
  try {
    const response = await fetch("/api/forum/state", { cache: "no-store" });
    const payload = await response.json();
    if (payload.ok && payload.state) {
      forumState = payload.state;
      renderForumIndex();
      route();
    }
  } catch (_) {
    // Static HTML remains the fallback if the API is temporarily unavailable.
  }
}

window.addEventListener("hashchange", route);
init();
