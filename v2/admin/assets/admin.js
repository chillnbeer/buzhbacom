import { DEFAULT_STATE } from "../data/default-state.js";

const storageKey = "buzhba-admin-v2";
const $ = (selector) => document.querySelector(selector);

let state = migrate(loadState());

function loadState(){
  try {
    return JSON.parse(localStorage.getItem(storageKey)) || clone(DEFAULT_STATE);
  } catch (_) {
    return clone(DEFAULT_STATE);
  }
}

function clone(value){
  return JSON.parse(JSON.stringify(value));
}

function migrate(data){
  const fresh = clone(DEFAULT_STATE);
  return {
    ...fresh,
    ...data,
    categories: Array.isArray(data.categories) ? data.categories : fresh.categories,
    sections: Array.isArray(data.sections) ? data.sections.map((item, index) => ({
      id: item.id || makeId("forum", item.name || "section"),
      categoryId: item.categoryId || "cat-buzhba",
      name: item.name || "раздел",
      description: item.description || "",
      order: Number(item.order || index + 1),
      status: item.status || "открыт"
    })) : fresh.sections,
    topics: Array.isArray(data.topics) ? data.topics : fresh.topics,
    posts: Array.isArray(data.posts) ? data.posts : fresh.posts,
    media: Array.isArray(data.media) ? data.media : fresh.media,
    users: Array.isArray(data.users) ? data.users : fresh.users,
    trash: Array.isArray(data.trash) ? data.trash : [],
    logs: Array.isArray(data.logs) ? data.logs : fresh.logs
  };
}

function save(){
  localStorage.setItem(storageKey, JSON.stringify(state, null, 2));
  render();
}

function makeId(prefix, text){
  return `${prefix}-${String(text).toLowerCase().replace(/[^a-zа-я0-9]+/gi, "-").replace(/^-|-$/g, "")}-${Date.now().toString(36)}`;
}

function now(){
  return new Date().toLocaleString("sv-SE").replace("T", " ").slice(0, 19);
}

function escapeHtml(value){
  return String(value || "").replace(/[&<>"']/g, (char) => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"
  }[char]));
}

function addLog(text){
  state.logs.unshift(`${new Date().toLocaleString("ru-RU")} - ${text}`);
  state.logs = state.logs.slice(0, 30);
}

function moveToTrash(type, item, collection){
  state.trash.unshift({
    id: makeId("trash", item.id || item.title || item.name || type),
    type,
    item: clone(item),
    collection,
    deletedAt: now()
  });
}

function findForum(id){
  return state.sections.find((item) => item.id === id) || state.sections[0];
}

function findTopic(id){
  return state.topics.find((item) => item.id === id) || state.topics[0];
}

function options(items, selected, label){
  return items.map((item) => `<option value="${item.id}"${item.id === selected ? " selected" : ""}>${escapeHtml(label(item))}</option>`).join("");
}

function videoEmbed(url){
  const value = String(url || "").trim();
  if (!value) return "";
  if (value.includes("<iframe")) return value;

  const youtube = value.match(/(?:v=|youtu\.be\/|shorts\/)([A-Za-z0-9_-]{11})/);
  if (youtube) {
    return `<iframe width="420" height="236" src="https://www.youtube.com/embed/${youtube[1]}" allowfullscreen></iframe>`;
  }

  const vimeo = value.match(/vimeo\.com\/(?:video\/)?([0-9]+)/);
  if (vimeo) {
    return `<iframe width="420" height="236" src="https://player.vimeo.com/video/${vimeo[1]}" allowfullscreen></iframe>`;
  }

  return `<a href="${escapeHtml(value)}" target="_blank" rel="noopener">${escapeHtml(value)}</a>`;
}

function postHtml(post){
  return `
    <div class="post-preview">
      <strong>${escapeHtml(post.author)}</strong> <span class="muted">${escapeHtml(post.createdAt || now())}</span>
      <p>${escapeHtml(post.body).replace(/\n/g, "<br>")}</p>
      ${post.image ? `<img src="${escapeHtml(post.image)}" alt="">` : ""}
      ${post.video ? videoEmbed(post.video) : ""}
    </div>
  `;
}

function renderCategories(){
  $("#sectionCategory").innerHTML = options(state.categories, state.categories[0]?.id, (item) => item.title);
  $("#categoryRows").innerHTML = state.categories.map((category) => {
    const count = state.sections.filter((section) => section.categoryId === category.id).length;
    return `
      <tr>
        <td><strong>${escapeHtml(category.title)}</strong><br><span class="muted">${escapeHtml(category.description)}</span></td>
        <td class="count">${count}</td>
        <td class="actions">
          <button class="mini-button" data-kind="category" data-action="edit" data-id="${category.id}">править</button>
          <button class="mini-button" data-kind="category" data-action="toggle" data-id="${category.id}">${category.status === "открыта" ? "закрыть" : "открыть"}</button>
          <button class="mini-button danger" data-kind="category" data-action="delete" data-id="${category.id}">удалить</button>
        </td>
      </tr>
    `;
  }).join("");
}

function renderSections(){
  $("#sectionRows").innerHTML = state.sections
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((section) => {
      const topicCount = state.topics.filter((topic) => topic.forumId === section.id).length;
      return `
        <tr>
          <td><strong><a href="/v2/#${escapeHtml(section.name)}">${escapeHtml(section.name)}</a></strong><br><span class="muted">${escapeHtml(section.description)}</span></td>
          <td class="count">${topicCount}</td>
          <td class="count">${escapeHtml(section.status)}</td>
          <td class="actions">
            <button class="mini-button" data-kind="section" data-action="edit" data-id="${section.id}">править</button>
            <button class="mini-button" data-kind="section" data-action="up" data-id="${section.id}">выше</button>
            <button class="mini-button" data-kind="section" data-action="toggle" data-id="${section.id}">${section.status === "открыт" ? "закрыть" : "открыть"}</button>
            <button class="mini-button danger" data-kind="section" data-action="delete" data-id="${section.id}">удалить</button>
          </td>
        </tr>
      `;
    }).join("");
}

function renderTopics(){
  $("#topicForum").innerHTML = options(state.sections, state.topics[0]?.forumId, (item) => item.name);
  $("#postTopic").innerHTML = options(state.topics, state.topics[0]?.id, (item) => item.title);
  $("#topicRows").innerHTML = state.topics.map((topic) => `
    <tr>
      <td><strong>${escapeHtml(topic.title)}</strong><br><span class="muted">${escapeHtml(topic.author)} - ${escapeHtml(topic.createdAt)}</span></td>
      <td>${escapeHtml(findForum(topic.forumId)?.name)}</td>
      <td class="count">${escapeHtml(topic.status)}</td>
      <td class="actions">
        <button class="mini-button" data-kind="topic" data-action="edit" data-id="${topic.id}">править</button>
        <button class="mini-button" data-kind="topic" data-action="pin" data-id="${topic.id}">закрепить</button>
        <button class="mini-button" data-kind="topic" data-action="close" data-id="${topic.id}">закрыть</button>
        <button class="mini-button danger" data-kind="topic" data-action="delete" data-id="${topic.id}">удалить</button>
      </td>
    </tr>
  `).join("");
}

function renderTopicEditor(topic = state.topics[0]){
  if (!topic) return;
  $("#topicTitle").value = topic.title;
  $("#topicForum").value = topic.forumId;
  $("#topicStatus").value = topic.status;
  $("#topicAuthor").value = topic.author;
  $("#topicBody").value = state.posts.find((post) => post.topicId === topic.id)?.body || "";
  $("#topicForm").dataset.editing = topic.id;
  $("#topicPreview").textContent = JSON.stringify(topic, null, 2);
}

function renderPosts(){
  $("#postRows").innerHTML = state.posts.map((post) => `
    <tr>
      <td>${postHtml(post)}</td>
      <td>${escapeHtml(findTopic(post.topicId)?.title)}</td>
      <td class="count">${escapeHtml(post.author)}</td>
      <td class="actions">
        <button class="mini-button" data-kind="post" data-action="edit" data-id="${post.id}">править</button>
        <button class="mini-button danger" data-kind="post" data-action="delete" data-id="${post.id}">удалить</button>
      </td>
    </tr>
  `).join("");
}

function renderMedia(){
  $("#mediaRows").innerHTML = state.media.map((item) => `
    <tr>
      <td><strong>${escapeHtml(item.title)}</strong><br><span class="muted">${escapeHtml(item.alt)}</span></td>
      <td class="count">${escapeHtml(item.type)}</td>
      <td>${escapeHtml(item.url)}</td>
      <td class="actions">
        <button class="mini-button" data-kind="media" data-action="use" data-id="${item.id}">вставить</button>
        <button class="mini-button" data-kind="media" data-action="edit" data-id="${item.id}">править</button>
        <button class="mini-button danger" data-kind="media" data-action="delete" data-id="${item.id}">удалить</button>
      </td>
    </tr>
  `).join("");
}

function renderUsers(){
  $("#userRows").innerHTML = state.users.map((user) => `
    <tr>
      <td><strong>${escapeHtml(user.name)}</strong></td>
      <td class="count">${escapeHtml(user.role)}</td>
      <td class="count">${escapeHtml(user.status)}</td>
      <td class="actions">
        <button class="mini-button" data-kind="user" data-action="role" data-id="${user.id}">роль</button>
        <button class="mini-button" data-kind="user" data-action="ban" data-id="${user.id}">бан</button>
        <button class="mini-button danger" data-kind="user" data-action="delete" data-id="${user.id}">удалить</button>
      </td>
    </tr>
  `).join("");
}

function renderTrash(){
  $("#trashRows").innerHTML = state.trash.map((entry) => `
    <tr>
      <td><strong>${escapeHtml(entry.item.title || entry.item.name || entry.item.body || entry.item.url || entry.id)}</strong><br><span class="muted">${escapeHtml(entry.deletedAt)}</span></td>
      <td class="count">${escapeHtml(entry.type)}</td>
      <td class="actions">
        <button class="mini-button" data-kind="trash" data-action="restore" data-id="${entry.id}">восстановить</button>
        <button class="mini-button danger" data-kind="trash" data-action="purge" data-id="${entry.id}">стереть</button>
      </td>
    </tr>
  `).join("") || `<tr><td colspan="3" class="muted">Корзина пуста</td></tr>`;
}

function renderStats(){
  $("#categoryCount").textContent = state.categories.length;
  $("#sectionCount").textContent = state.sections.length;
  $("#topicCount").textContent = state.topics.length;
  $("#postCount").textContent = state.posts.length;
  $("#userCount").textContent = state.users.length;
  $("#modeState").textContent = state.forumMode;
  $("#exportPreview").textContent = JSON.stringify(state, null, 2);
  $("#logsList").innerHTML = state.logs.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function render(){
  renderCategories();
  renderSections();
  renderTopics();
  renderTopicEditor(state.topics.find((topic) => topic.id === $("#topicForm").dataset.editing) || state.topics[0]);
  renderPosts();
  renderMedia();
  renderUsers();
  renderTrash();
  renderStats();
}

function handleCrudClick(event){
  const button = event.target.closest("[data-kind]");
  if (!button) return;
  const { kind, action, id } = button.dataset;

  if (kind === "category") handleCategoryAction(action, id);
  if (kind === "section") handleSectionAction(action, id);
  if (kind === "topic") handleTopicAction(action, id);
  if (kind === "post") handlePostAction(action, id);
  if (kind === "media") handleMediaAction(action, id);
  if (kind === "user") handleUserAction(action, id);
  if (kind === "trash") handleTrashAction(action, id);

  addLog(`${kind}: ${action}`);
  save();
}

function handleCategoryAction(action, id){
  const item = state.categories.find((entry) => entry.id === id);
  if (!item) return;
  if (action === "edit") {
    $("#categoryTitle").value = item.title;
    $("#categoryDesc").value = item.description;
    $("#categoryForm").dataset.editing = item.id;
  }
  if (action === "toggle") item.status = item.status === "открыта" ? "закрыта" : "открыта";
  if (action === "delete") {
    moveToTrash("категория", item, "categories");
    state.categories = state.categories.filter((entry) => entry.id !== id);
  }
}

function handleSectionAction(action, id){
  const item = state.sections.find((entry) => entry.id === id);
  if (!item) return;
  if (action === "edit") {
    const title = prompt("Название раздела", item.name);
    if (title) item.name = title;
    const description = prompt("Описание раздела", item.description);
    if (description !== null) item.description = description;
  }
  if (action === "up") item.order = Math.max(1, item.order - 1.5);
  if (action === "toggle") item.status = item.status === "открыт" ? "закрыт" : "открыт";
  if (action === "delete") {
    moveToTrash("раздел", item, "sections");
    state.sections = state.sections.filter((entry) => entry.id !== id);
  }
}

function handleTopicAction(action, id){
  const item = state.topics.find((entry) => entry.id === id);
  if (!item) return;
  if (action === "edit") renderTopicEditor(item);
  if (action === "pin") item.status = "закреплена";
  if (action === "close") item.status = "закрыта";
  if (action === "delete") {
    moveToTrash("тема", item, "topics");
    state.topics = state.topics.filter((entry) => entry.id !== id);
  }
}

function handlePostAction(action, id){
  const item = state.posts.find((entry) => entry.id === id);
  if (!item) return;
  if (action === "edit") {
    $("#postTopic").value = item.topicId;
    $("#postAuthor").value = item.author;
    $("#postBody").value = item.body;
    $("#postImage").value = item.image;
    $("#postVideo").value = item.video;
    $("#postForm").dataset.editing = item.id;
  }
  if (action === "delete") {
    moveToTrash("сообщение", item, "posts");
    state.posts = state.posts.filter((entry) => entry.id !== id);
  }
}

function handleMediaAction(action, id){
  const item = state.media.find((entry) => entry.id === id);
  if (!item) return;
  if (action === "use") {
    if (item.type === "image") $("#postImage").value = item.url;
    if (item.type === "video") $("#postVideo").value = item.url;
  }
  if (action === "edit") {
    $("#mediaType").value = item.type;
    $("#mediaUrl").value = item.url;
    $("#mediaTitle").value = item.title;
    $("#mediaAlt").value = item.alt;
    $("#mediaForm").dataset.editing = item.id;
  }
  if (action === "delete") {
    moveToTrash("медиа", item, "media");
    state.media = state.media.filter((entry) => entry.id !== id);
  }
}

function handleUserAction(action, id){
  const item = state.users.find((entry) => entry.id === id);
  if (!item) return;
  if (action === "role") item.role = item.role === "участник" ? "модератор" : item.role === "модератор" ? "администратор" : "участник";
  if (action === "ban") item.status = item.status === "забанен" ? "активен" : "забанен";
  if (action === "delete") {
    moveToTrash("пользователь", item, "users");
    state.users = state.users.filter((entry) => entry.id !== id);
  }
}

function handleTrashAction(action, id){
  const entry = state.trash.find((item) => item.id === id);
  if (!entry) return;
  if (action === "restore" && state[entry.collection]) {
    state[entry.collection].push(entry.item);
    state.trash = state.trash.filter((item) => item.id !== id);
  }
  if (action === "purge") state.trash = state.trash.filter((item) => item.id !== id);
}

function bindForms(){
  $("#categoryForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const editing = event.currentTarget.dataset.editing;
    const existing = state.categories.find((entry) => entry.id === editing);
    const payload = {
      id: editing || makeId("cat", $("#categoryTitle").value),
      title: $("#categoryTitle").value,
      description: $("#categoryDesc").value,
      order: state.categories.length + 1,
      status: existing?.status || "открыта"
    };
    if (existing) Object.assign(existing, payload);
    else state.categories.push(payload);
    delete event.currentTarget.dataset.editing;
    addLog("Категория сохранена");
    save();
  });

  $("#sectionForm").addEventListener("submit", (event) => {
    event.preventDefault();
    state.sections.push({
      id: makeId("forum", $("#sectionName").value),
      categoryId: $("#sectionCategory").value,
      name: $("#sectionName").value,
      description: $("#sectionDescription").value,
      order: state.sections.length + 1,
      status: "открыт"
    });
    addLog("Раздел создан");
    save();
  });

  $("#topicForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const editing = event.currentTarget.dataset.editing;
    const existing = state.topics.find((topic) => topic.id === editing);
    const payload = {
      id: editing || makeId("topic", $("#topicTitle").value),
      forumId: $("#topicForum").value,
      title: $("#topicTitle").value,
      status: $("#topicStatus").value,
      author: $("#topicAuthor").value,
      createdAt: existing?.createdAt || now()
    };
    if (existing) Object.assign(existing, payload);
    else state.topics.unshift(payload);
    const firstPost = state.posts.find((post) => post.topicId === payload.id);
    if (firstPost) firstPost.body = $("#topicBody").value;
    else state.posts.unshift({ id: makeId("post", payload.title), topicId: payload.id, author: payload.author, body: $("#topicBody").value, image: "", video: "", createdAt: now(), status: "опубликовано" });
    event.currentTarget.dataset.editing = payload.id;
    $("#saveStatus").textContent = "сохранено локально";
    addLog("Тема сохранена");
    save();
  });

  $("#postForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const editing = event.currentTarget.dataset.editing;
    const existing = state.posts.find((post) => post.id === editing);
    const payload = {
      id: editing || makeId("post", $("#postTopic").value),
      topicId: $("#postTopic").value,
      author: $("#postAuthor").value,
      body: $("#postBody").value,
      image: $("#postImage").value,
      video: $("#postVideo").value,
      createdAt: existing?.createdAt || now(),
      status: "опубликовано"
    };
    if (existing) Object.assign(existing, payload);
    else state.posts.unshift(payload);
    delete event.currentTarget.dataset.editing;
    addLog("Сообщение сохранено");
    save();
  });

  $("#mediaForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const editing = event.currentTarget.dataset.editing;
    const existing = state.media.find((item) => item.id === editing);
    const payload = {
      id: editing || makeId("media", $("#mediaTitle").value),
      type: $("#mediaType").value,
      url: $("#mediaUrl").value,
      title: $("#mediaTitle").value,
      alt: $("#mediaAlt").value
    };
    if (existing) Object.assign(existing, payload);
    else state.media.unshift(payload);
    delete event.currentTarget.dataset.editing;
    addLog("Медиа сохранено");
    save();
  });

  $("#userForm").addEventListener("submit", (event) => {
    event.preventDefault();
    state.users.push({ id: makeId("user", $("#userName").value), name: $("#userName").value, role: $("#userRole").value, status: "активен" });
    addLog("Пользователь добавлен");
    save();
  });

  $("#designForm").addEventListener("submit", (event) => {
    event.preventDefault();
    state.design = { forumName: $("#forumName").value, theme: $("#themeSelect").value, announcement: $("#announcement").value };
    addLog("Оформление применено");
    save();
  });
}

function bindButtons(){
  document.addEventListener("click", handleCrudClick);

  $("#previewPost").addEventListener("click", () => {
    $("#postPreview").innerHTML = postHtml({ author: $("#postAuthor").value, body: $("#postBody").value, image: $("#postImage").value, video: $("#postVideo").value, createdAt: now() });
  });

  $("#insertMediaToPost").addEventListener("click", () => {
    const media = state.media[0];
    if (!media) return;
    if (media.type === "image") $("#postImage").value = media.url;
    if (media.type === "video") $("#postVideo").value = media.url;
  });

  $("#pinTopic").addEventListener("click", () => {
    const topic = state.topics.find((item) => item.id === $("#topicForm").dataset.editing) || state.topics[0];
    if (topic) topic.status = "закреплена";
    addLog("Тема закреплена");
    save();
  });

  $("#hideTopic").addEventListener("click", () => {
    const topic = state.topics.find((item) => item.id === $("#topicForm").dataset.editing) || state.topics[0];
    if (topic) topic.status = "скрыта";
    addLog("Тема скрыта");
    save();
  });

  $("#toggleMode").addEventListener("click", () => {
    state.forumMode = state.forumMode === "открыт" ? "закрыт" : "открыт";
    addLog(`Режим форума: ${state.forumMode}`);
    save();
  });

  $("#resetData").addEventListener("click", () => {
    if (!confirm("Сбросить локальные данные админки?")) return;
    state = clone(DEFAULT_STATE);
    addLog("Демо-данные сброшены");
    save();
  });

  $("#downloadJson").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "buzhba-forum-data.json";
    link.click();
    URL.revokeObjectURL(url);
  });
}

function init(){
  bindForms();
  bindButtons();
  save();
}

init();
