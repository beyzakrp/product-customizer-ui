import { useState, useCallback } from "react";
import {
  Card,
  Button,
  TextField,
  Select,
  FormLayout,
  InlineStack,
  Text,
  Banner,
  Icon,
  Modal,
  TextContainer,
  BlockStack,
} from "@shopify/polaris";

import { parseMetafieldValue, validateMetafieldFields, createDefaultField, getDefaultOptionsForType } from "../utils/metafield";

export default function MetafieldEditor({ initialValue, onSave, onCancel }) {
  const [fields, setFields] = useState(() => {
    return parseMetafieldValue(initialValue);
  });

  const [errors, setErrors] = useState({});
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteIndex, setDeleteIndex] = useState(null);

  const fieldTypes = [
    { label: "Color", value: "color" },
    { label: "Header Type", value: "header" },
    { label: "Grommet", value: "grommet" },
    { label: "Size", value: "size" },
    { label: "Text", value: "text" },
    { label: "Number", value: "number" },
    { label: "Image URL", value: "image" },
  ];

  const addField = useCallback(() => {
    const newField = createDefaultField("color");
    setFields([...fields, newField]);
  }, [fields]);

  const updateField = useCallback((index, field, value) => {
    const newFields = [...fields];
    newFields[index] = { ...newFields[index], [field]: value };
    
    if (field === "type") {
      newFields[index].options = getDefaultOptionsForType(value);
      newFields[index].defaultValue = "";
    }
    
    setFields(newFields);
    

    if (errors[`${index}-${field}`]) {
      const newErrors = { ...errors };
      delete newErrors[`${index}-${field}`];
      setErrors(newErrors);
    }
  }, [fields, errors]);

  const removeField = useCallback((index) => {
    setDeleteIndex(index);
    setShowDeleteModal(true);
  }, []);

  const confirmDelete = useCallback(() => {
    if (deleteIndex !== null) {
      const newFields = fields.filter((_, index) => index !== deleteIndex);
      setFields(newFields);
    }
    setShowDeleteModal(false);
    setDeleteIndex(null);
  }, [deleteIndex, fields]);

  const addOption = useCallback((fieldIndex) => {
    const newFields = [...fields];
    if (!newFields[fieldIndex].options) {
      newFields[fieldIndex].options = [];
    }
    newFields[fieldIndex].options.push({ label: "", value: "" });
    setFields(newFields);
  }, [fields]);

  const updateOption = useCallback((fieldIndex, optionIndex, field, value) => {
    const newFields = [...fields];
    newFields[fieldIndex].options[optionIndex][field] = value;
    setFields(newFields);
  }, [fields]);

  const removeOption = useCallback((fieldIndex, optionIndex) => {
    const newFields = [...fields];
    newFields[fieldIndex].options.splice(optionIndex, 1);
    setFields(newFields);
  }, [fields]);

  const validateFields = useCallback(() => {
    const newErrors = validateMetafieldFields(fields);
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [fields]);

  const handleSave = useCallback(() => {
    if (validateFields()) {
      onSave(fields);
    }
  }, [fields, validateFields, onSave]);

  const renderFieldInputs = (field, index) => {
    const baseInputs = (
      <>
        <TextField
          label="Label"
          value={field.label || ""}
          onChange={(value) => updateField(index, "label", value)}
          error={errors[`${index}-label`]}
          autoComplete="off"
        />
        <TextField
          label="Key"
          value={field.key || ""}
          onChange={(value) => updateField(index, "key", value)}
          error={errors[`${index}-key`]}
          autoComplete="off"
          helpText="This key will be defined in the JSON. It is unique identifier."
        />
        <Select
          label="Tip"
          options={fieldTypes}
          value={field.type || "color"}
          onChange={(value) => updateField(index, "type", value)}
        />
      </>
    );

    if (["color", "header", "grommet", "size"].includes(field.type)) {
      return (
        <>
          {baseInputs}
          <div style={{ marginTop: "16px" }}>
            <InlineStack align="space-between">
              <Text variant="headingMd" as="h3">Options</Text>
              <Button
                onClick={() => addOption(index)}
                variant="tertiary"
              >
                Add Option
              </Button>
            </InlineStack>
            
            {field.options && field.options.map((option, optionIndex) => (
              <Card key={optionIndex} sectioned>
                <InlineStack align="space-between">
                  <div style={{ flex: 1, marginRight: "16px" }}>
                    <TextField
                      label="Label"
                      value={option.label || ""}
                      onChange={(value) => updateOption(index, optionIndex, "label", value)}
                      error={errors[`${index}-option-${optionIndex}-label`]}
                      autoComplete="off"
                    />
                  </div>
                  <div style={{ flex: 1, marginRight: "16px" }}>
                    <TextField
                      label="Value"
                      value={option.value || ""}
                      onChange={(value) => updateOption(index, optionIndex, "value", value)}
                      error={errors[`${index}-option-${optionIndex}-value`]}
                      autoComplete="off"
                    />
                  </div>
                  <div style={{ alignSelf: "end", marginBottom: "8px" }}>
                    <Button
                      onClick={() => removeOption(index, optionIndex)}
                      variant="tertiary"
                      tone="critical"
                    >
                      Delete
                    </Button>
                  </div>
                </InlineStack>
              </Card>
            ))}
            
            {errors[`${index}-options`] && (
              <Banner tone="critical">
                <p>{errors[`${index}-options`]}</p>
              </Banner>
            )}
          </div>
        </>
      );
    }

    return (
      <>
        {baseInputs}
        <TextField
          label="Default Value"
          value={field.defaultValue || ""}
          onChange={(value) => updateField(index, "defaultValue", value)}
          autoComplete="off"
        />
      </>
    );
  };

  return (
    <div>
      <BlockStack gap="loose">
        {fields.length === 0 ? (
          <Card sectioned>
            <div style={{ textAlign: "center", padding: "40px" }}>
              <Text variant="headingMd" as="h2">
                No fields added yet.
              </Text>
              <Text variant="bodyMd" as="p" tone="subdued">
                Add customization options by clicking the below button.
              </Text>
            </div>
          </Card>
        ) : (
          fields.map((field, index) => (
            <Card key={index} sectioned>
              <BlockStack gap="loose">
                <InlineStack align="space-between">
                  <Text variant="headingMd" as="h3">
                    Field {index + 1}
                  </Text>
                  <Button
                    onClick={() => removeField(index)}
                    variant="tertiary"
                    tone="critical"
                  >
                    Delete
                  </Button>
                </InlineStack>
                
                <FormLayout>
                  {renderFieldInputs(field, index)}
                </FormLayout>
              </BlockStack>
            </Card>
          ))
        )}

        <Button
          onClick={addField}
          variant="tertiary"
          fullWidth
        >
          Add New Field
        </Button>

        <InlineStack align="end" gap="tight">
          {onCancel && (
            <Button onClick={onCancel} variant="tertiary">
              Cancel
            </Button>
          )}
          <Button onClick={handleSave} primary>
            Save
          </Button>
        </InlineStack>
      </BlockStack>

      <Modal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Field"
        primaryAction={{
          content: "Delete",
          destructive: true,
          onAction: confirmDelete,
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () => setShowDeleteModal(false),
          },
        ]}
      >
        <Modal.Section>
          <TextContainer>
            <p>Are you sure you want to delete? This action cannot be undone.</p>
          </TextContainer>
        </Modal.Section>
      </Modal>
    </div>
  );
} 