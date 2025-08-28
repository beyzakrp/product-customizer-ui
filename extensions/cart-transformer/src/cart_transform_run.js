// @ts-check

/**
 * @typedef {import("../generated/api").CartTransformRunInput} RunInput
 * @typedef {import("../generated/api").CartTransformRunResult} FunctionRunResult
 */

/**
 * @type {FunctionRunResult}
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

  const newUnitPrice = (unitPrice + addedSum) * (multiplierValueSum || 1);

  console.log('🔍 CART TRANSFORMER DEBUG:', {
    unitPrice,
    addedSum,
    multiplierValueSum,
    newUnitPrice,
    customerWidth: toNumber(selections?.[config.find((b) => b.type === "area" && b.enabled)?.id]?.width, 0)
  });

  const areaBlock = config.find((b) => b.type === "area" && b.enabled);
  if (!areaBlock) {
    return newUnitPrice;
  }

  const areaSelection = selections?.[areaBlock.id];
  const customerWidth = toNumber(areaSelection?.width, 0);

  if (customerWidth <= 0) {
    return 0;
  }

  const finalPrice = customerWidth * newUnitPrice;
  return finalPrice;
}


export function cartTransformRun(input) {
  const operations = [];

  input.cart.lines.forEach((line) => {
    const configRaw = line.customizer_config?.value;
    const selectionsRaw = line.customizer_selections?.value;

    // If selling plan exists, skip lineExpand (Shopify doesn't allow it)
    if (line.sellingPlanAllocation?.sellingPlan?.id) {
      console.log("Selling plan detected, skipping lineExpand for line:", line.id);
      return;
    }

    if (configRaw && selectionsRaw) {
      try {
        const config = JSON.parse(configRaw);
        const selections = JSON.parse(selectionsRaw);
        
        const customizerPrice = computeTotalPrice({ config, selections });
        if (customizerPrice > 0) {
          const qty = Math.max(1, line.quantity || 1);
          const perUnit = (customizerPrice / qty);

          operations.push({
            lineExpand: {
              cartLineId: line.id,
              // Add debug attribute (Test the function is working)
              attributes: [{ key: "_ct_hit", value: new Date().toISOString() }],
              expandedCartItems: [
                {
                  merchandiseId: "gid://shopify/ProductVariant/46741666857196",
                  price: { 
                    adjustment: { 
                      fixedPricePerUnit: { 
                        amount: perUnit.toFixed(2) 
                      } 
                    } 
                  }
                }
              ]
            }
          });
        }
      } catch (e) {
        console.error("Cart Transform Error:", e.message, e.stack);
      }
    }
  });

  return {
    operations: operations.length > 0 ? operations : NO_CHANGES.operations,
  };
}