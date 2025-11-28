// --- RSS fetch util ---
async function fetchRSSFeed(url) {
  try {
    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(
      url
    )}`;
    const response = await fetch(proxyUrl);
    const data = await response.json();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(data.contents, "text/xml");
    return xmlDoc;
  } catch (error) {
    console.error("Error fetching RSS feed:", error);
    return null;
  }
}

// --- Text helpers ---
function stripHtml(html) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return (tmp.textContent || tmp.innerText || "").trim();
}

function truncateText(text, maxLength) {
  if (text.length <= maxLength) return text;
  const sliced = text.slice(0, maxLength - 1);
  const lastSpace = sliced.lastIndexOf(" ");
  return sliced.slice(0, lastSpace > 40 ? lastSpace : maxLength - 1) + "…";
}

// Basic noun-ish keyword extraction, can be replaced later
function extractNouns(text) {
  const tokens = text.match(/\b[A-Za-z]{4,}\b/g) || [];
  return tokens.map((t) => t.toLowerCase());
}

function getTrendingKeywords(articles) {
  const allText = articles
    .map((a) => `${a.title} ${a.rawDescription || ""}`)
    .join(" ");
  const nouns = extractNouns(allText);
  const wordCount = {};
  nouns.forEach((word) => {
    wordCount[word] = (wordCount[word] || 0) + 1;
  });
  const sortedWords = Object.keys(wordCount).sort(
    (a, b) => wordCount[b] - wordCount[a]
  );
  return sortedWords.slice(0, 10).join(" · ");
}

// --- Time helpers ---
function formatTimeAgo(timestamp) {
  if (!timestamp) return "";
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes} min ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} hr ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  const d = new Date(timestamp);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// --- DOM: hero + cards ---
function renderHero(article) {
  const hero = document.getElementById("hero");
  if (!hero) return;

  const timeAgo = formatTimeAgo(article.pubDate);
  const imageUrl =
    article.image ||
    "https://images.unsplash.com/photo-1495020689067-958852a7765e?q=80&auto=format&fit=crop&w=1600";

  hero.innerHTML = `
    <article class="hero-card" data-source="${article.sourceName}">
      <div class="hero-media">
        <img src="${imageUrl}" alt="News image">
        <div class="hero-gradient"></div>
      </div>
      <div class="hero-body">
        <div class="hero-kicker">Top Bengaluru story</div>
        <h2 class="hero-title">${article.title}</h2>
        <p class="hero-summary">${article.description}</p>
        <div class="hero-meta">
          <div class="hero-meta-left">
            <span class="source">${article.sourceName}</span>
            ${
              timeAgo
                ? `<span aria-hidden="true">·</span><span>${timeAgo}</span>`
                : ""
            }
          </div>
          <a href="${article.link}" class="news-readmore" target="_blank" rel="noopener noreferrer">
            Read full story <i class="fa-solid fa-arrow-up-right-from-square"></i>
          </a>
        </div>
      </div>
    </article>
  `;
}

function createNewsCard(article) {
  const card = document.createElement("article");
  card.classList.add("news-card");
  card.setAttribute("data-source", article.sourceName);

  const timeAgo = formatTimeAgo(article.pubDate);
  const imageUrl =
    article.image ||
    "https://images.unsplash.com/photo-1495020689067-958852a7765e?q=80&auto=format&fit=crop&w=1200";

  card.innerHTML = `
    <div class="news-card-inner">
      <div class="news-media">
        <img src="${imageUrl}" alt="News image">
      </div>
      <div class="news-body">
        <h3 class="news-title">${article.title}</h3>
        <p class="news-summary">${article.description}</p>
        <div class="news-meta">
          <div class="news-meta-left">
            <span class="source">${article.sourceName}</span>
            ${
              timeAgo
                ? `<span aria-hidden="true">·</span><span>${timeAgo}</span>`
                : ""
            }
          </div>
          <a href="${article.link}" class="news-readmore" target="_blank" rel="noopener noreferrer">
            Open <i class="fa-solid fa-arrow-up-right-from-square"></i>
          </a>
        </div>
      </div>
    </div>
  `;

  return card;
}

// --- Filter ---
function filterNews() {
  const checkedSources = Array.from(
    document.querySelectorAll(".form-check-input:checked")
  ).map((input) => input.value);

  const elements = document.querySelectorAll("[data-source]");
  elements.forEach((el) => {
    const source = el.getAttribute("data-source");
    if (checkedSources.includes(source)) {
      el.classList.remove("is-hidden");
    } else {
      el.classList.add("is-hidden");
    }
  });
}

// --- Main loader ---
async function loadRSSFeeds() {
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

  const articles = [];

  for (const feed of feeds) {
    const xmlDoc = await fetchRSSFeed(feed.url);
    if (!xmlDoc) continue;

    const items = xmlDoc.querySelectorAll("item");
    items.forEach((item) => {
      const title = item.querySelector("title")?.textContent?.trim() || "";
      const link = item.querySelector("link")?.textContent?.trim() || "#";

      const rawDescription =
        item.querySelector("description")?.textContent || "";
      const cleanedDescription = truncateText(
        stripHtml(rawDescription),
        220
      );

      const enclosure = item.querySelector("enclosure");
      const mediaContent = item.querySelector("media\\:content");
      const image =
        enclosure?.getAttribute("url") ||
        mediaContent?.getAttribute("url") ||
        null;

      const pubDateText =
        item.querySelector("pubDate")?.textContent ||
        item.querySelector("updated")?.textContent ||
        null;
      const pubDate = pubDateText ? new Date(pubDateText).getTime() : null;

      if (!title) return;

      articles.push({
        title,
        link,
        description: cleanedDescription,
        rawDescription,
        image,
        sourceName: feed.sourceName,
        pubDate,
      });
    });
  }

  if (!articles.length) {
    document.getElementById("news-feed").innerHTML =
      "<p class='text-center text-muted'>No stories could be loaded.</p>";
    return;
  }

  // Sort by time (newest first)
  articles.sort((a, b) => {
    if (!a.pubDate && !b.pubDate) return 0;
    if (!a.pubDate) return 1;
    if (!b.pubDate) return -1;
    return b.pubDate - a.pubDate;
  });

  const [heroArticle, ...rest] = articles;

  renderHero(heroArticle);

  const newsFeed = document.getElementById("news-feed");
  rest.forEach((article) => {
    const card = createNewsCard(article);
    newsFeed.appendChild(card);
  });

  // Trending keywords
  const keywords = getTrendingKeywords(articles);
  document.getElementById("keywords").textContent = keywords || "—";

  // Filter wiring
  document
    .querySelectorAll(".form-check-input")
    .forEach((input) => input.addEventListener("change", filterNews));
}

// Init
document.addEventListener("DOMContentLoaded", loadRSSFeeds);
