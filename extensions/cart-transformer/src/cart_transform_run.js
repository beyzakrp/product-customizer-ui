// @ts-check

/**
 * @typedef {import("../generated/api").CartTransformRunInput} CartTransformRunInput
 * @typedef {import("../generated/api").CartTransformRunResult} CartTransformRunResult
 * @typedef {import("../generated/api").UpdateOperation} UpdateOperation
 */

const NO_CHANGES = {
  operations: [],
};

// --- YENİ VE DÜZELTİLMİŞ FİYAT HESAPLAMA MANTIĞI ---

function toNumber(val, fallback = 0) {
  const n = typeof val === "string" ? parseFloat(val) : val;
  return Number.isFinite(n) ? n : fallback;
}

function computeTotalPrice({ config, selections }) {
  if (!Array.isArray(config)) return 0;

  const cfg = config.find((b) => b.type === "config") || {};
  const basePrice = toNumber(cfg.base_price, 0);

  // --- STAGE 1: Calculate "New Base Price" ---
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

  const multiplierEffect = basePrice * multiplierValueSum;
  const newBasePrice = basePrice + addedSum + multiplierEffect;

  // --- STAGE 2: Calculate Final Price based on Width ---
  const areaBlock = config.find((b) => b.type === "area" && b.enabled);
  if (!areaBlock) {
    return newBasePrice;
  }

  const referenceWidth = toNumber(areaBlock.pricing?.value, 1);
  if (referenceWidth <= 0) {
    return newBasePrice;
  }

  const priceAtReferenceWidth = newBasePrice;
  const pricePerInch = priceAtReferenceWidth / referenceWidth;

  const areaSelection = selections?.[areaBlock.id];
  const customerWidth = toNumber(areaSelection?.width, 0);

  const finalPrice = customerWidth * pricePerInch;
  return finalPrice;
}


// --- ANA FONKSİYON ---

export function cartTransformRun(input) {
  const operations = input.cart.lines
    .map(line => {
      const configAttribute = line.attributes.find(attr => attr.key === "customizer_config");
      const selectionsAttribute = line.attributes.find(attr => attr.key === "customizer_selections");

      if (!configAttribute || !selectionsAttribute) {
        return null;
      }

      try {
        const config = JSON.parse(configAttribute.value);
        const selections = JSON.parse(selectionsAttribute.value);
        const newPrice = computeTotalPrice({ config, selections });
        const currentPrice = parseFloat(line.cost.amountPerQuantity.amount);

        // Update price only if it's calculated correctly and different from the current price
        if (newPrice > 0 && Math.abs(newPrice - currentPrice) > 0.01) {
          /** @type {UpdateOperation} */
          const updateOperation = {
            update: {
              cartLineId: line.id,
              price: {
                adjustment: {
                  fixedPricePerUnit: {
                    amount: newPrice.toFixed(2),
                  }
                }
              }
            }
          };
          return updateOperation;
        }
      } catch (e) {
        console.error("Cart Transform Error:", e.message);
        // Don't crash, just log the error and make no changes
      }
      
      return null;
    })
    .filter(op => op !== null);

  if (operations.length === 0) {
    return NO_CHANGES;
  }

  return { operations };
};