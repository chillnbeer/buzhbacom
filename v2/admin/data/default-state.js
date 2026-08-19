export const DEFAULT_STATE = {
  categories: [
    {
      id: "cat-buzhba",
      title: "бужба",
      slug: "buzhba",
      description: "Основные разделы форума группы Бужба.",
      order: 1,
      status: "открыта"
    }
  ],
  sections: [
    {
      id: "forum-photos",
      categoryId: "cat-buzhba",
      name: "фотографии",
      slug: "photos",
      description: "портреты, концерты, картинки для афиш",
      order: 1,
      status: "открыт"
    },
    {
      id: "forum-music",
      categoryId: "cat-buzhba",
      name: "музыка",
      slug: "music",
      description: "альбомы, синглы, EP и ссылки",
      order: 2,
      status: "открыт"
    },
    {
      id: "forum-video",
      categoryId: "cat-buzhba",
      name: "видео",
      slug: "video",
      description: "клипы, лайвы и YouTube-следы",
      order: 3,
      status: "открыт"
    }
  ],
  topics: [
    {
      id: "topic-site",
      forumId: "forum-music",
      title: "бужба - новый форумный сайт",
      slug: "buzhba-new-forum-site",
      status: "закреплена",
      author: "buzhba",
      createdAt: "2026-08-19 11:14:32"
    },
    {
      id: "topic-live",
      forumId: "forum-video",
      title: "бужба: Цех live x mmmesss",
      slug: "buzhba-tseh-live-x-mmmesss",
      status: "обычная",
      author: "buzhba",
      createdAt: "2026-08-19 11:10:05"
    },
    {
      id: "topic-photos",
      forumId: "forum-photos",
      title: "второй фотоальбом",
      slug: "second-photo-album",
      status: "обычная",
      author: "buzhba",
      createdAt: "2021-07-22 09:33:25"
    }
  ],
  posts: [
    {
      id: "post-site-1",
      topicId: "topic-site",
      author: "buzhba",
      body: "Все забыли форумы, а мы вспомнили. Тут будет сайт группы Бужба в виде старого форума.",
      image: "",
      video: "",
      createdAt: "2026-08-19 11:14:32",
      status: "опубликовано"
    },
    {
      id: "post-live-1",
      topicId: "topic-live",
      author: "buzhba",
      body: "Живой выпуск из Цеха.",
      image: "",
      video: "https://www.youtube.com/watch?v=O241obUNimI",
      createdAt: "2026-08-19 11:10:05",
      status: "опубликовано"
    }
  ],
  media: [
    {
      id: "media-portrait",
      type: "image",
      title: "портрет на черном фоне",
      url: "/images/press/20260226-225554-a31b.jpg",
      alt: "Жорж Корнилов Бужба"
    },
    {
      id: "media-live",
      type: "video",
      title: "Цех live x mmmesss",
      url: "https://www.youtube.com/watch?v=O241obUNimI",
      alt: "live-видео"
    }
  ],
  users: [
    { id: "user-admin", name: "buzhba", role: "администратор", status: "активен" },
    { id: "user-bobubip", name: "bobubip", role: "участник", status: "активен" },
    { id: "user-guest", name: "guest", role: "участник", status: "только чтение" }
  ],
  design: {
    forumName: "группа бужба",
    theme: "classic",
    announcement: "Все забыли форумы, а мы вспомнили."
  },
  forumMode: "открыт",
  trash: [],
  logs: ["Создана расширенная CMS форума", "Форум v2 опубликован"]
};
