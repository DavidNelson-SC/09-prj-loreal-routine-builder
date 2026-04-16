# Project 9: L'Oréal Routine Builder

L’Oréal is expanding what’s possible with AI, and now your chatbot is getting smarter. This week, you’ll upgrade it into a product-aware routine builder.

Users will be able to browse real L’Oréal brand products, select the ones they want, and generate a personalized routine using AI. They can also ask follow-up questions about their routine—just like chatting with a real advisor.

## Cloudflare Worker Setup

This project now sends AI requests through a Cloudflare Worker instead of calling OpenAI directly from the browser.

### 1. Install Wrangler

```bash
npm install -g wrangler
```

### 2. Log in to Cloudflare

```bash
wrangler login
```

### 3. Add your OpenAI API key as a Worker secret

Run this command from the project root:

```bash
wrangler secret put OPENAI_API_KEY
```

### 4. Deploy the Worker

```bash
wrangler deploy
```

After deployment, copy your Worker URL.

### 5. Create local secrets file for frontend

Copy `secrets.example.js` to `secrets.js`, then set your Worker URL:

```js
window.WORKER_URL = "https://your-worker-subdomain.workers.dev";
```

`secrets.js` is loaded by `index.html`, so your app can send requests to the Worker endpoint.

## Included LevelUp Features

- Web search mode: toggle `Use live web search` in the chat area to allow current web results and citations.
- Product keyword search: type in the search field to filter products by name, brand, category, or description.
- RTL support: click `Switch to RTL` to mirror layout direction for right-to-left languages.
