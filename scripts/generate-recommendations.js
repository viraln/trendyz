const fs = require('fs').promises;
const path = require('path');
const matter = require('gray-matter');

// Simple NLP utilities
const tokenize = (text) => text.toLowerCase().split(/\W+/).filter(Boolean);
const calculateTFIDF = (term, doc, docs) => {
    const tf = doc.terms.filter(t => t === term).length / doc.terms.length;
    const docsWithTerm = docs.filter(d => d.terms.includes(term)).length;
    const idf = Math.log(docs.length / (1 + docsWithTerm));
    return tf * idf;
};

async function generateRecommendations() {
    try {
        const articlesDir = path.join(process.cwd(), 'content', 'articles');
        const files = await fs.readdir(articlesDir);
        
        // Read and parse all articles
        const articles = await Promise.all(
            files
                .filter(file => file.endsWith('.md'))
                .map(async file => {
                    const content = await fs.readFile(path.join(articlesDir, file), 'utf-8');
                    const { data, content: articleContent } = matter(content);
                    const terms = tokenize(articleContent);
                    
                    return {
                        file,
                        path: path.join(articlesDir, file),
                        frontmatter: data,
                        content: articleContent,
                        terms,
                        tags: data.tags || []
                    };
                })
        );

        // Process each article
        for (const article of articles) {
            // Calculate similarity scores
            const similarities = articles
                .filter(a => a.file !== article.file)
                .map(other => {
                    // Tag-based similarity
                    const tagOverlap = article.tags.filter(t => 
                        other.tags.includes(t)
                    ).length / Math.max(article.tags.length, other.tags.length);

                    // Content-based similarity using TF-IDF
                    const uniqueTerms = [...new Set([...article.terms, ...other.terms])];
                    const tfidfSimilarity = uniqueTerms.reduce((sum, term) => {
                        const score1 = calculateTFIDF(term, article, articles);
                        const score2 = calculateTFIDF(term, other, articles);
                        return sum + (score1 * score2);
                    }, 0);

                    // Recency bonus (newer articles get slight preference)
                    const date1 = new Date(article.frontmatter.date);
                    const date2 = new Date(other.frontmatter.date);
                    const daysDiff = Math.abs(date1 - date2) / (1000 * 60 * 60 * 24);
                    const recencyScore = Math.exp(-daysDiff / 30); // Exponential decay over 30 days

                    // Combined score
                    const totalScore = (tagOverlap * 0.4) + (tfidfSimilarity * 0.4) + (recencyScore * 0.2);

                    return {
                        file: other.file,
                        title: other.frontmatter.title,
                        score: totalScore
                    };
                })
                .sort((a, b) => b.score - a.score)
                .slice(0, 5);

            // Generate recommendation section
            const recommendationSection = `

## Recommended Articles

${similarities.map(sim => 
    `- [${sim.title}](/articles/${sim.file.replace('.md', '')})`
).join('\n')}

---

*These recommendations are automatically generated based on content similarity and trending topics.*
`;

            // Update the article with recommendations
            const updatedContent = matter.stringify(article.content, {
                ...article.frontmatter,
                recommendations: similarities.map(s => s.file)
            }) + recommendationSection;

            await fs.writeFile(article.path, updatedContent);
        }

        console.log('Successfully updated recommendations for all articles');

    } catch (error) {
        console.error('Error generating recommendations:', error);
        throw error;
    }
}

// Allow running from command line or as module
if (require.main === module) {
    generateRecommendations().catch(error => {
        console.error('Recommendation generation failed:', error);
        process.exit(1);
    });
}

module.exports = { generateRecommendations };