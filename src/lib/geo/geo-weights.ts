import type { GeoCategoryKey } from "./geo-types";

export type GeoWeightTable = Record<GeoCategoryKey, number>;

// Pesi di base (brief sezione 13): sommano esattamente a 1 quando Local GEO
// non e' applicabile.
const BASE_WEIGHTS: Omit<GeoWeightTable, "local_geo"> = {
  ai_accessibility: 0.15,
  semantic_understanding: 0.15,
  entity_clarity: 0.15,
  information_completeness: 0.15,
  answerability: 0.15,
  content_structure: 0.1,
  trust_signals: 0.1,
  structured_data: 0.05,
};

const LOCAL_GEO_WEIGHT = 0.12;

/**
 * Per le attivita' locali, Local GEO entra con un peso proprio e le altre 8
 * categorie si restringono proporzionalmente per lasciargli spazio (brief
 * sezione 13: "redistribuisci... senza falsare il punteggio") — stessa
 * logica di rinormalizzazione usata da getWeightsFor per i pesi SEO
 * (src/lib/scoring/weights.ts), cosi' la somma resta sempre 1.
 */
export function getGeoWeights(localApplicable: boolean): GeoWeightTable {
  if (!localApplicable) {
    return { ...BASE_WEIGHTS, local_geo: 0 };
  }
  const shrink = 1 - LOCAL_GEO_WEIGHT;
  const scaled = Object.fromEntries(
    Object.entries(BASE_WEIGHTS).map(([key, value]) => [key, value * shrink])
  ) as Omit<GeoWeightTable, "local_geo">;
  return { ...scaled, local_geo: LOCAL_GEO_WEIGHT };
}

// Etichette in inglese come da terminologia GEO del brief (sezione 18),
// deliberatamente distinte da scoreLabel() (SEO, in italiano) per non far
// sembrare GEO una semplice riformulazione del Digital Score.
export function geoScoreLabel(score: number): string {
  if (score < 40) return "Poor";
  if (score < 60) return "Needs Improvement";
  if (score < 80) return "Good";
  return "Excellent";
}
