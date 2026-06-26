import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { db } from './index';
import { licBooks, licCampaigns, licStudents, type NewLicBook, type NewLicStudent } from './schema';

type SeedData = {
  campaign: { name: string; academicYear: string; orderDeadline: string };
  books: Omit<NewLicBook, 'id' | 'campaignId' | 'createdAt'>[];
  students: Omit<NewLicStudent, 'id' | 'campaignId' | 'createdAt'>[];
};

async function main() {
  const file = join(process.cwd(), 'src/db/data/licencias-2026.json');
  const data = JSON.parse(readFileSync(file, 'utf-8')) as SeedData;

  // Campaña (idempotente por academicYear)
  let campaign = await db.query.licCampaigns.findFirst({
    where: eq(licCampaigns.academicYear, data.campaign.academicYear),
  });
  if (!campaign) {
    [campaign] = await db
      .insert(licCampaigns)
      .values({ ...data.campaign, status: 'draft' })
      .returning();
    console.log('Campaña creada:', campaign.name);
  } else {
    console.log('Campaña ya existía:', campaign.name);
  }
  const campaignId = campaign.id;

  // Libros
  console.log(`Insertando ${data.books.length} libros...`);
  await db
    .insert(licBooks)
    .values(data.books.map((b) => ({ ...b, campaignId })))
    .onConflictDoNothing();

  // Alumnos (en lotes)
  console.log(`Insertando ${data.students.length} alumnos...`);
  const chunk = 200;
  for (let i = 0; i < data.students.length; i += chunk) {
    await db
      .insert(licStudents)
      .values(data.students.slice(i, i + chunk).map((s) => ({ ...s, campaignId })))
      .onConflictDoNothing();
  }

  console.log('Import completado.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Error en el import de licencias:', err);
  process.exit(1);
});
