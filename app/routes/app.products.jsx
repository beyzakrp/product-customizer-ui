import { json } from "@remix-run/node";
import { useLoaderData, Link, useLocation, useNavigate, useSubmit, useActionData, useFetcher } from "@remix-run/react";
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
  Banner,
  Tabs,
  TextField,
  Checkbox,
  BlockStack,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";

export async function loader({ request }) {
  const { admin } = await authenticate.admin(request);

  const response = await admin.graphql(
    `query {
      products(first: 50) {
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
        }
        pageInfo {
          hasNextPage
          hasPreviousPage
        }
      }
    }`
  );

  const data = await response.json();
  return json({ 
    products: data.data.products.edges.map((e) => e.node),
    pageInfo: data.data.products.pageInfo 
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
  const { products, pageInfo } = useLoaderData();
  const actionData = useActionData();
  const [showDebug, setShowDebug] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [expanded, setExpanded] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterByTag, setFilterByTag] = useState(false);

  // URL'den product parametresini oku ve state'i güncelle
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const productId = searchParams.get("product");
    setExpanded(productId);
  }, [location.search]);
  const fetcher = useFetcher();

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
      const newId = expanded===product.id ? null : product.id.split("/").pop();
      const params = new URLSearchParams(location.search);
      if (newId) {
        params.set("product", newId);
      } else {
        params.delete("product");
      }
      navigate(`?${params.toString()}`, { replace: true });
      setExpanded(newId ? product.id : null);
    }} variant="primary" size="slim">{expanded===product.id?"Close":"Edit"}</Button>,
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
      {(fetcher.data?.success || actionData?.success) && (
        <Banner tone="success" title="Saved">Color options have been successfully updated.</Banner>
      )}
      {(fetcher.data?.error || actionData?.error) && (
        <Banner tone="critical" title="Hata">{fetcher.data?.error || actionData.error}</Banner>
      )}

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
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Product detail cards */}
        {products.map((product) => (
          <Layout.Section key={product.id}>
            
            {/* Inline Editor */}
            {expanded === product.id.split("/").pop() && (
              <Layout.Section>
                <UnifiedCustomizerEditor
                  initialValue={(() => {
                    const edges = product.metafields?.edges || [];
                    const optionsEdge = edges.find(({node}) => node.key === "options");
                    return optionsEdge?.node?.value || "[]";
                  })()}
                  onSave={(config)=> fetcher.submit({productId: product.id.split("/").pop(), customizerOptions: JSON.stringify(config)}, {method:"post"})}
                  onCancel={()=> setExpanded(null)}
                />
              </Layout.Section>
            )}
          </Layout.Section>
        ))}
      </Layout>
      <Layout.Section>
        <Button onClick={() => setShowDebug(!showDebug)} variant="tertiary">
          {showDebug ? "Hide Debug" : "Show Debug"}
        </Button>
        {showDebug && (
          <Card>
            <pre style={{whiteSpace:"pre-wrap", wordBreak:"break-all"}}>
              {JSON.stringify(products, null, 2)}
            </pre>
          </Card>
        )}
      </Layout.Section>
    </Page>
  );
} 