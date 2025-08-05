import fetch from 'node-fetch';

export default async function handler(req, res) {
  // Handle CORS preflight
  res.setHeader('Access-Control-Allow-Origin', '*'); // Adjust for production!
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

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
                  reference {
                    ... on MediaImage {
                      image {
                        url
                      }
                    }
                  }
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
        console.error('Swatches fetch error:', json.errors);
        return res.status(500).json({ error: json.errors });
      }

      const data = json.data.metaobjects;
      allSwatches.push(...data.edges.map(edge => edge.node));

      hasNextPage = data.pageInfo.hasNextPage;
      cursor = hasNextPage ? data.edges[data.edges.length - 1].cursor : null;
    }

    // Replace value of main_image fields with the image URL if available
    for (const swatch of allSwatches) {
      const imageField = swatch.fields.find(f => f.key === 'main_image');
      if (imageField?.reference?.image?.url) {
        imageField.value = imageField.reference.image.url;
      }
    }

    res.status(200).json(allSwatches);

  } catch (error) {
    console.error('Unexpected error:', error);
    res.status(500).json({ error: 'Failed to fetch swatches' });
  }
}