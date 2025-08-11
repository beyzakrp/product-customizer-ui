import { useState, useCallback } from "react";
import {
  Card,
  TextField,
  InlineStack,
  Button,
  Text,
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

export default function ColorOptionsEditor({ initialValue = "[]", onSave, onCancel }) {
  const [options, setOptions] = useState(() => parseInitial(initialValue));
  const [errors, setErrors] = useState({});

  const addOption = () => {
    setOptions([...options, { value: "", hex: "#000000", price: 0 }]);
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
      if (!opt.value || !opt.value.trim()) newErrors[`${idx}-value`] = "Label is required";
      if (!/^#([0-9A-Fa-f]{3}){1,2}$/.test(opt.hex)) newErrors[`${idx}-hex`] = "Invalid HEX";
      if (isNaN(parseFloat(opt.price))) newErrors[`${idx}-price`] = "Price must be a number";
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
                label="Color"
                value={opt.value}
                onChange={(v) => updateOption(idx, "value", v)}
                error={errors[`${idx}-value`]}
              />
            </div>
            <div style={{ flex: 1, marginRight: 8 }}>
              <TextField
                label="HEX"
                value={opt.hex}
                onChange={(v) => updateOption(idx, "hex", v)}
                error={errors[`${idx}-hex`]}
                autoComplete="off"
              />
            </div>
            <div style={{ flex: 1, marginRight: 8 }}>
              <TextField
                label="Price"
                type="number"
                value={String(opt.price)}
                onChange={(v) => updateOption(idx, "price", v)}
                error={errors[`${idx}-price`]}
              />
            </div>
            <div style={{ alignSelf: "flex-end" }}>
              <Button tone="critical" variant="tertiary" onClick={() => removeOption(idx)}>
                Delete
              </Button>
            </div>
          </InlineStack>
        </Card>
      ))}

      {options.length === 0 && (
        <Banner tone="info">No color added yet.</Banner>
      )}

      <Button onClick={addOption} variant="tertiary">
        Add Color
      </Button>

      <InlineStack align="end">
        <Button onClick={onCancel} variant="tertiary">
          Cancel
        </Button>
        <Button variant="primary" onClick={handleSave}>
          Save
        </Button>
      </InlineStack>
    </BlockStack>
  );
} 