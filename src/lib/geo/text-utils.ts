/** Testo visibile della pagina, HTML/script/style rimossi — stessa logica di src/lib/ai/prompts.ts, duplicata qui per non accoppiare il modulo GEO al modulo AI (il GEO scoring e' data-driven e deve restare utilizzabile senza alcuna chiamata AI). */
export function stripHtmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
