/**
 * Generic fiyat hesaplama yardımcıları
 * Multiplier sadece base fiyata uygulanır
 */

function toNumber(val, fallback = 0) {
  const n = typeof val === "string" ? parseFloat(val) : val;
  return Number.isFinite(n) ? n : fallback;
}

export function computeAreaBase(block, selection) {
  if (!block || block.type !== "area" || !block.enabled) return 0;
  const width = toNumber(selection?.width, 0);
  const height = toNumber(selection?.height, 0);
  const sqm = (width * height) / 10000; // cm -> m²
  const pricePerSqm = toNumber(block?.pricing?.value, 0);
  return sqm * pricePerSqm;
}

export function computeTotalPrice({ config, selections }) {
  if (!Array.isArray(config)) return 0;
  const cfg = config.find((b) => b.type === "config") || {};
  const baseFromConfig = toNumber(cfg.base_price, 0);

  // 1) P0: birim taban fiyat
  const areaBlock = config.find((b) => b.type === "area" && b.enabled);
  const pricePerSqm = toNumber(areaBlock?.pricing?.value, 0);
  const areaSelectionForP0 = areaBlock ? selections?.[areaBlock.id] : undefined;
  const hasDimsForP0 = toNumber(areaSelectionForP0?.width, 0) > 0 && toNumber(areaSelectionForP0?.height, 0) > 0;
  const baseSource = cfg.base_source || 'base'; // 'base' | 'area'
  // Base kaynağına göre P0 belirle
  let P0 = baseFromConfig;
  if (baseSource === 'area' && areaBlock) {
    P0 = hasDimsForP0 ? pricePerSqm : baseFromConfig;
  }

  // 2) Opsiyonların P0 üzerindeki etkisi
  let mLinearSum = 0; // linear_base için
  let mCompoundFactor = 1; // compound için
  let aUnit = 0; // birim düzeyi ekler
  let aOrder = 0; // sipariş düzeyi ekler

  const applyPricing = (pricing, helpers = {}) => {
    if (!pricing || pricing.mode === 'none') return;
    const scope = pricing.scope || 'unit';
    const combine = pricing.combine || 'linear_base';
    const value = toNumber(pricing.value, 0);

    if (pricing.mode === 'multiplier') {
      const m = value; // linear_base: m eklenir; compound: (1+m) çarpılır
      if (scope === 'order') {
        // sipariş düzeyi multiplier istenmiyorsa, P0 üzerinden order-level arttırımı yap
        aOrder += P0 * m; // sade yaklaşım
      } else {
        if (combine === 'compound') mCompoundFactor *= (1 + m);
        else mLinearSum += m;
      }
    } else if (pricing.mode === 'added') {
      if (scope === 'order') aOrder += value;
      else aUnit += value;
    }
  };

  for (const block of config) {
    if (!block || !block.enabled) continue;
    const sel = selections?.[block.id];

    if (block.type === 'picker') {
      if (!sel) continue;
      const selectedItem = (block.options || []).find((o) => o.value === sel);
      if (selectedItem?.pricing) applyPricing(selectedItem.pricing);
      else if (Number.isFinite(toNumber(selectedItem?.added))) {
        // geri uyumluluk: eski 'added' alanı unit-scope added say
        aUnit += toNumber(selectedItem.added, 0);
      }
      // nested
      if (block.isNested && Array.isArray(block.nested)) {
        for (const group of block.nested) {
          if (group?.when?.equals && group.when.equals === sel) {
            for (const item of group.items || []) {
              const subSel = selections?.[item.id];
              if (!subSel) continue;
              const subItem = (item.options || []).find((o) => o.value === subSel);
              if (subItem?.pricing) applyPricing(subItem.pricing);
              else if (Number.isFinite(toNumber(subItem?.added))) aUnit += toNumber(subItem.added, 0);
            }
          }
        }
      }
    } else if (block.type === 'input') {
      if (!sel && sel !== 0) continue;
      if (block.subtype === 'number' || block.subtype === 'float') {
        if (block.pricing?.mode === 'multiplier') {
          const qty = toNumber(sel, 0);
          const k = toNumber(block.pricing.value, 0);
          applyPricing({ mode: 'multiplier', value: k * qty, scope: block.pricing.scope, combine: block.pricing.combine });
        }
        if (block.pricing?.mode === 'added') {
          const qty = toNumber(sel, 0);
          const perUnit = toNumber(block.pricing.value, 0);
          applyPricing({ mode: 'added', value: perUnit * qty, scope: block.pricing.scope });
        }
      } else if (block.subtype === 'text') {
        if (block.pricing) applyPricing(block.pricing);
      }
    } else if (block.type === 'area') {
      // Area için opsiyonel pricing yorumları genelde gerekmez; P0 zaten buradan gelir
      // Eğer ileride area block için order-level ekler istenirse buraya eklenebilir
    } else {
      // diğer tipler için block.pricing varsa uygula
      if (block.pricing) applyPricing(block.pricing);
    }
  }

  // P_unit hesapla
  const P_unit = P0 * (1 + mLinearSum) * mCompoundFactor + aUnit;

  // 3) Alan çarpanı
  let area_m2 = 1;
  if (areaBlock) {
    const areaSelection = selections?.[areaBlock.id];
    const w = toNumber(areaSelection?.width, 0);
    const h = toNumber(areaSelection?.height, 0);
    area_m2 = (w > 0 && h > 0) ? (w * h) / 10000 : 1; // ölçü yoksa 1 kabul et
  }

  const subtotal = P_unit * area_m2;
  const total = subtotal + aOrder;
  return total;
}

export default { computeTotalPrice };



