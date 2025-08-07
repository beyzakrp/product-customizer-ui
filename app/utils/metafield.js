/**
 * Metafield JSON işlemleri için yardımcı fonksiyonlar
 */

/**
 * JSON string'i parse eder, hata durumunda boş array döner
 * @param {string} jsonString - Parse edilecek JSON string
 * @returns {Array} Parse edilmiş array veya boş array
 */
export function parseMetafieldValue(jsonString) {
  try {
    if (!jsonString || jsonString === "null") {
      return [];
    }
    const parsed = JSON.parse(jsonString);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Metafield JSON parse hatası:", error);
    return [];
  }
}

/**
 * Array'i JSON string'e çevirir
 * @param {Array} data - JSON'a çevrilecek array
 * @returns {string} JSON string
 */
export function stringifyMetafieldValue(data) {
  try {
    return JSON.stringify(data || [], null, 2);
  } catch (error) {
    console.error("Metafield JSON stringify hatası:", error);
    return "[]";
  }
}

/**
 * Metafield verilerini doğrular
 * @param {Array} fields - Doğrulanacak alanlar
 * @returns {Object} Hata objesi
 */
export function validateMetafieldFields(fields) {
  const errors = {};
  
  if (!Array.isArray(fields)) {
    return { general: "Geçersiz veri formatı" };
  }
  
  fields.forEach((field, index) => {
    if (!field.label || !field.label.trim()) {
      errors[`${index}-label`] = "Label gereklidir";
    }
    
    if (!field.key || !field.key.trim()) {
      errors[`${index}-key`] = "Key gereklidir";
    }
    
    // Aynı key'lerin olup olmadığını kontrol et
    const duplicateKeys = fields.filter((f, i) => i !== index && f.key === field.key);
    if (duplicateKeys.length > 0) {
      errors[`${index}-key`] = "Bu key zaten kullanılıyor";
    }
    
    // Options gereken field tipleri için kontrol
    if (["color", "header", "grommet", "size"].includes(field.type)) {
      if (!field.options || field.options.length === 0) {
        errors[`${index}-options`] = "En az bir seçenek gereklidir";
      } else {
        field.options.forEach((option, optionIndex) => {
          if (!option.label || !option.label.trim()) {
            errors[`${index}-option-${optionIndex}-label`] = "Seçenek label'ı gereklidir";
          }
          if (!option.value || !option.value.trim()) {
            errors[`${index}-option-${optionIndex}-value`] = "Seçenek değeri gereklidir";
          }
        });
      }
    }
  });
  
  return errors;
}

/**
 * Varsayılan field şablonu oluşturur
 * @param {string} type - Field tipi
 * @returns {Object} Varsayılan field objesi
 */
export function createDefaultField(type = "color") {
  return {
    type,
    label: "",
    key: "",
    required: false,
    options: type === "color" ? [
      { label: "Kırmızı", value: "red" },
      { label: "Mavi", value: "blue" },
      { label: "Yeşil", value: "green" }
    ] : [],
    defaultValue: "",
  };
}

/**
 * Field tipine göre varsayılan seçenekler döner
 * @param {string} type - Field tipi
 * @returns {Array} Varsayılan seçenekler
 */
export function getDefaultOptionsForType(type) {
  const defaults = {
    color: [
      { label: "Kırmızı", value: "red" },
      { label: "Mavi", value: "blue" },
      { label: "Yeşil", value: "green" },
      { label: "Sarı", value: "yellow" },
      { label: "Siyah", value: "black" },
      { label: "Beyaz", value: "white" }
    ],
    header: [
      { label: "Standart", value: "standard" },
      { label: "Özel", value: "custom" },
      { label: "Minimal", value: "minimal" }
    ],
    grommet: [
      { label: "Yuvarlak", value: "round" },
      { label: "Kare", value: "square" },
      { label: "Oval", value: "oval" }
    ],
    size: [
      { label: "Küçük", value: "small" },
      { label: "Orta", value: "medium" },
      { label: "Büyük", value: "large" }
    ]
  };
  
  return defaults[type] || [];
} 