import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();
const app = express();

const SHOPIFY_DOMAIN = process.env.SHOPIFY_DOMAIN;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

async function fetchAllSwatches() {
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
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": ADMIN_TOKEN,
      },
      body: JSON.stringify({ query, variables: { cursor } }),
    });

    const json = await response.json();
    const data = json.data.metaobjects;

    const swatches = data.edges.map(edge => edge.node);
    allSwatches.push(...swatches);

    hasNextPage = data.pageInfo.hasNextPage;
    cursor = hasNextPage ? data.edges[data.edges.length - 1].cursor : null;
  }

  return allSwatches;
}

app.get("/swatches", async (req, res) => {
  try {
    const swatches = await fetchAllSwatches();
    res.json(swatches);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch swatches" });
  }
});

app.listen(3000, () => {
  console.log("Running on port 3000");
});