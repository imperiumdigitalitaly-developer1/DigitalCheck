import {
  PDFDocument,
  PDFFont,
  PDFImage,
  PDFPage,
  StandardFonts,
  LineCapStyle,
  rgb,
} from "pdf-lib";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { COLOR, scoreColor } from "./theme";

// Logo DigitalCheck con sfondo trasparente, incorporato una sola volta per
// documento e riusato in copertina (Pro) e nell'header (Free) — mai un
// wordmark testuale al posto del logo reale (richiesta esplicita: "l'unica
// cosa da inserire in prima pagina del pdf e' il logo di digitalcheck con
// sfondo trasparente").
const LOGO_PATH = join(process.cwd(), "public", "brand", "digitalcheck-logo.png");

export const PAGE_WIDTH = 595.28; // A4
export const PAGE_HEIGHT = 841.89;
export const MARGIN = 48;
export const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

// Fascia riservata a header/footer di "chrome" sulle pagine interne del
// Pro (brief, sezione 11). La cover non la usa: parte a filo margine.
const HEADER_BAND = 30;
const FOOTER_BAND = 34;

export type Color = ReturnType<typeof rgb>;

interface TextOptions {
  size?: number;
  font?: "regular" | "bold" | "display";
  color?: Color;
  gap?: number;
  maxWidth?: number;
  x?: number;
  lineHeightMult?: number;
  maxLines?: number; // se il testo eccede, tronca con ellissi sull'ultima riga
  align?: "left" | "center";
}

interface PageRef {
  page: PDFPage;
  chrome: boolean;
}

/**
 * Motore di disegno del PDF: gestisce cursore verticale, wrapping del
 * testo, interruzione di pagina automatica e le primitive grafiche
 * (gauge circolare, card arrotondate, pillole di priorita').
 *
 * Header/footer NON vengono disegnati durante la generazione dei
 * contenuti: la numerazione "0X / TOT" richiede di conoscere il numero
 * finale di pagine, che con un layout dinamico si sa solo a fine
 * generazione (brief, sezione 11). Si disegnano in un passaggio finale
 * con stampChrome().
 */
export class PdfCanvas {
  doc: PDFDocument;
  page: PDFPage;
  y: number;
  fontRegular: PDFFont;
  fontBold: PDFFont;
  fontDisplay: PDFFont; // serif, per titoli e numeri di punteggio
  logo: PDFImage;
  private pages: PageRef[] = [];
  private currentChrome: boolean;

  private constructor(doc: PDFDocument, fontRegular: PDFFont, fontBold: PDFFont, fontDisplay: PDFFont, logo: PDFImage) {
    this.doc = doc;
    this.fontRegular = fontRegular;
    this.fontBold = fontBold;
    this.fontDisplay = fontDisplay;
    this.logo = logo;
    this.page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.currentChrome = false;
    this.pages.push({ page: this.page, chrome: false });
    this.y = PAGE_HEIGHT - MARGIN;
  }

  static async create(): Promise<PdfCanvas> {
    const doc = await PDFDocument.create();
    const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
    const fontDisplay = await doc.embedFont(StandardFonts.TimesRomanBold);
    const logo = await doc.embedPng(readFileSync(LOGO_PATH));
    return new PdfCanvas(doc, fontRegular, fontBold, fontDisplay, logo);
  }

  /** Disegna il logo centrato in orizzontale, altezza fissa, larghezza proporzionale. Ritorna l'altezza. */
  drawLogoCentered(top: number, height: number): number {
    const width = height * (this.logo.width / this.logo.height);
    this.page.drawImage(this.logo, { x: (PAGE_WIDTH - width) / 2, y: top - height, width, height });
    return height;
  }

  /** Disegna il logo ancorato a sinistra (x, top), altezza fissa, larghezza proporzionale. Ritorna la larghezza. */
  drawLogo(x: number, top: number, height: number): number {
    const width = height * (this.logo.width / this.logo.height);
    this.page.drawImage(this.logo, { x, y: top - height, width, height });
    return width;
  }

  private font(kind: TextOptions["font"]): PDFFont {
    if (kind === "bold") return this.fontBold;
    if (kind === "display") return this.fontDisplay;
    return this.fontRegular;
  }

  contentTop(chrome: boolean): number {
    return chrome ? PAGE_HEIGHT - MARGIN - HEADER_BAND : PAGE_HEIGHT - MARGIN;
  }

  contentBottom(chrome: boolean): number {
    return chrome ? MARGIN + FOOTER_BAND : MARGIN;
  }

  /** Nuova pagina. `chrome=true` riserva le fasce per header/footer (pagine interne Pro). */
  newPage(chrome = this.currentChrome): PDFPage {
    this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.pages.push({ page: this.page, chrome });
    this.currentChrome = chrome;
    this.y = this.contentTop(chrome);
    return this.page;
  }

  // Il Free e' vincolato a UNA sola pagina (brief, sezione 19): se il
  // contenuto eccede lo spazio, va troncato, mai spinto su una seconda
  // pagina generata automaticamente. Il builder del Free imposta questo
  // flag cosi' ensureSpace() non apre mai una pagina in piu'.
  paginationLocked = false;

  ensureSpace(height: number) {
    if (this.paginationLocked) return;
    if (this.y - height < this.contentBottom(this.currentChrome)) this.newPage();
  }

  // Permette a sectionTitle()/agli header di categoria e GEO di capire se
  // stanno iniziando su una pagina fresca (nessun separatore aggiuntivo
  // serve) o se stanno continuando il flusso a meta' di una pagina gia'
  // parzialmente occupata da una sezione precedente (redesign PDF, sezione
  // 25: evitare pagine con spazio bianco eccessivo lasciando che i
  // capitoli si susseguano sulla stessa pagina quando c'e' posto, invece
  // di forzare sempre un'interruzione di pagina tra un capitolo e l'altro).
  isAtPageTop(): boolean {
    return this.y >= this.contentTop(this.currentChrome) - 0.5;
  }

  get pageCount(): number {
    return this.pages.length;
  }

  private wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
    const words = text.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  private clampLines(lines: string[], font: PDFFont, size: number, maxWidth: number, maxLines: number): string[] {
    if (lines.length <= maxLines) return lines;
    const clamped = lines.slice(0, maxLines);
    let last = clamped[maxLines - 1] ?? "";
    while (last.length > 0 && font.widthOfTextAtSize(`${last}…`, size) > maxWidth) {
      last = last.slice(0, -1).trimEnd();
    }
    clamped[maxLines - 1] = `${last}…`;
    return clamped;
  }

  /**
   * Riduce `value` a una singola riga (con ellissi se necessario) larga al
   * massimo `maxWidth`. Da usare ogni volta che un titolo va disegnato con
   * page.drawText() direttamente (dentro card la cui altezza e' gia' stata
   * misurata su un'unica riga): evita che un titolo insolitamente lungo
   * vada a capo per conto suo e trabocchi fuori dalla card (brief, sezione 12).
   */
  fitOneLine(value: string, font: PDFFont, size: number, maxWidth: number): string {
    return this.clampLines(this.wrapText(value, font, size, maxWidth), font, size, maxWidth, 1)[0] ?? "";
  }

  /** Altezza che occuperebbe `text()` con queste opzioni, senza disegnare nulla. */
  measure(value: string, opts: TextOptions = {}): number {
    const size = opts.size ?? 11;
    const font = this.font(opts.font);
    const maxWidth = opts.maxWidth ?? CONTENT_WIDTH;
    const lineHeight = size * (opts.lineHeightMult ?? 1.35);
    let lines = this.wrapText(value, font, size, maxWidth);
    if (opts.maxLines) lines = this.clampLines(lines, font, size, maxWidth, opts.maxLines);
    return lines.length * lineHeight + (opts.gap ?? 4);
  }

  text(value: string, opts: TextOptions = {}) {
    const size = opts.size ?? 11;
    const font = this.font(opts.font);
    const color = opts.color ?? COLOR.ink;
    const maxWidth = opts.maxWidth ?? CONTENT_WIDTH;
    const lineHeight = size * (opts.lineHeightMult ?? 1.35);
    const x = opts.x ?? MARGIN;

    let lines = this.wrapText(value, font, size, maxWidth);
    if (opts.maxLines) lines = this.clampLines(lines, font, size, maxWidth, opts.maxLines);

    for (const line of lines) {
      this.ensureSpace(lineHeight);
      const lineX =
        opts.align === "center" ? x + (maxWidth - font.widthOfTextAtSize(line, size)) / 2 : x;
      this.page.drawText(line, { x: lineX, y: this.y - size, size, font, color });
      this.y -= lineHeight;
    }
    this.y -= opts.gap ?? 4;
  }

  /** Testo con indentazione a bandiera (bullet/check): il glifo resta a `x`, il testo (e le righe successive) a `x + indent`. */
  hangingLine(glyph: string, value: string, opts: TextOptions & { indent?: number; glyphColor?: Color } = {}) {
    const size = opts.size ?? 10;
    const font = this.font(opts.font);
    const color = opts.color ?? COLOR.inkSoft;
    const indent = opts.indent ?? 14;
    const x = opts.x ?? MARGIN;
    const maxWidth = (opts.maxWidth ?? CONTENT_WIDTH) - indent;
    const lineHeight = size * (opts.lineHeightMult ?? 1.35);

    let lines = this.wrapText(value, font, size, maxWidth);
    if (opts.maxLines) lines = this.clampLines(lines, font, size, maxWidth, opts.maxLines);

    lines.forEach((line, i) => {
      this.ensureSpace(lineHeight);
      if (i === 0) {
        this.page.drawText(glyph, { x, y: this.y - size, size, font: this.fontBold, color: opts.glyphColor ?? color });
      }
      this.page.drawText(line, { x: x + indent, y: this.y - size, size, font, color });
      this.y -= lineHeight;
    });
    this.y -= opts.gap ?? 4;
  }

  divider(inset = 0) {
    this.ensureSpace(18);
    this.page.drawLine({
      start: { x: MARGIN + inset, y: this.y },
      end: { x: PAGE_WIDTH - MARGIN - inset, y: this.y },
      thickness: 0.75,
      color: COLOR.line,
    });
    this.y -= 16;
  }

  kicker(value: string, opts: { color?: Color } = {}) {
    this.text(value.toUpperCase(), { size: 8.5, font: "bold", color: opts.color ?? COLOR.accent, gap: 6 });
  }

  sectionTitle(title: string, opts: { subtitle?: string } = {}) {
    // Riserva spazio sufficiente per titolo + sottotitolo + un minimo di
    // contenuto a seguire, cosi' un capitolo non parte mai a ridosso del
    // fondo pagina. Se si sta continuando sulla stessa pagina di un
    // capitolo precedente (non in cima pagina), un divider marca
    // chiaramente l'inizio della nuova sezione invece di sprecare una
    // pagina quasi vuota (redesign PDF, sezione 25).
    this.ensureSpace(34 + (opts.subtitle ? 14 : 0) + 30);
    if (!this.isAtPageTop()) {
      this.y -= 4;
      this.divider();
      this.y -= 6;
    }
    this.text(title, { size: 17, font: "display", color: COLOR.ink, gap: opts.subtitle ? 2 : 10 });
    if (opts.subtitle) this.text(opts.subtitle, { size: 9.5, color: COLOR.inkSoft, gap: 12 });
  }

  // -----------------------------------------------------------------
  // Primitive vettoriali (rettangoli arrotondati, gauge circolare)
  // -----------------------------------------------------------------

  /**
   * Path SVG di un rettangolo arrotondato con origine locale nell'angolo
   * in alto a sinistra e asse Y verso il basso (convenzione SVG). Da
   * disegnare con drawSvgPath ancorato a (x, y + h) — vedi roundedRect().
   */
  private roundedRectPath(w: number, h: number, r: number): string {
    const radius = Math.min(r, w / 2, h / 2);
    return [
      `M ${radius} 0`,
      `H ${w - radius}`,
      `A ${radius} ${radius} 0 0 1 ${w} ${radius}`,
      `V ${h - radius}`,
      `A ${radius} ${radius} 0 0 1 ${w - radius} ${h}`,
      `H ${radius}`,
      `A ${radius} ${radius} 0 0 1 0 ${h - radius}`,
      `V ${radius}`,
      `A ${radius} ${radius} 0 0 1 ${radius} 0`,
      "Z",
    ].join(" ");
  }

  roundedRect(
    x: number,
    y: number,
    w: number,
    h: number,
    opts: { radius?: number; fill?: Color; border?: Color; borderWidth?: number } = {}
  ) {
    const path = this.roundedRectPath(w, h, opts.radius ?? 8);
    this.page.drawSvgPath(path, {
      x,
      y: y + h,
      color: opts.fill,
      borderColor: opts.border,
      borderWidth: opts.border ? opts.borderWidth ?? 1 : undefined,
    });
  }

  /**
   * Anello di avanzamento (score gauge). Autore il percorso in
   * convenzione SVG (Y verso il basso, 0° in alto, avanzamento orario) —
   * drawSvgPath applica internamente il flip verso lo spazio PDF, quindi
   * il risultato visivo corrisponde esattamente a quello di ScoreCircle
   * (il componente React equivalente).
   */
  ringGauge(opts: {
    cx: number;
    cy: number;
    radius: number;
    thickness: number;
    percent: number; // 0-100
    color: Color;
    trackColor?: Color;
  }) {
    const { cx, cy, radius, thickness, color } = opts;
    const trackColor = opts.trackColor ?? COLOR.line;
    const percent = Math.max(0, Math.min(100, opts.percent));

    // Binario di sfondo: cerchio completo.
    this.page.drawEllipse({
      x: cx,
      y: cy,
      xScale: radius,
      yScale: radius,
      borderColor: trackColor,
      borderWidth: thickness,
    });

    if (percent <= 0) return;

    const polar = (angleDeg: number) => {
      const rad = ((angleDeg - 90) * Math.PI) / 180;
      return { x: radius * Math.cos(rad), y: radius * Math.sin(rad) };
    };

    if (percent >= 99.9) {
      // Un arco pieno con inizio=fine e' un caso degenere in SVG: si
      // disegna come due semicerchi.
      const a = polar(0);
      const b = polar(180);
      const path = [
        `M ${a.x} ${a.y}`,
        `A ${radius} ${radius} 0 0 1 ${b.x} ${b.y}`,
        `A ${radius} ${radius} 0 0 1 ${a.x} ${a.y}`,
      ].join(" ");
      this.page.drawSvgPath(path, {
        x: cx,
        y: cy,
        borderColor: color,
        borderWidth: thickness,
        borderLineCap: LineCapStyle.Round,
      });
      return;
    }

    const endAngle = (percent / 100) * 360;
    const start = polar(0);
    const end = polar(endAngle);
    const largeArc = endAngle > 180 ? 1 : 0;
    const path = `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${end.x} ${end.y}`;

    this.page.drawSvgPath(path, {
      x: cx,
      y: cy,
      borderColor: color,
      borderWidth: thickness,
      borderLineCap: LineCapStyle.Round,
    });
  }

  /** Gauge con il punteggio scritto al centro (usato per hero score e mini-card). */
  scoreGauge(opts: {
    cx: number;
    cy: number;
    radius: number;
    thickness: number;
    score: number;
    label?: string;
    scoreSize?: number;
    labelSize?: number;
  }) {
    this.ringGauge({
      cx: opts.cx,
      cy: opts.cy,
      radius: opts.radius,
      thickness: opts.thickness,
      percent: opts.score,
      color: scoreColor(opts.score),
    });
    const scoreSize = opts.scoreSize ?? opts.radius * 0.62;
    const scoreText = String(Math.round(opts.score));
    const scoreWidth = this.fontDisplay.widthOfTextAtSize(scoreText, scoreSize);
    this.page.drawText(scoreText, {
      x: opts.cx - scoreWidth / 2,
      y: opts.cy - scoreSize * 0.32,
      size: scoreSize,
      font: this.fontDisplay,
      color: COLOR.ink,
    });
    if (opts.label) {
      const labelSize = opts.labelSize ?? 8;
      const labelWidth = this.fontRegular.widthOfTextAtSize(opts.label, labelSize);
      this.page.drawText(opts.label, {
        x: opts.cx - labelWidth / 2,
        y: opts.cy - scoreSize * 0.32 - labelSize - 4,
        size: labelSize,
        font: this.fontRegular,
        color: COLOR.inkSoft,
      });
    }
  }

  /** Pillola colorata (es. priorita'): restituisce la larghezza occupata. */
  pill(x: number, yTop: number, text: string, color: Color, soft: Color): number {
    const size = 8;
    const paddingX = 8;
    const height = 15;
    const width = this.fontBold.widthOfTextAtSize(text.toUpperCase(), size) + paddingX * 2;
    this.roundedRect(x, yTop - height, width, height, { radius: height / 2, fill: soft });
    this.page.drawText(text.toUpperCase(), {
      x: x + paddingX,
      y: yTop - height + (height - size) / 2 + 1,
      size,
      font: this.fontBold,
      color,
    });
    return width;
  }

  /**
   * Badge di gravita' prominente (redesign PDF, sezione 7: "il badge deve
   * essere immediatamente riconoscibile, non la parola dentro un
   * paragrafo"): piu' grande e pieno (non solo pillola soft) del pill()
   * generico, pensato per aprire ogni IssueCard. Restituisce la larghezza.
   */
  severityBadge(x: number, yTop: number, label: string, color: Color): number {
    const size = 8.5;
    const paddingX = 10;
    const height = 18;
    const text = label.toUpperCase();
    const width = this.fontBold.widthOfTextAtSize(text, size) + paddingX * 2;
    this.roundedRect(x, yTop - height, width, height, { radius: 4, fill: color });
    this.page.drawText(text, {
      x: x + paddingX,
      y: yTop - height + (height - size) / 2 + 1,
      size,
      font: this.fontBold,
      color: COLOR.white,
    });
    return width;
  }

  /**
   * Badge quadrato con 1-2 lettere (redesign PDF, sezione 6: "[ICONA] NOME
   * CATEGORIA"): sostituisce un'icona grafica vera, che pdf-lib non puo'
   * disegnare senza un asset esterno. Restituisce la larghezza (= altezza,
   * e' un quadrato).
   */
  monogramBadge(x: number, yTop: number, text: string, opts: { size?: number; fill?: Color; color?: Color } = {}): number {
    const box = opts.size ?? 30;
    const fontSize = box * 0.36;
    this.roundedRect(x, yTop - box, box, box, { radius: 8, fill: opts.fill ?? COLOR.accentSoft });
    const textWidth = this.fontBold.widthOfTextAtSize(text, fontSize);
    this.page.drawText(text, {
      x: x + (box - textWidth) / 2,
      y: yTop - box / 2 - fontSize * 0.36,
      size: fontSize,
      font: this.fontBold,
      color: opts.color ?? COLOR.accentDeep,
    });
    return box;
  }

  /**
   * Box elegante e compatto per metodologia/limitazioni (redesign PDF,
   * sezione 10/13/25: "MethodologyBox" riutilizzabile, mai un lungo
   * paragrafo che occupa il centro pagina). Ritorna l'altezza occupata.
   */
  calloutBox(
    kicker: string,
    text: string,
    opts: { fill?: Color; kickerColor?: Color; textColor?: Color; maxLines?: number } = {}
  ): number {
    const padding = 12;
    const innerWidth = CONTENT_WIDTH - padding * 2;
    const kickerH = 12;
    const textH = this.measure(text, { size: 8.5, maxWidth: innerWidth, lineHeightMult: 1.3, gap: 0, maxLines: opts.maxLines ?? 3 });
    const boxHeight = padding * 2 + kickerH + textH;

    this.ensureSpace(boxHeight + 8);
    const top = this.y;
    this.roundedRect(MARGIN, top - boxHeight, CONTENT_WIDTH, boxHeight, { radius: 9, fill: opts.fill ?? COLOR.paper, border: COLOR.line, borderWidth: 0.75 });
    this.y = top - padding;
    this.text(kicker.toUpperCase(), { size: 7.5, font: "bold", color: opts.kickerColor ?? COLOR.inkSoft, x: MARGIN + padding, maxWidth: innerWidth, gap: 4 });
    this.text(text, { size: 8.5, color: opts.textColor ?? COLOR.inkSoft, x: MARGIN + padding, maxWidth: innerWidth, gap: 0, lineHeightMult: 1.3, maxLines: opts.maxLines ?? 3 });
    this.y = top - boxHeight - 10;
    return boxHeight;
  }

  /**
   * Tabella semplice a 2 colonne (redesign PDF, sezione 14: Security
   * Headers come vera tabella HEADER/STATO, non un paragrafo). Colonna
   * destra allineata a destra con un badge di stato colorato.
   */
  keyValueTable(rows: { label: string; value: string; valueColor?: Color; valueSoft?: Color }[]) {
    const rowHeight = 22;
    const tableHeight = rows.length * rowHeight;
    this.ensureSpace(tableHeight + 8);
    const top = this.y;
    this.roundedRect(MARGIN, top - tableHeight, CONTENT_WIDTH, tableHeight, { radius: 8, fill: COLOR.white, border: COLOR.line, borderWidth: 0.75 });

    rows.forEach((row, i) => {
      const rowTop = top - i * rowHeight;
      if (i > 0) {
        this.page.drawLine({ start: { x: MARGIN, y: rowTop }, end: { x: MARGIN + CONTENT_WIDTH, y: rowTop }, thickness: 0.5, color: COLOR.line });
      }
      this.page.drawText(row.label, { x: MARGIN + 14, y: rowTop - rowHeight / 2 - 3.5, size: 9, font: this.fontRegular, color: COLOR.ink });
      if (row.valueColor) {
        const pillW = this.fontBold.widthOfTextAtSize(row.value.toUpperCase(), 7.5) + 16;
        this.roundedRect(MARGIN + CONTENT_WIDTH - 14 - pillW, rowTop - rowHeight / 2 - 7, pillW, 14, { radius: 7, fill: row.valueSoft ?? row.valueColor });
        this.page.drawText(row.value.toUpperCase(), {
          x: MARGIN + CONTENT_WIDTH - 14 - pillW + 8,
          y: rowTop - rowHeight / 2 - 3,
          size: 7.5,
          font: this.fontBold,
          color: row.valueColor,
        });
      } else {
        const valueWidth = this.fontBold.widthOfTextAtSize(row.value, 9);
        this.page.drawText(row.value, { x: MARGIN + CONTENT_WIDTH - 14 - valueWidth, y: rowTop - rowHeight / 2 - 3.5, size: 9, font: this.fontBold, color: COLOR.ink });
      }
    });

    this.y = top - tableHeight - 10;
  }

  footer(): void {
    // Il vero footer viene disegnato da stampChrome() a fine documento
    // (serve conoscere il totale pagine). Metodo mantenuto per API
    // simmetria con newPage(), intenzionalmente vuoto.
  }

  /**
   * Applica header/footer/numero pagina a tutte le pagine marcate
   * `chrome: true` (brief, sezione 11). Va chiamato una sola volta, a
   * generazione del contenuto completata.
   */
  stampChrome(brandLine: string, headerLine: string) {
    const chromePages = this.pages.filter((p) => p.chrome);
    const total = chromePages.length;
    chromePages.forEach((p, i) => {
      const { page } = p;
      // Header
      page.drawText(headerLine, {
        x: MARGIN,
        y: PAGE_HEIGHT - MARGIN + 4,
        size: 8.5,
        font: this.fontBold,
        color: COLOR.accent,
      });
      page.drawLine({
        start: { x: MARGIN, y: PAGE_HEIGHT - MARGIN - 8 },
        end: { x: PAGE_WIDTH - MARGIN, y: PAGE_HEIGHT - MARGIN - 8 },
        thickness: 0.75,
        color: COLOR.line,
      });
      // Footer
      page.drawLine({
        start: { x: MARGIN, y: MARGIN + FOOTER_BAND - 14 },
        end: { x: PAGE_WIDTH - MARGIN, y: MARGIN + FOOTER_BAND - 14 },
        thickness: 0.75,
        color: COLOR.line,
      });
      page.drawText(brandLine, {
        x: MARGIN,
        y: MARGIN + FOOTER_BAND - 28,
        size: 8,
        font: this.fontRegular,
        color: COLOR.inkSoft,
      });
      const pageLabel = `${String(i + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`;
      const pageLabelWidth = this.fontRegular.widthOfTextAtSize(pageLabel, 8);
      page.drawText(pageLabel, {
        x: PAGE_WIDTH - MARGIN - pageLabelWidth,
        y: MARGIN + FOOTER_BAND - 28,
        size: 8,
        font: this.fontRegular,
        color: COLOR.inkSoft,
      });
    });
  }

  async save(): Promise<Uint8Array> {
    return this.doc.save();
  }
}
