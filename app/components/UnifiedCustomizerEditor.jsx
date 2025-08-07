import { useState } from "react";
import {
  Card,
  TextField,
  InlineStack,
  Button,
  Banner,
  BlockStack,
  Tabs,
  Checkbox,
  Select,
} from "@shopify/polaris";

function parseInitial(data) {
  try {
    if (typeof data === "string") {
      return JSON.parse(data);
    }
    return data || getDefaultStructure();
  } catch {
    return getDefaultStructure();
  }
}

function getDefaultStructure() {
  return [
    {
      type: "config",
      title: "Perde Özelleştirici",
      enabled: true,
      show_price: true,
      step_order: ["color", "header", "size"]
    },
    {
      type: "color",
      label: "Perde Rengi",
      enabled: true,
      options: [
        { value: "Beyaz", type: "hex", hex: "#FFFFFF", price: 0 },
        { value: "Bej", type: "hex", hex: "#F5E8D4", price: 15 },
        { value: "Siyah", type: "hex", hex: "#111111", price: 20 }
      ]
    },
    {
      type: "header",
      label: "Header Tipi", 
      enabled: true,
      options: [],
      nestedOption: {
        grommetColor: {
          enabled: true,
          condition: "Grommet Top",
          options: [
            { value: "Gümüş", type: "hex", hex: "#E5E4E2", price: 5 },
            { value: "Altın", type: "hex", hex: "#DAA520", price: 10 },
            { value: "Siyah", type: "hex", hex: "#111111", price: 8 }
          ]
        }
      }
    },
    {
      type: "size",
      label: "Boyut",
      enabled: true,
      unit: "cm",
      base_price_per_sqm: 100.0,
      size_multiplier: 1.0,
      limits: {
        width: { min: 50.8, max: 304.8 },
        height: { min: 50.8, max: 1016 }
      }
    }
  ];
}

export default function UnifiedCustomizerEditor({ initialValue = "[]", onSave, onCancel }) {
  const [config, setConfig] = useState(() => parseInitial(initialValue));
  const [activeTab, setActiveTab] = useState(0);
  const [errors, setErrors] = useState({});

  const colorSection = config.find(c => c.type === "color") || config[0];
  const headerSection = config.find(c => c.type === "header") || config[1];
  const sizeSection = config.find(c => c.type === "size") || config[2];
  const configSection = config.find(c => c.type === "config") || config[0];

  // Color Options Functions
  const addColorOption = () => {
    const newConfig = [...config];
    const colorIdx = newConfig.findIndex(c => c.type === "color");
    if (colorIdx >= 0) {
      newConfig[colorIdx].options.push({ 
        value: "", 
        type: "hex",
        hex: "#000000", 
        price: 0 
      });
      setConfig(newConfig);
    }
  };

  const updateColorOption = (index, field, value) => {
    const newConfig = [...config];
    const colorIdx = newConfig.findIndex(c => c.type === "color");
    if (colorIdx >= 0) {
      newConfig[colorIdx].options[index][field] = value;
      setConfig(newConfig);
    }
  };

  const removeColorOption = (index) => {
    const newConfig = [...config];
    const colorIdx = newConfig.findIndex(c => c.type === "color");
    if (colorIdx >= 0) {
      newConfig[colorIdx].options.splice(index, 1);
      setConfig(newConfig);
    }
  };

  // Header Options Functions
  const addHeaderOption = () => {
    const newConfig = [...config];
    const headerIdx = newConfig.findIndex(c => c.type === "header");
    if (headerIdx >= 0) {
      newConfig[headerIdx].options.push({ value: "", price: 0, image_url: "" });
      setConfig(newConfig);
    }
  };

  const updateHeaderOption = (index, field, value) => {
    const newConfig = [...config];
    const headerIdx = newConfig.findIndex(c => c.type === "header");
    if (headerIdx >= 0) {
      newConfig[headerIdx].options[index][field] = value;
      setConfig(newConfig);
    }
  };

  const removeHeaderOption = (index) => {
    const newConfig = [...config];
    const headerIdx = newConfig.findIndex(c => c.type === "header");
    if (headerIdx >= 0) {
      newConfig[headerIdx].options.splice(index, 1);
      setConfig(newConfig);
    }
  };

  // Grommet Options Functions
  const addGrommetOption = () => {
    const newConfig = [...config];
    const headerIdx = newConfig.findIndex(c => c.type === "header");
    if (headerIdx >= 0) {
      newConfig[headerIdx].nestedOption.grommetColor.options.push({ 
        value: "", 
        type: "hex",
        hex: "#000000", 
        price: 0 
      });
      setConfig(newConfig);
    }
  };

  const updateGrommetOption = (index, field, value) => {
    const newConfig = [...config];
    const headerIdx = newConfig.findIndex(c => c.type === "header");
    if (headerIdx >= 0) {
      newConfig[headerIdx].nestedOption.grommetColor.options[index][field] = value;
      setConfig(newConfig);
    }
  };

  const removeGrommetOption = (index) => {
    const newConfig = [...config];
    const headerIdx = newConfig.findIndex(c => c.type === "header");
    if (headerIdx >= 0) {
      newConfig[headerIdx].nestedOption.grommetColor.options.splice(index, 1);
      setConfig(newConfig);
    }
  };

  // Size Functions
  const updateSizeConfig = (field, value) => {
    const newConfig = [...config];
    const sizeIdx = newConfig.findIndex(c => c.type === "size");
    if (sizeIdx >= 0) {
      if (field.includes('.')) {
        const [parent, child] = field.split('.');
        newConfig[sizeIdx][parent][child] = parseFloat(value);
      } else {
        newConfig[sizeIdx][field] = parseFloat(value);
      }
      setConfig(newConfig);
    }
  };

  const handleSave = () => {
    onSave(config);
  };

  return (
    <BlockStack gap="400">
      <Tabs
        tabs={[
          { id: 'config', content: 'Yapılandırma' },
          { id: 'colors', content: 'Renkler' },
          { id: 'headers', content: 'Header & Grommet' },
          { id: 'sizes', content: 'Boyut Ayarları' }
        ]}
        selected={activeTab}
        onSelect={setActiveTab}
      >
        {/* Config Tab */}
        {activeTab === 0 && (
          <BlockStack gap="300">
            <Banner tone="info">
              Bu ayarlar perde özelleştiricinin genel davranışını kontrol eder. 
              Başlık alanı, müşterilerin göreceği ana başlığı belirler.
            </Banner>
            <Card title="Genel Ayarlar" sectioned>
              <BlockStack gap="300">
                <TextField
                  label="Başlık"
                  value={configSection?.title || ""}
                  onChange={(title) => {
                    const newConfig = [...config];
                    const configIdx = newConfig.findIndex(c => c.type === "config");
                    if (configIdx >= 0) newConfig[configIdx].title = title;
                    setConfig(newConfig);
                  }}
                />
                <Checkbox
                  label="Costumizer is active"
                  checked={configSection?.enabled || false}
                  onChange={(enabled) => {
                    const newConfig = [...config];
                    const configIdx = newConfig.findIndex(c => c.type === "config");
                    if (configIdx >= 0) newConfig[configIdx].enabled = enabled;
                    setConfig(newConfig);
                  }}
                />
                <Checkbox
                  label="Fiyat göster"
                  checked={configSection?.show_price || false}
                  onChange={(showPrice) => {
                    const newConfig = [...config];
                    const configIdx = newConfig.findIndex(c => c.type === "config");
                    if (configIdx >= 0) newConfig[configIdx].show_price = showPrice;
                    setConfig(newConfig);
                  }}
                />
                <TextField
                  label="Adım Sırası (virgülle ayırın)"
                  value={configSection?.step_order?.join(', ') || ""}
                  helpText="Örnek: color, header, size"
                  onChange={(v) => {
                    const newConfig = [...config];
                    const configIdx = newConfig.findIndex(c => c.type === "config");
                    if (configIdx >= 0) newConfig[configIdx].step_order = v.split(',').map(s => s.trim());
                    setConfig(newConfig);
                  }}
                />
              </BlockStack>
            </Card>
          </BlockStack>
        )}

        {/* Color Tab */}
        {activeTab === 1 && (
          <BlockStack gap="300">
            <Banner tone="info">
              Renk seçenekleri için URL (resim) veya HEX kodu kullanabilirsiniz.
            </Banner>
            <Checkbox
              label="Renk seçeneği etkin"
              checked={colorSection?.enabled || false}
              onChange={(enabled) => {
                const newConfig = [...config];
                const colorIdx = newConfig.findIndex(c => c.type === "color");
                if (colorIdx >= 0) newConfig[colorIdx].enabled = enabled;
                setConfig(newConfig);
              }}
            />
            
            {colorSection?.options?.map((opt, idx) => (
              <Card key={idx} sectioned>
                <BlockStack gap="300">
                  <InlineStack align="space-between">
                    <div style={{ flex: 2, marginRight: 8 }}>
                      <TextField
                        label="Renk"
                        value={opt.value}
                        onChange={(v) => updateColorOption(idx, "value", v)}
                      />
                    </div>
                    <div style={{ flex: 1, marginRight: 8 }}>
                      <Select
                        label="Tip"
                        options={[
                          { label: "HEX Kodu", value: "hex" },
                          { label: "Resim URL", value: "url" }
                        ]}
                        value={opt.type || "hex"}
                        onChange={(type) => updateColorOption(idx, "type", type)}
                      />
                    </div>
                    <div style={{ flex: 1, marginRight: 8 }}>
                      <TextField
                        label="Fiyat"
                        type="number"
                        value={String(opt.price)}
                        onChange={(v) => updateColorOption(idx, "price", v)}
                      />
                    </div>
                    <Button tone="critical" variant="tertiary" onClick={() => removeColorOption(idx)}>
                      Sil
                    </Button>
                  </InlineStack>
                  <div style={{ flex: 1 }}>
                    {opt.type === "url" ? (
                      <TextField
                        label="Resim URL"
                        value={opt.image_url || ""}
                        onChange={(v) => updateColorOption(idx, "image_url", v)}
                      />
                    ) : (
                      <TextField
                        label="HEX Kodu"
                        value={opt.hex || "#000000"}
                        onChange={(v) => updateColorOption(idx, "hex", v)}
                      />
                    )}
                  </div>
                  {/* Önizleme */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', color: '#666' }}>Önizleme:</span>
                    {opt.type === "url" && opt.image_url ? (
                      <img 
                        src={opt.image_url} 
                        alt={opt.value}
                        style={{ width: '30px', height: '30px', borderRadius: '4px', objectFit: 'cover' }}
                      />
                    ) : (
                      <div 
                        style={{ 
                          width: '30px', 
                          height: '30px', 
                          backgroundColor: opt.hex || '#000000',
                          borderRadius: '4px',
                          border: '1px solid #ddd'
                        }}
                      />
                    )}
                  </div>
                </BlockStack>
              </Card>
            ))}
            
            <Button onClick={addColorOption} variant="tertiary">Renk Ekle</Button>
          </BlockStack>
        )}

        {/* Header & Grommet Tab */}
        {activeTab === 2 && (
          <BlockStack gap="300">
            <Banner tone="info">Header seçenekleri ve grommet renkleri</Banner>
            
            {/* Header Options */}
            <Card title="Header Seçenekleri" sectioned>
              {headerSection?.options?.map((opt, idx) => (
                <Card key={idx} sectioned>
                  <InlineStack align="space-between">
                    <div style={{ flex: 1, marginRight: 8 }}>
                      <TextField
                        label="Header Tipi"
                        value={opt.value}
                        onChange={(v) => updateHeaderOption(idx, "value", v)}
                      />
                    </div>
                    <div style={{ flex: 1, marginRight: 8 }}>
                      <TextField
                        label="Fiyat"
                        type="number"
                        value={String(opt.price)}
                        onChange={(v) => updateHeaderOption(idx, "price", v)}
                      />
                    </div>
                    <div style={{ flex: 1, marginRight: 8 }}>
                      <TextField
                        label="Resim URL"
                        value={opt.image_url}
                        onChange={(v) => updateHeaderOption(idx, "image_url", v)}
                      />
                    </div>
                    <Button tone="critical" variant="tertiary" onClick={() => removeHeaderOption(idx)}>
                      Sil
                    </Button>
                  </InlineStack>
                </Card>
              ))}
              <Button onClick={addHeaderOption} variant="tertiary">Header Ekle</Button>
            </Card>

            {/* Grommet Colors */}
            <Card title="Grommet Renkleri" sectioned>
              <Banner tone="info">
                Grommet renkleri için URL (resim) veya HEX kodu kullanabilirsiniz.
              </Banner>
              {headerSection?.nestedOption?.grommetColor?.options?.map((opt, idx) => (
                <Card key={idx} sectioned>
                 <BlockStack gap="300">
                   <InlineStack align="space-between">
                     <div style={{ flex: 2, marginRight: 8 }}>
                      <TextField
                        label="Grommet Rengi"
                        value={opt.value}
                        onChange={(v) => updateGrommetOption(idx, "value", v)}
                      />
                     </div>
                     <div style={{ flex: 1, marginRight: 8 }}>
                      <Select
                        label="Tip"
                        options={[
                          { label: "HEX Kodu", value: "hex" },
                          { label: "Resim URL", value: "url" }
                        ]}
                        value={opt.type || "hex"}
                        onChange={(type) => updateGrommetOption(idx, "type", type)}
                      />
                     </div>
                     <div style={{ flex: 1, marginRight: 8 }}>
                      <TextField
                        label="Fiyat"
                        type="number"
                        value={String(opt.price)}
                        onChange={(v) => updateGrommetOption(idx, "price", v)}
                      />
                     </div>
                     <Button tone="critical" variant="tertiary" onClick={() => removeGrommetOption(idx)}>
                       Sil
                     </Button>
                   </InlineStack>
                   <div style={{ flex: 1 }}>
                     {opt.type === "url" ? (
                       <TextField
                         label="Resim URL"
                         value={opt.image_url || ""}
                         onChange={(v) => updateGrommetOption(idx, "image_url", v)}
                       />
                     ) : (
                       <TextField
                         label="HEX Kodu"
                         value={opt.hex || "#000000"}
                         onChange={(v) => updateGrommetOption(idx, "hex", v)}
                       />
                     )}
                   </div>
                   {/* Önizleme */}
                   <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                     <span style={{ fontSize: '12px', color: '#666' }}>Önizleme:</span>
                     {opt.type === "url" && opt.image_url ? (
                       <img 
                         src={opt.image_url} 
                         alt={opt.value}
                         style={{ width: '30px', height: '30px', borderRadius: '4px', objectFit: 'cover' }}
                       />
                     ) : (
                       <div 
                         style={{ 
                           width: '30px', 
                           height: '30px', 
                           backgroundColor: opt.hex || '#000000',
                           borderRadius: '4px',
                           border: '1px solid #ddd'
                         }}
                       />
                     )}
                    </div>
                  </BlockStack>
                </Card>
              ))}
              <Button onClick={addGrommetOption} variant="tertiary">Grommet Rengi Ekle</Button>
            </Card>
          </BlockStack>
        )}

        {/* Size Tab */}
        {activeTab === 3 && (
          <BlockStack gap="300">
            <TextField
              label="Birim"
              value={sizeSection?.unit || "cm"}
              onChange={(v) => {
                const newConfig = [...config];
                const sizeIdx = newConfig.findIndex(c => c.type === "size");
                if (sizeIdx >= 0) newConfig[sizeIdx].unit = v;
                setConfig(newConfig);
              }}
            />
            <TextField
              label="m² Başına Fiyat"
              type="number"
              value={String(sizeSection?.base_price_per_sqm || 100)}
              onChange={(v) => updateSizeConfig("base_price_per_sqm", v)}
            />
            <TextField
              label="Size Multiplier"
              type="number"
              step="0.1"
              value={String(sizeSection?.size_multiplier || 1)}
              onChange={(v) => updateSizeConfig("size_multiplier", v)}
            />
            
            <Card title="Boyut Limitleri" sectioned>
              <InlineStack>
                <TextField
                  label="Min Genişlik"
                  type="number"
                  value={String(sizeSection?.limits?.width?.min || 50.8)}
                  onChange={(v) => updateSizeConfig("limits.width.min", v)}
                />
                <TextField
                  label="Max Genişlik" 
                  type="number"
                  value={String(sizeSection?.limits?.width?.max || 304.8)}
                  onChange={(v) => updateSizeConfig("limits.width.max", v)}
                />
              </InlineStack>
              <InlineStack>
                <TextField
                  label="Min Yükseklik"
                  type="number"
                  value={String(sizeSection?.limits?.height?.min || 50.8)}
                  onChange={(v) => updateSizeConfig("limits.height.min", v)}
                />
                <TextField
                  label="Max Yükseklik"
                  type="number"
                  value={String(sizeSection?.limits?.height?.max || 1016)}
                  onChange={(v) => updateSizeConfig("limits.height.max", v)}
                />
              </InlineStack>
            </Card>
          </BlockStack>
        )}
      </Tabs>

      <InlineStack align="end">
        <Button onClick={onCancel} variant="tertiary">
          Vazgeç
        </Button>
        <Button variant="primary" onClick={handleSave}>
          Kaydet
        </Button>
      </InlineStack>
    </BlockStack>
  );
} 