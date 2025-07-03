import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';

// --- Types ---
interface NewsArticle {
  headline: string;
  summary: string;
  date: string;
  imageUrl: string;
}

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
    max-width: 90%;
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
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    transition: transform 0.5s ease-out, opacity 0.5s ease-out;
    opacity: 0;
    transform-style: preserve-3d;
    backface-visibility: hidden;
    will-change: transform, opacity;
    overflow: hidden; /* To contain image corners */
  }
  
  .news-card-image-wrapper {
    width: 100%;
    height: 220px;
    background-color: #333; /* Placeholder color */
    flex-shrink: 0;
  }
  
  .news-card-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  
  .news-card-content {
    padding: 20px 30px 30px;
    display: flex;
    flex-direction: column;
    flex-grow: 1;
    overflow: hidden;
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
    font-size: 1.4rem;
    margin: 0 0 8px;
    font-weight: 700;
    color: #f0f0f0;
    line-height: 1.3;
  }
  
  .news-card-date {
    font-size: 0.8rem;
    color: #999;
    margin-bottom: 15px;
  }

  .news-card-summary {
    font-size: 1rem;
    line-height: 1.6;
    color: #b0b0b0;
    flex-grow: 1;
    overflow-y: auto;
    padding-right: 10px; /* space for scrollbar */
    margin: 0;
  }
  
  .news-card-summary::-webkit-scrollbar { width: 5px; }
  .news-card-summary::-webkit-scrollbar-track { background: transparent; }
  .news-card-summary::-webkit-scrollbar-thumb { background: #555; border-radius: 10px; }
  .news-card-summary::-webkit-scrollbar-thumb:hover { background: #777; }

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

// --- Helpers ---
const formatDate = (dateString: string) => {
    try {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        });
    } catch (e) {
        return dateString; // Fallback to original string if format is invalid
    }
};

// --- Components ---
const NewsCard: React.FC<{ article: NewsArticle, status?: 'prev' | 'active' | 'next' }> = ({ article, status }) => {
  return (
    <div className={`news-card ${status || ''}`.trim()} aria-hidden={status !== 'active'}>
      <div className="news-card-image-wrapper">
        {article.imageUrl && <img src={article.imageUrl} alt={article.headline} className="news-card-image" />}
      </div>
      <div className="news-card-content">
        <h2>{article.headline}</h2>
        <p className="news-card-date">{formatDate(article.date)}</p>
        <p className="news-card-summary">{article.summary}</p>
      </div>
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
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/generate-news');

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || `Request failed with status ${response.status}`);
        }

        const finalNews: NewsArticle[] = await response.json();
        
        if (!Array.isArray(finalNews)) {
          throw new Error("Received data from server is not in the expected format.");
        }
        
        setNews(finalNews);

      } catch (err) {
        console.error("Failed to fetch news:", err);
        setError(`Could not fetch market news. Please try again later. (Details: ${err.message})`);
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
          <p>Crafting Your News Feed...</p>
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
            // Only render the active, previous, and next cards for performance
            if (status) {
              return <NewsCard key={index} article={article} status={status} />;
            }
            return null;
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
