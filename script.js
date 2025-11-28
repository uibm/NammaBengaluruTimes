// Lightweight date formatting
function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateShort(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });
}

// RSS fetch via AllOrigins
async function fetchRSSFeed(url) {
  const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
  try {
    const res = await fetch(proxy);
    const data = await res.json();
    const parser = new DOMParser();
    return parser.parseFromString(data.contents, "text/xml");
  } catch (err) {
    console.error("RSS fetch error:", url, err);
    return null;
  }
}

// RSS parsing helpers
function getText(item, selector) {
  const el = item.querySelector(selector);
  return el ? el.textContent.trim() : "";
}

function getTagText(item, tagName) {
  const el = item.getElementsByTagName(tagName)[0];
  return el ? el.textContent.trim() : "";
}

function cleanDescription(text) {
  if (!text) return "";
  const tmp = document.createElement("div");
  tmp.innerHTML = text;
  return tmp.textContent.replace(/\s+/g, " ").trim();
}

function extractImage(item) {
  const mediaContent = item.querySelector("media\\:content, content");
  if (mediaContent && mediaContent.getAttribute("url")) {
    return mediaContent.getAttribute("url");
  }

  const enclosure = item.querySelector("enclosure");
  if (enclosure && enclosure.getAttribute("type")?.startsWith("image/")) {
    return enclosure.getAttribute("url");
  }

  const thumb = item.querySelector("media\\:thumbnail");
  if (thumb && thumb.getAttribute("url")) {
    return thumb.getAttribute("url");
  }

  const desc = getText(item, "description") || getTagText(item, "content:encoded");
  const match = desc && desc.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (match && match[1]) return match[1];

  return "https://images.unsplash.com/photo-1495020689067-958852a7765e?q=80&w=1600&auto=format&fit=crop";
}

function extractCategories(item) {
  const cats = Array.from(item.getElementsByTagName("category")).map((c) =>
    c.textContent.trim()
  );
  return [...new Set(cats)].slice(0, 4);
}

function extractEnclosure(item) {
  const enclosure = item.querySelector("enclosure");
  if (!enclosure) return null;
  const url = enclosure.getAttribute("url");
  const type = enclosure.getAttribute("type") || "";
  if (!url) return null;
  return { url, type };
}

function extractContentHTML(item) {
  const encoded = getTagText(item, "content:encoded");
  if (encoded) return encoded;
  const desc = getText(item, "description");
  return desc;
}

// Parse entire feed to unified article objects
function parseRSS(xmlDoc, sourceName) {
  if (!xmlDoc) return [];
  const channel = xmlDoc.querySelector("channel");
  const feedTitle = channel ? getText(channel, "title") : sourceName;
  const feedLink = channel ? getText(channel, "link") : "";
  const items = xmlDoc.querySelectorAll("item");
  const results = [];

  items.forEach((item) => {
    const title = getText(item, "title");
    const link = getText(item, "link") || feedLink;
    const rawDesc = getText(item, "description");
    const description = cleanDescription(rawDesc).slice(0, 320);
    const image = extractImage(item);
    const pubDate = getText(item, "pubDate") || getTagText(item, "dc:date");
    const guid = getText(item, "guid");
    const author =
      getTagText(item, "dc:creator") || getText(item, "author") || feedTitle;
    const categories = extractCategories(item);
    const enclosure = extractEnclosure(item);
    const contentHTML = extractContentHTML(item);

    results.push({
      id: guid || link || title,
      title,
      link,
      sourceName,
      feedTitle,
      feedLink,
      description,
      pubDate,
      author,
      categories,
      image,
      enclosure,
      contentHTML,
    });
  });

  return results;
}

// Global state
const state = {
  allArticles: [],
  filteredArticles: [],
  heroArticles: [],
  categoryBuckets: new Map(),
  gridArticles: [],
  heroSwiper: null,
};

// Trending keywords
function getTrendingKeywords(articles) {
  const allText = articles
    .map((a) => `${a.title} ${a.description}`)
    .join(" ");
  const words = (allText.match(/\b[A-Za-z]{4,}\b/g) || []).map((w) =>
    w.toLowerCase()
  );

  const stop = new Set([
    "bengaluru",
    "bangalore",
    "india",
    "times",
    "hindu",
    "hindustan",
    "city",
    "news",
    "today",
    "after",
    "over",
    "with",
    "from",
    "this",
    "that",
  ]);

  const freq = {};
  words.forEach((w) => {
    if (stop.has(w)) return;
    freq[w] = (freq[w] || 0) + 1;
  });

  const top = Object.keys(freq)
    .sort((a, b) => freq[b] - freq[a])
    .slice(0, 8);

  return top;
}

// DOM references
const dateEl = document.getElementById("nbt-date");
const yearEl = document.getElementById("nbt-year");
const countEl = document.getElementById("nbt-articles-count");
const keywordsEl = document.getElementById("nbt-trending-keywords");
const heroSlidesEl = document.getElementById("hero-slides");
const heroBgEl = document.getElementById("hero-bg-layer");
const heroItemBgEl = document.getElementById("hero-item-bg");
const stripsContainer = document.getElementById("nbt-category-strips");
const gridEl = document.getElementById("nbt-grid");
const articleDrawerEl = document.getElementById("nbt-article");
const articleOverlayEl = document.getElementById("nbt-article-overlay");
const articleCloseEl = document.getElementById("nbt-article-close");
const articleSourceEl = document.getElementById("nbt-article-source");
const articleCategoryEl = document.getElementById("nbt-article-category");
const articleHeroEl = document.getElementById("nbt-article-hero");
const articleTitleEl = document.getElementById("nbt-article-title");
const articleMetaAuthorEl = document.getElementById("nbt-article-author");
const articleMetaDateEl = document.getElementById("nbt-article-date");
const articleMetaGuidEl = document.getElementById("nbt-article-guid");
const articleContentEl = document.getElementById("nbt-article-content");
const articleEnclosureEl = document.getElementById("nbt-article-enclosure");
const articleLinkEl = document.getElementById("nbt-article-link");

// Render hero slider
function renderHero(articles) {
  heroSlidesEl.innerHTML = "";
  const heroCandidates = articles
    .filter((a) => a.image)
    .sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0));

  state.heroArticles = heroCandidates.slice(0, 8);

  state.heroArticles.forEach((article) => {
    const slide = document.createElement("div");
    slide.className = "news-slider__item swiper-slide";
    slide.dataset.articleId = article.id;

    const dateShort = formatDateShort(article.pubDate);

    slide.innerHTML = `
      <a href="javascript:void(0)" class="news__item">
        <div class="news-date">
          <span class="news-date__title">${dateShort || "—"}</span>
          <span class="news-date__txt">${article.sourceName}</span>
        </div>
        <div class="news__title">${article.title}</div>
        <div class="news__meta">
          <span><i class="fa-regular fa-user"></i> ${article.author}</span>
          <span><i class="fa-regular fa-clock"></i> ${formatDateShort(article.pubDate) || ""}</span>
        </div>
        <div class="news__txt">${article.description}</div>
        <div class="news__chips">
          ${
            article.categories.length
              ? article.categories
                  .map(
                    (c) =>
                      `<span class="nbt-chip nbt-chip--soft">${c}</span>`
                  )
                  .join("")
              : `<span class="nbt-chip nbt-chip--soft">Bengaluru</span>`
          }
        </div>
        <div class="news__img">
          <img src="${article.image}" alt="News image" />
        </div>
      </a>
    `;

    slide.addEventListener("click", () => openArticle(article));
    heroSlidesEl.appendChild(slide);
  });

  initHeroSwiper();
}

// Swiper + active background

function initHeroSwiper() {
  if (state.heroSwiper) {
    state.heroSwiper.destroy(true, true);
  }

  state.heroSwiper = new Swiper("#hero-swiper", {
    effect: "coverflow",
    grabCursor: true,
    centeredSlides: true,
    slidesPerView: "auto",
    spaceBetween: 16,
    loop: true,
    speed: 450,
    coverflowEffect: {
      rotate: 0,
      stretch: 0,
      depth: 180,
      modifier: 2.8,
      slideShadows: false,
    },
    navigation: {
      nextEl: ".news-slider-next",
      prevEl: ".news-slider-prev",
    },
    pagination: {
      el: ".news-slider__pagination",
      clickable: true,
    },
    on: {
      init() {
        syncHeroItemBg();
      },
      slideChangeTransitionEnd() {
        syncHeroItemBg();
      },
      resize() {
        syncHeroItemBg();
      },
    },
  });
}

function syncHeroItemBg() {
  const active = document.querySelector(
    "#hero-swiper .swiper-slide-active .news__item"
  );
  if (!active || !heroItemBgEl) return;

  const rect = active.getBoundingClientRect();
  const containerRect = heroSlidesEl.getBoundingClientRect();

  const x = rect.left - containerRect.left;
  const y = rect.top - containerRect.top;

  heroItemBgEl.style.opacity = "1";
  heroItemBgEl.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  heroItemBgEl.style.width = `${rect.width}px`;
  heroItemBgEl.style.height = `${rect.height}px`;
}

// Category strips

function buildCategoryBuckets(articles) {
  state.categoryBuckets.clear();
  articles.forEach((a) => {
    if (a.categories.length === 0) {
      const key = "General";
      if (!state.categoryBuckets.has(key)) state.categoryBuckets.set(key, []);
      state.categoryBuckets.get(key).push(a);
    } else {
      a.categories.forEach((c) => {
        const key = c;
        if (!state.categoryBuckets.has(key))
          state.categoryBuckets.set(key, []);
        state.categoryBuckets.get(key).push(a);
      });
    }
  });
}

function renderCategoryStrips() {
  stripsContainer.innerHTML = "";

  const entries = Array.from(state.categoryBuckets.entries())
    .filter(([, arr]) => arr.length > 1)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 8);

  entries.forEach(([category, articles]) => {
    const lane = document.createElement("div");
    lane.className = "nbt-strip";

    lane.innerHTML = `
      <div class="nbt-strip__header">
        <div class="nbt-strip__header-left">
          <span class="nbt-chip nbt-chip--soft">
            <i class="fa-solid fa-hashtag"></i>&nbsp;${category}
          </span>
          <span>${articles.length} stories</span>
        </div>
        <div class="nbt-strip__scroll">
          Swipe →
        </div>
      </div>
      <div class="nbt-strip__lane"></div>
    `;

    const laneInner = lane.querySelector(".nbt-strip__lane");

    articles
      .slice(0, 12)
      .sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0))
      .forEach((article) => {
        const card = document.createElement("div");
        card.className = "nbt-strip-card";
        card.dataset.articleId = article.id;

        card.innerHTML = `
          <div class="nbt-strip-card__title">${article.title}</div>
          <div class="nbt-strip-card__meta">
            <span class="nbt-strip-card__source">${article.sourceName}</span>
            <span class="nbt-strip-card__date">${formatDateShort(
              article.pubDate
            )}</span>
          </div>
          <div class="nbt-strip-card__desc">${article.description}</div>
        `;

        card.addEventListener("click", () => openArticle(article));
        laneInner.appendChild(card);
      });

    stripsContainer.appendChild(lane);
  });
}

// Grid feed

function renderGrid(articles) {
  gridEl.innerHTML = "";
  state.gridArticles = articles;

  articles.forEach((article) => {
    const card = document.createElement("article");
    card.className = "nbt-grid-card";
    card.dataset.articleId = article.id;

    card.innerHTML = `
      <div class="nbt-grid-card__image">
        <img src="${article.image}" alt="News" />
      </div>
      <div class="nbt-grid-card__body">
        <div class="nbt-grid-card__title">${article.title}</div>
        <div class="nbt-grid-card__meta">
          <span>${article.sourceName}</span>
          <span>${formatDateShort(article.pubDate)}</span>
        </div>
        <div class="nbt-grid-card__desc">${article.description}</div>
      </div>
    `;

    card.addEventListener("click", () => openArticle(article));
    gridEl.appendChild(card);
  });
}

// Article drawer

function openArticle(article) {
  if (!article) return;

  articleSourceEl.textContent = article.sourceName || "";
  articleCategoryEl.textContent =
    article.categories[0] || "Bengaluru Story";

  articleHeroEl.innerHTML = article.image
    ? `<img src="${article.image}" alt="Article hero">`
    : "";

  articleTitleEl.textContent = article.title || "";

  articleMetaAuthorEl.textContent = article.author
    ? `By ${article.author}`
    : "";
  articleMetaDateEl.textContent = article.pubDate
    ? formatDate(article.pubDate)
    : "";
  articleMetaGuidEl.textContent = article.id ? `ID: ${article.id}` : "";

  articleContentEl.innerHTML = "";
  if (article.contentHTML) {
    const tmp = document.createElement("div");
    tmp.innerHTML = article.contentHTML;
    // simplify content: keep basic tags
    articleContentEl.append(...Array.from(tmp.childNodes));
  } else {
    articleContentEl.textContent = article.description || "";
  }

  if (article.enclosure) {
    const { url, type } = article.enclosure;
    let html = `<p>Attached media: <code>${type}</code></p>`;
    if (type.startsWith("audio/")) {
      html += `<audio controls src="${url}" style="width:100%; margin-top:0.4rem;"></audio>`;
    } else if (type.startsWith("video/")) {
      html += `<video controls src="${url}" style="width:100%; margin-top:0.4rem;"></video>`;
    } else {
      html += `<p><a href="${url}" target="_blank" rel="noopener">Open attachment</a></p>`;
    }
    articleEnclosureEl.innerHTML = html;
  } else {
    articleEnclosureEl.innerHTML = "";
  }

  if (article.link) {
    articleLinkEl.href = article.link;
  } else if (article.feedLink) {
    articleLinkEl.href = article.feedLink;
  } else {
    articleLinkEl.href = "#";
  }

  articleDrawerEl.classList.add("nbt-article--open");
}

function closeArticle() {
  articleDrawerEl.classList.remove("nbt-article--open");
}

// Source filters

function applySourceFilter() {
  const checked = Array.from(
    document.querySelectorAll(".nbt-source input:checked")
  ).map((i) => i.value);

  state.filteredArticles = state.allArticles.filter((a) =>
    checked.includes(a.sourceName)
  );

  countEl.textContent = `${state.filteredArticles.length} stories`;

  const keywords = getTrendingKeywords(state.filteredArticles);
  if (keywords.length) {
    keywordsEl.innerHTML = `Trending: <span>${keywords.join(", ")}</span>`;
  }

  renderHero(state.filteredArticles);
  buildCategoryBuckets(state.filteredArticles);
  renderCategoryStrips();
  renderGrid(state.filteredArticles);
}

// Initial load

async function loadAllFeeds() {
  const feeds = [
    {
      url: "https://timesofindia.indiatimes.com/rssfeeds/-2128833038.cms",
      sourceName: "Times of India",
    },
    {
      url: "https://www.hindustantimes.com/feeds/rss/cities/bengaluru-news/rssfeed.xml",
      sourceName: "Hindustan Times",
    },
    {
      url: "https://www.thehindu.com/news/cities/bangalore/feeder/default.rss",
      sourceName: "The Hindu",
    },
  ];

  const all = [];

  for (const feed of feeds) {
    const xmlDoc = await fetchRSSFeed(feed.url);
    const parsed = parseRSS(xmlDoc, feed.sourceName);
    all.push(...parsed);
  }

  // sort by date desc
  all.sort(
    (a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0)
  );

  state.allArticles = all;
  applySourceFilter();
}

// Event wiring

document.addEventListener("DOMContentLoaded", () => {
  // Header date + year
  const now = new Date();
  dateEl.textContent = now.toLocaleString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
  yearEl.textContent = now.getFullYear();

  // Source filters
  document
    .querySelectorAll(".nbt-source input")
    .forEach((input) =>
      input.addEventListener("change", applySourceFilter)
    );

  // Article close
  articleOverlayEl.addEventListener("click", closeArticle);
  articleCloseEl.addEventListener("click", closeArticle);

  // Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeArticle();
  });

  // Load feeds
  loadAllFeeds();
});
