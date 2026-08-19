const forumRows = document.getElementById("forumRows");
const forumContent = document.getElementById("forumContent");
const forumIndexBlock = forumRows?.closest(".category");
let forumState = null;

const translitMap = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
  х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya"
};

function escapeHtml(value){
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  }[char]));
}

function slugify(value){
  const latin = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[а-яё]/g, (char) => translitMap[char] || char);
  return latin.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "page";
}

function visible(items, hiddenStatus){
  return (items || []).filter((item) => item.status !== hiddenStatus);
}

function sectionSlug(section){
  return slugify(section?.slug || section?.name || section?.id);
}

function categorySlug(category){
  return slugify(category?.slug || category?.title || category?.id);
}

function topicSlug(topic){
  return slugify(topic?.slug || topic?.title || topic?.id);
}

function categoryById(id){
  return forumState.categories.find((category) => category.id === id) || forumState.categories[0];
}

function forumById(id){
  return forumState.sections.find((section) => section.id === id);
}

function topicById(id){
  return forumState.topics.find((topic) => topic.id === id);
}

function categoryForSection(section){
  return categoryById(section?.categoryId);
}

function sectionUrl(section){
  const category = categoryForSection(section);
  return `/v2/${categorySlug(category)}/${sectionSlug(section)}/`;
}

function topicUrl(topic){
  const section = forumById(topic?.forumId);
  return section ? `${sectionUrl(section)}${topicSlug(topic)}/` : "/v2/";
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
  return visible(forumState.posts, "скрыто").filter((post) => ids.includes(post.topicId));
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
            <a class="forum-link" href="${sectionUrl(section)}"><span class="forum-icon"></span><span>${escapeHtml(section.name)}</span></a>
            <p class="forum-desc">${escapeHtml(section.description)}</p>
          </td>
          <td class="count">${topics.length}</td>
          <td class="count">${posts.length}</td>
          <td class="last">
            ${latest ? `
              <div class="last-post">
                <span class="avatar" aria-hidden="true"></span>
                <span><a href="${latestTopic ? topicUrl(latestTopic) : sectionUrl(section)}">${escapeHtml(latestTopic?.title || "последнее сообщение")}</a><br>${escapeHtml(latest.createdAt)} - ${escapeHtml(latest.author)}</span>
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
    <section class="category" id="${escapeHtml(sectionSlug(section))}">
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
        <a class="topic-table-title" href="${topicUrl(topic)}"><span class="forum-icon"></span><span>${escapeHtml(topic.title)}</span></a>
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
              <a class="forum-link" href="${forum ? sectionUrl(forum) : "/v2/"}"><span class="forum-icon"></span><span>${escapeHtml(topic.title)}</span></a>
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

function renderNotFound(){
  forumContent.innerHTML = `
    <section class="category">
      <div class="category-title">Не найдено</div>
      <table>
        <tbody>
          <tr><td class="forum-cell"><a class="forum-link" href="/v2/"><span class="forum-icon"></span><span>вернуться на форум</span></a></td></tr>
        </tbody>
      </table>
    </section>
  `;
}

function currentPathSegments(){
  return decodeURI(location.pathname)
    .replace(/^\/v2\/?/, "")
    .split("/")
    .filter(Boolean);
}

function route(){
  if (!forumState || !forumContent) return;
  const [catSlug, secSlug, topSlug] = currentPathSegments();

  if (!catSlug) {
    if (forumIndexBlock) forumIndexBlock.hidden = false;
    renderAllForums();
    return;
  }

  if (forumIndexBlock) forumIndexBlock.hidden = true;

  const section = visible(forumState.sections, "скрыт")
    .find((item) => sectionSlug(item) === slugify(secSlug) && categorySlug(categoryForSection(item)) === slugify(catSlug));

  if (section && !topSlug) {
    forumContent.innerHTML = renderForumSection(section);
    return;
  }

  const topic = section
    ? topicsForForum(section.id).find((item) => topicSlug(item) === slugify(topSlug))
    : null;

  if (topic) {
    renderTopicPage(topic);
    return;
  }

  renderNotFound();
}

function bindInternalLinks(){
  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[href]");
    if (!link || !forumState) return;
    const url = new URL(link.href, location.origin);
    if (url.origin !== location.origin || !url.pathname.startsWith("/v2/") || url.pathname.startsWith("/v2/assets/")) return;
    event.preventDefault();
    history.pushState({}, "", url.pathname);
    route();
    window.scrollTo({ top: 0, behavior: "auto" });
  });

  window.addEventListener("popstate", route);
}

async function init(){
  bindInternalLinks();
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

init();
