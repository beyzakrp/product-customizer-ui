import { useMemo, useState } from "react";
import { computeTotalPrice } from "../utils/pricing";
import {
  Card,
  TextField,
  InlineStack,
  Button,
  Banner,
  BlockStack,
  Checkbox,
  Select,
} from "@shopify/polaris";

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
      base_price: 0,
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
    };
  }
  if (type === "area") {
    return {
      id: idBase,
      type: "area",
      title: "Area",
      enabled: true,
      unit: "cm",
      limits: {
        width: { min: 50.8, max: 304.8 },
        height: { min: 50.8, max: 1016 },
      },
      pricing: { mode: "multiplier", value: 100.0, per: "sqm" },
    };
  }
  return {
    id: idBase,
    type,
    title: type,
    enabled: true,
  };
}

export default function UnifiedCustomizerEditor({ initialValue = "[]", onSave, onCancel }) {
  const [blocks, setBlocks] = useState(() => parseInitial(initialValue));
  const [newBlockType, setNewBlockType] = useState("picker");
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [preview, setPreview] = useState({});

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
    const next = [...blocks];
    next.push(createDefaultBlock(newBlockType));
    setBlocks(next);
  };

  const removeBlock = (index) => {
    if (index === configIdx) return; // config silinmez
    const next = blocks.filter((_, i) => i !== index);
    setBlocks(next);
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

  const moveBlock = (fromIdx, toIdx) => {
    if (fromIdx === configIdx || toIdx === configIdx) return; // config taşınamaz
    if (toIdx < 0 || toIdx >= blocks.length) return;
    const next = [...blocks];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    setBlocks(next);
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
    setBlocks(next);
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

  const handleSave = () => {
    onSave(blocks);
  };

  return (
    <BlockStack gap="400">
            <Banner tone="info">
        3 types are supported: Picker, Input (text/number), Area. Multiplier only applies to base price.
            </Banner>

      {/* Config */}
            <Card title="General Settings" sectioned>
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
                label="Base price (optional)"
                type="number"
                value={String(config.base_price ?? 0)}
                onChange={(v) => updateConfig({ base_price: parseFloat(v) || 0 })}
              />
            </div>
          </InlineStack>
                <TextField
            label="Step Order (comma separated ids)"
            value={(config.step_order || []).join(", ")}
            helpText="Example: colorPicker, headerPicker, widthHeight"
            onChange={(v) => updateConfig({ step_order: v.split(",").map((s) => s.trim()).filter(Boolean) })}
                />
              </BlockStack>
            </Card>

      <div style={{ height: 8 }} />

      {/* Add Block */}
      <Card sectioned>
        <InlineStack align="space-between">
          <InlineStack gap="200">
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
            <Button onClick={addBlock} variant="tertiary">Add Block</Button>
          </InlineStack>
        </InlineStack>
      </Card>

      {/* Blocks List */}
      {blocks.map((block, idx) => (
        block.type === "config" ? null : (
          <Card key={block.id || idx} title={`${block.title || block.type} (${block.type})`} sectioned>
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
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                  <Button size="slim" variant="tertiary" onClick={() => moveBlock(idx, idx - 1)}>Up</Button>
                  <Button size="slim" variant="tertiary" onClick={() => moveBlock(idx, idx + 1)}>Down</Button>
                  <Button size="slim" variant="tertiary" onClick={() => duplicateBlock(idx)}>Duplicate</Button>
                  <Button size="slim" variant="tertiary" onClick={() => toggleCollapse(block.id || String(idx))}>{collapsed.has(block.id || String(idx)) ? 'Expand' : 'Collapse'}</Button>
                  <Checkbox
                    label="Enabled"
                    checked={!!block.enabled}
                    onChange={(v) => updateBlock(idx, { enabled: v })}
                  />
                </div>
                <div style={{ alignSelf: "flex-end" }}>
                  <Button tone="critical" variant="tertiary" onClick={() => removeBlock(idx)}>Delete</Button>
                </div>
              </InlineStack>

              {!collapsed.has(block.id || String(idx)) && (
              <>
              <Card title="Pricing" sectioned>
                {block.type === 'picker' ? (
                  <div style={{ fontSize: 12, color: '#666' }}>
                    Pricing options are available for Picker. Use Mode (None/Added/Multiplier) and Value fields on each option card.
                  </div>
                ) : (
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
                          label={block.type === "area" ? "Price per m²" : "Value"}
                          type="number"
                          step="any"
                          value={String(block.pricing?.value ?? 0)}
                          onChange={(v) => updateBlock(idx, { pricing: { ...(block.pricing || {}), value: parseFloat(v) || 0 } })}
                        />
                      </div>
                    </InlineStack>
                    <div style={{ fontSize: 12, color: '#666', marginTop: 6 }}>
                      {block.type === 'area' ? 'Base price is calculated based on m². Multiplier only applies to base.' : 'Added is a fixed extra charge, Multiplier applies a multiplier to base (linear).'}
                    </div>
                  </>
                )}
              </Card>

              {/* Type Specific */}
              {block.type === "picker" && (
                <BlockStack gap="300">
                  <Checkbox
                    label="Nested (1 level)"
                    checked={!!block.isNested}
                    onChange={(v) => updateBlock(idx, { isNested: v })}
                  />

                  {(block.options || []).map((opt, oIdx) => (
                    <Card key={oIdx} sectioned>
                  <InlineStack align="space-between">
                        <div style={{ flex: 1, marginRight: 8 }}>
                      <TextField
                            label="Label"
                            value={opt.label || ""}
                            onChange={(v) => updatePickerOption(idx, oIdx, { label: v, value: opt.value || slugify(v) })}
                      />
                    </div>
                    <div style={{ flex: 1, marginRight: 8 }}>
                          <TextField
                            label="Value"
                            value={opt.value || ""}
                            onChange={(v) => updatePickerOption(idx, oIdx, { value: slugify(v) })}
                          />
                        </div>
                        <div style={{ width: 200, marginRight: 8 }}>
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
                        <div style={{ width: 180, marginRight: 8 }}>
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
                        <div style={{ width: 180 }}>
                      <TextField
                            label="Value"
                        type="number"
                            step="any"
                            value={String(opt.pricing?.value ?? (typeof opt.added === 'number' ? opt.added : 0))}
                            onChange={(v) => updatePickerOption(idx, oIdx, { pricing: { ...(opt.pricing || {}), value: parseFloat(v) || 0 } })}
                      />
                    </div>
                        <div>
                          <Button tone="critical" variant="tertiary" onClick={() => removePickerOption(idx, oIdx)}>Delete</Button>
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
              </Card>
            ))}
                  <Button onClick={() => addPickerOption(idx)} variant="tertiary">Add Option</Button>

                  {block.isNested && (
                    <Card title="Nested Settings" sectioned>
          <BlockStack gap="300">
                        <Banner tone="info">Nested groups are displayed when a specific option of the parent picker is selected.</Banner>
                        {(block.nested || []).map((ng, nIdx) => (
                          <Card key={nIdx} sectioned>
                            <BlockStack gap="200">
                              <Select
                                label="Show when parent equals"
                                options={[{ label: "Select option", value: "" }, ...(block.options || []).map((o) => ({ label: o.label, value: o.value }))]}
                                value={ng.when?.equals || ""}
                                onChange={(v) => updateNestedGroup(idx, nIdx, { when: { parentId: block.id, equals: v } })}
                              />
                              <Banner tone="subdued">Items</Banner>
                              {(ng.items || []).map((item, itemIdx) => (
                                <Card key={itemIdx} title={`${item.title || item.type}`} sectioned>
                  <InlineStack align="space-between">
                    <div style={{ flex: 1, marginRight: 8,marginBottom: 8}}>
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
                                    <Button tone="critical" variant="tertiary" onClick={() => removeNestedItem(idx, nIdx, itemIdx)}>Delete</Button>
                                  </InlineStack>

                                  {/* Only picker items inside nested for now */}
                                  {(item.options || []).map((opt, oIdx) => (
                                    <Card key={oIdx} sectioned>
                                      <InlineStack align="space-between" style={{ marginBottom: 8 }}>
                    <div style={{ flex: 1, marginRight: 8 }}>
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
                    <div style={{ flex: 1, marginRight: 8 }}>
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
                                        <div style={{ width: 200, marginRight: 8 }}>
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
                                        <div style={{ width: 180, marginRight: 8 }}>
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
                                        <div style={{ width: 180 }}>
                      <TextField
                                            label="Value"
                        type="number"
                                            value={String(opt.pricing?.value ?? (typeof opt.added === 'number' ? opt.added : 0))}
                                            onChange={(v) => {
                                              const options = [...(item.options || [])];
                                              options[oIdx] = { ...options[oIdx], pricing: { ...(opt.pricing || {}), value: parseFloat(v) || 0 } };
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
                                    </Card>
                                  ))}
                                  <Button variant="tertiary" onClick={() => {
                                    const options = [...(item.options || [])];
                                    options.push({ label: "Option", value: slugify(`option-${options.length + 1}`), media: { type: "hex", hex: "#000000" }, added: 0 });
                                    updateNestedItem(idx, nIdx, itemIdx, { options });
                                  }}>Add Option</Button>
                                </Card>
                              ))}
                              <Button variant="tertiary" onClick={() => addNestedItemPicker(idx, nIdx)}>Add Nested Picker</Button>
                  </BlockStack>
                </Card>
              ))}
                        <Button variant="tertiary" onClick={() => addNestedGroup(idx)}>Add Nested Group</Button>
                      </BlockStack>
            </Card>
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
                </BlockStack>
              )}
            
              {block.type === "area" && (
                <BlockStack gap="300">
              <InlineStack>
                    <div style={{ width: 160, marginRight: 8 }}>
                      <TextField
                        label="Unit"
                        value={block.unit || "cm"}
                        onChange={(v) => updateBlock(idx, { unit: v })}
                      />
                    </div>
                    <div style={{ width: 220, marginRight: 8 }}>
                <TextField
                  label="Min Width"
                  type="number"
                        value={String(block.limits?.width?.min ?? 0)}
                        onChange={(v) => updateBlock(idx, { limits: { ...(block.limits || {}), width: { ...(block.limits?.width || {}), min: parseFloat(v) } } })}
                />
                    </div>
                    <div style={{ width: 220 }}>
                <TextField
                  label="Max Width" 
                  type="number"
                        value={String(block.limits?.width?.max ?? 0)}
                        onChange={(v) => updateBlock(idx, { limits: { ...(block.limits || {}), width: { ...(block.limits?.width || {}), max: parseFloat(v) } } })}
                />
                    </div>
              </InlineStack>
              <InlineStack>
                    <div style={{ width: 220, marginRight: 8 }}>
                <TextField
                  label="Min Height"
                  type="number"
                        value={String(block.limits?.height?.min ?? 0)}
                        onChange={(v) => updateBlock(idx, { limits: { ...(block.limits || {}), height: { ...(block.limits?.height || {}), min: parseFloat(v) } } })}
                />
                    </div>
                    <div style={{ width: 220 }}>
                <TextField
                  label="Max Height"
                  type="number"
                        value={String(block.limits?.height?.max ?? 0)}
                        onChange={(v) => updateBlock(idx, { limits: { ...(block.limits || {}), height: { ...(block.limits?.height || {}), max: parseFloat(v) } } })}
                />
                    </div>
              </InlineStack>
                  <Banner tone="subdued">Price per m² is managed in the Pricing section (mode: multiplier, value: price/m²).</Banner>
          </BlockStack>
        )}
              </>
              )}
            </BlockStack>
          </Card>
        )
      ))}

      {/* Preview */}
      <Card title="Preview - Live Price" sectioned>
        <BlockStack gap="300">
          {(blocks.filter(b=>b.type!=="config")).map((block) => (
            <div key={`prev-${block.id}`}>
              {block.type === 'picker' && block.enabled && (
                <InlineStack align="space-between">
                  <div style={{ flex: 1, marginRight: 8 }}>
                    <Select
                      label={block.title || block.id}
                      options={[{ label: 'Select', value: '' }, ...(block.options||[]).map(o=>({ label: o.label, value: o.value }))]}
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
                <InlineStack>
                  <div style={{ width: 220, marginRight: 8 }}>
                    <TextField
                      label={`${block.title || block.id} - Width (${block.unit||'cm'})`}
                      type="number"
                      step="any"
                      value={String(preview[block.id]?.width ?? '')}
                      onChange={(v)=> setPreview((p)=> ({ ...p, [block.id]: { ...(p[block.id]||{}), width: v } }))}
                    />
                  </div>
                  <div style={{ width: 220 }}>
                    <TextField
                      label={`Height (${block.unit||'cm'})`}
                      type="number"
                      step="any"
                      value={String(preview[block.id]?.height ?? '')}
                      onChange={(v)=> setPreview((p)=> ({ ...p, [block.id]: { ...(p[block.id]||{}), height: v } }))}
                    />
                  </div>
                </InlineStack>
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
                            options={[{ label: 'Select', value: '' }, ...(item.options||[]).map(o=>({ label: o.label, value: o.value }))]}
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

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ color: '#666' }}>
              Currency: {config.currency || 'USD'}
            </div>
            <div style={{ fontSize: 20, fontWeight: 600 }}>
              Total: {(() => {
                try {
                  const t = computeTotalPrice({ config: blocks, selections: preview });
                  return `${(t || 0).toFixed(2)} ${config.currency || ''}`.trim();
                } catch {
                  return `0.00 ${config.currency || ''}`.trim();
                }
              })()}
            </div>
          </div>
        </BlockStack>
      </Card>

      <div style={{ position: 'sticky', bottom: 0, background: 'white', padding: 12, borderTop: '1px solid #E1E3E5', zIndex: 10 }}>
      <InlineStack align="end">
        <Button onClick={onCancel} variant="tertiary">
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSave}>
          Save
        </Button>
      </InlineStack>
      </div>
    </BlockStack>
  );
} 