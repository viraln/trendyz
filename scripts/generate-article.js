const fetch = require("node-fetch");
const fs = require("fs").promises;
const path = require("path");
const FormData = require("form-data");

// Utility functions
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const retry = async (fn, retries = 3, delay = 2000) => {
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (error) {
            if (i === retries - 1) throw error;
            await sleep(delay);
        }
    }
};

const sanitizeTitle = (text) => {
    return text
        .replace(/[^\w\s-]/g, '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .slice(0, 50);
};

async function generateArticle(topic = "tech") {
    console.log(`Generating article about: ${topic}`);
    
    try {
        // Generate article text
        const textResponse = await retry(async () => {
            const response = await fetch("https://api-inference.huggingface.co/models/gpt2-xl", {
                method: "POST",
                headers: { 
                    "Authorization": `Bearer ${process.env.HF_TOKEN}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    inputs: `Write a comprehensive article about the latest developments in ${topic}:`,
                    parameters: {
                        max_length: 1000,
                        temperature: 0.7,
                        top_p: 0.9,
                        do_sample: true
                    }
                })
            });
            
            if (!response.ok) throw new Error(`Text generation failed: ${response.statusText}`);
            return response.json();
        });

        const articleText = textResponse[0].generated_text;
        
        // Generate image
        const imageResponse = await retry(async () => {
            const response = await fetch("https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-xl-base-1.0", {
                method: "POST",
                headers: { 
                    "Authorization": `Bearer ${process.env.HF_TOKEN}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    inputs: `High quality professional photograph representing ${topic}, modern, detailed, 4k`,
                    parameters: {
                        negative_prompt: "blurry, low quality, distorted, watermark",
                        num_inference_steps: 50,
                        guidance_scale: 7.5
                    }
                })
            });
            
            if (!response.ok) throw new Error(`Image generation failed: ${response.statusText}`);
            return response.blob();
        });

        // Upload image to ImgBB
        const form = new FormData();
        form.append("image", Buffer.from(await imageResponse.arrayBuffer()), "image.png");
        
        const uploadResponse = await retry(async () => {
            const response = await fetch(`https://api.imgbb.com/1/upload?key=${process.env.IMGBB_KEY}`, {
                method: "POST",
                body: form
            });
            
            if (!response.ok) throw new Error(`Image upload failed: ${response.statusText}`);
            return response.json();
        });

        const imageUrl = uploadResponse.data.url;

        // Generate related topics
        const relatedTopics = [
            `Latest ${topic} innovations`,
            `Future of ${topic}`,
            `${topic} market analysis`,
            `${topic} expert insights`,
            `${topic} industry trends`
        ];

        // Create suggestions section
        const suggestions = relatedTopics.map(prompt => {
            const slug = sanitizeTitle(prompt);
            return `- [${prompt}](https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec?topic=${encodeURIComponent(prompt)}&slug=${slug})`;
        }).join("\n");

        // Add monetization elements
        const adSenseMid = `
<div class="ad-break">
    <ins class="adsbygoogle"
         style="display:block"
         data-ad-client="${process.env.ADSENSE_CLIENT}"
         data-ad-slot="${process.env.ADSENSE_SLOT_MID}"
         data-ad-format="auto"
         data-full-width-responsive="true"></ins>
    <script>(adsbygoogle = window.adsbygoogle || []).push({});</script>
</div>`;

        const affiliateLinks = [
            `[Top ${topic} Products](https://amazon.com/s?k=${encodeURIComponent(topic)}&tag=${process.env.AMAZON_AFFILIATE_ID})`,
            `[${topic} Courses](https://udemy.com/courses/search/?q=${encodeURIComponent(topic)}&ref=${process.env.UDEMY_AFFILIATE_ID})`
        ].join("\n");

        // Format the article
        const date = new Date().toISOString();
        const title = `Latest ${topic} Developments - ${new Date().toLocaleDateString()}`;
        const slug = sanitizeTitle(title);
        
        const markdown = `---
title: "${title}"
date: "${date}"
author: "Trendyz AI"
image: "${imageUrl}"
tags: ["${topic}", "news", "trending", "analysis"]
slug: "${slug}"
---

![${topic} visualization](${imageUrl})

${articleText.split("\n\n")[0]}

${adSenseMid}

${articleText.split("\n\n").slice(1).join("\n\n")}

## Recommended Products and Resources

${affiliateLinks}

## Continue Exploring

${suggestions}

---

[💬 Discuss this article](https://github.com/viraln/trendyz/issues/new?title=Comments%20on%20${encodeURIComponent(title)}&labels=comments,${encodeURIComponent(topic)})
`;

        // Save the article
        const articlesDir = path.join(process.cwd(), "content", "articles");
        await fs.mkdir(articlesDir, { recursive: true });
        
        const fileName = `${date.split("T")[0]}-${slug}.md`;
        await fs.writeFile(path.join(articlesDir, fileName), markdown);
        
        console.log(`Successfully generated article: ${fileName}`);
        return fileName;

    } catch (error) {
        console.error("Error generating article:", error);
        throw error;
    }
}

// Allow running from command line or as module
if (require.main === module) {
    const topic = process.argv[2] || "tech";
    generateArticle(topic).catch(error => {
        console.error("Article generation failed:", error);
        process.exit(1);
    });
}

module.exports = { generateArticle };