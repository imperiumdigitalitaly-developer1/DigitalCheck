import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Free: 1 analisi a settimana, 1 sito nuovo al mese (vedi
  // src/lib/billing/plan-config.ts per la definizione centrale). maxSites
  // resta come tetto di sicurezza legacy, non e' il vincolo principale.
  await prisma.usageLimit.upsert({
    where: { plan: "FREE" },
    create: { plan: "FREE", maxSites: 12, maxScansMonth: 4, maxPagesScan: 5, maxScansWeek: 1, maxSitesMonth: 1 },
    update: { maxSites: 12, maxScansMonth: 4, maxPagesScan: 5, maxScansWeek: 1, maxSitesMonth: 1 },
  });

  // Pro: siti illimitati (applicato in codice, non da maxSites), fino a
  // 200 analisi al mese.
  await prisma.usageLimit.upsert({
    where: { plan: "PRO" },
    create: { plan: "PRO", maxSites: 999999, maxScansMonth: 200, maxPagesScan: 20, maxScansWeek: null, maxSitesMonth: null },
    update: { maxSites: 999999, maxScansMonth: 200, maxPagesScan: 20, maxScansWeek: null, maxSitesMonth: null },
  });

  console.log("Seed completato: limiti Free/Pro impostati.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
