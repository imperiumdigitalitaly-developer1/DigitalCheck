import type { BusinessType, CrawlResult, SeoFacts } from "@/types";
import type {
  AnswerabilityQuery,
  EntityData,
  GeoCategoryKey,
  GeoCategoryScore,
  GeoIssue,
  InformationCompletenessItem,
} from "./geo-types";
import { getGeoWeights } from "./geo-weights";
import { extractEntityData } from "./entity-extractor";
import { scoreAiAccessibility } from "./ai-crawlability";
import { scoreSemanticUnderstanding } from "./semantic-understanding";
import { scoreEntityClarity } from "./entity-clarity";
import { evaluateInformationCompleteness } from "./information-completeness";
import { evaluateAnswerability } from "./answerability";
import { scoreContentStructure } from "./content-structure";
import { scoreTrustSignals } from "./trust-signals";
import { scoreStructuredData } from "./structured-data";
import { isLocalApplicable, scoreLocalGeo } from "./local-geo";

export interface GeoScoringOutput {
  overallScore: number;
  localApplicable: boolean;
  categoryScores: GeoCategoryScore[];
  issues: GeoIssue[];
  strengths: string[];
  entities: EntityData;
  informationCompleteness: InformationCompletenessItem[];
  answerabilityQueries: AnswerabilityQuery[];
}

/**
 * Orchestratore GEO: chiama ogni analizzatore di categoria (tutti
 * puramente data-driven, nessuna chiamata AI qui — brief GEO sezione 36)
 * e compone il punteggio finale con i pesi di src/lib/geo/geo-weights.ts.
 * L'interpretazione AI (sintesi, confronto con la SEO) viene aggiunta
 * separatamente da src/lib/ai/geo-analyzer.ts, a valle di questo risultato
 * — mai il contrario.
 */
export function computeGeoAnalysis(crawl: CrawlResult, facts: SeoFacts, businessType: BusinessType): GeoScoringOutput {
  const issues: GeoIssue[] = [];
  const entities = extractEntityData(crawl, facts);

  const aiAccessibility = scoreAiAccessibility(facts, crawl, issues);
  const semantic = scoreSemanticUnderstanding(facts, crawl, businessType, issues);
  const entityClarity = scoreEntityClarity(entities, issues);
  const infoCompleteness = evaluateInformationCompleteness(crawl, facts, entities, issues);
  const answerability = evaluateAnswerability(crawl, entities, issues);
  const contentStructure = scoreContentStructure(crawl, entities, issues);
  const trust = scoreTrustSignals(crawl, entities, issues);
  const structuredData = scoreStructuredData(crawl, entities, issues);

  const localApplicable = isLocalApplicable(businessType);
  const local = localApplicable ? scoreLocalGeo(crawl, businessType, entities, issues) : null;

  const weights = getGeoWeights(localApplicable);

  const rawScore: Record<GeoCategoryKey, number> = {
    ai_accessibility: aiAccessibility.score,
    semantic_understanding: semantic.score,
    entity_clarity: entityClarity.score,
    information_completeness: infoCompleteness.score,
    answerability: answerability.score,
    content_structure: contentStructure.score,
    trust_signals: trust.score,
    structured_data: structuredData.score,
    local_geo: local?.score ?? 0,
  };

  const notes: Record<GeoCategoryKey, string | undefined> = {
    ai_accessibility: aiAccessibility.notes,
    semantic_understanding: semantic.notes,
    entity_clarity: entityClarity.notes,
    information_completeness: `${infoCompleteness.items.filter((i) => i.status === "answered").length}/${infoCompleteness.items.length} domande fondamentali trovano risposta nel contenuto.`,
    answerability: `${answerability.queries.filter((q) => q.answered).length}/${answerability.queries.length} query generate trovano risposta nel contenuto.`,
    content_structure: contentStructure.notes,
    trust_signals: undefined,
    structured_data: structuredData.notes,
    local_geo: localApplicable ? local?.notes : "Non applicabile: categoria di attivita' non locale.",
  };

  const categoryScores: GeoCategoryScore[] = (Object.keys(weights) as GeoCategoryKey[]).map((category) => ({
    category,
    score: rawScore[category],
    weight: weights[category],
    applicable: category === "local_geo" ? localApplicable : true,
    notes: notes[category],
  }));

  const overallScore = Math.round(categoryScores.reduce((sum, c) => sum + c.score * c.weight, 0));

  return {
    overallScore,
    localApplicable,
    categoryScores,
    issues,
    strengths: trust.strengths,
    entities,
    informationCompleteness: infoCompleteness.items,
    answerabilityQueries: answerability.queries,
  };
}
