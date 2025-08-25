// @ts-check

/**
 * @typedef {import("../generated/api").CartTransformRunInput} CartTransformRunInput
 * @typedef {import("../generated/api").CartTransformRunResult} CartTransformRunResult
 * @typedef {import("../generated/api").ExpandOperation} ExpandOperation
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
  console.log("=== CART EXPAND DEBUG START ===");
  console.log("Input cart lines:", input.cart.lines.length);
  
  const operations = [];
  
  input.cart.lines.forEach((line, index) => {
    console.log(`Processing line ${index}:`, line.id);
    
    const configAttribute = line.attributes.find(attr => attr.key === "customizer_config");
    const selectionsAttribute = line.attributes.find(attr => attr.key === "customizer_selections");
    
    if (!configAttribute || !selectionsAttribute) {
      console.log("Missing customizer attributes - config:", !!configAttribute, "selections:", !!selectionsAttribute);
      return;
    }
    
    try {
      const config = JSON.parse(configAttribute.value);
      const selections = JSON.parse(selectionsAttribute.value);
      
      console.log("Parsed config:", config);
      console.log("Parsed selections:", selections);
      
      const customizerPrice = computeTotalPrice({ config, selections });
      const originalPrice = parseFloat(line.cost.amountPerQuantity.amount) / 100; // cents to dollars
      
      console.log("Customizer price:", customizerPrice);
      console.log("Original price:", originalPrice);
      
      if (customizerPrice > 0) {
        const expandOperation = {
          expand: {
            cartLineId: line.id,
            attributes: [
              {
                key: "_Customizer-Enabled",
                value: "true"
              },
              {
                key: "_Customizer-Config",
                value: configAttribute.value
              },
              {
                key: "_Customizer-Selections", 
                value: selectionsAttribute.value
              },
              {
                key: "_Customizer-Price",
                value: customizerPrice.toFixed(2)
              },
              {
                key: "_Original-Price",
                value: originalPrice.toFixed(2)
              }
            ],
            expandedCartItems: [
              {
                merchandiseId: line.merchandise.id,
                quantity: line.quantity,
                price: {
                  fixedPricePerUnit: {
                    amount: customizerPrice.toFixed(2) // ondalıklı string
                  }
                }
              }
            ]
          }
        };
        
        operations.push(expandOperation);
        console.log("Created expand operation for line:", line.id);
      }
      
    } catch (e) {
      console.error("Cart Transform Error:", e.message, e.stack);
    }
  });
  
  console.log("Total expand operations:", operations.length);
  console.log("=== CART EXPAND DEBUG END ===");
  
  if (operations.length === 0) {
    return NO_CHANGES;
  }
  
  return { operations };
}