import { json } from "@remix-run/node";
import { useLoaderData, Link, useLocation, useNavigate, useSubmit, useActionData, useFetcher, useOutletContext } from "@remix-run/react";
import { useState, useEffect } from "react";
import ColorOptionsEditor from "../components/ColorOptionsEditor";
import HeaderOptionsEditor from "../components/HeaderOptionsEditor";
import GrommetOptionsEditor from "../components/GrommetOptionsEditor";
import SizeMultiplierEditor from "../components/SizeMultiplierEditor";
import UnifiedCustomizerEditor from "../components/UnifiedCustomizerEditor";
import {
  Page,
  Layout,
  Card,
  DataTable,
  Badge,
  Button,
  Text,
  InlineStack,
  EmptyState,
  Tabs,
  TextField,
  Checkbox,
  BlockStack,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";

export async function loader({ request }) {
  const { admin } = await authenticate.admin(request);
  
  // URL'den pagination parametrelerini al
  const url = new URL(request.url);
  const cursor = url.searchParams.get('cursor');
  const direction = url.searchParams.get('direction') || 'forward';
  const limit = Math.min(parseInt(url.searchParams.get('limit')) || 250, 250); // Maksimum 250

  // GraphQL sorgusunu dinamik olarak oluştur
  let queryArgs = `first: ${limit}`;
  if (cursor && direction === 'forward') {
    queryArgs = `first: ${limit}, after: "${cursor}"`;
  } else if (cursor && direction === 'backward') {
    queryArgs = `last: ${limit}, before: "${cursor}"`;
  }

  const response = await admin.graphql(
    `query {
      products(${queryArgs}) {
        edges {
          node {
            id
            title
            handle
            status
            tags
            createdAt
            updatedAt
            metafields(namespace: "custom", first: 10) {
              edges {
                node {
                  id
                  key
                  value
                  type
                }
              }
            }
          }
          cursor
        }
        pageInfo {
          hasNextPage
          hasPreviousPage
          startCursor
          endCursor
        }
      }
    }`
  );

  const data = await response.json();
  return json({ 
    products: data.data.products.edges.map((e) => e.node),
    pageInfo: data.data.products.pageInfo,
    cursors: {
      startCursor: data.data.products.pageInfo.startCursor,
      endCursor: data.data.products.pageInfo.endCursor
    }
  });
}

export async function action({ request }) {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const productId = formData.get("productId");
  const customizerData = formData.get("customizerOptions");

  if (!productId || !customizerData) {
    return json({ success: false, error: "Missing data" });
  }

  console.log("Action received:", { productId, customizerData }); 

  try {
    const productGid = `gid://shopify/Product/${productId}`;
    
    // Shopify otomatik olarak create/update yapar - tek mutation kullan
    const mutation = `
      mutation {
        metafieldsSet(metafields: [{
          namespace: "custom",
          key: "options",
          type: "json",
          value: """${customizerData}""",
          ownerId: "${productGid}"
        }]) {
          metafields {
            id
            key
            value
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const updateResponse = await admin.graphql(mutation);
    const updateData = await updateResponse.json();
    
    if (updateData.data.metafieldsSet.userErrors.length > 0) {
      throw new Error(updateData.data.metafieldsSet.userErrors[0].message);
    }

    return json({ success: true, message: "Customizer options saved" });
  } catch (error) {
    console.error("Metafield save error:", error);
    return json({ success: false, error: error.message });
  }
}

export default function Products() {
  const { products, pageInfo, cursors } = useLoaderData();
  const [showDebug, setShowDebug] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [expanded, setExpanded] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterByTag, setFilterByTag] = useState(false);
  const fetcher = useFetcher();
  const { showToast } = useOutletContext();

  // URL'den product parametresini oku ve state'i güncelle
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const productId = searchParams.get("product");
    setExpanded(productId);
  }, [location.search]);

  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data) {
      if (fetcher.data.success) {
        showToast("Customizer options saved");
      } else if (fetcher.data.error) {
        showToast(fetcher.data.error, true);
      }
    }
  }, [fetcher.data, fetcher.state, showToast]);


  const filteredProducts = products.filter(product => {
    const titleMatch = product.title.toLowerCase().includes(searchTerm.toLowerCase());
    const tagMatch = !filterByTag || (product.tags && product.tags.includes('product-customizer'));
    return titleMatch && tagMatch;
  });

  const rows = filteredProducts.map((product) => [
    product.title,
    product.handle,
    <Badge status={product.status === "ACTIVE" ? "success" : "attention"}>
      {product.status === "ACTIVE" ? "Active" : "Inactive"}
    </Badge>,
    new Date(product.createdAt).toLocaleDateString("tr-TR"),
    <Button onClick={() => {
      const numericId = product.id.split("/").pop();
      const isCurrentlyExpanded = expanded === numericId;
      const params = new URLSearchParams(location.search);

      if (isCurrentlyExpanded) {
        params.delete("product");
      } else {
        params.set("product", numericId);
      }
      navigate(`?${params.toString()}`, { replace: true });
    }} variant="primary" size="slim">{expanded === product.id.split("/").pop() ? "Close" : "Edit"}</Button>,
  ]);

  if (products.length === 0) {
    return (
      <Page title="Products">
        <Layout>
          <Layout.Section>
            <Card>
              <EmptyState
                heading="No products found"
                image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
              >
                <p>You do not have any products yet. After adding a product, it will appear here.</p>
              </EmptyState>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  return (
    <Page 
      title="Products" 
      subtitle={`${products.length} products found`}
      backAction={{
        content: "Home",
        url: "/app",
      }}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <div style={{ padding: '16px' }}>
                <BlockStack gap="400">
                  <Text variant="headingMd">Filter and Search</Text>
                  <TextField
                    label="Product Name"
                    value={searchTerm}
                    onChange={setSearchTerm}
                    autoComplete="off"
                    placeholder="Search by product name..."
                  />
                  <Checkbox
                    label="Show only customizable products (products with product-customizer tag)"
                    checked={filterByTag}
                    onChange={(checked) => setFilterByTag(checked)}
                  />
                </BlockStack>
              </div>
              <DataTable
                columnContentTypes={['text', 'text', 'text', 'text', 'text']}
                headings={['Product Name', 'Handle', 'Status', 'Created At', 'Actions']}
                rows={rows}
                hoverable
              />
              
              {/* Pagination Controls */}
              {(pageInfo.hasNextPage || pageInfo.hasPreviousPage) && (
                <div style={{ padding: '16px', borderTop: '1px solid #e3e3e3' }}>
                  <InlineStack align="space-between" blockAlign="center">
                    <div>
                      {pageInfo.hasPreviousPage && (
                        <Button
                          onClick={() => {
                            const params = new URLSearchParams(location.search);
                            params.set('cursor', cursors.startCursor);
                            params.set('direction', 'backward');
                            navigate(`?${params.toString()}`);
                          }}
                          variant="secondary"
                        >
                          ← Previous
                        </Button>
                      )}
                    </div>
                    <Text variant="bodyMd" color="subdued">
                      Showing {products.length} products
                    </Text>
                    <div>
                      {pageInfo.hasNextPage && (
                        <Button
                          onClick={() => {
                            const params = new URLSearchParams(location.search);
                            params.set('cursor', cursors.endCursor);
                            params.set('direction', 'forward');
                            navigate(`?${params.toString()}`);
                          }}
                          variant="secondary"
                        >
                          Next →
                        </Button>
                      )}
                    </div>
                  </InlineStack>
                </div>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Product detail editor (render only for expanded product) */}
        {products.map((product) => {
          const numericId = product.id.split("/").pop();
          const isExpanded = expanded === numericId;
          if (!isExpanded) return null;
          return (
            <Layout.Section key={product.id}>
              <UnifiedCustomizerEditor
                productId={numericId}
                productTitle={product.title}
                initialValue={(() => {
                  const edges = product.metafields?.edges || [];
                  const optionsEdge = edges.find(({ node }) => node.key === "options");
                  return optionsEdge?.node?.value || "[]";
                })()}
                onSave={(config) =>
                  fetcher.submit(
                    { productId: numericId, customizerOptions: JSON.stringify(config) },
                    { method: "post" }
                  )
                }
                onCancel={() => {
                  const params = new URLSearchParams(location.search);
                  params.delete("product");
                  navigate(`?${params.toString()}`, { replace: true });
                }}
              />
            </Layout.Section>
          );
        })}
        {/* Debug toggle */}
        <Layout.Section>
          <Button onClick={() => setShowDebug(!showDebug)} variant="tertiary">
            {showDebug ? "Hide Debug" : "Show Debug"}
          </Button>
          {showDebug && (
            <Card>
              <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
                {JSON.stringify(products, null, 2)}
              </pre>
            </Card>
          )}
        </Layout.Section>
      </Layout>
      <div style={{
        position: 'fixed',
        right: 5,
        bottom: 5,
        zIndex: 9999,
        color: '#f49d9dff',
        fontSize: 10,
      }}>
        Made with <span style={{color:'#e25555', fontWeight:'bold'}}>&lt;3</span> by Beyza for Renart 
      </div>
    </Page>
  );
} 