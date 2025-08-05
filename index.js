import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Helper function to resolve main image URL
async function resolveImageUrl(SHOPIFY_DOMAIN, ADMIN_TOKEN, gid) {
  const imageQuery = `
    query GetImage($id: ID!) {
      node(id: $id) {
        ... on MediaImage {
          image {
            url
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
    body: JSON.stringify({ query: imageQuery, variables: { id: gid } }),
  });

  const json = await response.json();

  if (json.errors) {
    console.error('Image query error:', json.errors);
    return null;
  }

  return json?.data?.node?.image?.url || null;
}

app.get('/api/swatches', async (req, res) => {
  const SHOPIFY_DOMAIN = process.env.SHOPIFY_DOMAIN;
  const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

  if (!SHOPIFY_DOMAIN || !ADMIN_TOKEN) {
    return res.status(500).json({ error: 'Missing environment variables' });
  }

  try {
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
        console.error('Swatch fetch error:', json.errors);
        return res.status(500).json({ error: json.errors });
      }

      const data = json.data.metaobjects;
      allSwatches.push(...data.edges.map(edge => edge.node));

      hasNextPage = data.pageInfo.hasNextPage;
      cursor = hasNextPage ? data.edges[data.edges.length - 1].cursor : null;
    }

    // Resolve main_image URLs
    const swatchesWithImages = await Promise.all(
      allSwatches.map(async (swatch) => {
        const imageField = swatch.fields.find(f => f.key === 'main_image');
        let main_image_url = null;

        if (imageField?.value?.startsWith('gid://shopify/MediaImage/')) {
          main_image_url = await resolveImageUrl(SHOPIFY_DOMAIN, ADMIN_TOKEN, imageField.value);
          // Replace the value with the resolved URL
          imageField.value = main_image_url;
        }

        return { ...swatch, main_image_url };
      })
    );

    res.status(200).json(swatchesWithImages);
  } catch (error) {
    console.error('Unexpected error:', error);
    res.status(500).json({ error: 'Failed to fetch swatches or resolve images' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});