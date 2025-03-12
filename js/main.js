// Constants
const GITHUB_USERNAME = 'viraln';
const REPO_NAME = 'trendyz';
const CONTENT_PATH = 'content/articles';

// Utility Functions
const formatDate = (date) => {
    return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric'
    }).format(new Date(date));
};

const createArticleCard = (article) => {
    return `
        <article class="article-card">
            <img src="${article.image}" alt="${article.title}" class="article-image">
            <div class="article-content">
                <h3>${article.title}</h3>
                <p>${article.excerpt}</p>
                <small>Published: ${formatDate(article.date)}</small>
            </div>
        </article>
    `;
};

const createBanner = (topic) => {
    return `
        <a href="#${topic.id}" class="banner">
            <h3>${topic.title}</h3>
            <p>${topic.description}</p>
        </a>
    `;
};

// Content Loading
async function loadArticles() {
    try {
        const response = await fetch(`https://api.github.com/repos/${GITHUB_USERNAME}/${REPO_NAME}/contents/${CONTENT_PATH}`);
        const articles = await response.json();
        
        const articleList = document.getElementById('article-list');
        articleList.innerHTML = articles
            .filter(file => file.name.endsWith('.md'))
            .map(file => {
                // In a real implementation, we'd fetch and parse each article
                return {
                    title: file.name.replace('.md', ''),
                    excerpt: 'Loading...',
                    date: new Date(),
                    image: 'https://via.placeholder.com/300x200'
                };
            })
            .map(createArticleCard)
            .join('');
    } catch (error) {
        console.error('Error loading articles:', error);
    }
}

async function loadTrendingTopics() {
    // Example trending topics
    const topics = [
        {
            id: 'ai-revolution',
            title: 'AI Revolution',
            description: 'Latest breakthroughs in artificial intelligence'
        },
        {
            id: 'crypto-updates',
            title: 'Crypto Updates',
            description: 'Real-time cryptocurrency trends and analysis'
        },
        {
            id: 'tech-innovations',
            title: 'Tech Innovations',
            description: 'Cutting-edge technology developments'
        }
    ];

    const bannersContainer = document.getElementById('trending-banners');
    bannersContainer.innerHTML = topics.map(createBanner).join('');
}

// Comments System using GitHub Issues
async function loadComments(articleId) {
    try {
        const response = await fetch(`https://api.github.com/repos/${GITHUB_USERNAME}/${REPO_NAME}/issues?labels=comment,${articleId}`);
        const comments = await response.json();
        return comments;
    } catch (error) {
        console.error('Error loading comments:', error);
        return [];
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadArticles();
    loadTrendingTopics();
});

// Infinite Scroll
let isLoading = false;
window.addEventListener('scroll', () => {
    if (isLoading) return;
    
    const scrollPosition = window.innerHeight + window.scrollY;
    const pageHeight = document.documentElement.scrollHeight;
    
    if (scrollPosition >= pageHeight - 1000) {
        isLoading = true;
        loadArticles().finally(() => {
            isLoading = false;
        });
    }
});