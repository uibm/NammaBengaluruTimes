// Function to fetch and parse RSS feed
async function fetchRSSFeed(url) {
    try {
      const response = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
      const data = await response.json();
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(data.contents, "text/xml");
      return xmlDoc;
    } catch (error) {
      console.error("Error fetching RSS feed:", error);
      return null;
    }
  }
  
  // Function to create a news card
  function createNewsCard(title, link, description, sourceName) {
    const card = document.createElement("div");
    card.classList.add("nbt-card");
  
    card.innerHTML = `
      <div class="nbt-card-content">
        <h2 class="nbt-card-title">${title}</h2>
        <p class="nbt-card-excerpt">${description}</p>
        <div class="nbt-card-source">
          Source: <a href="${link}" target="_blank">${sourceName}</a>
        </div>
      </div>
    `;
  
    return card;
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
  
    for (const feed of feeds) {
      const xmlDoc = await fetchRSSFeed(feed.url);
      if (xmlDoc) {
        const items = xmlDoc.querySelectorAll("item");
        items.forEach((item, index) => {
          if (index >= 50) return; // Limit to 5 items per feed
  
          const title = item.querySelector("title").textContent;
          const link = item.querySelector("link").textContent;
          const description = item.querySelector("description")?.textContent || "No description available.";
  
          const card = createNewsCard(title, link, description, feed.sourceName);
          newsGrid.appendChild(card);
        });
      }
    }
  }
  
  // Load RSS feeds when the page loads
  document.addEventListener("DOMContentLoaded", loadRSSFeeds);