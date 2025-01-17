// Function to fetch and parse RSS feed using AllOrigins proxy
async function fetchRSSFeed(url) {
    try {
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
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
  
  // Function to extract nouns from text
  function extractNouns(text) {
    const nouns = text.match(/\b[A-Za-z]+\b/g) || [];
    return nouns.filter(word => word.length > 3); // Filter out short words
  }
  
  // Function to get trending keywords
  function getTrendingKeywords(articles) {
    const allText = articles.map(article => article.title + " " + article.description).join(" ");
    const nouns = extractNouns(allText);
    const wordCount = {};
  
    nouns.forEach(word => {
      wordCount[word] = (wordCount[word] || 0) + 1;
    });
  
    const sortedWords = Object.keys(wordCount).sort((a, b) => wordCount[b] - wordCount[a]);
    return sortedWords.slice(0, 10).join(", ");
  }
  
  // Function to create a news card
  function createNewsCard(article) {
    const card = document.createElement("div");
    card.classList.add("col-md-4", "mb-4", "news-card");
    card.setAttribute("data-source", article.sourceName);
  
    const imageUrl = article.image || "https://images.unsplash.com/photo-1495020689067-958852a7765e?q=80&w=2069&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D";
  
    card.innerHTML = `
      <div class="card">
        <img src="${imageUrl}" class="card-img-top" alt="News Image">
        <div class="card-body">
          <h5 class="card-title">${article.title}</h5>
          <p class="card-text">${article.description}</p>
          <a href="${article.link}" class="btn btn-primary" target="_blank">Read More</a>
        </div>
        <div class="card-footer">
          <small class="text-muted">Source: ${article.sourceName}</small>
        </div>
      </div>
    `;
  
    return card;
  }
  
  // Function to filter news cards
  function filterNews() {
    const checkedSources = Array.from(document.querySelectorAll(".form-check-input:checked")).map(input => input.value);
    const newsCards = document.querySelectorAll(".news-card");
  
    newsCards.forEach(card => {
      const source = card.getAttribute("data-source");
      if (checkedSources.includes(source)) {
        card.style.display = "block";
      } else {
        card.style.display = "none";
      }
    });
  }
  
  // Function to load and display RSS feeds
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
  
    const newsGrid = document.getElementById("news-grid");
    const articles = [];
  
    for (const feed of feeds) {
      const xmlDoc = await fetchRSSFeed(feed.url);
      if (xmlDoc) {
        const items = xmlDoc.querySelectorAll("item");
        items.forEach(item => {
          const title = item.querySelector("title").textContent;
          const link = item.querySelector("link").textContent;
          const description = item.querySelector("description")?.textContent || "No description available.";
          const image = item.querySelector("enclosure")?.getAttribute("url") || null;
  
          const article = { title, link, description, image, sourceName: feed.sourceName };
          articles.push(article);
  
          const card = createNewsCard(article);
          newsGrid.appendChild(card);
        });
      }
    }
  
    // Display trending keywords
    const keywords = getTrendingKeywords(articles);
    document.getElementById("keywords").textContent = keywords;
  
    // Add event listeners to checkboxes
    document.querySelectorAll(".form-check-input").forEach(input => {
      input.addEventListener("change", filterNews);
    });
  }
  
  // Load RSS feeds when the page loads
  document.addEventListener("DOMContentLoaded", loadRSSFeeds);