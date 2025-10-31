import { json } from "@remix-run/node";
import { useLoaderData, useNavigate, useFetcher, useOutletContext } from "@remix-run/react";
import { useState, useEffect, useMemo } from "react";
import {
  Page,
  Layout,
  Card,
  DataTable,
  Badge,
  Button,
  Text,
  InlineStack,
  BlockStack,
  Select,
  TextField,
  Checkbox,
  Banner,
  Modal,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";

export async function loader({ request }) {
  const { admin } = await authenticate.admin(request);
  
  const response = await admin.graphql(
    `query {
      products(first: 250) {
        edges {
          node {
            id
            title
            handle
            status
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
      }
    }`
  );

  const data = await response.json();
  return json({ 
    products: data.data.products.edges.map((e) => e.node)
  });
}

export async function action({ request }) {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const action = formData.get("action");

  if (action === "bulkUpdate") {
    const productIds = JSON.parse(formData.get("productIds"));
    const blockId = formData.get("blockId");
    const updates = JSON.parse(formData.get("updates"));

    try {
      const results = [];
      
      for (const productId of productIds) {
        const productGid = `gid://shopify/Product/${productId}`;
        
        // Get current metafield
        const getResponse = await admin.graphql(
          `query {
            product(id: "${productGid}") {
              metafields(namespace: "custom", first: 10) {
                edges {
                  node {
                    id
                    key
                    value
                  }
                }
              }
            }
          }`
        );
        
        const getData = await getResponse.json();
        const metafields = getData.data.product.metafields.edges.map(e => e.node);
        const optionsMetafield = metafields.find(m => m.key === "options");
        
        if (!optionsMetafield) {
          results.push({ productId, success: false, error: "No customizer config found" });
          continue;
        }

        // Parse and update
        let config = JSON.parse(optionsMetafield.value);
        const blockIndex = config.findIndex(b => b.id === blockId);
        
        if (blockIndex === -1) {
          results.push({ productId, success: false, error: "Block not found" });
          continue;
        }

        // Apply updates
        config[blockIndex] = { ...config[blockIndex], ...updates };

        // Save back
        const mutation = `
          mutation {
            metafieldsSet(metafields: [{
              namespace: "custom",
              key: "options",
              type: "json",
              value: """${JSON.stringify(config)}""",
              ownerId: "${productGid}"
            }]) {
              metafields {
                id
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
          results.push({ 
            productId, 
            success: false, 
            error: updateData.data.metafieldsSet.userErrors[0].message 
          });
        } else {
          results.push({ productId, success: true });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failCount = results.length - successCount;

      return json({ 
        success: true, 
        message: `${successCount} products updated successfully. ${failCount} failed.`,
        results 
      });
    } catch (error) {
      console.error("Bulk update error:", error);
      return json({ success: false, error: error.message });
    }
  }

  return json({ success: false, error: "Invalid action" });
}

export default function BulkEditor() {
  const { products } = useLoaderData();
  const navigate = useNavigate();
  const fetcher = useFetcher();
  const { showToast } = useOutletContext();
  
  const [selectedBlockId, setSelectedBlockId] = useState("");
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [blockType, setBlockType] = useState("");
  const [showEditor, setShowEditor] = useState(false);
  
  // Block updates state
  const [blockUpdates, setBlockUpdates] = useState({
    title: "",
    enabled: true,
    pricing: { mode: "none", value: 0 }
  });

  useEffect(() => {
    if (fetcher.state === 'idle' && fetcher.data) {
      if (fetcher.data.success) {
        showToast(fetcher.data.message || "Bulk update completed");
        setShowEditor(false);
        setSelectedProducts([]);
      } else if (fetcher.data.error) {
        showToast(fetcher.data.error, true);
      }
    }
  }, [fetcher.data, fetcher.state, showToast]);

  // Extract all unique block IDs from products
  const allBlocks = useMemo(() => {
    const blockMap = new Map();
    
    products.forEach(product => {
      const optionsMetafield = product.metafields.edges
        .map(e => e.node)
        .find(m => m.key === "options");
      
      if (!optionsMetafield) return;
      
      try {
        const config = JSON.parse(optionsMetafield.value);
        config.forEach(block => {
          if (block.type !== "config" && block.id) {
            if (!blockMap.has(block.id)) {
              blockMap.set(block.id, {
                id: block.id,
                type: block.type,
                title: block.title,
                count: 1,
                products: [product.id.split("/").pop()]
              });
            } else {
              const existing = blockMap.get(block.id);
              existing.count++;
              existing.products.push(product.id.split("/").pop());
            }
          }
        });
      } catch (e) {
        console.error("Error parsing config:", e);
      }
    });
    
    return Array.from(blockMap.values());
  }, [products]);

  // Get products that have the selected block
  const productsWithSelectedBlock = useMemo(() => {
    if (!selectedBlockId) return [];
    
    const block = allBlocks.find(b => b.id === selectedBlockId);
    if (!block) return [];
    
    return products.filter(p => {
      const numericId = p.id.split("/").pop();
      return block.products.includes(numericId);
    });
  }, [selectedBlockId, allBlocks, products]);

  // Get current block data from first selected product
  useEffect(() => {
    if (selectedBlockId && productsWithSelectedBlock.length > 0) {
      const firstProduct = productsWithSelectedBlock[0];
      const optionsMetafield = firstProduct.metafields.edges
        .map(e => e.node)
        .find(m => m.key === "options");
      
      if (optionsMetafield) {
        try {
          const config = JSON.parse(optionsMetafield.value);
          const block = config.find(b => b.id === selectedBlockId);
          
          if (block) {
            setBlockType(block.type);
            setBlockUpdates({
              title: block.title || "",
              enabled: block.enabled ?? true,
              pricing: block.pricing || { mode: "none", value: 0 }
            });
          }
        } catch (e) {
          console.error("Error loading block data:", e);
        }
      }
    }
  }, [selectedBlockId, productsWithSelectedBlock]);

  const handleBulkUpdate = () => {
    if (selectedProducts.length === 0) {
      showToast("Please select at least one product", true);
      return;
    }

    fetcher.submit(
      {
        action: "bulkUpdate",
        productIds: JSON.stringify(selectedProducts),
        blockId: selectedBlockId,
        updates: JSON.stringify(blockUpdates)
      },
      { method: "post" }
    );
  };

  const rows = productsWithSelectedBlock.map((product) => {
    const numericId = product.id.split("/").pop();
    const isSelected = selectedProducts.includes(numericId);
    
    return [
      <Checkbox
        checked={isSelected}
        onChange={(checked) => {
          if (checked) {
            setSelectedProducts([...selectedProducts, numericId]);
          } else {
            setSelectedProducts(selectedProducts.filter(id => id !== numericId));
          }
        }}
      />,
      product.title,
      product.handle,
      <Badge status={product.status === "ACTIVE" ? "success" : "attention"}>
        {product.status === "ACTIVE" ? "Active" : "Inactive"}
      </Badge>,
    ];
  });

  const selectAllProducts = () => {
    const allIds = productsWithSelectedBlock.map(p => p.id.split("/").pop());
    setSelectedProducts(allIds);
  };

  const deselectAllProducts = () => {
    setSelectedProducts([]);
  };

  return (
    <Page 
      title="Bulk Block Editor" 
      subtitle="Edit same blocks across multiple products"
      backAction={{
        content: "Products",
        url: "/app/products",
      }}
    >
      <Layout>
        <Layout.Section>
          <Banner tone="info">
            <p>Select a block ID to see all products that use it, then edit them all at once.</p>
          </Banner>
        </Layout.Section>

        <Layout.Section>
          <Card sectioned>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Step 1: Select a Block ID</Text>
              
              {allBlocks.length === 0 ? (
                <Banner tone="warning">
                  <p>No customizer blocks found. Please configure products first.</p>
                </Banner>
              ) : (
                <>
                  <Select
                    label="Block ID"
                    options={[
                      { label: "Select a block", value: "" },
                      ...allBlocks.map(block => ({
                        label: `${block.id} (${block.type}) - ${block.title} - Found in ${block.count} products`,
                        value: block.id
                      }))
                    ]}
                    value={selectedBlockId}
                    onChange={(value) => {
                      setSelectedBlockId(value);
                      setSelectedProducts([]);
                      setShowEditor(false);
                    }}
                  />

                  {selectedBlockId && (
                    <InlineStack align="space-between">
                      <Text variant="bodyMd" as="p" tone="subdued">
                        Found in {productsWithSelectedBlock.length} products
                      </Text>
                      <Button 
                        variant="primary"
                        onClick={() => setShowEditor(true)}
                      >
                        Continue to Edit
                      </Button>
                    </InlineStack>
                  )}
                </>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        {selectedBlockId && showEditor && (
          <>
            <Layout.Section>
              <Card sectioned>
                <BlockStack gap="400">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text variant="headingMd" as="h2">
                      Step 2: Select Products to Update
                    </Text>
                    <InlineStack gap="200">
                      <Button size="slim" onClick={selectAllProducts}>Select All</Button>
                      <Button size="slim" onClick={deselectAllProducts}>Deselect All</Button>
                    </InlineStack>
                  </InlineStack>

                  {selectedProducts.length > 0 && (
                    <Banner tone="success">
                      <p>{selectedProducts.length} product(s) selected</p>
                    </Banner>
                  )}

                  <DataTable
                    columnContentTypes={['text', 'text', 'text', 'text']}
                    headings={['Select', 'Product Name', 'Handle', 'Status']}
                    rows={rows}
                    hoverable
                  />
                </BlockStack>
              </Card>
            </Layout.Section>

            <Layout.Section>
              <Card sectioned>
                <BlockStack gap="400">
                  <Text variant="headingMd" as="h2">Step 3: Edit Block Properties</Text>
                  
                  <Banner tone="info">
                    <p>Changes will be applied to all selected products.</p>
                  </Banner>

                  <TextField
                    label="Block Title"
                    value={blockUpdates.title}
                    onChange={(value) => setBlockUpdates({ ...blockUpdates, title: value })}
                  />

                  <Checkbox
                    label="Enabled"
                    checked={blockUpdates.enabled}
                    onChange={(checked) => setBlockUpdates({ ...blockUpdates, enabled: checked })}
                  />

                  {blockType !== "area" && (
                    <BlockStack gap="300">
                      <Text variant="headingSm" as="h3">Pricing</Text>
                      
                      <InlineStack gap="300">
                        <div style={{ width: 200 }}>
                          <Select
                            label="Pricing Mode"
                            options={[
                              { label: "None", value: "none" },
                              { label: "Added", value: "added" },
                              { label: "Multiplier", value: "multiplier" },
                            ]}
                            value={blockUpdates.pricing.mode}
                            onChange={(value) => setBlockUpdates({ 
                              ...blockUpdates, 
                              pricing: { ...blockUpdates.pricing, mode: value } 
                            })}
                          />
                        </div>
                        
                        <div style={{ width: 200 }}>
                          <TextField
                            label="Pricing Value"
                            type="number"
                            step="any"
                            value={String(blockUpdates.pricing.value)}
                            onChange={(value) => setBlockUpdates({ 
                              ...blockUpdates, 
                              pricing: { ...blockUpdates.pricing, value: parseFloat(value) || 0 } 
                            })}
                          />
                        </div>
                      </InlineStack>
                    </BlockStack>
                  )}

                  <InlineStack align="end">
                    <Button 
                      variant="primary"
                      onClick={handleBulkUpdate}
                      loading={fetcher.state === "submitting"}
                      disabled={selectedProducts.length === 0}
                    >
                      Apply Changes to {selectedProducts.length} Product(s)
                    </Button>
                  </InlineStack>
                </BlockStack>
              </Card>
            </Layout.Section>
          </>
        )}
      </Layout>
    </Page>
  );
}
