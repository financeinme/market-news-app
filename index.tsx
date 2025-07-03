
import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI } from "@google/genai";

// --- Types ---
interface NewsArticle {
  headline: string;
  summary: string;
}

// --- API Initialization ---
const apiKey = process.env.API_KEY;
if (!apiKey) {
  // In a real app, you'd want to show this error in the UI.
  console.error("API_KEY environment variable not set.");
}
const ai = new GoogleGenAI({ apiKey });

// --- Styles ---
const styles = `
  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .app-container {
    width: 100%;
    height: 100%;
    max-width: 480px; /* Mobile-first design */
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    position: relative;
    overflow: hidden;
    perspective: 1000px;
  }

  .loading-container, .error-container {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    padding: 20px;
    color: #ccc;
  }

  .loader {
    width: 50px;
    height: 50px;
    border: 5px solid #444;
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 20px;
  }

  .error-message {
    color: #ff4d4d;
    background-color: rgba(255, 77, 77, 0.1);
    padding: 10px 15px;
    border-radius: 8px;
  }

  .news-swiper {
    width: 90%;
    height: 75vh;
    max-height: 600px;
    position: relative;
    user-select: none; /* Prevent text selection on swipe */
  }

  .news-card {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(145deg, #2a2a2e, #1e1e22);
    border-radius: 20px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    padding: 30px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    justify-content: center;
    transition: transform 0.5s ease-out, opacity 0.5s ease-out;
    opacity: 0;
    transform-style: preserve-3d;
    backface-visibility: hidden;
    will-change: transform, opacity;
  }

  .news-card.active {
    opacity: 1;
    transform: translateX(0) rotateY(0);
    z-index: 2;
  }

  .news-card.prev {
    transform: translateX(-100%) rotateY(45deg);
    opacity: 0.5;
    z-index: 1;
  }

  .news-card.next {
    transform: translateX(100%) rotateY(-45deg);
    opacity: 0.5;
    z-index: 1;
  }

  .news-card h2 {
    font-size: 1.5rem;
    margin: 0 0 15px;
    font-weight: 700;
    color: #f0f0f0;
    line-height: 1.3;
  }

  .news-card p {
    font-size: 1rem;
    line-height: 1.6;
    color: #b0b0b0;
    flex-grow: 1;
    overflow-y: auto;
    padding-right: 10px; /* space for scrollbar */
  }
  
  .news-card p::-webkit-scrollbar { width: 5px; }
  .news-card p::-webkit-scrollbar-track { background: transparent; }
  .news-card p::-webkit-scrollbar-thumb { background: #555; border-radius: 10px; }
  .news-card p::-webkit-scrollbar-thumb:hover { background: #777; }

  .progress-bar-container {
      width: 80%;
      height: 4px;
      background-color: #444;
      border-radius: 2px;
      margin-top: 25px;
      overflow: hidden;
  }

  .progress-bar {
      height: 100%;
      background-color: #fff;
      border-radius: 2px;
      transition: width 0.3s ease-in-out;
  }
  
  .app-title {
    position: absolute;
    top: 20px;
    font-weight: 600;
    font-size: 1.2rem;
    color: #888;
  }
`;

// --- Components ---

const NewsCard: React.FC<{ article: NewsArticle, status?: 'prev' | 'active' | 'next' }> = ({ article, status }) => {
  return (
    <div className={`news-card ${status || ''}`.trim()} aria-hidden={status !== 'active'}>
      <h2>{article.headline}</h2>
      <p>{article.summary}</p>
    </div>
  );
};

const App = () => {
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const swipeThreshold = 50; // min px to be considered a swipe

  useEffect(() => {
    const fetchNews = async () => {
      if (!apiKey) {
        setError("API key is not configured.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const prompt = `
          Provide the top 7 latest and most significant news summaries related to the Indian share market from the last 24 hours.
          The tone should be neutral and factual, similar to a news brief.
          Each summary should be concise, around 60-80 words.
          Return the response as a JSON array where each object has two keys: "headline" (a short, catchy title) and "summary" (the news brief).
        `;

        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash-preview-04-17",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
          },
        });

        let jsonStr = response.text.trim();
        const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
        const match = jsonStr.match(fenceRegex);
        if (match && match[2]) {
          jsonStr = match[2].trim();
        }
        
        const parsedNews = JSON.parse(jsonStr);
        if (Array.isArray(parsedNews) && parsedNews.length > 0) {
          setNews(parsedNews);
        } else {
          throw new Error("Received data is not in the expected array format or is empty.");
        }

      } catch (err) {
        console.error("Failed to fetch news:", err);
        setError("Could not fetch the latest market news. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
  }, []);

  const handleNext = () => {
    if (news.length === 0) return;
    setCurrentIndex((prevIndex) => (prevIndex + 1) % news.length);
  };

  const handlePrev = () => {
    if (news.length === 0) return;
    setCurrentIndex((prevIndex) => (prevIndex - 1 + news.length) % news.length);
  };
  
  const handleTouchStart = (e: React.TouchEvent) => {
    touchEndX.current = null; // reset end position
    touchStartX.current = e.targetTouches[0].clientX;
  };
  
  const handleTouchMove = (e: React.TouchEvent) => {
      touchEndX.current = e.targetTouches[0].clientX;
  };
  
  const handleTouchEnd = () => {
    if (touchStartX.current === null || touchEndX.current === null) return;
    
    const distance = touchStartX.current - touchEndX.current;
    
    if (distance > swipeThreshold) {
      handleNext();
    } else if (distance < -swipeThreshold) {
      handlePrev();
    }
    
    touchStartX.current = null;
    touchEndX.current = null;
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="loading-container">
          <div className="loader"></div>
          <p>Fetching Latest Market News...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="error-container">
          <p className="error-message">{error}</p>
        </div>
      );
    }
    
    if (news.length === 0) {
        return (
            <div className="error-container">
              <p>No news articles found at the moment.</p>
            </div>
        );
    }

    return (
      <>
        <div 
            className="news-swiper"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
          {news.map((article, index) => {
            let status: 'prev' | 'active' | 'next' | undefined;
            if (index === currentIndex) {
              status = 'active';
            } else if (index === (currentIndex - 1 + news.length) % news.length) {
              status = 'prev';
            } else if (index === (currentIndex + 1) % news.length) {
              status = 'next';
            }
            return <NewsCard key={index} article={article} status={status} />;
          })}
        </div>
        <div className="progress-bar-container">
            <div 
                className="progress-bar" 
                style={{ width: `${((currentIndex + 1) / news.length) * 100}%` }}
                aria-valuenow={currentIndex + 1}
                aria-valuemin={1}
                aria-valuemax={news.length}
                aria-label={`News article ${currentIndex + 1} of ${news.length}`}
                role="progressbar"
            ></div>
        </div>
      </>
    );
  };

  return (
    <>
      <style>{styles}</style>
      <main className="app-container" aria-roledescription="carousel">
        <h1 className="app-title">Market Shorts</h1>
        {renderContent()}
      </main>
    </>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
