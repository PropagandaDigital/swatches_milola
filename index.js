import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/swatches', async (req, res) => {
  const SHOPIFY_DOMAIN = process.env.SHOPIFY_DOMAIN;
  const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

  if (!SHOPIFY_DOMAIN || !ADMIN_TOKEN) {
    return res.status(500).json({ error: 'Missing environment variables' });
  }

  let allSwatches = [];
  let cursor = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const query = `
      query GetSwatches($cursor: String) {
        metaobjects(type: "swatches", first: 250, after: $cursor) {
          pageInfo {
            hasNextPage
          }
          edges {
            cursor
            node {
              id
              handle
              fields {
                key
                value
              }
            }
          }
        }
      }
    `;

    const response = await fetch(`https://${SHOPIFY_DOMAIN}/admin/api/2024-07/graphql.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': ADMIN_TOKEN,
      },
      body: JSON.stringify({ query, variables: { cursor } }),
    });

    const json = await response.json();

    if (json.errors) {
      return res.status(500).json({ error: json.errors });
    }

    const data = json.data.metaobjects;
    allSwatches.push(...data.edges.map(edge => edge.node));

    hasNextPage = data.pageInfo.hasNextPage;
    cursor = hasNextPage ? data.edges[data.edges.length - 1].cursor : null;
  }

  res.status(200).json(allSwatches);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});