/**
 * Generic fiyat hesaplama yardımcıları
 * Unit price (per cm) ile width çarpılarak hesaplanır
 */

function toNumber(val, fallback = 0) {
  const n = typeof val === "string" ? parseFloat(val) : val;
  return Number.isFinite(n) ? n : fallback;
}

export function computeTotalPrice({ config, selections }) {
  if (!Array.isArray(config)) return 0;

  const cfg = config.find((b) => b.type === "config") || {};
  const unitPrice = toNumber(cfg.unit_price, 0);

  // --- STAGE 1: Calculate "New Unit Price" ---
  let addedSum = 0;
  let multiplierValueSum = 0;

  const processPricing = (pricing) => {
    if (!pricing || pricing.mode === 'none') return;
    const value = toNumber(pricing.value, 0);
    if (pricing.mode === 'added') {
      addedSum += value;
    } else if (pricing.mode === 'multiplier') {
      multiplierValueSum += value;
    }
  };

  for (const block of config) {
    if (!block || !block.enabled) continue;
    const sel = selections?.[block.id];

    if (block.type === 'picker') {
      if (!sel) continue;
      const selectedItem = (block.options || []).find((o) => o.value === sel);
      if (selectedItem) {
        processPricing(selectedItem.pricing);
        if (!selectedItem.pricing && Number.isFinite(toNumber(selectedItem?.added))) {
          addedSum += toNumber(selectedItem.added, 0);
        }
      }

      // Nested pickers
      if (block.isNested && Array.isArray(block.nested)) {
        for (const group of block.nested) {
          if (group?.when?.equals && group.when.equals === sel) {
            for (const item of (group.items || [])) {
              const subSel = selections?.[item.id];
              if (!subSel) continue;
              const subItem = (item.options || []).find((o) => o.value === subSel);
              if (subItem) {
                processPricing(subItem.pricing);
                if (!subItem.pricing && Number.isFinite(toNumber(subItem.added))) {
                  addedSum += toNumber(subItem.added, 0);
                }
              }
            }
          }
        }
      }
    }
  }

  const multiplierEffect = unitPrice * multiplierValueSum;
  const newUnitPrice = unitPrice + addedSum + multiplierEffect;

  // --- STAGE 2: Calculate Final Price based on Width ---
  const areaBlock = config.find((b) => b.type === "area" && b.enabled);
  if (!areaBlock) {
    return newUnitPrice;
  }

  const areaSelection = selections?.[areaBlock.id];
  const customerWidth = toNumber(areaSelection?.width, 0);

  // Width 0 ise, fiyat hesaplanamaz
  if (customerWidth <= 0) {
    return 0;
  }

  // Unit price ile width çarpılır
  const finalPrice = customerWidth * newUnitPrice;
  return finalPrice;
}

export default { computeTotalPrice };



