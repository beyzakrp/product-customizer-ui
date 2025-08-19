// @ts-check

/**
 * @typedef {import("../generated/api").CartTransformRunInput} CartTransformRunInput
 * @typedef {import("../generated/api").CartTransformRunResult} CartTransformRunResult
 * @typedef {import("../generated/api").UpdateOperation} UpdateOperation
 */

const NO_CHANGES = {
  operations: [],
};


function toNumber(val, fallback = 0) {
  const n = typeof val === "string" ? parseFloat(val) : val;
  return Number.isFinite(n) ? n : fallback;
}

function computeTotalPrice({ config, selections }) {
  if (!Array.isArray(config)) return 0;

  const cfg = config.find((b) => b.type === "config") || {};
  const unitPrice = toNumber(cfg.unit_price, 0);

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

  const multiplierEffect = unitPrice * multiplierValueSum;
  const newUnitPrice = unitPrice + addedSum + multiplierEffect;

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



export function cartTransformRun(input) {
  console.log("=== CART TRANSFORM DEBUG START ===");
  console.log("Input cart lines:", input.cart.lines.length);
  
  const operations = input.cart.lines
    .map((line, index) => {
      console.log(`Processing line ${index}:`, line.id);
      console.log("Line attributes:", line.attributes.map(attr => ({ key: attr.key, value: attr.value.substring(0, 100) + "..." })));
      
      const configAttribute = line.attributes.find(attr => attr.key === "customizer_config");
      const selectionsAttribute = line.attributes.find(attr => attr.key === "customizer_selections");

      if (!configAttribute || !selectionsAttribute) {
        console.log("Missing attributes - config:", !!configAttribute, "selections:", !!selectionsAttribute);
        return null;
      }

      try {
        const config = JSON.parse(configAttribute.value);
        const selections = JSON.parse(selectionsAttribute.value);
        console.log("Parsed config:", config);
        console.log("Parsed selections:", selections);
        
        const newPrice = computeTotalPrice({ config, selections });
        const currentPrice = parseFloat(line.cost.amountPerQuantity.amount);
        
        console.log("Calculated price:", newPrice);
        console.log("Current price:", currentPrice);
        console.log("Price difference:", Math.abs(newPrice - currentPrice));

        // Update price only if it's calculated correctly and different from the current price
        if (newPrice > 0 && Math.abs(newPrice - currentPrice) > 0.01) {
          console.log("Creating price update operation");
          const updateOperation = {
            lineUpdate: {
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
        } else {
          console.log("No price update needed - price difference too small or invalid price");
        }
      } catch (e) {
        console.error("Cart Transform Error:", e.message, e.stack);
      }
      
      return null;
    })
    .filter(op => op !== null);

  console.log("Total operations:", operations.length);
  console.log("=== CART TRANSFORM DEBUG END ===");

  if (operations.length === 0) {
    return NO_CHANGES;
  }

  return { operations };
};