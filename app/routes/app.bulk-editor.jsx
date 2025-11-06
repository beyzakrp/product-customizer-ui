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

  if (action === "bulkAddBlock") {
    const productIds = JSON.parse(formData.get("productIds"));
    const blockToAdd = JSON.parse(formData.get("blockToAdd"));
    const sourceProductId = formData.get("sourceProductId");

    try {
      const results = [];
      
      for (const productId of productIds) {
        // Skip source product
        if (productId === sourceProductId) {
          results.push({ productId, success: true, skipped: true });
          continue;
        }

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

        // Parse and check if block already exists
        let config = JSON.parse(optionsMetafield.value);
        const existingBlockIndex = config.findIndex(b => b.id === blockToAdd.id);
        
        if (existingBlockIndex !== -1) {
          results.push({ productId, success: false, error: "Block with same ID already exists" });
          continue;
        }

        // Add block to config (before the last item or at the end)
        config.push(blockToAdd);

        // Update step_order in config block
        const configIndex = config.findIndex(b => b.type === "config");
        if (configIndex !== -1) {
          const newStepOrder = config
            .filter(b => b.type !== "config" && b.id)
            .map(b => b.id);
          config[configIndex] = { ...config[configIndex], step_order: newStepOrder };
        }

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

      const successCount = results.filter(r => r.success && !r.skipped).length;
      const failCount = results.filter(r => !r.success).length;
      const skippedCount = results.filter(r => r.skipped).length;

      return json({ 
        success: true, 
        message: `${successCount} products updated, ${skippedCount} skipped (source), ${failCount} failed.`,
        results 
      });
    } catch (error) {
      console.error("Bulk add block error:", error);
      return json({ success: false, error: error.message });
    }
  }

  if (action === "bulkUpdateGeneralSettings") {
    const productIds = JSON.parse(formData.get("productIds"));
    const generalUpdates = JSON.parse(formData.get("updates"));

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

        // Parse and update config block
        let config = JSON.parse(optionsMetafield.value);
        const configIndex = config.findIndex(b => b.type === "config");
        
        if (configIndex === -1) {
          results.push({ productId, success: false, error: "Config block not found" });
          continue;
        }

        // Apply updates to config
        config[configIndex] = { ...config[configIndex], ...generalUpdates };

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
  
  const [editMode, setEditMode] = useState("block"); // "block", "general", or "addBlock"
  const [selectedBlockId, setSelectedBlockId] = useState("");
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [blockType, setBlockType] = useState("");
  const [showEditor, setShowEditor] = useState(false);
  
  // General Settings updates state
  const [generalUpdates, setGeneralUpdates] = useState({
    title: "",
    enabled: true,
    show_price: true,
    currency: "USD",
    unit_price: 0
  });
  
  // For adding blocks
  const [sourceProductId, setSourceProductId] = useState("");
  const [blockToAdd, setBlockToAdd] = useState(null);
  
  // Block updates state - comprehensive
  const [blockUpdates, setBlockUpdates] = useState({
    title: "",
    enabled: true,
    pricing: { mode: "none", value: 0 },
    // Picker specific
    options: [],
    isNested: false,
    nested: [],
    hasGuide: false,
    // Input specific
    subtype: "text",
    placeholder: "",
    // Area specific
    limits: { width: { min: 0, max: 1000 } },
    hasInputSection: false,
    inputSection: { title: "", placeholder: "" },
    guide: { enabled: false, title: "", sections: [] },
    isHasGuideImage: false,
    guideImageUrl: "",
    unit: "inch"
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
              pricing: block.pricing || { mode: "none", value: 0 },
              // Picker specific
              options: block.options || [],
              isNested: block.isNested || false,
              nested: block.nested || [],
              hasGuide: block.hasGuide || false,
              // Input specific
              subtype: block.subtype || "text",
              placeholder: block.placeholder || "",
              // Area specific
              limits: block.limits || { width: { min: 0, max: 1000 } },
              hasInputSection: block.hasInputSection || false,
              inputSection: block.inputSection || { title: "", placeholder: "" },
              guide: block.guide || { enabled: false, title: "", sections: [] },
              isHasGuideImage: block.isHasGuideImage || false,
              guideImageUrl: block.guideImageUrl || "",
              unit: block.unit || "inch"
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

    if (editMode === "addBlock") {
      if (!blockToAdd) {
        showToast("Please select a block to add", true);
        return;
      }
      fetcher.submit(
        {
          action: "bulkAddBlock",
          productIds: JSON.stringify(selectedProducts),
          blockToAdd: JSON.stringify(blockToAdd),
          sourceProductId: sourceProductId
        },
        { method: "post" }
      );
    } else if (editMode === "general") {
      fetcher.submit(
        {
          action: "bulkUpdateGeneralSettings",
          productIds: JSON.stringify(selectedProducts),
          updates: JSON.stringify(generalUpdates)
        },
        { method: "post" }
      );
    } else {
      fetcher.submit(
        {
          action: "bulkUpdate",
          productIds: JSON.stringify(selectedProducts),
          blockId: selectedBlockId,
          updates: JSON.stringify(blockUpdates)
        },
        { method: "post" }
      );
    }
  };

  // Get products that have customizer config (for general settings mode)
  const productsWithConfig = useMemo(() => {
    return products.filter(p => {
      const optionsMetafield = p.metafields.edges
        .map(e => e.node)
        .find(m => m.key === "options");
      return !!optionsMetafield;
    });
  }, [products]);

  // Get products for product selection table
  const productsForSelection = useMemo(() => {
    if (editMode === "general") {
      return productsWithConfig;
    } else if (editMode === "addBlock") {
      // Show all products with config except source product
      return productsWithConfig.filter(p => p.id.split("/").pop() !== sourceProductId);
    }
    return productsWithSelectedBlock;
  }, [editMode, productsWithConfig, productsWithSelectedBlock, sourceProductId]);

  const rows = productsForSelection.map((product) => {
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
    const allIds = productsForSelection.map(p => p.id.split("/").pop());
    setSelectedProducts(allIds);
  };

  const deselectAllProducts = () => {
    setSelectedProducts([]);
  };

  return (
    <Page 
      title="Bulk Editor" 
      subtitle="Edit blocks or general settings across multiple products"
      backAction={{
        content: "Products",
        url: "/app/products",
      }}
    >
      <Layout>
        <Layout.Section>
          <Banner tone="info">
            <p>Edit blocks or general settings across multiple products at once.</p>
          </Banner>
        </Layout.Section>

        <Layout.Section>
          <Card sectioned>
            <BlockStack gap="400">
              <Text variant="headingMd" as="h2">Step 1: Choose Edit Mode</Text>
              
              <Select
                label="What do you want to edit?"
                options={[
                  { label: "Edit Specific Block", value: "block" },
                  { label: "Edit General Settings", value: "general" },
                  { label: "Add Block to Products", value: "addBlock" },
                ]}
                value={editMode}
                onChange={(value) => {
                  setEditMode(value);
                  setSelectedBlockId("");
                  setSelectedProducts([]);
                  setShowEditor(false);
                  setSourceProductId("");
                  setBlockToAdd(null);
                }}
              />

              {editMode === "block" && (
                <>
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
                </>
              )}

              {editMode === "general" && (
                <>
                  <Banner tone="success">
                    <p>All products with customizer configuration will be shown for editing.</p>
                  </Banner>
                  <Button 
                    variant="primary"
                    onClick={() => {
                      setShowEditor(true);
                      // Load first product's general settings as template
                      const firstProductWithConfig = products.find(p => {
                        const optionsMetafield = p.metafields.edges
                          .map(e => e.node)
                          .find(m => m.key === "options");
                        return !!optionsMetafield;
                      });
                      
                      if (firstProductWithConfig) {
                        try {
                          const optionsMetafield = firstProductWithConfig.metafields.edges
                            .map(e => e.node)
                            .find(m => m.key === "options");
                          const config = JSON.parse(optionsMetafield.value);
                          const configBlock = config.find(b => b.type === "config");
                          
                          if (configBlock) {
                            setGeneralUpdates({
                              title: configBlock.title || "",
                              enabled: configBlock.enabled ?? true,
                              show_price: configBlock.show_price ?? true,
                              currency: configBlock.currency || "USD",
                              unit_price: configBlock.unit_price ?? 0
                            });
                          }
                        } catch (e) {
                          console.error("Error loading general settings:", e);
                        }
                      }
                    }}
                  >
                    Continue to Edit General Settings
                  </Button>
                </>
              )}

              {editMode === "addBlock" && (
                <>
                  <Banner tone="info">
                    <p>Select a source product and block ID to copy it to other products.</p>
                  </Banner>

                  <Select
                    label="Source Product"
                    options={[
                      { label: "Select a product", value: "" },
                      ...products
                        .filter(p => p.metafields.edges.some(e => e.node.key === "options"))
                        .map(p => ({
                          label: p.title,
                          value: p.id.split("/").pop()
                        }))
                    ]}
                    value={sourceProductId}
                    onChange={(value) => {
                      setSourceProductId(value);
                      setBlockToAdd(null);
                      setSelectedProducts([]);
                      setShowEditor(false);
                    }}
                  />

                  {sourceProductId && (
                    <>
                      <Select
                        label="Block to Copy"
                        options={[
                          { label: "Select a block", value: "" },
                          ...(() => {
                            const product = products.find(p => p.id.split("/").pop() === sourceProductId);
                            if (!product) return [];
                            
                            const optionsMetafield = product.metafields.edges
                              .map(e => e.node)
                              .find(m => m.key === "options");
                            
                            if (!optionsMetafield) return [];
                            
                            try {
                              const config = JSON.parse(optionsMetafield.value);
                              return config
                                .filter(b => b.type !== "config" && b.id)
                                .map(b => ({
                                  label: `${b.id} (${b.type}) - ${b.title || "Untitled"}`,
                                  value: b.id
                                }));
                            } catch (e) {
                              return [];
                            }
                          })()
                        ]}
                        value={blockToAdd?.id || ""}
                        onChange={(value) => {
                          const product = products.find(p => p.id.split("/").pop() === sourceProductId);
                          if (!product) return;
                          
                          const optionsMetafield = product.metafields.edges
                            .map(e => e.node)
                            .find(m => m.key === "options");
                          
                          if (!optionsMetafield) return;
                          
                          try {
                            const config = JSON.parse(optionsMetafield.value);
                            const block = config.find(b => b.id === value);
                            if (block) {
                              setBlockToAdd(block);
                            }
                          } catch (e) {
                            console.error("Error loading block:", e);
                          }
                        }}
                      />

                      {blockToAdd && (
                        <>
                          <Banner tone="success">
                            <BlockStack gap="200">
                              <Text variant="bodyMd">Block ready to copy:</Text>
                              <Text variant="bodySm" as="p">
                                • ID: <strong>{blockToAdd.id}</strong>
                              </Text>
                              <Text variant="bodySm" as="p">
                                • Type: <strong>{blockToAdd.type}</strong>
                              </Text>
                              <Text variant="bodySm" as="p">
                                • Title: <strong>{blockToAdd.title || "Untitled"}</strong>
                              </Text>
                              {blockToAdd.type === "picker" && blockToAdd.options && (
                                <Text variant="bodySm" as="p">
                                  • Options: <strong>{blockToAdd.options.length}</strong>
                                </Text>
                              )}
                            </BlockStack>
                          </Banner>
                          
                          <Button 
                            variant="primary"
                            onClick={() => setShowEditor(true)}
                          >
                            Continue to Select Products
                          </Button>
                        </>
                      )}
                    </>
                  )}
                </>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        {((editMode === "block" && selectedBlockId) || editMode === "general" || (editMode === "addBlock" && blockToAdd)) && showEditor && (
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
                  <Text variant="headingMd" as="h2">
                    Step 3: {editMode === "general" ? "Edit General Settings" : editMode === "addBlock" ? "Confirm Block Addition" : "Edit Block Properties"}
                  </Text>
                  
                  {editMode === "addBlock" ? (
                    <BlockStack gap="400">
                      <Banner tone="warning">
                        <BlockStack gap="200">
                          <Text variant="headingSm">You are about to add this block:</Text>
                          <Text variant="bodyMd" as="p">
                            • ID: <strong>{blockToAdd?.id}</strong>
                          </Text>
                          <Text variant="bodyMd" as="p">
                            • Type: <strong>{blockToAdd?.type}</strong>
                          </Text>
                          <Text variant="bodyMd" as="p">
                            • Title: <strong>{blockToAdd?.title || "Untitled"}</strong>
                          </Text>
                          <Text variant="bodyMd" as="p">
                            • To: <strong>{selectedProducts.length} product(s)</strong>
                          </Text>
                          {blockToAdd?.type === "picker" && blockToAdd?.options && (
                            <Text variant="bodySm" as="p" tone="subdued">
                              • With {blockToAdd.options.length} option(s)
                            </Text>
                          )}
                          {blockToAdd?.isNested && (
                            <Text variant="bodySm" as="p" tone="subdued">
                              • Includes nested pickers
                            </Text>
                          )}
                          {(blockToAdd?.hasGuide || blockToAdd?.guide?.enabled) && (
                            <Text variant="bodySm" as="p" tone="subdued">
                              • Includes guide sections
                            </Text>
                          )}
                        </BlockStack>
                      </Banner>

                      <Banner tone="info">
                        <p>The block will be added to the end of each product's configuration. Products that already have a block with this ID will be skipped.</p>
                      </Banner>

                      <Card sectioned>
                        <BlockStack gap="200">
                          <Text variant="headingSm">Block Preview (JSON)</Text>
                          <div style={{ 
                            maxHeight: '300px', 
                            overflow: 'auto', 
                            background: '#f6f6f7', 
                            padding: '12px',
                            borderRadius: '8px',
                            fontFamily: 'monospace',
                            fontSize: '12px'
                          }}>
                            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                              {JSON.stringify(blockToAdd, null, 2)}
                            </pre>
                          </div>
                        </BlockStack>
                      </Card>

                      <InlineStack align="end">
                        <Button 
                          variant="primary"
                          onClick={handleBulkUpdate}
                          loading={fetcher.state === "submitting"}
                          disabled={selectedProducts.length === 0}
                          tone="critical"
                        >
                          Add Block to {selectedProducts.length} Product(s)
                        </Button>
                      </InlineStack>
                    </BlockStack>
                  ) : editMode === "general" ? (
                    <BlockStack gap="400">
                      <Banner tone="info">
                        <p>These settings will be applied to the config block of all selected products.</p>
                      </Banner>

                      <TextField
                        label="Customizer Title"
                        value={generalUpdates.title}
                        onChange={(value) => setGeneralUpdates({ ...generalUpdates, title: value })}
                        helpText="The main title for your customizer"
                      />

                      <InlineStack gap="300">
                        <Checkbox
                          label="Customizer Active"
                          checked={generalUpdates.enabled}
                          onChange={(checked) => setGeneralUpdates({ ...generalUpdates, enabled: checked })}
                        />
                        
                        <Checkbox
                          label="Show Price"
                          checked={generalUpdates.show_price}
                          onChange={(checked) => setGeneralUpdates({ ...generalUpdates, show_price: checked })}
                        />
                      </InlineStack>

                      <InlineStack gap="300">
                        <div style={{ width: 200 }}>
                          <TextField
                            label="Currency"
                            value={generalUpdates.currency}
                            onChange={(value) => setGeneralUpdates({ ...generalUpdates, currency: value })}
                            placeholder="USD"
                          />
                        </div>
                        
                        <div style={{ width: 200 }}>
                          <TextField
                            label="Unit Price (per inch)"
                            type="number"
                            step="0.01"
                            value={String(generalUpdates.unit_price)}
                            onChange={(value) => setGeneralUpdates({ 
                              ...generalUpdates, 
                              unit_price: parseFloat(value) || 0 
                            })}
                          />
                        </div>
                      </InlineStack>

                      <Banner tone="warning">
                        <BlockStack gap="200">
                          <Text variant="headingSm">What will be updated:</Text>
                          <Text variant="bodyMd" as="p">
                            • Title: {generalUpdates.title || "(empty)"}
                          </Text>
                          <Text variant="bodyMd" as="p">
                            • Active: {generalUpdates.enabled ? "Yes" : "No"}
                          </Text>
                          <Text variant="bodyMd" as="p">
                            • Show Price: {generalUpdates.show_price ? "Yes" : "No"}
                          </Text>
                          <Text variant="bodyMd" as="p">
                            • Currency: {generalUpdates.currency}
                          </Text>
                          <Text variant="bodyMd" as="p">
                            • Unit Price: {generalUpdates.unit_price}
                          </Text>
                        </BlockStack>
                      </Banner>

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
                  ) : (
                    <BlockStack gap="400">
                  <Banner tone="info">
                    <BlockStack gap="200">
                      <Text variant="bodyMd" as="p">Changes will be applied to all selected products.</Text>
                      <Text variant="bodySm" as="p" tone="subdued">
                        Editing: <strong>{selectedBlockId}</strong> ({blockType})
                      </Text>
                      {blockType === "picker" && blockUpdates.options.length > 0 && (
                        <Text variant="bodySm" as="p" tone="subdued">
                          • {blockUpdates.options.length} option(s) configured
                        </Text>
                      )}
                      {blockType === "picker" && blockUpdates.isNested && (
                        <Text variant="bodySm" as="p" tone="subdued">
                          • {(blockUpdates.nested || []).length} nested group(s) configured
                        </Text>
                      )}
                      {blockType === "area" && blockUpdates.guide?.enabled && (
                        <Text variant="bodySm" as="p" tone="subdued">
                          • Measurement guide enabled with {(blockUpdates.guide?.sections || []).length} section(s)
                        </Text>
                      )}
                    </BlockStack>
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

                  {/* PICKER OPTIONS */}
                  {blockType === "picker" && (
                    <BlockStack gap="400">
                      <Text variant="headingSm" as="h3">Picker Options</Text>
                      
                      {blockUpdates.options.map((option, idx) => (
                        <Card key={idx} sectioned>
                          <BlockStack gap="300">
                            <InlineStack align="space-between">
                              <Text variant="bodyMd" as="h4">Option {idx + 1}</Text>
                              <Button 
                                size="slim" 
                                variant="plain" 
                                tone="critical"
                                onClick={() => {
                                  const newOptions = [...blockUpdates.options];
                                  newOptions.splice(idx, 1);
                                  setBlockUpdates({ ...blockUpdates, options: newOptions });
                                }}
                              >
                                Remove
                              </Button>
                            </InlineStack>
                            
                            <InlineStack gap="200">
                              <div style={{ flex: 1 }}>
                                <TextField
                                  label="Label"
                                  value={option.label || ""}
                                  onChange={(value) => {
                                    const newOptions = [...blockUpdates.options];
                                    newOptions[idx] = { ...newOptions[idx], label: value };
                                    setBlockUpdates({ ...blockUpdates, options: newOptions });
                                  }}
                                />
                              </div>
                              <div style={{ flex: 1 }}>
                                <TextField
                                  label="Value"
                                  value={option.value || ""}
                                  onChange={(value) => {
                                    const newOptions = [...blockUpdates.options];
                                    newOptions[idx] = { ...newOptions[idx], value: value };
                                    setBlockUpdates({ ...blockUpdates, options: newOptions });
                                  }}
                                />
                              </div>
                            </InlineStack>

                            {/* Media Selection */}
                            <Select
                              label="Media Type"
                              options={[
                                { label: "Hex Color", value: "hex" },
                                { label: "Image URL", value: "url" },
                              ]}
                              value={option.media?.type || "hex"}
                              onChange={(value) => {
                                const newOptions = [...blockUpdates.options];
                                newOptions[idx] = { 
                                  ...newOptions[idx], 
                                  media: { 
                                    type: value, 
                                    [value]: value === "hex" ? "#000000" : "" 
                                  } 
                                };
                                setBlockUpdates({ ...blockUpdates, options: newOptions });
                              }}
                            />

                            {option.media?.type === "hex" ? (
                              <TextField
                                label="Hex Color"
                                value={option.media.hex || "#000000"}
                                onChange={(value) => {
                                  const newOptions = [...blockUpdates.options];
                                  newOptions[idx] = { 
                                    ...newOptions[idx], 
                                    media: { type: "hex", hex: value } 
                                  };
                                  setBlockUpdates({ ...blockUpdates, options: newOptions });
                                }}
                              />
                            ) : (
                              <TextField
                                label="Image URL"
                                value={option.media?.url || ""}
                                onChange={(value) => {
                                  const newOptions = [...blockUpdates.options];
                                  newOptions[idx] = { 
                                    ...newOptions[idx], 
                                    media: { type: "url", url: value } 
                                  };
                                  setBlockUpdates({ ...blockUpdates, options: newOptions });
                                }}
                              />
                            )}

                            {/* Pricing for this option */}
                            <Text variant="bodyMd" as="h5">Pricing</Text>
                            <InlineStack gap="200">
                              <div style={{ flex: 1 }}>
                                <Select
                                  label="Mode"
                                  options={[
                                    { label: "None", value: "none" },
                                    { label: "Added", value: "added" },
                                    { label: "Multiplier", value: "multiplier" },
                                  ]}
                                  value={option.pricing?.mode || "none"}
                                  onChange={(value) => {
                                    const newOptions = [...blockUpdates.options];
                                    newOptions[idx] = { 
                                      ...newOptions[idx], 
                                      pricing: { ...(newOptions[idx].pricing || {}), mode: value } 
                                    };
                                    setBlockUpdates({ ...blockUpdates, options: newOptions });
                                  }}
                                />
                              </div>
                              <div style={{ flex: 1 }}>
                                <TextField
                                  label="Value"
                                  type="number"
                                  step="any"
                                  value={String(option.pricing?.value || 0)}
                                  onChange={(value) => {
                                    const newOptions = [...blockUpdates.options];
                                    newOptions[idx] = { 
                                      ...newOptions[idx], 
                                      pricing: { 
                                        ...(newOptions[idx].pricing || {}), 
                                        value: parseFloat(value) || 0 
                                      } 
                                    };
                                    setBlockUpdates({ ...blockUpdates, options: newOptions });
                                  }}
                                />
                              </div>
                            </InlineStack>

                            <Checkbox
                              label="Show price to customer"
                              checked={option.pricing?.show !== false}
                              onChange={(checked) => {
                                const newOptions = [...blockUpdates.options];
                                newOptions[idx] = { 
                                  ...newOptions[idx], 
                                  pricing: { 
                                    ...(newOptions[idx].pricing || {}), 
                                    show: checked 
                                  } 
                                };
                                setBlockUpdates({ ...blockUpdates, options: newOptions });
                              }}
                            />
                          </BlockStack>
                        </Card>
                      ))}

                      <Button 
                        onClick={() => {
                          setBlockUpdates({ 
                            ...blockUpdates, 
                            options: [
                              ...blockUpdates.options, 
                              { 
                                label: "New Option", 
                                value: `option-${blockUpdates.options.length + 1}`, 
                                media: { type: "hex", hex: "#000000" },
                                pricing: { mode: "none", value: 0, show: true }
                              }
                            ] 
                          });
                        }}
                      >
                        Add Option
                      </Button>

                      {/* Nested Picker Toggle */}
                      <Checkbox
                        label="Enable Nested Pickers (Conditional Options)"
                        checked={blockUpdates.isNested}
                        onChange={(checked) => setBlockUpdates({ ...blockUpdates, isNested: checked, nested: checked ? (blockUpdates.nested || []) : [] })}
                      />

                      {/* Picker Guide */}
                      <Checkbox
                        label="Enable Guide for this Picker"
                        checked={blockUpdates.hasGuide || blockUpdates.guide?.enabled}
                        onChange={(checked) => setBlockUpdates({ 
                          ...blockUpdates, 
                          hasGuide: checked,
                          guide: { 
                            ...(blockUpdates.guide || {}), 
                            enabled: checked,
                            title: blockUpdates.guide?.title || "",
                            sections: blockUpdates.guide?.sections || []
                          }
                        })}
                      />

                      {/* Picker Guide Sections - Same as Area */}
                      {(blockUpdates.hasGuide || blockUpdates.guide?.enabled) && (
                        <BlockStack gap="300">
                          <TextField
                            label="Guide Title"
                            value={blockUpdates.guide?.title || ""}
                            onChange={(value) => setBlockUpdates({ 
                              ...blockUpdates, 
                              guide: { 
                                ...(blockUpdates.guide || {}), 
                                title: value 
                              } 
                            })}
                          />

                          <Text variant="headingSm" as="h4">Guide Sections</Text>
                          
                          {(blockUpdates.guide?.sections || []).map((section, sIdx) => (
                            <Card key={sIdx} sectioned>
                              <BlockStack gap="200">
                                <InlineStack align="space-between">
                                  <Text variant="bodyMd">Section {sIdx + 1}</Text>
                                  <Button 
                                    size="slim" 
                                    variant="plain" 
                                    tone="critical"
                                    onClick={() => {
                                      const newSections = [...(blockUpdates.guide?.sections || [])];
                                      newSections.splice(sIdx, 1);
                                      setBlockUpdates({ 
                                        ...blockUpdates, 
                                        guide: { 
                                          ...(blockUpdates.guide || {}), 
                                          sections: newSections 
                                        } 
                                      });
                                    }}
                                  >
                                    Remove
                                  </Button>
                                </InlineStack>

                                <TextField
                                  label="Section Title"
                                  value={section.title || ""}
                                  onChange={(value) => {
                                    const newSections = [...(blockUpdates.guide?.sections || [])];
                                    newSections[sIdx] = { ...newSections[sIdx], title: value };
                                    setBlockUpdates({ 
                                      ...blockUpdates, 
                                      guide: { 
                                        ...(blockUpdates.guide || {}), 
                                        sections: newSections 
                                      } 
                                    });
                                  }}
                                />

                                <TextField
                                  label="Description"
                                  value={section.description || ""}
                                  multiline={3}
                                  onChange={(value) => {
                                    const newSections = [...(blockUpdates.guide?.sections || [])];
                                    newSections[sIdx] = { ...newSections[sIdx], description: value };
                                    setBlockUpdates({ 
                                      ...blockUpdates, 
                                      guide: { 
                                        ...(blockUpdates.guide || {}), 
                                        sections: newSections 
                                      } 
                                    });
                                  }}
                                />

                                <Text variant="bodySm">Photo Gallery</Text>
                                {(section.photoGallery || []).map((photo, pIdx) => (
                                  <InlineStack key={pIdx} gap="200">
                                    <div style={{ flex: 1 }}>
                                      <TextField
                                        label={`Photo ${pIdx + 1} URL`}
                                        labelHidden
                                        value={photo.url || ""}
                                        placeholder="Image URL"
                                        onChange={(value) => {
                                          const newSections = [...(blockUpdates.guide?.sections || [])];
                                          const newPhotos = [...(newSections[sIdx].photoGallery || [])];
                                          newPhotos[pIdx] = { ...newPhotos[pIdx], url: value };
                                          newSections[sIdx] = { ...newSections[sIdx], photoGallery: newPhotos };
                                          setBlockUpdates({ 
                                            ...blockUpdates, 
                                            guide: { 
                                              ...(blockUpdates.guide || {}), 
                                              sections: newSections 
                                            } 
                                          });
                                        }}
                                      />
                                    </div>
                                    <Button 
                                      size="slim" 
                                      variant="plain" 
                                      tone="critical"
                                      onClick={() => {
                                        const newSections = [...(blockUpdates.guide?.sections || [])];
                                        const newPhotos = [...(newSections[sIdx].photoGallery || [])];
                                        newPhotos.splice(pIdx, 1);
                                        newSections[sIdx] = { ...newSections[sIdx], photoGallery: newPhotos };
                                        setBlockUpdates({ 
                                          ...blockUpdates, 
                                          guide: { 
                                            ...(blockUpdates.guide || {}), 
                                            sections: newSections 
                                          } 
                                        });
                                      }}
                                    >
                                      Remove
                                    </Button>
                                  </InlineStack>
                                ))}

                                <Button 
                                  size="slim"
                                  onClick={() => {
                                    const newSections = [...(blockUpdates.guide?.sections || [])];
                                    const newPhotos = [...(newSections[sIdx].photoGallery || [])];
                                    newPhotos.push({ id: `photo-${Date.now()}`, url: "", alt: "", caption: "" });
                                    newSections[sIdx] = { ...newSections[sIdx], photoGallery: newPhotos };
                                    setBlockUpdates({ 
                                      ...blockUpdates, 
                                      guide: { 
                                        ...(blockUpdates.guide || {}), 
                                        sections: newSections 
                                      } 
                                    });
                                  }}
                                >
                                  Add Photo
                                </Button>
                              </BlockStack>
                            </Card>
                          ))}

                          <Button 
                            onClick={() => {
                              const newSections = [...(blockUpdates.guide?.sections || [])];
                              newSections.push({ id: `section-${Date.now()}`, title: "", description: "", photoGallery: [] });
                              setBlockUpdates({ 
                                ...blockUpdates, 
                                guide: { 
                                  ...(blockUpdates.guide || {}), 
                                  sections: newSections 
                                } 
                              });
                            }}
                          >
                            Add Guide Section
                          </Button>
                        </BlockStack>
                      )}

                      {/* Nested Pickers Management */}
                      {blockUpdates.isNested && (
                        <BlockStack gap="400">
                          <Text variant="headingSm" as="h3">Nested Pickers (Conditional Groups)</Text>
                          
                          {(blockUpdates.nested || []).map((nestedGroup, ngIdx) => (
                            <Card key={ngIdx} sectioned>
                              <BlockStack gap="300">
                                <InlineStack align="space-between">
                                  <Text variant="bodyMd" as="h4">Conditional Group {ngIdx + 1}</Text>
                                  <Button 
                                    size="slim" 
                                    variant="plain" 
                                    tone="critical"
                                    onClick={() => {
                                      const newNested = [...(blockUpdates.nested || [])];
                                      newNested.splice(ngIdx, 1);
                                      setBlockUpdates({ ...blockUpdates, nested: newNested });
                                    }}
                                  >
                                    Remove Group
                                  </Button>
                                </InlineStack>

                                <Select
                                  label="Show When Parent Equals"
                                  options={[
                                    { label: "Select parent value", value: "" },
                                    ...(blockUpdates.options || []).map(opt => ({
                                      label: opt.label,
                                      value: opt.value
                                    }))
                                  ]}
                                  value={nestedGroup.when?.equals || ""}
                                  onChange={(value) => {
                                    const newNested = [...(blockUpdates.nested || [])];
                                    newNested[ngIdx] = {
                                      ...newNested[ngIdx],
                                      when: {
                                        parentId: blockUpdates.options?.[0]?.value || "",
                                        equals: value
                                      }
                                    };
                                    setBlockUpdates({ ...blockUpdates, nested: newNested });
                                  }}
                                />

                                {/* Nested Items (Sub-pickers) */}
                                <Text variant="bodyMd" as="h5">Sub-Pickers</Text>
                                
                                {(nestedGroup.items || []).map((item, itemIdx) => (
                                  <Card key={itemIdx} sectioned>
                                    <BlockStack gap="300">
                                      <InlineStack align="space-between">
                                        <Text variant="bodySm">Sub-Picker {itemIdx + 1}</Text>
                                        <Button 
                                          size="slim" 
                                          variant="plain" 
                                          tone="critical"
                                          onClick={() => {
                                            const newNested = [...(blockUpdates.nested || [])];
                                            const newItems = [...(newNested[ngIdx].items || [])];
                                            newItems.splice(itemIdx, 1);
                                            newNested[ngIdx] = { ...newNested[ngIdx], items: newItems };
                                            setBlockUpdates({ ...blockUpdates, nested: newNested });
                                          }}
                                        >
                                          Remove
                                        </Button>
                                      </InlineStack>

                                      <InlineStack gap="200">
                                        <div style={{ flex: 1 }}>
                                          <TextField
                                            label="Title"
                                            value={item.title || ""}
                                            onChange={(value) => {
                                              const newNested = [...(blockUpdates.nested || [])];
                                              const newItems = [...(newNested[ngIdx].items || [])];
                                              newItems[itemIdx] = { ...newItems[itemIdx], title: value };
                                              newNested[ngIdx] = { ...newNested[ngIdx], items: newItems };
                                              setBlockUpdates({ ...blockUpdates, nested: newNested });
                                            }}
                                          />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                          <TextField
                                            label="ID"
                                            value={item.id || ""}
                                            onChange={(value) => {
                                              const newNested = [...(blockUpdates.nested || [])];
                                              const newItems = [...(newNested[ngIdx].items || [])];
                                              newItems[itemIdx] = { ...newItems[itemIdx], id: value };
                                              newNested[ngIdx] = { ...newNested[ngIdx], items: newItems };
                                              setBlockUpdates({ ...blockUpdates, nested: newNested });
                                            }}
                                          />
                                        </div>
                                      </InlineStack>

                                      <Checkbox
                                        label="Enabled"
                                        checked={item.enabled !== false}
                                        onChange={(checked) => {
                                          const newNested = [...(blockUpdates.nested || [])];
                                          const newItems = [...(newNested[ngIdx].items || [])];
                                          newItems[itemIdx] = { ...newItems[itemIdx], enabled: checked };
                                          newNested[ngIdx] = { ...newNested[ngIdx], items: newItems };
                                          setBlockUpdates({ ...blockUpdates, nested: newNested });
                                        }}
                                      />

                                      {/* Sub-picker Options */}
                                      <Text variant="bodySm" as="h6">Options</Text>
                                      {(item.options || []).map((opt, optIdx) => (
                                        <Card key={optIdx} sectioned subdued>
                                          <BlockStack gap="200">
                                            <InlineStack align="space-between">
                                              <Text variant="bodySm">Option {optIdx + 1}</Text>
                                              <Button 
                                                size="slim" 
                                                variant="plain" 
                                                tone="critical"
                                                onClick={() => {
                                                  const newNested = [...(blockUpdates.nested || [])];
                                                  const newItems = [...(newNested[ngIdx].items || [])];
                                                  const newOptions = [...(newItems[itemIdx].options || [])];
                                                  newOptions.splice(optIdx, 1);
                                                  newItems[itemIdx] = { ...newItems[itemIdx], options: newOptions };
                                                  newNested[ngIdx] = { ...newNested[ngIdx], items: newItems };
                                                  setBlockUpdates({ ...blockUpdates, nested: newNested });
                                                }}
                                              >
                                                Remove
                                              </Button>
                                            </InlineStack>

                                            <InlineStack gap="200">
                                              <TextField
                                                label="Label"
                                                value={opt.label || ""}
                                                onChange={(value) => {
                                                  const newNested = [...(blockUpdates.nested || [])];
                                                  const newItems = [...(newNested[ngIdx].items || [])];
                                                  const newOptions = [...(newItems[itemIdx].options || [])];
                                                  newOptions[optIdx] = { ...newOptions[optIdx], label: value };
                                                  newItems[itemIdx] = { ...newItems[itemIdx], options: newOptions };
                                                  newNested[ngIdx] = { ...newNested[ngIdx], items: newItems };
                                                  setBlockUpdates({ ...blockUpdates, nested: newNested });
                                                }}
                                              />
                                              <TextField
                                                label="Value"
                                                value={opt.value || ""}
                                                onChange={(value) => {
                                                  const newNested = [...(blockUpdates.nested || [])];
                                                  const newItems = [...(newNested[ngIdx].items || [])];
                                                  const newOptions = [...(newItems[itemIdx].options || [])];
                                                  newOptions[optIdx] = { ...newOptions[optIdx], value: value };
                                                  newItems[itemIdx] = { ...newItems[itemIdx], options: newOptions };
                                                  newNested[ngIdx] = { ...newNested[ngIdx], items: newItems };
                                                  setBlockUpdates({ ...blockUpdates, nested: newNested });
                                                }}
                                              />
                                            </InlineStack>
                                          </BlockStack>
                                        </Card>
                                      ))}

                                      <Button 
                                        size="slim"
                                        onClick={() => {
                                          const newNested = [...(blockUpdates.nested || [])];
                                          const newItems = [...(newNested[ngIdx].items || [])];
                                          const newOptions = [...(newItems[itemIdx].options || [])];
                                          newOptions.push({
                                            label: "New Option",
                                            value: `option-${newOptions.length + 1}`,
                                            media: { type: "hex", hex: "#000000" }
                                          });
                                          newItems[itemIdx] = { ...newItems[itemIdx], options: newOptions };
                                          newNested[ngIdx] = { ...newNested[ngIdx], items: newItems };
                                          setBlockUpdates({ ...blockUpdates, nested: newNested });
                                        }}
                                      >
                                        Add Option
                                      </Button>
                                    </BlockStack>
                                  </Card>
                                ))}

                                <Button 
                                  size="slim"
                                  onClick={() => {
                                    const newNested = [...(blockUpdates.nested || [])];
                                    const newItems = [...(newNested[ngIdx].items || [])];
                                    newItems.push({
                                      id: `nested-picker-${Date.now()}`,
                                      type: "picker",
                                      title: "New Sub-Picker",
                                      enabled: true,
                                      options: []
                                    });
                                    newNested[ngIdx] = { ...newNested[ngIdx], items: newItems };
                                    setBlockUpdates({ ...blockUpdates, nested: newNested });
                                  }}
                                >
                                  Add Sub-Picker
                                </Button>
                              </BlockStack>
                            </Card>
                          ))}

                          <Button 
                            onClick={() => {
                              const newNested = [...(blockUpdates.nested || [])];
                              newNested.push({
                                when: {
                                  parentId: blockUpdates.options?.[0]?.value || "",
                                  equals: ""
                                },
                                items: []
                              });
                              setBlockUpdates({ ...blockUpdates, nested: newNested });
                            }}
                          >
                            Add Conditional Group
                          </Button>
                        </BlockStack>
                      )}
                    </BlockStack>
                  )}

                  {/* INPUT TYPE */}
                  {blockType === "input" && (
                    <BlockStack gap="300">
                      <Text variant="headingSm" as="h3">Input Settings</Text>
                      
                      <Select
                        label="Input Type"
                        options={[
                          { label: "Text", value: "text" },
                          { label: "Number", value: "number" },
                        ]}
                        value={blockUpdates.subtype}
                        onChange={(value) => setBlockUpdates({ ...blockUpdates, subtype: value })}
                      />

                      <TextField
                        label="Placeholder"
                        value={blockUpdates.placeholder}
                        onChange={(value) => setBlockUpdates({ ...blockUpdates, placeholder: value })}
                      />
                    </BlockStack>
                  )}

                  {/* AREA SETTINGS */}
                  {blockType === "area" && (
                    <BlockStack gap="400">
                      <Text variant="headingSm" as="h3">Area Settings</Text>
                      
                      <InlineStack gap="200">
                        <div style={{ flex: 1 }}>
                          <TextField
                            label="Min Width (inches)"
                            type="number"
                            step="0.1"
                            value={String(blockUpdates.limits?.width?.min || 0)}
                            onChange={(value) => setBlockUpdates({ 
                              ...blockUpdates, 
                              limits: { 
                                ...blockUpdates.limits, 
                                width: { 
                                  ...blockUpdates.limits.width, 
                                  min: parseFloat(value) || 0 
                                } 
                              } 
                            })}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <TextField
                            label="Max Width (inches)"
                            type="number"
                            step="0.1"
                            value={String(blockUpdates.limits?.width?.max || 1000)}
                            onChange={(value) => setBlockUpdates({ 
                              ...blockUpdates, 
                              limits: { 
                                ...blockUpdates.limits, 
                                width: { 
                                  ...blockUpdates.limits.width, 
                                  max: parseFloat(value) || 1000 
                                } 
                              } 
                            })}
                          />
                        </div>
                      </InlineStack>

                      <Checkbox
                        label="Enable Additional Input Section"
                        checked={blockUpdates.hasInputSection}
                        onChange={(checked) => setBlockUpdates({ ...blockUpdates, hasInputSection: checked })}
                      />

                      {blockUpdates.hasInputSection && (
                        <BlockStack gap="200">
                          <TextField
                            label="Input Section Title"
                            value={blockUpdates.inputSection?.title || ""}
                            onChange={(value) => setBlockUpdates({ 
                              ...blockUpdates, 
                              inputSection: { 
                                ...blockUpdates.inputSection, 
                                title: value 
                              } 
                            })}
                          />
                          <TextField
                            label="Input Section Placeholder"
                            value={blockUpdates.inputSection?.placeholder || ""}
                            onChange={(value) => setBlockUpdates({ 
                              ...blockUpdates, 
                              inputSection: { 
                                ...blockUpdates.inputSection, 
                                placeholder: value 
                              } 
                            })}
                          />
                        </BlockStack>
                      )}

                      {/* Guide Section */}
                      <Checkbox
                        label="Enable Measurement Guide"
                        checked={blockUpdates.guide?.enabled}
                        onChange={(checked) => setBlockUpdates({ 
                          ...blockUpdates, 
                          guide: { 
                            ...blockUpdates.guide, 
                            enabled: checked,
                            sections: blockUpdates.guide?.sections || []
                          } 
                        })}
                      />

                      {/* Guide Image */}
                      <Checkbox
                        label="Enable Guide Image"
                        checked={blockUpdates.isHasGuideImage}
                        onChange={(checked) => setBlockUpdates({ 
                          ...blockUpdates, 
                          isHasGuideImage: checked
                        })}
                      />

                      {blockUpdates.isHasGuideImage && (
                        <TextField
                          label="Guide Image URL"
                          value={blockUpdates.guideImageUrl || ""}
                          onChange={(value) => setBlockUpdates({ 
                            ...blockUpdates, 
                            guideImageUrl: value 
                          })}
                          placeholder="https://example.com/guide-image.jpg"
                        />
                      )}

                      {/* Unit Field */}
                      <TextField
                        label="Unit of Measurement"
                        value={blockUpdates.unit || "inch"}
                        onChange={(value) => setBlockUpdates({ 
                          ...blockUpdates, 
                          unit: value 
                        })}
                        helpText="e.g., inch, cm, m"
                      />

                      {blockUpdates.guide?.enabled && (
                        <BlockStack gap="400">
                          <TextField
                            label="Guide Title"
                            value={blockUpdates.guide?.title || ""}
                            onChange={(value) => setBlockUpdates({ 
                              ...blockUpdates, 
                              guide: { 
                                ...blockUpdates.guide, 
                                title: value 
                              } 
                            })}
                          />

                          {/* Guide Sections */}
                          <Text variant="headingSm" as="h4">Guide Sections</Text>
                          
                          {(blockUpdates.guide?.sections || []).map((section, sIdx) => (
                            <Card key={sIdx} sectioned>
                              <BlockStack gap="300">
                                <InlineStack align="space-between">
                                  <Text variant="bodyMd" as="h5">Section {sIdx + 1}</Text>
                                  <Button 
                                    size="slim" 
                                    variant="plain" 
                                    tone="critical"
                                    onClick={() => {
                                      const newSections = [...(blockUpdates.guide?.sections || [])];
                                      newSections.splice(sIdx, 1);
                                      setBlockUpdates({ 
                                        ...blockUpdates, 
                                        guide: { 
                                          ...blockUpdates.guide, 
                                          sections: newSections 
                                        } 
                                      });
                                    }}
                                  >
                                    Remove Section
                                  </Button>
                                </InlineStack>

                                <TextField
                                  label="Section Title"
                                  value={section.title || ""}
                                  onChange={(value) => {
                                    const newSections = [...(blockUpdates.guide?.sections || [])];
                                    newSections[sIdx] = { ...newSections[sIdx], title: value };
                                    setBlockUpdates({ 
                                      ...blockUpdates, 
                                      guide: { 
                                        ...blockUpdates.guide, 
                                        sections: newSections 
                                      } 
                                    });
                                  }}
                                />

                                <TextField
                                  label="Description"
                                  value={section.description || ""}
                                  multiline={4}
                                  onChange={(value) => {
                                    const newSections = [...(blockUpdates.guide?.sections || [])];
                                    newSections[sIdx] = { ...newSections[sIdx], description: value };
                                    setBlockUpdates({ 
                                      ...blockUpdates, 
                                      guide: { 
                                        ...blockUpdates.guide, 
                                        sections: newSections 
                                      } 
                                    });
                                  }}
                                />

                                {/* Photo Gallery */}
                                <Text variant="bodyMd" as="h6">Photo Gallery</Text>
                                
                                {(section.photoGallery || []).map((photo, pIdx) => (
                                  <Card key={pIdx} sectioned>
                                    <BlockStack gap="200">
                                      <InlineStack align="space-between">
                                        <Text variant="bodySm">Photo {pIdx + 1}</Text>
                                        <Button 
                                          size="slim" 
                                          variant="plain" 
                                          tone="critical"
                                          onClick={() => {
                                            const newSections = [...(blockUpdates.guide?.sections || [])];
                                            const newPhotos = [...(newSections[sIdx].photoGallery || [])];
                                            newPhotos.splice(pIdx, 1);
                                            newSections[sIdx] = { ...newSections[sIdx], photoGallery: newPhotos };
                                            setBlockUpdates({ 
                                              ...blockUpdates, 
                                              guide: { 
                                                ...blockUpdates.guide, 
                                                sections: newSections 
                                              } 
                                            });
                                          }}
                                        >
                                          Remove Photo
                                        </Button>
                                      </InlineStack>

                                      <TextField
                                        label="Image URL"
                                        value={photo.url || ""}
                                        onChange={(value) => {
                                          const newSections = [...(blockUpdates.guide?.sections || [])];
                                          const newPhotos = [...(newSections[sIdx].photoGallery || [])];
                                          newPhotos[pIdx] = { ...newPhotos[pIdx], url: value };
                                          newSections[sIdx] = { ...newSections[sIdx], photoGallery: newPhotos };
                                          setBlockUpdates({ 
                                            ...blockUpdates, 
                                            guide: { 
                                              ...blockUpdates.guide, 
                                              sections: newSections 
                                            } 
                                          });
                                        }}
                                      />

                                      <TextField
                                        label="Alt Text"
                                        value={photo.alt || ""}
                                        onChange={(value) => {
                                          const newSections = [...(blockUpdates.guide?.sections || [])];
                                          const newPhotos = [...(newSections[sIdx].photoGallery || [])];
                                          newPhotos[pIdx] = { ...newPhotos[pIdx], alt: value };
                                          newSections[sIdx] = { ...newSections[sIdx], photoGallery: newPhotos };
                                          setBlockUpdates({ 
                                            ...blockUpdates, 
                                            guide: { 
                                              ...blockUpdates.guide, 
                                              sections: newSections 
                                            } 
                                          });
                                        }}
                                      />

                                      <TextField
                                        label="Caption"
                                        value={photo.caption || ""}
                                        onChange={(value) => {
                                          const newSections = [...(blockUpdates.guide?.sections || [])];
                                          const newPhotos = [...(newSections[sIdx].photoGallery || [])];
                                          newPhotos[pIdx] = { ...newPhotos[pIdx], caption: value };
                                          newSections[sIdx] = { ...newSections[sIdx], photoGallery: newPhotos };
                                          setBlockUpdates({ 
                                            ...blockUpdates, 
                                            guide: { 
                                              ...blockUpdates.guide, 
                                              sections: newSections 
                                            } 
                                          });
                                        }}
                                      />
                                    </BlockStack>
                                  </Card>
                                ))}

                                <Button 
                                  size="slim"
                                  onClick={() => {
                                    const newSections = [...(blockUpdates.guide?.sections || [])];
                                    const newPhotos = [...(newSections[sIdx].photoGallery || [])];
                                    newPhotos.push({
                                      id: `photo-${Date.now()}`,
                                      url: "",
                                      alt: "",
                                      caption: ""
                                    });
                                    newSections[sIdx] = { ...newSections[sIdx], photoGallery: newPhotos };
                                    setBlockUpdates({ 
                                      ...blockUpdates, 
                                      guide: { 
                                        ...blockUpdates.guide, 
                                        sections: newSections 
                                      } 
                                    });
                                  }}
                                >
                                  Add Photo
                                </Button>
                              </BlockStack>
                            </Card>
                          ))}

                          <Button 
                            onClick={() => {
                              const newSections = [...(blockUpdates.guide?.sections || [])];
                              newSections.push({
                                id: `section-${Date.now()}`,
                                title: "",
                                description: "",
                                photoGallery: []
                              });
                              setBlockUpdates({ 
                                ...blockUpdates, 
                                guide: { 
                                  ...blockUpdates.guide, 
                                  sections: newSections 
                                } 
                              });
                            }}
                          >
                            Add Guide Section
                          </Button>
                        </BlockStack>
                      )}
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
                  )}
                </BlockStack>
              </Card>
            </Layout.Section>
          </>
        )}
      </Layout>
    </Page>
  );
}
