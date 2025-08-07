import { useState } from "react";
import {
  TextField,
  Button,
  Banner,
  BlockStack,
  InlineStack,
} from "@shopify/polaris";

function parseInitial(data) {
  if (typeof data === "number") return data;
  if (typeof data === "string") {
    try {
      const num = parseFloat(data);
      return isNaN(num) ? 1.0 : num;
    } catch {
      return 1.0;
    }
  }
  return 1.0;
}

export default function SizeMultiplierEditor({ initialValue = "1.0", onSave, onCancel }) {
  const [multiplier, setMultiplier] = useState(() => parseInitial(initialValue));
  const [error, setError] = useState("");

  const validate = () => {
    if (isNaN(parseFloat(multiplier))) {
      setError("Geçerli bir sayı giriniz");
      return false;
    }
    setError("");
    return true;
  };

  const handleSave = () => {
    if (validate()) {
      onSave(parseFloat(multiplier));
    }
  };

  return (
    <BlockStack gap="400">
      <Banner tone="info">
        <p>Size multiplier değeri, boyut hesaplamalarında kullanılan çarpan değeridir.</p>
      </Banner>
      
      <TextField
        label="Size Multiplier"
        type="number"
        step="0.1"
        value={String(multiplier)}
        onChange={(value) => {
          setMultiplier(value);
          setError("");
        }}
        error={error}
        helpText="Örnek: 30.0 veya 1.5"
      />

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