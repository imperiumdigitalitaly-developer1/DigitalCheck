import type { BusinessType, CategoryKey } from "@/types";
import { getWeightsFor } from "@/lib/scoring/weights";
import type { AnalysisResult } from "./types";

// DigitalCheck Score complessivo (brief audit sezione 13): NON una media
// secca, riusa la metodologia di pesatura gia' documentata per le 7
// categorie SEO-side (src/lib/scoring/weights.ts, con override per tipo di
// attivita') ed estende lo stesso principio al GEO, che prima non entrava
// nel punteggio complessivo.
//
// Il GEO riceve un peso fisso di GEO_WEIGHT quando disponibile; le altre 7
// categorie si restringono proporzionalmente per lasciargli spazio — stessa
// tecnica di rinormalizzazione gia' usata da getGeoWeights() per Local GEO
// all'interno del GEO stesso (src/lib/geo/geo-weights.ts), applicata qui
// a un livello sopra. Se il GEO non e' disponibile (scan falliti prima del
// suo calcolo), i pesi restano i soli 7 originali, sommando comunque a 1.
export const GEO_WEIGHT = 0.15;

export interface MasterScoreBreakdown {
  score: number;
  weights: Partial<Record<CategoryKey, number>> & { geo?: number };
}

export function computeMasterScore(
  analyses: AnalysisResult[],
  geoScore: number | null,
  businessType: BusinessType
): MasterScoreBreakdown {
  const baseWeights = getWeightsFor(businessType);
  const shrink = geoScore != null ? 1 - GEO_WEIGHT : 1;

  const weights: MasterScoreBreakdown["weights"] = {};
  let weightedSum = 0;
  let totalWeight = 0;

  for (const result of analyses) {
    const weight = (baseWeights[result.category] ?? 0) * shrink;
    weights[result.category] = weight;
    weightedSum += result.score * weight;
    totalWeight += weight;
  }

  if (geoScore != null) {
    weights.geo = GEO_WEIGHT;
    weightedSum += geoScore * GEO_WEIGHT;
    totalWeight += GEO_WEIGHT;
  }

  const score = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;
  return { score, weights };
}
