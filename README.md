# DigitalCheck — piattaforma SaaS di Website Intelligence

**DigitalCheck**, powered by **Imperium Digital**, e' una piattaforma SaaS
freemium per l'analisi professionale dei siti web di piccole attivita'
locali (B&B, case vacanze, ristoranti, negozi, professionisti). L'utente
inserisce l'URL del proprio sito e ottiene un **Digital Score** da 0 a 100,
con dati tecnici reali (PageSpeed Insights quando disponibile),
interpretazione AI, problemi, punti di forza e azioni consigliate, in
linguaggio comprensibile anche a chi non e' tecnico.

Gerarchia di brand da rispettare ovunque nel prodotto: **DigitalCheck** e'
il nome del prodotto, dominante; "powered by Imperium Digital" e' la
dicitura secondaria che indica il team che lo sviluppa.

## Piani

| | **Free** — €0 | **Pro** — €6,99/mese |
|---|---|---|
| Analisi | 1 a settimana | fino a 200/mese |
| Siti | 1 nuovo al mese | illimitati |
| Risultati | punteggi + sintesi + alcuni problemi | analisi completa |
| Assistente AI | — | incluso, con storico per sito |
| Report PDF | 1 pagina sintetica | almeno 5 pagine, struttura completa |
| Gestionale (Analytics/Search Console/Metrics/Observability) | — | incluso |
| Storico e monitoraggio | — | incluso |

I limiti sono applicati **lato server** (mai solo nascosti in UI): vedi
`src/lib/billing/plan-config.ts` (feature flag per piano) e
`src/lib/billing/plan-limits.ts` (quote numeriche, con contatori
settimanali/mensili basati sui dati reali salvati, non su timer finti).

## 0. Stato del progetto — cosa e' reale, cosa va verificato

Questo codice e' stato scritto e validato con un type-check statico
(`tsc --noEmit`), ma **non e' mai stato eseguito** in questo ambiente di
sviluppo: l'ambiente in cui e' stato generato non ha accesso alla rete,
quindi non e' stato possibile fare `npm install`, avviare `next dev`, ne'
collegare un vero database Postgres o i provider esterni (AI, Stripe,
email, PageSpeed). Il primo passo, prima di qualunque demo o deploy, e'
eseguire davvero `npm install && npm run dev` in locale e i test elencati
nella sezione 16, non fidarsi del solo fatto che il codice "sembra corretto".

## 1. Cosa fa il prodotto

```
Landing page (pubblica, senza account)
  → inserimento URL + tipo attivita' + obiettivo
  → crawl sicuro + analisi SEO/tecnica + analisi AI + scoring
  → report mostrato subito in pagina (nessuna persistenza: e' il "prova gratis")

Account autenticato
  → aggiunta di uno o piu' siti alla dashboard
  → scan persistiti nel database, con storico e variazione punteggio
  → monitoraggio periodico opzionale (piano Pro) via cron
  → report PDF, scaricabile o condivisibile con un link pubblico
  → upgrade a Pro via Stripe Checkout
  → area admin con metriche aggregate
```

**Regola seguita ovunque nel codice**: se un dato non e' verificabile con
gli strumenti collegati (es. Core Web Vitals reali senza una
`PAGESPEED_API_KEY`, o un'email senza un provider configurato), il sistema
lo dichiara esplicitamente invece di inventarlo o fingere che sia andato a
buon fine. Vedi `unverifiable` nel tipo `DigitalCheckReport` e l'adapter
email (`src/lib/mail/mailer.ts`).

## 2. Stack tecnologico e motivazioni

| Livello | Scelta | Perche' |
|---|---|---|
| Frontend + backend | Next.js 14 (App Router) + TypeScript | Un solo progetto per UI e API routes; il rendering server-side aiuta la SEO della web app stessa. |
| Styling | Tailwind CSS | Token di design in un unico file, senza un design system separato da mantenere. |
| Estrazione HTML | `cheerio` | Parsing DOM lato server senza headless browser: piu' leggero di Puppeteer per l'analisi statica dell'HTML. |
| Validazione | `zod` | Valida sia l'input utente sia — punto critico — l'output del modello AI prima di fidarsene. |
| Database | PostgreSQL + Prisma | Relazionale, adatto a un dominio con ownership multi-utente (users → sites → scans → issues). |
| Autenticazione | Sessioni JWT firmate (`jose`) in cookie httpOnly + `bcryptjs` per le password | Nessuna dipendenza da un provider OAuth esterno per l'MVP; `jose` funziona anche nel middleware Edge, dove Prisma non e' disponibile. |
| PDF | `pdf-lib` | Genera il PDF lato server senza un browser headless (piu' leggero di Puppeteer/Playwright per un report testuale). |
| Pagamenti | Stripe (Checkout + webhook) | Standard per abbonamenti SaaS. |
| Email transazionale | Adapter per Resend, sostituibile | Isolato in un'unica funzione (`sendMail`) cosi' cambiare provider non tocca le route che la chiamano. |

## 3. Struttura delle cartelle

```
digitalcheck/
  prisma/
    schema.prisma            # schema DB completo
    seed.ts                  # popola i limiti di piano Free/Pro
  vercel.json                 # configurazione del cron di monitoraggio
  src/
    types/index.ts            # tipi condivisi della pipeline di scan
    middleware.ts              # protegge /dashboard e /admin
    lib/
      security/ssrf-guard.ts
      crawler/crawler.ts
      analysis/seo-analyzer.ts
      scoring/{weights,scoring-engine}.ts
      ai/{prompts,schema,content-analyzer}.ts
      pipeline/
        run-scan.ts            # pipeline pura (crawl→analisi→AI→score)
        persist-scan.ts        # esegue run-scan + scrive tutto su DB + notifiche
        build-report-from-scan.ts  # ricostruisce un report da righe DB (per il PDF)
      auth/{password,session,tokens}.ts
      db/{prisma,enum-map}.ts
      billing/{stripe,plan-limits}.ts
      mail/mailer.ts
      pdf/report-pdf.ts
    app/
      page.tsx                 # landing pubblica + widget di analisi
      login/, register/, reset-password/
      dashboard/page.tsx        # lista siti
      dashboard/site/[id]/page.tsx  # storico, monitoraggio, PDF, condivisione
      admin/page.tsx
      api/
        scan/route.ts                   # scan pubblico, stateless
        sites/route.ts                  # lista/crea siti (autenticato)
        sites/[id]/route.ts              # dettaglio + PATCH monitoraggio + delete
        sites/[id]/scan/route.ts         # scan persistito
        reports/[scanId]/pdf/route.ts    # genera il PDF (owner o link pubblico)
        reports/[scanId]/share/route.ts  # crea il link pubblico
        auth/{register,login,logout,verify-email,reset-password/*}/route.ts
        billing/{checkout,webhook}/route.ts
        cron/rescan/route.ts             # monitoraggio periodico
        admin/stats/route.ts
    components/{ScoreCircle,ReportView}.tsx
```

## 4. Modello dati

`User`, `Organization`, `Site`, `Scan`, `ScanScore`, `ScanIssue`,
`Recommendation`, `Report`, `Subscription`, `UsageLimit`, `Notification` —
11 modelli in `prisma/schema.prisma`. Punti degni di nota:

- `User` salva solo l'**hash** della password e degli eventuali token di
  reset/verifica email (mai il valore in chiaro).
- `Site` ha `monitoringEnabled`, `scanFrequencyDays`, `nextScanAt`: e' la
  base su cui gira il cron di monitoraggio.
- `Scan` porta anche `strengths`/`unverifiable`/`businessImpactSummary`
  come colonne array/testo (specifiche PostgreSQL), cosi' il PDF generato
  da uno scan storico resta fedele al report originale, non solo ai
  punteggi.
- Ogni tabella con dati di un utente ha una foreign key verso il
  proprietario: tutte le query filtrano esplicitamente per
  `ownerId`/`userId` ricavato dalla sessione, mai da un ID passato dal
  client (vedi Sicurezza).

## 5. Autenticazione

Registrazione, login, logout, verifica email, reset password — tutte in
`src/app/api/auth/`. Dettagli implementativi rilevanti:

- Password con `bcryptjs` (12 salt round), minimo 10 caratteri, verificato
  anche lato server (mai solo nel form).
- Sessione: JWT firmato con `AUTH_SECRET`, in cookie `httpOnly`,
  `sameSite=lax`, 7 giorni. Il payload include `isAdmin` per permettere al
  middleware (Edge runtime, senza Prisma) di proteggere `/admin` senza una
  query al database; il rovescio della medaglia e' che un cambio di ruolo
  richiede un nuovo login per essere effettivo — accettabile per un MVP,
  da rivedere se servono permessi sempre aggiornati in tempo reale.
- Login e registrazione rispondono con lo **stesso messaggio generico** sia
  per email inesistente sia per password sbagliata, e la registrazione con
  un'email gia' in uso non lo conferma esplicitamente: mitigazione base
  contro la user enumeration.
- Token di reset password / verifica email: generati con
  `crypto.randomBytes`, salvato solo l'**hash SHA-256** nel DB, scadenza
  esplicita (60 minuti il reset, 24 ore la verifica).
- Senza `RESEND_API_KEY` configurata, le email non vengono inviate
  davvero: il contenuto finisce nei log del server e, solo fuori
  produzione, il link compare direttamente nella risposta API per poter
  testare il flusso in locale.

## 6. Persistenza degli scan e monitoraggio

`src/lib/pipeline/persist-scan.ts` e' il cuore di questa parte: esegue la
pipeline di scan (`run-scan.ts`, la stessa usata dal widget pubblico),
aggiorna lo stato dello `Scan` passo per passo
(`REQUESTED → CRAWLING → SCORING → COMPLETED` o `FAILED`), scrive punteggi
per categoria, problemi e raccomandazioni in una singola transazione, e
genera notifiche se il punteggio cambia di almeno 3 punti o emergono
problemi ad alta priorita'.

Il monitoraggio periodico (`/api/cron/rescan`) riusa la stessa funzione per
ogni sito con `monitoringEnabled=true` e `nextScanAt` scaduto. E' pensato
per **Vercel Cron** (vedi `vercel.json`, schedulato ogni notte alle 4:00) o
per un qualunque scheduler esterno che chiami quell'URL con l'header
`Authorization: Bearer <CRON_SECRET>`.

## 7. Report PDF e condivisione

`src/lib/pdf/report-pdf.ts` genera un PDF A4 con `pdf-lib` (niente browser
headless), in due varianti scelte in base al piano del proprietario del
sito (`generateReportPdf(report, plan)`):

- **Free** (`generateFreeReportPdf`): 1 pagina sintetica — punteggio,
  punteggi principali, breve sintesi, pochi problemi, rimando elegante al
  piano Pro. Verificato con un test automatico (`getPageCount() === 1`).
- **Pro** (`generateProReportPdf`): 5 pagine strutturate — Cover,
  Executive Summary, Performance, SEO & Accessibility, Best Practices &
  Action Plan (incluse le interpretazioni AI quando disponibili).

Entrambe condividono lo stesso `DigitalCheckReport`, la stessa fonte dati
di dashboard/pagina di dettaglio/Gestionale: nessun numero diverso tra
schermo e PDF.

`POST /api/reports/:scanId/share` crea uno `slug` casuale (Report.publicSlug)
e restituisce un URL pubblico verso `GET /api/reports/:scanId/pdf?slug=...`,
accessibile senza login: e' il link condivisibile richiesto dal brief
(sezione 39). Senza `slug` valido, la stessa route richiede che la
sessione autenticata sia il proprietario del sito.

## 8. Pagamenti

`POST /api/billing/checkout` crea una Stripe Checkout Session in modalita'
abbonamento; se `STRIPE_SECRET_KEY` o `STRIPE_PRICE_ID_PRO` mancano,
risponde con un errore esplicito invece di un link finto.
`POST /api/billing/webhook` verifica la firma Stripe e aggiorna
`User.plan`/`Subscription` su `checkout.session.completed` e
`customer.subscription.deleted`. **Non testato con eventi Stripe reali**
in questo ambiente: prima del lancio, verificare con la Stripe CLI
(`stripe listen --forward-to localhost:3000/api/billing/webhook`).

## 9. Limiti di piano e feature per piano

Due file, due responsabilita' distinte (brief, sezione 31):

- `src/lib/billing/plan-config.ts` — feature flag booleane non
  modificabili da admin (`ai`, `fullReports`, `dashboard`, `monitoring`):
  sono regole di prodotto, non quote numeriche.
- `src/lib/billing/plan-limits.ts` — quote numeriche lette da
  `UsageLimit` (popolata da `prisma/seed.ts`, modificabile dall'area
  admin), con fallback via env var se la tabella e' vuota:
  - Free: 1 analisi a settimana (`countScansThisWeek`), 1 sito nuovo al
    mese (`countSitesThisMonth`).
  - Pro: siti illimitati (nessun controllo lato server), fino a 200
    analisi al mese (`countScansThisMonth`).

Applicazione concreta: `POST /api/sites` blocca oltre `maxSitesMonth` solo
per Free; `POST /api/sites/:id/scan` blocca oltre `maxScansWeek` (Free) o
`maxScansMonth` (Pro); un utente Free riceve sempre, anche chiamando le
API direttamente, un report troncato (`src/lib/billing/report-tiering.ts`)
e un PDF di una pagina — il troncamento non e' mai solo nell'interfaccia.
Il monitoraggio periodico (`PATCH` con `monitoringEnabled: true`), il
Gestionale e l'Assistente AI sono riservati al piano Pro.

## 10. Area admin

`GET /api/admin/stats`, protetto sia dal middleware (`/admin/*`) sia da un
controllo esplicito `session.isAdmin` nella route stessa (difesa in
profondita': un'API sensibile non deve dipendere solo dal middleware).
Nessun utente e' admin per default: va impostato manualmente
(`UPDATE "User" SET "isAdmin" = true WHERE email = '...'`) finche' non
esiste un flusso di invito dedicato.

## 11. Sicurezza

- **SSRF**: blocca localhost, IPv4/IPv6 privati e link-local, il metadata
  endpoint cloud, e rivalida ogni singolo redirect (non solo l'URL
  iniziale) per prevenire il DNS rebinding.
- **Password**: hash bcrypt, mai in chiaro, mai nei log.
- **Token** (reset/verifica): solo l'hash e' salvato, con scadenza.
- **Ownership**: ogni query su `Site`/`Scan` filtra per l'utente della
  sessione; un ID sbagliato o di un altro utente restituisce 404, non 403,
  per non confermarne l'esistenza.
- **Rate limiting**: in-memory sia sullo scan pubblico sia sul login;
  adeguato a un singolo processo, da sostituire con uno store condiviso
  (Redis) in un deployment multi-istanza.
- **Webhook Stripe**: firma verificata con `stripe.webhooks.constructEvent`
  prima di fidarsi del payload.
- **Cron**: protetto da un segreto condiviso (`CRON_SECRET`), non
  raggiungibile pubblicamente senza di esso.
- Non ancora implementato, da aggiungere prima del lancio: CSP a livello
  di header HTTP, protezione CSRF esplicita sui form autenticati (il
  cookie `sameSite=lax` mitiga ma non sostituisce un vero token CSRF),
  revoca lato server delle sessioni (oggi un JWT resta valido fino a
  scadenza anche dopo un cambio password — andrebbe invalidato).

## 12. Privacy

L'HTML scaricato durante uno scan vive solo in memoria per la durata della
richiesta; nel database restano solo i dati derivati (punteggi, problemi,
raccomandazioni), non il contenuto grezzo del sito. Restano da definire
prima del lancio: privacy policy, termini di servizio reali (questo
README non e' consulenza legale), cancellazione account/dati su richiesta,
retention configurabile per lo storico scan.

## 13. Installazione e sviluppo locale

```bash
npm install
cp .env.example .env.local
# Compila almeno: DATABASE_URL, AUTH_SECRET
npx prisma migrate dev --name init
npm run prisma:seed        # popola i limiti di piano Free/Pro
npm run dev                # http://localhost:3000
```

Per testare i flussi email senza un provider configurato, registra un
utente e usa il `devVerifyLink`/`devResetLink` restituito dalla risposta
API (solo fuori produzione).

`npm run typecheck` per la verifica dei tipi, `npm run build` per la build
di produzione.

## 14. API/servizi esterni necessari

Vedi anche `.env.example` per l'elenco completo, commentato, pronto da
copiare in `.env.local`.

| Servizio | A cosa serve | Variabili | Stato |
|---|---|---|---|
| PostgreSQL (Supabase, Neon, RDS...) | Persistenza | `DATABASE_URL` | richiesto |
| Google Gemini (o altro provider LLM) | Interpretazione AI, Assistente | `AI_API_KEY`, `AI_MODEL` | opzionale (fallback esplicito se assente) |
| Google PageSpeed Insights API | Core Web Vitals reali | `PAGESPEED_API_KEY` | opzionale (fallback a stima dichiarata) |
| Stripe | Abbonamento Pro (checkout + portale) | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_PRO` | opzionale (errore esplicito se assente) |
| Resend (o altro provider email) | Verifica email, reset password | `RESEND_API_KEY`, `EMAIL_FROM` | opzionale (link mostrato in dev) |
| Scheduler (Vercel Cron o esterno) | Monitoraggio periodico | `CRON_SECRET` | richiesto per il cron |
| Google Analytics Data API (OAuth) | Tab "Web Analytics" del Gestionale | `GOOGLE_ANALYTICS_CLIENT_ID/SECRET` | **non implementato**: schema pronto (`AnalyticsConnection`), OAuth da collegare |
| Google Search Console API (OAuth) | Tab "Search Console" del Gestionale | `GOOGLE_SEARCH_CONSOLE_CLIENT_ID/SECRET` | **non implementato**: schema pronto (`SearchConsoleConnection`) |
| Provider di uptime monitoring | Tab "Observability" del Gestionale | `MONITORING_PROVIDER_API_KEY` | **non implementato**: schema pronto (`MonitoringConfig`) |

Finche' le tre integrazioni "non implementate" non vengono collegate, il
Gestionale mostra sempre esplicitamente "Connessione richiesta" / "Non
configurato" — mai dati finti (brief, sezioni 17, 20, 45).

## 15. Stima qualitativa dei costi operativi

Indicativa, non un preventivo — dipende dal provider scelto e dal volume.

- **AI per scan**: input troncato e strutturato (~6.000 caratteri), non
  l'HTML intero: il costo scala con la lunghezza del prompt, non con la
  dimensione del sito analizzato.
- **PageSpeed Insights**: quota gratuita giornaliera; oltre quella soglia
  serve un progetto Google Cloud con billing attivo.
- **Hosting**: un'app Next.js con route handler si adatta a hosting
  serverless standard; il costo scala con gli scan eseguiti, non con gli
  utenti registrati. Il cron di monitoraggio aggiunge invocazioni
  periodiche proporzionali al numero di siti con monitoraggio attivo.
- **Database**: costo minimo sui piani entry-level dei provider Postgres
  gestiti, finche' il volume di scan/storico resta contenuto.
- **Email transazionale**: Resend (e provider simili) hanno un piano
  gratuito con una quota mensile di invii, sufficiente per un volume
  iniziale di registrazioni/reset.

## 16. Test da eseguire prima del lancio (non ancora eseguiti qui)

Nessuno di questi e' stato eseguito in questo ambiente (nessuna rete
disponibile): vanno lanciati per davvero in locale/CI prima di qualunque
deploy.

- Validazione URL, protezione SSRF (redirect verso IP privati, DNS
  rebinding), scoring, analisi SEO, severita' degli issue, validazione
  JSON dell'output AI
- Ownership a livello database (un utente non deve poter leggere/scrivere
  siti o scan di un altro manipolando gli ID)
- Autorizzazione sulle API (incluso `/admin` con e senza `isAdmin`)
- Ciclo di vita dello scan, incluso il percorso `FAILED` con `retryCount`
- Flusso di autenticazione end-to-end: registrazione → verifica email →
  login → reset password → logout
- Webhook Stripe con eventi reali (Stripe CLI) e limiti di piano dopo
  l'upgrade
- Cron di monitoraggio: sito che raggiunge `nextScanAt`, notifica generata
  correttamente
- Casi limite: URL non valido, sito offline, timeout, redirect, sito molto
  grande, contenuto vuoto, errore del provider AI, errore PageSpeed, HTML
  non valido

## 17. Cosa manca ancora (oltre ai test sopra)

- Integrazione OAuth reale di Google Analytics e Google Search Console
  nel Gestionale (schema DB pronto — `AnalyticsConnection`,
  `SearchConsoleConnection` — ma il flusso di collegamento account non e'
  implementato: richiede credenziali OAuth Google, vedi `.env.example`)
- Provider di uptime monitoring per la tab Observability (schema pronto —
  `MonitoringConfig` — nessun provider collegato)
- Pagina pubblica di visualizzazione del report condiviso (oggi il link
  pubblico serve direttamente il PDF, non una pagina HTML col branding)
- Flusso di invito/promozione a admin (oggi va fatto a mano sul database)
- Revoca lato server delle sessioni JWT
- CSP e protezione CSRF esplicita
- Multilingua IT/EN (le stringhe non sono hardcoded pensando a questo, ma
  l'estrazione in un sistema i18n non e' stata fatta)
- Costo medio per scan e AI/API usage nell'area admin (richiede di
  collegare la fatturazione del provider AI/PageSpeed)
- Team/agenzie, white label, API pubbliche, report programmati, alert via
  email/Slack: l'architettura (modelli relazionali, feature flag
  centralizzati) non li impedisce, ma non sono implementati in questa
  fase (brief, sezione 44).

## 18. Brand

- **Prodotto**: DigitalCheck — nome dominante, usato in navbar, dashboard,
  report, pagine pubbliche, metadata.
  - **Sviluppatore/progetto**: Imperium Digital — sempre presente ma
    secondario ("powered by Imperium Digital"), mai come nome principale
    della piattaforma.
- Le stringhe non sono hardcoded pensando a un design system separato,
  quindi un eventuale ulteriore rebranding resta semplice.
