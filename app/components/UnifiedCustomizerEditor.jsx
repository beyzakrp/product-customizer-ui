import { useMemo, useState, useCallback, useRef } from "react";
import { computeTotalPrice } from "../utils/pricing";
import {
  Card,
  TextField,
  InlineStack,
  Button,
  Banner,
  BlockStack,
  Checkbox,
  ButtonGroup,
  Select,
  Page,
  Tabs,
  Box,
  Text,
  Modal,
  Layout,
  Scrollable,
  Collapsible,
  Divider,
  LegacyCard,
} from "@shopify/polaris";
import {  ArrowUpIcon, ArrowDownIcon } from '@shopify/polaris-icons';

function parseInitial(data) {
  try {
    if (typeof data === "string") {
      const parsed = JSON.parse(data || "[]");
      return Array.isArray(parsed) ? parsed : getDefaultStructure();
    }
    return Array.isArray(data) ? data : getDefaultStructure();
  } catch {
    return getDefaultStructure();
  }
}

function getDefaultStructure() {
  return [
    {
      type: "config",
      title: "Product Customizer",
      enabled: true,
      show_price: true,
      currency: "USD",
      unit_price: 0,
      step_order: [],
    },
  ];
}

function slugify(text = "") {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9\-]/g, "");
}

function createDefaultBlock(type) {
  const idBase = `${type}-${Math.random().toString(36).slice(2, 7)}`;
  if (type === "picker") {
    return {
      id: idBase,
      type: "picker",
      title: "Picker",
      enabled: true,
      isNested: false,
      pricing: { mode: "none", value: 0 },
      options: [
        { label: "Option A", value: "a", media: { type: "hex", hex: "#000000" }, added: 0 },
      ],
      nested: [],
    };
  }
  if (type === "input") {
    return {
      id: idBase,
      type: "input",
      title: "Input",
      enabled: true,
      subtype: "text",
      placeholder: "",
      validation: {},
      pricing: { mode: "none", value: 0 },
      hasGuide: false,
      guide: { enabled: false, title: "", sections: [] },
    };
  }
  if (type === "area") {
    return {
      id: idBase,
      type: "area",
      title: "Area",
      enabled: true,
      unit: "inch",
      limits: {
        width: { min: 20 },
      },
      pricing: { mode: "none", value: 0 },
      hasGuide: false,
      guide: { enabled: false, title: "", sections: [] },
      isHasGuideImage: false,
      guideImageUrl: "",
      hasInputSection: false,
      inputSection: {
        title: "",
        placeholder: ""
      }
    };
  }
  return {
    id: idBase,
    type,
    title: type,
    enabled: true,
  };
}

export default function UnifiedCustomizerEditor({ initialValue = "[]", onSave, onCancel, productId, productTitle }) {
  const [blocks, setBlocks] = useState(() => parseInitial(initialValue));
  const [newBlockType, setNewBlockType] = useState("picker");
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [preview, setPreview] = useState({});
  const [selectedTab, setSelectedTab] = useState(0);
  const [customerEmail, setCustomerEmail] = useState("");
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [draftOrderUrl, setDraftOrderUrl] = useState("");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState({});
  const [selectedOnlyId, setSelectedOnlyId] = useState(null);
  
  // Refs for scroll-to functionality
  const editorScrollRef = useRef(null);
  const blockRefs = useRef({});

  const scrollToBlock = useCallback((id) => {
    try {
      const element = blockRefs.current?.[id];
      if (element && typeof element.scrollIntoView === 'function') {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } catch {}
  }, []);

  const showOnlyBlock = useCallback((id) => {
    try {
      setSelectedOnlyId(id);
      const next = new Set();
      for (const b of blocks) {
        if (b.type !== 'config' && (b.id || String(b.title || b.type)) !== id) {
          next.add(b.id || String(b.title || b.type));
        }
      }
      setCollapsed(next);
      scrollToBlock(id);
    } catch {}
  }, [blocks, scrollToBlock]);

  const showAllBlocks = useCallback(() => {
    setSelectedOnlyId(null);
    setCollapsed(new Set());
  }, []);

  // Validation helpers
  const getFirstPickerBlock = useMemo(() => {
    return blocks.find(b => b.type === 'picker' && b.enabled);
  }, [blocks]);

  const getAreaBlock = useMemo(() => {
    return blocks.find(b => b.type === 'area' && b.enabled);
  }, [blocks]);

  const hasValidSelections = useMemo(() => {
    // Check if first picker has selection
    if (getFirstPickerBlock && !preview[getFirstPickerBlock.id]) {
      return false;
    }
    
    // Check if area block has width
    if (getAreaBlock) {
      const areaSelection = preview[getAreaBlock.id];
      if (!areaSelection || !areaSelection.width || parseFloat(areaSelection.width) <= 0) {
        return false;
      }
      
      // Check width limits
      const width = parseFloat(areaSelection.width);
      if (getAreaBlock.limits?.width?.min && width < getAreaBlock.limits.width.min) {
        return false;
      }
    }
    
    return true;
  }, [preview, getFirstPickerBlock, getAreaBlock]);

  // Email validation - isFormValid'den ÖNCE tanımlanmalı
  const isValidEmail = useCallback((email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }, []);

  // Compact preview renderer for right panel
  const renderCompactPreview = useCallback(() => {
    return (
      <BlockStack gap="200">
        {blocks.filter(b => b.type !== "config").map((block) => (
          <div key={`cp-${block.id}`}>
            {block.type === 'picker' && block.enabled && (
              <Select
                label={block.title || block.id}
                options={[{ label: 'Select', value: '' }, ...(block.options || []).map(o => ({ label: o.label, value: o.value }))]}
                value={preview[block.id] ?? ''}
                onChange={(v) => setPreview(p => ({ ...p, [block.id]: v }))}
              />
            )}
            {block.type === 'input' && block.enabled && (
              (block.subtype || 'text') === 'text' ? (
                <TextField 
                  label={block.title || block.id}
                  value={String(preview[block.id] ?? '')}
                  onChange={(v) => setPreview(p => ({ ...p, [block.id]: v }))} 
                />
              ) : (
                <TextField 
                  label={block.title || block.id} 
                  type="number" 
                  step="any"
                  value={String(preview[block.id] ?? 0)}
                  onChange={(v) => setPreview(p => ({ ...p, [block.id]: v }))}
                />
              )
            )}
            {block.type === 'area' && block.enabled && (
              <TextField
                label={`${block.title || block.id} - Width (inches)`}
                type="number" 
                step="0.1"
                min={block.limits?.width?.min || 0}
                max={block.limits?.width?.max || 1000}
                value={String(preview[block.id]?.width ?? '')}
                onChange={(v) => setPreview(p => ({ ...p, [block.id]: { ...(p[block.id] || {}), width: v } }))}
              />
            )}
          </div>
        ))}
      </BlockStack>
    );
  }, [blocks, preview]);

  // Draft order payload builder
  const buildDraftPayload = useCallback(({ email, finalPrice, summary, productTitle }) => {
    // Product title + customizer options + selections summary
    const productInfo = productTitle ? `${productTitle} - ` : '';
    
    // Customizer options + selections (enabled blocks)
    const customizerOptionsWithSelections = [];
    if (summary?.config) {
      summary.config.forEach(block => {
        if (block.enabled && block.title && block.type !== 'config') {
          const selection = summary.selections?.[block.id];
          let optionText = block.title;
          
          // Seçim varsa ekle
          if (selection) {
            if (block.type === 'picker' && selection.label) {
              optionText += `: ${selection.label}`;
            } else if (block.type === 'area' && selection.width) {
              optionText += `: ${selection.width}in`;
            } else if (block.type === 'input' && selection) {
              optionText += `: ${selection}`;
            }
          }
          
          customizerOptionsWithSelections.push(optionText);
        }
      });
    }
    
    // Title format: "Product Title - Option1: Selection1 • Option2: Selection2"
    let fullTitle = productTitle || 'Custom Product';
    
    // Customizer options + selections ekle
    if (customizerOptionsWithSelections.length > 0) {
      fullTitle += ` - ${customizerOptionsWithSelections.join(' • ')}`;
    }

    // 1) VARIANT kullanmak istersen (fiyatı varyanttan gelir):
    if (summary?.variantId) {
      return {
        email,
        lineItems: [
          {
            variantId: summary.variantId,
            quantity: 1,
            customAttributes: [
              { key: '_product_title', value: productTitle || 'Unknown Product' },
              { key: '_config', value: JSON.stringify(summary.config || []) },
              { key: '_selections', value: JSON.stringify(summary.selections || {}) },
              { key: '_currency', value: summary.currency || 'USD' }
            ]
          }
        ]
      };
    }

    // 2) TAMAMEN CUSTOM satır (özel fiyatı yazmak için):
    return {
      email,
      lineItems: [
        {
          title: fullTitle,
          originalUnitPrice: Number(finalPrice), // ÖNEMLİ: number olmalı
          quantity: 1,
          customAttributes: [
            { key: '_product_title', value: productTitle || 'Unknown Product' },
            { key: '_config', value: JSON.stringify(summary?.config || []) },
            { key: '_selections', value: JSON.stringify(summary?.selections || {}) },
            { key: '_currency', value: summary?.currency || 'USD' }
          ]
        }
      ]
    };
  }, []);

  const isFormValid = useMemo(() => {
    return hasValidSelections && customerEmail && isValidEmail(customerEmail);
  }, [hasValidSelections, customerEmail, isValidEmail]);

  // Preview'da dinamik fiyat hesaplama
  const calculatePreviewPrice = useCallback((option, currentTotal) => {
    if (option.pricing?.mode === 'multiplier') {
      return currentTotal * option.pricing.value;
    } else if (option.pricing?.mode === 'added') {
      return option.pricing.value;
    }
    return 0;
  }, []);

  // Fiyat gösterimini kontrol et
  const shouldShowPrice = useCallback((option) => {
    // Pricing yoksa fiyat gösterilmez
    if (!option.pricing) return false;
    
    // show: false ise fiyat gösterilmez
    if (option.pricing.show === false) return false;
    
    // show: true veya undefined ise fiyat gösterilir
    return true;
  }, []);

  // Mevcut toplam fiyatı hesapla
  const currentTotalPrice = useMemo(() => {
    try {
      const selectionsForPricing = JSON.parse(JSON.stringify(preview));
      for (const block of blocks) {
        if (block.type === 'area' && selectionsForPricing[block.id]) {
          delete selectionsForPricing[block.id].height;
        }
      }
      return computeTotalPrice({ config: blocks, selections: selectionsForPricing });
    } catch (e) {
      return 0;
    }
  }, [preview, blocks]);

  const getValidationMessage = useMemo(() => {
    if (getFirstPickerBlock && !preview[getFirstPickerBlock.id]) {
      return `Please select "${getFirstPickerBlock.title || getFirstPickerBlock.id}" first.`;
    }
    
    if (getAreaBlock) {
      const areaSelection = preview[getAreaBlock.id];
      if (!areaSelection || !areaSelection.width || parseFloat(areaSelection.width) <= 0) {
        return `Please enter the width value for "${getAreaBlock.title || getAreaBlock.id}".`;
      }
      
      // Check width limits
      const width = parseFloat(areaSelection.width);
      if (getAreaBlock.limits?.width?.min && width < getAreaBlock.limits.width.min) {
        return `"${getAreaBlock.title || getAreaBlock.id}" for minimum width ${getAreaBlock.limits.width.min} inches.`;
      }
    }
    
    return null;
  }, [preview, getFirstPickerBlock, getAreaBlock]);

  const setBlocksAndUpdateStepOrder = useCallback((newBlocks) => {
    const newStepOrder = newBlocks
      .filter((b) => b.type !== "config")
      .map((b) => b.id)
      .filter(Boolean);

    const configIndex = newBlocks.findIndex((b) => b.type === "config");
    
    if (configIndex !== -1) {
      const newConfig = { ...newBlocks[configIndex], step_order: newStepOrder };
      newBlocks[configIndex] = newConfig;
    }
    
    setBlocks(newBlocks);
  }, []);

  const handleTabChange = useCallback(
    (selectedTabIndex) => setSelectedTab(selectedTabIndex),
    [],
  );

  const tabs = [
    {
      id: "builder",
      content: "Builder",
      panelID: "builder-panel",
    },
    {
      id: "preview",
      content: "Live Preview",
      panelID: "preview-panel",
    },
  ];

  const configIdx = useMemo(() => blocks.findIndex((b) => b.type === "config"), [blocks]);
  const config = blocks[configIdx] || getDefaultStructure()[0];

  const updateConfig = (patch) => {
    const next = [...blocks];
    if (configIdx >= 0) {
      next[configIdx] = { ...next[configIdx], ...patch };
    } else {
      next.unshift({ ...getDefaultStructure()[0], ...patch });
    }
    setBlocks(next);
  };

  const addBlock = () => {
    const next = [...blocks, createDefaultBlock(newBlockType)];
    setBlocksAndUpdateStepOrder(next);
  };

  const removeBlock = (index) => {
    if (index === configIdx) return; // config silinmez
    const next = blocks.filter((_, i) => i !== index);
    setBlocksAndUpdateStepOrder(next);
  };

  const updateBlock = (index, patch) => {
    const next = [...blocks];
    next[index] = { ...next[index], ...patch };
    setBlocks(next);
  };

  const toggleCollapse = (id) => {
    const next = new Set(collapsed);
    if (next.has(id)) next.delete(id); else next.add(id);
    setCollapsed(next);
  };

  const collapseAll = () => {
    const next = new Set();
    for (const b of blocks) {
      if (b.type !== 'config') next.add(b.id || String(b.title || b.type));
    }
    setCollapsed(next);
  };

  const expandAll = () => {
    setCollapsed(new Set());
  };

  const moveBlock = (fromIdx, toIdx) => {
    if (fromIdx === configIdx || toIdx === configIdx) return; // config taşınamaz
    if (toIdx < 0 || toIdx >= blocks.length) return;
    const next = [...blocks];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    setBlocksAndUpdateStepOrder(next);
  };

  const duplicateBlock = (index) => {
    if (index === configIdx) return;
    const src = blocks[index];
    const clone = JSON.parse(JSON.stringify(src));
    const baseId = (clone.id || slugify(clone.title || clone.type || "block"));
    let newId = `${baseId}-copy`;
    const existingIds = new Set(blocks.map((b) => b.id).filter(Boolean));
    let counter = 2;
    while (existingIds.has(newId)) {
      newId = `${baseId}-copy-${counter++}`;
    }
    clone.id = newId;
    const next = [...blocks];
    next.splice(index + 1, 0, clone);
    setBlocksAndUpdateStepOrder(next);
  };

  const updatePickerOption = (blockIndex, optionIndex, patch) => {
    const blk = blocks[blockIndex];
    const options = [...(blk.options || [])];
    options[optionIndex] = { ...options[optionIndex], ...patch };
    updateBlock(blockIndex, { options });
  };

  const addPickerOption = (blockIndex) => {
    const blk = blocks[blockIndex];
    const options = [...(blk.options || [])];
    options.push({ label: "Option", value: slugify(`option-${options.length + 1}`), media: { type: "hex", hex: "#000000" }, added: 0 });
    updateBlock(blockIndex, { options });
  };

  const removePickerOption = (blockIndex, optionIndex) => {
    const blk = blocks[blockIndex];
    const options = (blk.options || []).filter((_, i) => i !== optionIndex);
    updateBlock(blockIndex, { options });
  };

  // Nested (1 seviye)
  const ensureNestedStructure = (blockIndex) => {
    const blk = blocks[blockIndex];
    if (!blk.nested || !Array.isArray(blk.nested)) {
      updateBlock(blockIndex, { nested: [] });
    }
  };

  const addNestedGroup = (blockIndex) => {
    ensureNestedStructure(blockIndex);
    const blk = blocks[blockIndex];
    const nested = [...(blk.nested || [])];
    nested.push({ when: { parentId: blk.id, equals: "" }, items: [] });
    updateBlock(blockIndex, { nested });
  };

  const updateNestedGroup = (blockIndex, nestedIndex, patch) => {
    const blk = blocks[blockIndex];
    const nested = [...(blk.nested || [])];
    nested[nestedIndex] = { ...nested[nestedIndex], ...patch };
    updateBlock(blockIndex, { nested });
  };

  const addNestedItemPicker = (blockIndex, nestedIndex) => {
    const blk = blocks[blockIndex];
    const nested = [...(blk.nested || [])];
    const items = [...(nested[nestedIndex]?.items || [])];
    items.push(createDefaultBlock("picker"));
    nested[nestedIndex] = { ...nested[nestedIndex], items };
    updateBlock(blockIndex, { nested });
  };

  const updateNestedItem = (blockIndex, nestedIndex, itemIndex, patch) => {
    const blk = blocks[blockIndex];
    const nested = [...(blk.nested || [])];
    const items = [...(nested[nestedIndex]?.items || [])];
    items[itemIndex] = { ...items[itemIndex], ...patch };
    nested[nestedIndex] = { ...nested[nestedIndex], items };
    updateBlock(blockIndex, { nested });
  };

  const removeNestedItem = (blockIndex, nestedIndex, itemIndex) => {
    const blk = blocks[blockIndex];
    const nested = [...(blk.nested || [])];
    const items = (nested[nestedIndex]?.items || []).filter((_, i) => i !== itemIndex);
    nested[nestedIndex] = { ...nested[nestedIndex], items };
    updateBlock(blockIndex, { nested });
  };

  // Guide Section Helper Functions
  const addGuideSection = (blockIndex) => {
    const blk = blocks[blockIndex];
    updateBlock(blockIndex, { 
      guide: { 
        enabled: true, 
        title: "Measurement Guidelines",
        sections: []
      } 
    });
  };

  const addGuideSectionItem = (blockIndex) => {
    const blk = blocks[blockIndex];
    const guide = { ...(blk.guide || {}) };
    const sections = [...(guide.sections || [])];
    sections.push({
      id: `section-${Date.now()}`,
      title: "",
      description: "",
      photoGallery: []
    });
    guide.sections = sections;
    updateBlock(blockIndex, { guide });
  };

  const updateGuideSection = (blockIndex, sectionIndex, patch) => {
    const blk = blocks[blockIndex];
    const guide = { ...(blk.guide || {}) };
    const sections = [...(guide.sections || [])];
    sections[sectionIndex] = { ...sections[sectionIndex], ...patch };
    guide.sections = sections;
    updateBlock(blockIndex, { guide });
  };

  const removeGuideSection = (blockIndex, sectionIndex) => {
    const blk = blocks[blockIndex];
    const guide = { ...(blk.guide || {}) };
    const sections = (guide.sections || []).filter((_, i) => i !== sectionIndex);
    guide.sections = sections;
    updateBlock(blockIndex, { guide });
  };

  const addGuidePhoto = (blockIndex, sectionIndex) => {
    const blk = blocks[blockIndex];
    const guide = { ...(blk.guide || {}) };
    const sections = [...(guide.sections || [])];
    const photoGallery = [...(sections[sectionIndex]?.photoGallery || [])];
    photoGallery.push({
      id: `photo-${Date.now()}`,
      url: "",
      alt: "",
      caption: ""
    });
    sections[sectionIndex] = { ...sections[sectionIndex], photoGallery };
    guide.sections = sections;
    updateBlock(blockIndex, { guide });
  };

  const updateGuidePhoto = (blockIndex, sectionIndex, photoIndex, patch) => {
    const blk = blocks[blockIndex];
    const guide = { ...(blk.guide || {}) };
    const sections = [...(guide.sections || [])];
    const photoGallery = [...(sections[sectionIndex]?.photoGallery || [])];
    photoGallery[photoIndex] = { ...photoGallery[photoIndex], ...patch };
    sections[sectionIndex] = { ...sections[sectionIndex], photoGallery };
    guide.sections = sections;
    updateBlock(blockIndex, { guide });
  };

  const removeGuidePhoto = (blockIndex, sectionIndex, photoIndex) => {
    const blk = blocks[blockIndex];
    const guide = { ...(blk.guide || {}) };
    const sections = [...(guide.sections || [])];
    const photoGallery = (sections[sectionIndex]?.photoGallery || []).filter((_, i) => i !== photoIndex);
    sections[sectionIndex] = { ...sections[sectionIndex], photoGallery };
    guide.sections = sections;
    updateBlock(blockIndex, { guide });
  };

  const handleSave = () => {
    onSave(blocks);
  };

  const handleAddToCart = async () => {
    const configForCart = blocks;
    const selectionsForCart = preview;

    // ProductId kontrolü
    if (!productId) {
      alert('Ürün bilgisi bulunamadı. Lütfen sayfayı yenileyin.');
      return;
    }

    // Final price hesapla
    let finalPrice = 0;
    try {
      const selectionsForPricing = JSON.parse(JSON.stringify(preview));
      for (const block of blocks) {
        if (block.type === 'area' && selectionsForPricing[block.id]) {
          delete selectionsForPricing[block.id].height;
        }
      }
      finalPrice = computeTotalPrice({ config: blocks, selections: selectionsForPricing }) || 0;
    } catch (e) {
      console.error("Price calculation error:", e);
      finalPrice = 0;
    }

    // Customer email validation
    if (!customerEmail || !isValidEmail(customerEmail)) {
      alert('Lütfen geçerli bir email adresi giriniz.');
      return;
    }

    // Payload hazırla - buildDraftPayload ile (variantId olmadan custom mode)
    const summary = {
      config: configForCart,
      selections: selectionsForCart,
      currency: config.currency || 'USD'
    };
    
    const payload = buildDraftPayload({ 
      email: customerEmail, 
      finalPrice: finalPrice, 
      summary,
      productTitle 
    });

    console.log('Draft Order Payload:', payload);

    try {
      const response = await fetch('https://customizer-draft-order-api.vercel.app/api/draft-orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      
      if (response.ok && data.ok) {
        // Başarılı - modal'ı aç
        setDraftOrderUrl(data.invoiceUrl);
        setShowSuccessModal(true);
        console.log('Draft Order created successfully:', data);
      } else {
        const errorMessage = data.error || 'Unknown error';
        alert(`Draft order creation failed: ${errorMessage}`);
        console.error('Draft order error:', data);
      }
    } catch (error) {
      console.error('Failed to create draft order:', error);
      alert('Draft order creation failed. Please try again.');
    }
  };

  return (
    <Page fullWidth>
      <Tabs tabs={tabs} selected={selectedTab} onSelect={handleTabChange}>
        <div style={{ paddingTop: '1.6rem' }}>
          {selectedTab === 0 ? (
            <Layout>
              <Layout.Section>
                <BlockStack gap="400">
              {/* Search Bar */}
              <Card sectioned>
                <InlineStack align="space-between">
                  <TextField
                    label="Search blocks"
                    labelHidden
                    placeholder="Search by title or id…"
                    value={search}
                    onChange={setSearch}
                  />
                </InlineStack>
              </Card>
              
             {/* <Banner tone="info">
                3 types are supported: Picker, Input (text/number), Area. Multiplier only applies to base price.
              </Banner>
*/}

              {/* Config */}
              <Card title="General Settings" sectioned style={{ position: 'sticky', top: 0, zIndex: 5 }}>
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h1" variant="headingMd">General Settings</Text>
                  <Button
                    size="slim"
                    variant="tertiary"
                    onClick={() => toggleCollapse('config')}
                  >
                    {collapsed.has('config') ? 'Expand' : 'Collapse'}
                  </Button>
                </InlineStack>
                <Box paddingBlockStart="200" paddingBlockEnd="200">
                  <Divider />
                </Box>

                {!collapsed.has('config') && (
                  <BlockStack gap="300">
                  <TextField
                    label="Title"
                    value={config.title || ""}
                    onChange={(v) => updateConfig({ title: v })}
                  />
                  <InlineStack>
                    <div style={{ marginRight: 12 }}>
                      <Checkbox
                        label="Customizer active"
                        checked={!!config.enabled}
                        onChange={(v) => updateConfig({ enabled: v })}
                      />
                    </div>
                    <div>
                      <Checkbox
                        label="Show price"
                        checked={!!config.show_price}
                        onChange={(v) => updateConfig({ show_price: v })}
                      />
                    </div>
                  </InlineStack>
                  <InlineStack>
                    <div style={{ flex: 1, marginRight: 8 }}>
                      <TextField
                        label="Currency"
                        value={config.currency || "USD"}
                        onChange={(v) => updateConfig({ currency: v })}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <TextField
                        label="Unit price (per inch)"
                        type="number"
                        step="0.01"
                        value={String(config.unit_price ?? 0)}
                        onChange={(v) => updateConfig({ unit_price: parseFloat(v) || 0 })}
                      />
                    </div>
                  </InlineStack>
                  </BlockStack>
                )}
              </Card>

              <div style={{ height: 8 }} />

              {/* Blocks List */}
              {blocks.map((block, idx) => {
                const visible =
                  block.type !== "config" &&
                  (!search ||
                    (block.title || '').toLowerCase().includes(search.toLowerCase()) ||
                    (block.id || '').toLowerCase().includes(search.toLowerCase())
                  );

                if (!visible) return null;

                if (selectedOnlyId && (block.id !== selectedOnlyId)) return null;

                return (
                  <Card ref={(el)=> { if (el) { blockRefs.current[block.id] = el; } }} key={block.id || idx} title={`${block.title || block.type} (${block.type})`} sectioned>
                    <InlineStack align="space-between" blockAlign="center">
                      <Text as="h1" variant="headingMd">{block.title || block.type}</Text>
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                          <ButtonGroup variant="segmented">
                            <Button size="slim" onClick={() => moveBlock(idx, idx - 1)}>Up</Button>
                            <Button size="slim" onClick={() => moveBlock(idx, idx + 1)}>Down</Button>
                            <Button size="slim" onClick={() => duplicateBlock(idx)}>Duplicate</Button>
                            <Button size="slim" onClick={() => toggleCollapse(block.id || String(idx))}>{collapsed.has(block.id || String(idx)) ? 'Expand' : 'Collapse'}</Button> 
                          </ButtonGroup>
                        </div>
                    </InlineStack>
                    <Box paddingBlockStart="200" paddingBlockEnd="200">
                      <Divider />
                    </Box>
                    <BlockStack gap="300">
                      <InlineStack align="space-between">
                        <div style={{ flex: 1, marginRight: 8 }}>
                          <TextField
                            label="Title"
                            value={block.title || ""}
                            onChange={(v) => updateBlock(idx, { title: v, id: block.id || slugify(v) })}
                          />
                        </div>
                        <div style={{ width: 220, marginRight: 8 }}>
                          <TextField
                            label="Id"
                            value={block.id || ""}
                            onChange={(v) => updateBlock(idx, { id: slugify(v) })}
                            helpText="Should be short and unique"
                          />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 15 }}>
                          
                          <Checkbox
                            label="Enabled"
                            checked={!!block.enabled}
                            onChange={(v) => updateBlock(idx, { enabled: v })}
                          />
                           <div style={{ alignSelf: "flex-end" }}>
                          <Button tone="critical" variant="primary" onClick={() => removeBlock(idx)}>Delete</Button>
                        </div>
                        </div>
                        
                       
                      </InlineStack>

                      {!collapsed.has(block.id || String(idx)) && (
                      <>
                      {block.type !== 'area' && (
                        <Card title="Pricing" sectioned>
                          <InlineStack align="space-between" blockAlign="center">
                            <Text as="h1" variant="headingMd">Pricing</Text>
                            <Button
                              size="slim"
                              variant="tertiary"
                              onClick={() => toggleCollapse(`${block.id || String(idx)}-pricing`)}
                            >
                              {collapsed.has(`${block.id || String(idx)}-pricing`) ? 'Expand' : 'Collapse'}
                            </Button>
                          </InlineStack>
                          <Box paddingBlockStart="200" paddingBlockEnd="200">
                            <Divider />
                          </Box>

                          {!collapsed.has(`${block.id || String(idx)}-pricing`) && (
                            <>
                              <InlineStack>
                                <div style={{ width: 220, marginRight: 8 }}>
                                  <Select
                                    label="Mode"
                                    options={[
                                      { label: "None", value: "none" },
                                      { label: "Added", value: "added" },
                                      { label: "Multiplier", value: "multiplier" },
                                    ]}
                                    value={block.pricing?.mode || "none"}
                                    onChange={(v) => updateBlock(idx, { pricing: { ...(block.pricing || {}), mode: v } })}
                                  />
                                </div>
                                <div style={{ width: 220 }}>
                                  <TextField
                                    label="Value"
                                    type="number"
                                    step="any"
                                    value={String(block.pricing?.value ?? 0)}
                                    onChange={(v) => {
                                      const newPricing = { ...(block.pricing || {}), value: parseFloat(v) || 0 };
                                      updateBlock(idx, { pricing: newPricing });
                                    }}
                                  />
                                </div>
                              </InlineStack>
                              
                            </>
                          )}
                        </Card>
                      )}

                      {/* Type Specific */}
                      {block.type === "picker" && (
                        <BlockStack gap="300">
                          <Checkbox
                            label="Nested (1 level)"
                            checked={!!block.isNested}
                            onChange={(v) => updateBlock(idx, { isNested: v })}
                          />
                          
                          <Checkbox
                            label="Has Guide Section"
                            checked={!!block.hasGuide}
                            onChange={(v) => updateBlock(idx, { 
                              hasGuide: v,
                              guide: { 
                                ...(block.guide || {}), 
                                enabled: v 
                              }
                            })}
                          />

                          {(block.options || []).map((opt, oIdx) => (
                            <Card key={oIdx} sectioned>
                                <InlineStack align="space-between" blockAlign="center" style={{ width: '100%' }}>
                                  <Text as="h1" variant="headingMd">Option</Text>
                                  <Button
                                    size="slim"
                                    variant="tertiary"
                                    onClick={() => toggleCollapse(`${block.id || String(idx)}-opt-${oIdx}`)}
                                  >
                                    {collapsed.has(`${block.id || String(idx)}-opt-${oIdx}`) ? 'Expand' : 'Collapse'}
                                  </Button>
                                </InlineStack>
                                <Box paddingBlockStart="200" paddingBlockEnd="200" style={{ width: '100%' }}>
                                  <Divider />
                                </Box>
                                {!collapsed.has(`${block.id || String(idx)}-opt-${oIdx}`) && (
                                  <>
                                <InlineStack align="space-between" >
                                <div style={{ flex: 1, marginRight: 8 , marginBottom: 8}}>
                              <TextField
                                    label="Label"
                                    value={opt.label || ""}
                                    onChange={(v) => updatePickerOption(idx, oIdx, { label: v, value: opt.value || slugify(v) })}
                              />
                            </div>
                            <div style={{ flex: 1, marginRight: 8 , marginBottom: 10}}>
                                  <TextField
                                    label="Value"
                                    value={opt.value || ""}
                                    onChange={(v) => updatePickerOption(idx, oIdx, { value: slugify(v) })}
                                  />
                                </div>
                                </InlineStack>
                            
                                <InlineStack align="space-between" >
                                <div style={{ width: 200, marginRight: 8 , marginBottom: 10}}>
                                  <Select
                                    label="Media Type"
                                    options={[
                                      { label: "HEX", value: "hex" },
                                      { label: "Image URL", value: "url" },
                                    ]}
                                    value={opt.media?.type || "hex"}
                                    onChange={(v) => updatePickerOption(idx, oIdx, { media: { ...(opt.media || {}), type: v } })}
                                  />
                                </div>
                                <div style={{ width: 180, marginRight: 8 , marginBottom: 10}}>
                              <Select
                                    label="Pricing Mode"
                                options={[
                                      { label: "None", value: "none" },
                                      { label: "Added", value: "added" },
                                      { label: "Multiplier", value: "multiplier" },
                                ]}
                                    value={opt.pricing?.mode || (typeof opt.added === 'number' ? 'added' : 'none')}
                                    onChange={(v) => updatePickerOption(idx, oIdx, { pricing: { ...(opt.pricing || {}), mode: v } })}
                              />
                            </div>
                                <div style={{ width: 180 , marginBottom: 10}}>
                              <TextField
                                    label="Value"
                                type="number"
                                    step="any"
                                    value={String(opt.pricing?.value ?? (typeof opt.added === 'number' ? opt.added : 0))}
                                    onChange={(v) => updatePickerOption(idx, oIdx, { pricing: { ...(opt.pricing || {}), value: parseFloat(v) || 0 } })}
                              />
                            </div>
                            <div style={{ width: 180 , marginBottom: 10}}>
                              <Checkbox
                                label="Show price"
                                checked={opt.pricing?.show !== false}
                                onChange={(v) => updatePickerOption(idx, oIdx, { pricing: { ...(opt.pricing || {}), show: v } })}
                              />
                            </div>
                            
                                <div>
                                  <Button tone="critical" variant="primary" onClick={() => removePickerOption(idx, oIdx)}>Delete</Button>
                                </div>
                          </InlineStack>

                              {opt.media?.type === "url" ? (
                              <TextField
                                label="Image URL"
                                  value={opt.media?.url || ""}
                                  onChange={(v) => updatePickerOption(idx, oIdx, { media: { ...(opt.media || {}), url: v } })}
                              />
                            ) : (
                              <TextField
                                  label="HEX"
                                  value={opt.media?.hex || "#000000"}
                                  onChange={(v) => updatePickerOption(idx, oIdx, { media: { ...(opt.media || {}), hex: v } })}
                                />
                              )}
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span style={{ fontSize: 12, color: '#666', paddingTop: 4 }}>Preview:</span>
                                {opt.media?.type === 'url' && opt.media?.url ? (
                                  <img
                                    src={opt.media.url}
                                    alt={opt.label || opt.value || 'preview'}
                                    style={{ width: 30, height: 30, borderRadius: 4, objectFit: 'cover', border: '1px solid #ddd', marginTop: 10 }}
                              />
                            ) : (
                              <div 
                                style={{ 
                                      width: 30,
                                      height: 30,
                                      borderRadius: 4,
                                      border: '1px solid #ddd',
                                      marginTop: 10,
                                      backgroundColor: opt.media?.hex || '#000000',
                                }}
                              />
                            )}
                          </div>
                                  </>
                                )}
                      </Card>
                    ))}
                          <Button onClick={() => addPickerOption(idx)} variant="tertiary">Add Option</Button>

                          {block.isNested && (
                            <Box paddingBlockStart="400" borderBlockStart="divider" marginBlockStart="400">
                              <BlockStack gap="400">
                                <InlineStack align="space-between">
                                  <Text variant="headingMd" as="h3">Nested Groups</Text>
                                  <Button variant="tertiary" onClick={() => addNestedGroup(idx)}>Add Nested Group</Button>
                                </InlineStack>
                                <Banner tone="info" onDismiss={() => {}}>
                                  Nested groups are displayed when a specific option of the parent picker is selected.
                                </Banner>
                                {(block.nested || []).map((ng, nIdx) => (
                                  <Box key={nIdx} background="bg-surface-secondary" padding="300" borderRadius="200">
                                    <BlockStack gap="300">
                                      <InlineStack align="space-between">
                                      <Select
                                        label="Show when parent option is"
                                        options={[{ label: "Select option", value: "" }, ...(block.options || []).map((o) => ({ label: o.label, value: o.value }))]}
                                        value={ng.when?.equals || ""}
                                        onChange={(v) => updateNestedGroup(idx, nIdx, { when: { parentId: block.id, equals: v } })}
                                      />
                                      <Button tone="critical" variant="tertiary">Remove Group</Button>
                                      </InlineStack>
                                      
                                      <Text variant="headingSm" as="h4">Items in this group</Text>

                                      {(ng.items || []).map((item, itemIdx) => (
                                        <Card key={itemIdx}>
                                          <BlockStack gap="300" padding="400">
                                            <InlineStack align="space-between">
                                              <Text variant="bodyMd" as="p" fontWeight="semibold">{item.title || item.type}</Text>
                                              <Button tone="critical" variant="primary" onClick={() => removeNestedItem(idx, nIdx, itemIdx)}>Delete Item</Button>
                                            </InlineStack>
                                          
                                            <InlineStack>
                                              <div style={{ flex: 1, marginRight: 8, marginBottom: 8 }}>
                                                <TextField
                                                  label="Title"
                                                  value={item.title || ""}
                                                  onChange={(v) => updateNestedItem(idx, nIdx, itemIdx, { title: v })}
                                                />
                                              </div>
                                              <div style={{ width: 220, marginRight: 8 }}>
                                                <TextField
                                                  label="Id"
                                                  value={item.id || ""}
                                                  onChange={(v) => updateNestedItem(idx, nIdx, itemIdx, { id: slugify(v) })}
                                                />
                                              </div>
                                              <div style={{ alignSelf: "flex-end" }}>
                                                <Checkbox
                                                  label="Enabled"
                                                  checked={!!item.enabled}
                                                  onChange={(v) => updateNestedItem(idx, nIdx, itemIdx, { enabled: v })}
                                                />
                                              </div>
                                            </InlineStack>

                                            {(item.options || []).map((opt, oIdx) => (
                                              <Box key={oIdx} padding="300" border="divider" borderRadius="200">
                                                <BlockStack gap="300">
                                                  <InlineStack align="space-between" blockAlign="end" gap="300">
                                                    <div style={{ flex: 1 }}>
                                                      <TextField
                                                        label="Label"
                                                        value={opt.label || ""}
                                                        onChange={(v) => {
                                                          const options = [...(item.options || [])];
                                                          options[oIdx] = { ...options[oIdx], label: v, value: options[oIdx].value || slugify(v) };
                                                          updateNestedItem(idx, nIdx, itemIdx, { options });
                                                        }}
                                                      />
                                                    </div>
                                          
                                                    <div style={{ flex: 1 }}>
                                                      <TextField
                                                        label="Value"
                                                        value={opt.value || ""}
                                                        onChange={(v) => {
                                                          const options = [...(item.options || [])];
                                                          options[oIdx] = { ...options[oIdx], value: slugify(v) };
                                                          updateNestedItem(idx, nIdx, itemIdx, { options });
                                                        }}
                                                      />
                                                    </div>
                                                  </InlineStack>
                                                  <InlineStack gap="200" align="space-between" blockAlign="end">
                                                    <div style={{ width: 160 }}>
                                                      <Select
                                                        label="Media Type"
                                                        options={[
                                                          { label: "HEX", value: "hex" },
                                                          { label: "Image URL", value: "url" },
                                                        ]}
                                                        value={opt.media?.type || "hex"}
                                                        onChange={(v) => {
                                                          const options = [...(item.options || [])];
                                                          options[oIdx] = { ...options[oIdx], media: { ...(opt.media || {}), type: v } };
                                                          updateNestedItem(idx, nIdx, itemIdx, { options });
                                                        }}
                                                      />
                                                    </div>
                                                    <div style={{ width: 160 }}>
                                                      <Select
                                                        label="Pricing Mode"
                                                        options={[
                                                          { label: "None", value: "none" },
                                                          { label: "Added", value: "added" },
                                                          { label: "Multiplier", value: "multiplier" },
                                                        ]}
                                                        value={opt.pricing?.mode || (typeof opt.added === 'number' ? 'added' : 'none')}
                                                        onChange={(v) => {
                                                          const options = [...(item.options || [])];
                                                          options[oIdx] = { ...options[oIdx], pricing: { ...(opt.pricing || {}), mode: v } };
                                                          updateNestedItem(idx, nIdx, itemIdx, { options });
                                                        }}
                                                      />
                                                    </div>
                                                    <div style={{ width: 160 }}>
                                                      <TextField
                                                        label="Pricing Value"
                                                        type="number"
                                                        value={String(opt.pricing?.value ?? (typeof opt.added === 'number' ? opt.added : 0))}
                                                        onChange={(v) => {
                                                          const options = [...(item.options || [])];
                                                          options[oIdx] = { ...options[oIdx], pricing: { ...(opt.pricing || {}), value: parseFloat(v) || 0 } };
                                                          updateNestedItem(idx, nIdx, itemIdx, { options });
                                                        }}
                                                      />
                                                    </div>
                                                    <div style={{ width: 160 }}>
                                                      <Checkbox
                                                        label="Show price"
                                                        checked={opt.pricing?.show !== false}
                                                        onChange={(v) => {
                                                          const options = [...(item.options || [])];
                                                          options[oIdx] = { ...options[oIdx], pricing: { ...(opt.pricing || {}), show: v } };
                                                          updateNestedItem(idx, nIdx, itemIdx, { options });
                                                        }}
                                                      />
                                                    </div>
                                                  </InlineStack>

                                                  {opt.media?.type === "url" ? (
                                                    <TextField
                                                      label="Image URL"
                                                      value={opt.media?.url || ""}
                                                      onChange={(v) => {
                                                        const options = [...(item.options || [])];
                                                        options[oIdx] = { ...options[oIdx], media: { ...(opt.media || {}), url: v } };
                                                        updateNestedItem(idx, nIdx, itemIdx, { options });
                                                      }}
                                                    />
                                                  ) : (
                                                    <TextField
                                                      label="HEX"
                                                      value={opt.media?.hex || "#000000"}
                                                      onChange={(v) => {
                                                        const options = [...(item.options || [])];
                                                        options[oIdx] = { ...options[oIdx], media: { ...(opt.media || {}), hex: v } };
                                                        updateNestedItem(idx, nIdx, itemIdx, { options });
                                                      }}
                                                    />
                                                  )}
                                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                    <span style={{ fontSize: 12, color: '#666' }}>Preview:</span>
                                                    {opt.media?.type === 'url' && opt.media?.url ? (
                                                      <img
                                                        src={opt.media.url}
                                                        alt={opt.label || opt.value || 'preview'}
                                                        style={{ width: 30, height: 30, borderRadius: 4, objectFit: 'cover', border: '1px solid #ddd' }}
                                                      />
                                                    ) : (
                                                      <div 
                                                        style={{ 
                                                          width: 30,
                                                          height: 30,
                                                          borderRadius: 4,
                                                          border: '1px solid #ddd',
                                                          backgroundColor: opt.media?.hex || '#000000',
                                                        }}
                                                      />
                                                    )}
                                                  </div>
                                                </BlockStack>
                                              </Box>
                                            ))}
                                            <Button variant="tertiary" size="slim" onClick={() => {
                                              const options = [...(item.options || [])];
                                              options.push({ label: "Option", value: slugify(`option-${options.length + 1}`), media: { type: "hex", hex: "#000000" }, added: 0 });
                                              updateNestedItem(idx, nIdx, itemIdx, { options });
                                            }}>Add Option to Item</Button>
                                          </BlockStack>
                                        </Card>
                                      ))}
                                      <Button variant="tertiary" onClick={() => addNestedItemPicker(idx, nIdx)}>Add New Item to Group</Button>
                                    </BlockStack>
                                  </Box>
                                ))}
                              </BlockStack>
                            </Box>
                          )}

                          {block.hasGuide && (
                            <Box paddingBlockStart="400" borderBlockStart="divider" marginBlockStart="400">
                              <BlockStack gap="400">
                                <InlineStack align="space-between">
                                  <Text variant="headingMd" as="h3">Guide Section</Text>
                                  {!block.guide?.enabled && (
                                    <Button variant="tertiary" onClick={() => updateBlock(idx, { 
                                      guide: { 
                                        ...(block.guide || {}), 
                                        enabled: true,
                                        sections: [{ title: "", description: "", photoGallery: [] }]
                                      } 
                                    })}>Add Guide Section</Button>
                                  )}
                                </InlineStack>
                                <Banner tone="info" onDismiss={() => {}}>
                                  Guide sections provide measurement guidelines and helpful information for customers.
                                </Banner>
                                
                                {block.guide?.enabled && (
                                  <Card sectioned>
                                    <BlockStack gap="300">
                                      <TextField
                                        label="Guide Title"
                                        value={block.guide?.title || ""}
                                        onChange={(v) => updateBlock(idx, { 
                                          guide: { 
                                            ...(block.guide || {}), 
                                            title: v,
                                            enabled: true 
                                          } 
                                        })}
                                      />
                                      
                                      {(block.guide?.sections || []).map((section, sIdx) => (
                                        <Box key={sIdx} background="bg-surface-secondary" padding="300" borderRadius="200">
                                          <BlockStack gap="300">
                                            <InlineStack align="space-between">
                                              <Text variant="headingSm" as="h4">Section {sIdx + 1}</Text>
                                              <Button tone="critical" variant="tertiary" onClick={() => removeGuideSection(idx, sIdx)}>Remove Section</Button>
                                            </InlineStack>
                                            
                                            <TextField
                                              label="Section Title"
                                              value={section.title || ""}
                                              onChange={(v) => updateGuideSection(idx, sIdx, { title: v })}
                                            />
                                            
                                            <TextField
                                              label="Description"
                                              multiline={4}
                                              value={section.description || ""}
                                              onChange={(v) => updateGuideSection(idx, sIdx, { description: v })}
                                            />
                                            
                                            <Text variant="headingSm" as="h5">Photo Gallery</Text>
                                            {(section.photoGallery || []).map((photo, pIdx) => (
                                              <Card key={pIdx} sectioned>
                                                <BlockStack gap="200">
                                                  <InlineStack align="space-between">
                                                    <Text variant="bodyMd" as="p">Photo {pIdx + 1}</Text>
                                                    <Button tone="critical" variant="tertiary" onClick={() => removeGuidePhoto(idx, sIdx, pIdx)}>Remove Photo</Button>
                                                  </InlineStack>
                                                  
                                                  <TextField
                                                    label="Image URL"
                                                    value={photo.url || ""}
                                                    onChange={(v) => updateGuidePhoto(idx, sIdx, pIdx, { url: v })}
                                                  />
                                                  
                                                  <TextField
                                                    label="Alt Text"
                                                    value={photo.alt || ""}
                                                    onChange={(v) => updateGuidePhoto(idx, sIdx, pIdx, { alt: v })}
                                                  />
                                                  
                                                  <TextField
                                                    label="Caption"
                                                    value={photo.caption || ""}
                                                    onChange={(v) => updateGuidePhoto(idx, sIdx, pIdx, { caption: v })}
                                                  />
                                                  
                                                  {photo.url && (
                                                    <div style={{ marginTop: 8 }}>
                                                      <Text variant="bodySm" as="p" color="subdued">Preview:</Text>
                                                      <img
                                                        src={photo.url}
                                                        alt={photo.alt || "Preview"}
                                                        style={{ 
                                                          width: 150, 
                                                          height: 100, 
                                                          objectFit: 'cover', 
                                                          borderRadius: 4, 
                                                          border: '1px solid #ddd',
                                                          marginTop: 4
                                                        }}
                                                      />
                                                    </div>
                                                  )}
                                                </BlockStack>
                                              </Card>
                                            ))}
                                            <Button variant="tertiary" onClick={() => addGuidePhoto(idx, sIdx)}>Add Photo</Button>
                                          </BlockStack>
                                        </Box>
                                      ))}
                                      
                                      <Button variant="tertiary" onClick={() => addGuideSectionItem(idx)}>Add New Section</Button>
                                    </BlockStack>
                                  </Card>
                                )}
                              </BlockStack>
                            </Box>
                          )}
                        </BlockStack>
                      )}

                      {block.type === "input" && (
                  <BlockStack gap="300">
                          <Select
                            label="Subtype"
                            options={[
                              { label: "Text", value: "text" },
                              { label: "Number", value: "number" },
                            ]}
                            value={block.subtype || "text"}
                            onChange={(v) => updateBlock(idx, { subtype: v })}
                          />

                          {block.subtype === "text" && (
                            <InlineStack>
                              <div style={{ flex: 1, marginRight: 8 }}>
                                <TextField
                                  label="Placeholder"
                                  value={block.placeholder || ""}
                                  onChange={(v) => updateBlock(idx, { placeholder: v })}
                                />
                              </div>
                              <div style={{ width: 220 }}>
                                <TextField
                                  label="Max Length"
                                  type="number"
                                  value={String(block.validation?.maxLength ?? 0)}
                                  onChange={(v) => updateBlock(idx, { validation: { ...(block.validation || {}), maxLength: parseInt(v || "0", 10) } })}
                                />
                              </div>
                            </InlineStack>
                          )}

                          {block.subtype === "number" && (
                            <InlineStack>
                              <div style={{ width: 220, marginRight: 8 }}>
                    <TextField
                                  label="Min"
                                  type="number"
                                  value={String(block.validation?.min ?? 0)}
                                  onChange={(v) => updateBlock(idx, { validation: { ...(block.validation || {}), min: parseFloat(v) } })}
                                />
                              </div>
                              <div style={{ width: 220, marginRight: 8 }}>
                    <TextField
                                  label="Max"
                      type="number"
                                  value={String(block.validation?.max ?? 0)}
                                  onChange={(v) => updateBlock(idx, { validation: { ...(block.validation || {}), max: parseFloat(v) } })}
                    />
                              </div>
                              <div style={{ width: 220 }}>
                    <TextField
                                  label="Step"
                      type="number"
                                  value={String(block.validation?.step ?? 1)}
                                  onChange={(v) => updateBlock(idx, { validation: { ...(block.validation || {}), step: parseFloat(v) } })}
                    />
                              </div>
                            </InlineStack>
                          )}

                          {/* Has Guide Section Checkbox */}
                          <Checkbox
                            label="Has Guide Section"
                            checked={!!block.hasGuide}
                            onChange={(v) => updateBlock(idx, { 
                              hasGuide: v,
                              guide: { 
                                ...(block.guide || {}), 
                                enabled: v 
                              }
                            })}
                          />

                          {/* Guide Section */}
                          {block.hasGuide && (
                            <Box paddingBlockStart="400" borderBlockStart="divider" marginBlockStart="400">
                              <BlockStack gap="400">
                                <InlineStack align="space-between">
                                  <Text variant="headingMd" as="h3">Guide Section</Text>
                                  {!block.guide?.enabled && (
                                    <Button variant="tertiary" onClick={() => updateBlock(idx, { 
                                      guide: { 
                                        ...(block.guide || {}), 
                                        enabled: true,
                                        sections: [{ title: "", description: "", photoGallery: [] }]
                                      } 
                                    })}>Add Guide Section</Button>
                                  )}
                                </InlineStack>
                                <Banner tone="info" onDismiss={() => {}}>
                                  Guide sections provide measurement guidelines and helpful information for customers.
                                </Banner>
                                
                                {block.guide?.enabled && (
                                  <Card sectioned>
                                    <BlockStack gap="300">
                                      <TextField
                                        label="Guide Title"
                                        value={block.guide?.title || ""}
                                        onChange={(v) => updateBlock(idx, { 
                                          guide: { 
                                            ...(block.guide || {}), 
                                            title: v,
                                            enabled: true 
                                          } 
                                        })}
                                      />
                                      
                                      {(block.guide?.sections || []).map((section, sIdx) => (
                                        <Box key={sIdx} background="bg-surface-secondary" padding="300" borderRadius="200">
                                          <BlockStack gap="300">
                                            <InlineStack align="space-between">
                                              <Text variant="headingSm" as="h4">Section {sIdx + 1}</Text>
                                              <Button tone="critical" variant="tertiary" onClick={() => removeGuideSection(idx, sIdx)}>Remove Section</Button>
                                            </InlineStack>
                                            
                                            <TextField
                                              label="Section Title"
                                              value={section.title || ""}
                                              onChange={(v) => updateGuideSection(idx, sIdx, { title: v })}
                                            />
                                            
                                            <TextField
                                              label="Description"
                                              multiline={4}
                                              value={section.description || ""}
                                              onChange={(v) => updateGuideSection(idx, sIdx, { description: v })}
                                            />
                                            
                                            <Text variant="headingSm" as="h5">Photo Gallery</Text>
                                            {(section.photoGallery || []).map((photo, pIdx) => (
                                              <Card key={pIdx} sectioned>
                                                <BlockStack gap="200">
                                                  <InlineStack align="space-between">
                                                    <Text variant="bodyMd" as="p">Photo {pIdx + 1}</Text>
                                                    <Button tone="critical" variant="tertiary" onClick={() => removeGuidePhoto(idx, sIdx, pIdx)}>Remove Photo</Button>
                                                  </InlineStack>
                                                  
                                                  <TextField
                                                    label="Image URL"
                                                    value={photo.url || ""}
                                                    onChange={(v) => updateGuidePhoto(idx, sIdx, pIdx, { url: v })}
                                                  />
                                                  
                                                  <TextField
                                                    label="Alt Text"
                                                    value={photo.alt || ""}
                                                    onChange={(v) => updateGuidePhoto(idx, sIdx, pIdx, { alt: v })}
                                                  />
                                                  
                                                  <TextField
                                                    label="Caption"
                                                    value={photo.caption || ""}
                                                    onChange={(v) => updateGuidePhoto(idx, sIdx, pIdx, { caption: v })}
                                                  />
                                                  
                                                  {photo.url && (
                                                    <div style={{ marginTop: 8 }}>
                                                      <Text variant="bodySm" as="p" color="subdued">Preview:</Text>
                                                      <img
                                                        src={photo.url}
                                                        alt={photo.alt || "Preview"}
                                                        style={{ 
                                                          width: 150, 
                                                          height: 100, 
                                                          objectFit: 'cover', 
                                                          borderRadius: 4, 
                                                          border: '1px solid #ddd',
                                                          marginTop: 4
                                                        }}
                                                      />
                                                    </div>
                                                  )}
                                                </BlockStack>
                                              </Card>
                                            ))}
                                            <Button variant="tertiary" onClick={() => addGuidePhoto(idx, sIdx)}>Add Photo</Button>
                                          </BlockStack>
                                        </Box>
                                      ))}
                                      <Button variant="tertiary" onClick={() => addGuideSectionItem(idx)}>Add New Section</Button>
                                    </BlockStack>
                                  </Card>
                                )}
                              </BlockStack>
                            </Box>
                          )}
                        </BlockStack>
                      )}
                    
                      {block.type === "area" && (
                        <BlockStack gap="300">
                            <div style={{ width: 220, marginRight: 8 }}>
                        <TextField
                          label="Min Width (inches)"
                          type="number"
                          step="0.1"
                                value={String(block.limits?.width?.min ?? 0)}
                                onChange={(v) => updateBlock(idx, { limits: { ...(block.limits || {}), width: { ...(block.limits?.width || {}), min: parseFloat(v) } } })}
                        />
                            </div>
                          

                          {/* Has Guide Section Checkbox */}
                          <Checkbox
                            label="Has Guide Section"
                            checked={!!block.hasGuide}
                            onChange={(v) => updateBlock(idx, { 
                              hasGuide: v,
                              guide: { 
                                ...(block.guide || {}), 
                                enabled: v 
                              }
                            })}
                          />

                          {/* Guide Image Checkbox + URL alanı */}
                          <Checkbox
                            label="Has guide image?"
                            checked={block.isHasGuideImage ?? false}
                            onChange={(val) =>
                              updateBlock(idx, { 
                                isHasGuideImage: val, 
                                guideImageUrl: val ? "" : block.guideImageUrl 
                              })
                            }
                          />

                          {block.isHasGuideImage && (
                            <div style={{ width: 400 }}>
                              <TextField
                                label="Guide Image URL"
                                value={block.guideImageUrl ?? ""}
                                onChange={(v) => updateBlock(idx, { guideImageUrl: v })}
                              />
                            </div>
                          )}

                          {/* Guide Section */}
                           {block.hasGuide && (
                            <Box paddingBlockStart="400" borderBlockStart="divider" marginBlockStart="400">
                              <BlockStack gap="400">
                                <InlineStack align="space-between">
                                  <Text variant="headingMd" as="h3">Guide Section</Text>
                                  {!block.guide?.enabled && (
                                    <Button variant="tertiary" onClick={() => updateBlock(idx, { 
                                      guide: { 
                                        ...(block.guide || {}), 
                                        enabled: true,
                                        sections: [{ title: "", description: "", photoGallery: [] }]
                                      } 
                                    })}>Add Guide Section</Button>
                                  )}
                                </InlineStack>
                                <Banner tone="info" onDismiss={() => {}}>
                                  Guide sections provide measurement guidelines and helpful information for customers.
                                </Banner>
                                
                                {block.guide?.enabled && (
                                  <Card sectioned>
                                    <BlockStack gap="300">
                                      <TextField
                                        label="Guide Title"
                                        value={block.guide?.title || ""}
                                        onChange={(v) => updateBlock(idx, { 
                                          guide: { 
                                            ...(block.guide || {}), 
                                            title: v,
                                            enabled: true 
                                          } 
                                        })}
                                      />
                                      
                                      {(block.guide?.sections || []).map((section, sIdx) => (
                                        <Box key={sIdx} background="bg-surface-secondary" padding="300" borderRadius="200">
                                          <BlockStack gap="300">
                                            <InlineStack align="space-between">
                                              <Text variant="headingSm" as="h4">Section {sIdx + 1}</Text>
                                              <Button tone="critical" variant="tertiary" onClick={() => removeGuideSection(idx, sIdx)}>Remove Section</Button>
                                            </InlineStack>
                                            
                                            <TextField
                                              label="Section Title"
                                              value={section.title || ""}
                                              onChange={(v) => updateGuideSection(idx, sIdx, { title: v })}
                                            />
                                            
                                            <TextField
                                              label="Description"
                                              multiline={4}
                                              value={section.description || ""}
                                              onChange={(v) => updateGuideSection(idx, sIdx, { description: v })}
                                            />
                                            
                                            <Text variant="headingSm" as="h5">Photo Gallery</Text>
                                            {(section.photoGallery || []).map((photo, pIdx) => (
                                              <Card key={pIdx} sectioned>
                                                <BlockStack gap="200">
                                                  <InlineStack align="space-between">
                                                    <Text variant="bodyMd" as="p">Photo {pIdx + 1}</Text>
                                                    <Button tone="critical" variant="tertiary" onClick={() => removeGuidePhoto(idx, sIdx, pIdx)}>Remove Photo</Button>
                                                  </InlineStack>
                                                  
                                                  <TextField
                                                    label="Image URL"
                                                    value={photo.url || ""}
                                                    onChange={(v) => updateGuidePhoto(idx, sIdx, pIdx, { url: v })}
                                                  />
                                                  
                                                  <TextField
                                                    label="Alt Text"
                                                    value={photo.alt || ""}
                                                    onChange={(v) => updateGuidePhoto(idx, sIdx, pIdx, { alt: v })}
                                                  />
                                                  
                                                  <TextField
                                                    label="Caption"
                                                    value={photo.caption || ""}
                                                    onChange={(v) => updateGuidePhoto(idx, sIdx, pIdx, { caption: v })}
                                                  />
                                                  
                                                  {photo.url && (
                                                    <div style={{ marginTop: 8 }}>
                                                      <Text variant="bodySm" as="p" color="subdued">Preview:</Text>
                                                      <img
                                                        src={photo.url}
                                                        alt={photo.alt || "Preview"}
                                                        style={{ 
                                                          width: 150, 
                                                          height: 100, 
                                                          objectFit: 'cover', 
                                                          borderRadius: 4, 
                                                          border: '1px solid #ddd',
                                                          marginTop: 4
                                                        }}
                                                      />
                                                    </div>
                                                  )}
                                                </BlockStack>
                                              </Card>
                                            ))}
                                            <Button variant="tertiary" onClick={() => addGuidePhoto(idx, sIdx)}>Add Photo</Button>
                                          </BlockStack>
                                        </Box>
                                      ))}
                                      
                                      <Button variant="tertiary" onClick={() => addGuideSectionItem(idx)}>Add New Section</Button>
                                    </BlockStack>
                                  </Card>
                                )}
                              </BlockStack>
                            </Box>
                          )}

                          {/* Input Section Checkbox */}
                          <Checkbox
                            label="Has Input Section"
                            checked={!!block.hasInputSection}
                            onChange={(v) => updateBlock(idx, { 
                              hasInputSection: v,
                              inputSection: v ? { 
                                title: "", 
                                placeholder: "" 
                              } : undefined
                            })}
                          />

                          {/* Input Section Fields */}
                          {block.hasInputSection && (
                            <Box paddingBlockStart="400" borderBlockStart="divider" marginBlockStart="400">
                              <BlockStack gap="300">
                                <Text variant="headingMd" as="h3">Input Section</Text>
                                
                                <div style={{ width: 400 }}>
                                  <TextField
                                    label="Input Title"
                                    value={block.inputSection?.title ?? ""}
                                    onChange={(v) => updateBlock(idx, { 
                                      inputSection: { 
                                        ...(block.inputSection || {}), 
                                        title: v 
                                      } 
                                    })}
                                    placeholder="Enter input title"
                                  />
                                </div>

                                <div style={{ width: 400 }}>
                                  <TextField
                                    label="Input Placeholder"
                                    value={block.inputSection?.placeholder ?? ""}
                                    onChange={(v) => updateBlock(idx, { 
                                      inputSection: { 
                                        ...(block.inputSection || {}), 
                                        placeholder: v 
                                      } 
                                    })}
                                    placeholder="Enter placeholder text"
                                  />
                                </div>
                              </BlockStack>
                            </Box>
                          )}
                    </BlockStack>
                )}
                      </>
                      )}
                    </BlockStack>
                  </Card>
                );
              })}
                </BlockStack>
              </Layout.Section>
              <Layout.Section variant="oneThird">
                <LegacyCard title="Quick navigation" sectioned>
                  <InlineStack align="space-between" blockAlign="center">
                    {selectedOnlyId && (
                      <Button size="slim" onClick={showAllBlocks}>← All</Button>
                    )}
                    <InlineStack gap="100">
                      <Button size="slim" variant="tertiary" onClick={expandAll}>Expand all</Button>
                      <Button size="slim" variant="tertiary" onClick={collapseAll}>Collapse all</Button>
                    </InlineStack>
                  </InlineStack>
                  <Divider style="margin: 10px 0;"/>
                  <BlockStack gap="200">
                    {blocks.filter(b=>b.type!=="config").map((b, i)=> (
                      <div key={`nav-${b.id}`}> 
                        <InlineStack align="space-between" blockAlign="center">
                          <Button
                            size="slim"
                            variant={(selectedOnlyId ? (selectedOnlyId===b.id) : false) ? 'primary' : 'tertiary'}
                            onClick={()=> showOnlyBlock(b.id)}
                          >
                            {b.title || b.id}
                          </Button>
                          <InlineStack gap="100">
                            <Button size="slim" icon={ArrowUpIcon} onClick={()=> moveBlock(i, i-1)} disabled={i===0}>
                            </Button>
                            <Button size="slim" icon={ArrowDownIcon} onClick={()=> moveBlock(i, i+1)} disabled={i===(blocks.length-1)}>
                            </Button>
                          </InlineStack>
                        </InlineStack>
                      </div>
                    ))}
                  </BlockStack>
                </LegacyCard>
                <LegacyCard sectioned>
                  <InlineStack align="space-between">
                    <Select
                      label="Add block type"
                      labelHidden
                      options={[
                        { label: "Picker", value: "picker" },
                        { label: "Input", value: "input" },
                        { label: "Area", value: "area" },
                      ]}
                      value={newBlockType}
                      onChange={setNewBlockType}
                    />
                    <Button onClick={addBlock} variant="primary">Add</Button>
                  </InlineStack>
                </LegacyCard>
              </Layout.Section>
            </Layout>
          ) : (
            <div style={{ paddingTop: '1.6rem' }}>
              {/* Preview */}
              <Card title="Preview - Live Price" sectioned>
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h1" variant="headingMd">Preview - Live Price</Text>
                  <Button
                    size="slim"
                    variant="tertiary"
                    onClick={() => toggleCollapse('preview')}
                  >
                    {collapsed.has('preview') ? 'Expand' : 'Collapse'}
                  </Button>
                </InlineStack>
                <Box paddingBlockStart="200" paddingBlockEnd="200">
                  <Divider />
                </Box>
                {!collapsed.has('preview') && (
                  <BlockStack gap="300">
                  {(blocks.filter(b=>b.type!=="config")).map((block) => (
                    <div key={`prev-${block.id}`}>
                      {block.type === 'picker' && block.enabled && (
                        <InlineStack align="space-between">
                          <div style={{ flex: 1, marginRight: 8 }}>
                            <Select
                              label={block.title || block.id}
                              options={[
                                { label: 'Select', value: '' }, 
                                ...(block.options||[]).map(o => {
                                  const priceEffect = calculatePreviewPrice(o, currentTotalPrice);
                                  let label = o.label;
                                  
                                  if (priceEffect > 0 && shouldShowPrice(o)) {
                                    if (o.pricing?.mode === 'multiplier') {
                                      label = `${o.label} (+$${priceEffect.toFixed(2)})`;
                                    } else if (o.pricing?.mode === 'added') {
                                      label = `${o.label} (+$${priceEffect.toFixed(2)})`;
                                    }
                                  }
                                  
                                  return { label, value: o.value };
                                })
                              ]}
                              value={preview[block.id] ?? ''}
                              onChange={(v)=> setPreview((p)=> ({ ...p, [block.id]: v }))}
                            />
                          </div>
                        </InlineStack>
                      )}

                      {block.type === 'input' && block.enabled && (
                        <InlineStack align="space-between">
                          { (block.subtype||'text') === 'text' ? (
                            <div style={{ flex: 1, marginRight: 8 }}>
                              <TextField
                                label={block.title || block.id}
                                value={String(preview[block.id] ?? '')}
                                onChange={(v)=> setPreview((p)=> ({ ...p, [block.id]: v }))}
                              />
                            </div>
                          ) : (
                            <div style={{ width: 240 }}>
                              <TextField
                                label={block.title || block.id}
                                type="number"
                                step="any"
                                value={String(preview[block.id] ?? 0)}
                                onChange={(v)=> setPreview((p)=> ({ ...p, [block.id]: v }))}
                              />
                            </div>
                          ) }
                        </InlineStack>
                      )}

                      {block.type === 'area' && block.enabled && (
                        <BlockStack gap="300">
                          <InlineStack>
                            <div style={{ width: 220, marginRight: 8 }}>
                              <TextField
                                label={`${block.title || block.id} - Width (inches)`}
                                type="number"
                                step="0.1"
                                min={block.limits?.width?.min || 0}
                                value={String(preview[block.id]?.width ?? '')}
                                onChange={(v)=> setPreview((p)=> ({ ...p, [block.id]: { ...(p[block.id]||{}), width: v } }))}
                                error={(() => {
                                  const width = parseFloat(preview[block.id]?.width);
                                  if (width && block.limits?.width?.min && width < block.limits.width.min) {
                                    return `Minimum width should be ${block.limits.width.min} inches`;
                                  }
                                  return '';
                                })()}
                              />
                            </div>
                          </InlineStack>
                          
                          {/* Input Section Preview */}
                          {block.hasInputSection && block.inputSection && (
                            <div style={{ width: 220 }}>
                              <TextField
                                label={block.inputSection.title || "Additional Input"}
                                placeholder={block.inputSection.placeholder || "Enter value"}
                                value={String(preview[block.id]?.inputValue ?? '')}
                                onChange={(v)=> setPreview((p)=> ({ ...p, [block.id]: { ...(p[block.id]||{}), inputValue: v } }))}
                              />
                            </div>
                          )}
                        </BlockStack>
                      )}

                      {/* Nested preview */}
                      {block.type==='picker' && block.enabled && block.isNested && Array.isArray(block.nested) && (
                        (block.nested||[]).map((ng, nIdx)=> (
                          ng?.when?.equals && preview[block.id] === ng.when.equals ? (
                            <div key={`prev-n-${block.id}-${nIdx}`} style={{ marginTop: 8 }}>
                              {(ng.items||[]).map((item)=> (
                                <div key={`prev-n-item-${item.id}`} style={{ marginTop: 6 }}>
                                  <Select
                                    label={item.title || item.id}
                                    options={[
                                      { label: 'Select', value: '' }, 
                                                                              ...(item.options||[]).map(o => {
                                          const priceEffect = calculatePreviewPrice(o, currentTotalPrice);
                                          let label = o.label;
                                          
                                          if (priceEffect > 0 && shouldShowPrice(o)) {
                                            if (o.pricing?.mode === 'multiplier') {
                                              label = `${o.label} (+$${priceEffect.toFixed(2)})`;
                                            } else if (o.pricing?.mode === 'added') {
                                              label = `${o.label} (+$${priceEffect.toFixed(2)})`;
                                            }
                                          }
                                          
                                          return { label, value: o.value };
                                        })
                                    ]}
                                    value={preview[item.id] ?? ''}
                                    onChange={(v)=> setPreview((p)=> ({ ...p, [item.id]: v }))}
                                  />
                                </div>
                              ))}
                            </div>
                          ) : null
                        ))
                      )}
                    </div>
                  ))}

                  {/* Validation Message */}
                  {getValidationMessage && (
                    <Banner tone="warning">
                      <p>{getValidationMessage}</p>
                    </Banner>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ color: '#666' }}>
                      Currency: {config.currency || 'USD'}
                    </div>
                    {hasValidSelections ? (
                      <div style={{ fontSize: 20, fontWeight: 600 }}>
                        Total: {(() => {
                          try {
                            // Ensure height is not passed to the pricing function
                            const selectionsForPricing = JSON.parse(JSON.stringify(preview));
                            for (const block of blocks) {
                              if (block.type === 'area' && selectionsForPricing[block.id]) {
                                delete selectionsForPricing[block.id].height;
                              }
                            }

                            const t = computeTotalPrice({ config: blocks, selections: selectionsForPricing });
                            return `${(t || 0).toFixed(2)} ${config.currency || ''}`.trim();
                          } catch (e) {
                            console.error("Price calculation error:", e);
                            return `0.00 ${config.currency || ''}`.trim();
                          }
                        })()}
                      </div>
                    ) : (
                      <div style={{ fontSize: 16, color: '#666', fontStyle: 'italic' }}>
                        Please make the required selections to calculate the price
                      </div>
                    )}
                  </div>
                  {/* Email Input */}
                  <div style={{ marginTop: '1rem' }}>
                    <TextField
                      label="Email Address"
                      type="email"
                      value={customerEmail}
                      onChange={setCustomerEmail}
                      placeholder="order@example.com"
                      helpText="Order information will be sent to this email address"
                      error={customerEmail && !isValidEmail(customerEmail) ? "Please enter a valid email address" : ""}
                    />
                  </div>

                  <div style={{ marginTop: '1rem' }}>
                    <Button 
                      onClick={handleAddToCart} 
                      variant="primary" 
                      disabled={!isFormValid}
                    >
                      Add to Cart
                    </Button>
                  </div>
                  </BlockStack>
                )}
              </Card>
            </div>
          )}
        </div>
      </Tabs>
      <div style={{ position: 'sticky', bottom: 0, background: 'white', padding: '1.2rem', borderTop: '1px solid #e1e3e5', zIndex: 10, marginTop: '1.6rem' }}>
        <InlineStack align="end" gap="200">
          <Button onClick={onCancel} variant="tertiary">
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave}>
            Save
          </Button>
        </InlineStack>
      </div>

      {/* Success Modal */}
      <Modal
        open={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title="Draft Order Successfully Created!"
        primaryAction={{
          content: 'Checkout',
          onAction: () => {
            window.open(draftOrderUrl, '_blank');
            setShowSuccessModal(false);
          },
        }}
        secondaryActions={[
          {
            content: 'Close',
            onAction: () => setShowSuccessModal(false),
          },
        ]}
      >
        <Modal.Section>
          <BlockStack gap="400">
            <Text variant="bodyMd">
              Draft order successfully created! You can now checkout.
            </Text>
            <Card>
              <BlockStack gap="200">
                <Text variant="headingSm">Checkout Link'i:</Text>
                <Text variant="bodyMd" as="p">
                  <a 
                    href={draftOrderUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{ 
                      color: '#007cba', 
                      textDecoration: 'underline',
                      wordBreak: 'break-all'
                    }}
                  >
                    {draftOrderUrl}
                  </a>
                </Text>
                <Text variant="bodyMd" as="p" color="subdued">
                  You can copy this link and open it in a new tab or click the "Checkout" button.
                </Text>
              </BlockStack>
            </Card>
          </BlockStack>
        </Modal.Section>
      </Modal>
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