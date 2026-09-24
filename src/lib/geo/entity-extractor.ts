import * as cheerio from "cheerio";
import type { CrawlResult, SeoFacts } from "@/types";
import type { EntityData } from "./geo-types";
import { extractJsonLd, extractSameAs, findEntriesOfType, firstStringField } from "./json-ld";
import { stripHtmlToText } from "./text-utils";

const PHONE_PATTERN = /\+?\d[\d\s\-().]{7,}\d/;
const EMAIL_PATTERN = /@[\w.-]+\.\w+/;
const ADDRESS_PATTERN = /\b(via|viale|piazza|corso|largo|vicolo)\s+[a-zA-ZÀ-ſ]/i;
const GBP_LINK_PATTERN = /google\.com\/maps|g\.page\/|goo\.gl\/maps|business\.google\.com/i;

/**
 * Segnali di entita'/brand rilevabili tecnicamente (brief GEO sezione 3).
 * Come per seo-analyzer.ts, ogni campo e' "rilevato", mai "verificato
 * esternamente" — non conferma che l'organizzazione esista davvero o che
 * i dati di contatto siano corretti, solo che sono dichiarati nel sito.
 */
export function extractEntityData(crawl: CrawlResult, facts: SeoFacts): EntityData {
  const jsonLd = extractJsonLd(crawl);
  const detectedSchemaTypes = Array.from(new Set(jsonLd.map((e) => e.type)));

  const organizationEntries = findEntriesOfType(jsonLd, ["Organization", "Corporation"]);
  const localBusinessEntries = jsonLd.filter((e) =>
    /LocalBusiness|Restaurant|Hotel|LodgingBusiness|Store|ProfessionalService|FoodEstablishment/i.test(e.type)
  );
  const personEntries = findEntriesOfType(jsonLd, ["Person"]);
  const productServiceEntries = findEntriesOfType(jsonLd, ["Product", "Service", "Offer"]);
  const faqEntries = findEntriesOfType(jsonLd, ["FAQPage"]);
  const breadcrumbEntries = findEntriesOfType(jsonLd, ["BreadcrumbList"]);
  const reviewEntries = jsonLd.filter((e) => /Review|AggregateRating/i.test(e.type));

  const homeHtml = crawl.pages[0]?.html ?? "";
  const $ = cheerio.load(homeHtml);
  const ogSiteName = $('meta[property="og:site_name"]').attr("content")?.trim() || null;

  const nameFromSchema =
    firstStringField(organizationEntries, "name") ??
    firstStringField(localBusinessEntries, "name") ??
    null;

  const titleCandidate = facts.title
    ? facts.title.split(/[|\-·–—]/)[0]?.trim() || facts.title.trim()
    : null;

  const businessNameCandidates = Array.from(
    new Set([nameFromSchema, ogSiteName, titleCandidate].filter((v): v is string => !!v && v.length > 0))
  );

  const combinedText = crawl.pages.map((p) => stripHtmlToText(p.html)).join(" ");
  const combinedHtml = crawl.pages.map((p) => p.html).join(" ");

  return {
    businessNameCandidates,
    detectedSchemaTypes,
    organizationSchemaPresent: organizationEntries.length > 0,
    localBusinessSchemaPresent: localBusinessEntries.length > 0,
    personSchemaPresent: personEntries.length > 0,
    productOrServiceSchemaPresent: productServiceEntries.length > 0,
    faqSchemaPresent: faqEntries.length > 0,
    breadcrumbSchemaPresent: breadcrumbEntries.length > 0,
    reviewSchemaPresent: reviewEntries.length > 0,
    sameAsLinks: extractSameAs([...organizationEntries, ...localBusinessEntries, ...personEntries]),
    contact: {
      phonePresent: PHONE_PATTERN.test(combinedText),
      emailPresent: EMAIL_PATTERN.test(combinedText),
      addressPresent: ADDRESS_PATTERN.test(combinedText),
    },
    googleBusinessProfileLinkPresent: GBP_LINK_PATTERN.test(combinedHtml),
  };
}
