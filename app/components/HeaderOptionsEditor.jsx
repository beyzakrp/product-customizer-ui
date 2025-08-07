import { useState } from "react";
import {
  Card,
  TextField,
  InlineStack,
  Button,
  Banner,
  BlockStack,
} from "@shopify/polaris";

function parseInitial(data) {
  if (Array.isArray(data)) return data;
  if (typeof data === "string") {
    try {
      const arr = JSON.parse(data || "[]");
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }
  return [];
}

export default function HeaderOptionsEditor({ initialValue = "[]", onSave, onCancel }) {
  const [options, setOptions] = useState(() => parseInitial(initialValue));
  const [errors, setErrors] = useState({});

  const addOption = () => {
    setOptions([...options, { value: "", price: 0, image_url: "" }]);
  };

  const updateOption = (index, field, value) => {
    const newOpts = [...options];
    newOpts[index][field] = value;
    setOptions(newOpts);
  };

  const removeOption = (index) => {
    const newOpts = options.filter((_, i) => i !== index);
    setOptions(newOpts);
  };

  const validate = () => {
    const newErrors = {};
    options.forEach((opt, idx) => {
      if (!opt.value || !opt.value.trim()) newErrors[`${idx}-value`] = "Header tipi gerekli";
      if (isNaN(parseFloat(opt.price))) newErrors[`${idx}-price`] = "Fiyat sayısal olmalı";
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (validate()) {
      onSave(options);
    }
  };

  return (
    <BlockStack gap="400">
      {options.map((opt, idx) => (
        <Card key={idx} sectioned>
          <InlineStack align="space-between">
            <div style={{ flex: 1, marginRight: 8 }}>
              <TextField
                label="Header Tipi"
                value={opt.value}
                onChange={(v) => updateOption(idx, "value", v)}
                error={errors[`${idx}-value`]}
              />
            </div>
            <div style={{ flex: 1, marginRight: 8 }}>
              <TextField
                label="Fiyat"
                type="number"
                value={String(opt.price)}
                onChange={(v) => updateOption(idx, "price", v)}
                error={errors[`${idx}-price`]}
              />
            </div>
            <div style={{ flex: 1, marginRight: 8 }}>
              <TextField
                label="Resim URL"
                value={opt.image_url}
                onChange={(v) => updateOption(idx, "image_url", v)}
                placeholder="https://example.com/image.jpg"
              />
            </div>
            <div style={{ alignSelf: "flex-end" }}>
              <Button tone="critical" variant="tertiary" onClick={() => removeOption(idx)}>
                Sil
              </Button>
            </div>
          </InlineStack>
        </Card>
      ))}

      {options.length === 0 && (
        <Banner tone="info">Henüz header tipi eklenmemiş</Banner>
      )}

      <Button onClick={addOption} variant="tertiary">
        Header Tipi Ekle
      </Button>

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