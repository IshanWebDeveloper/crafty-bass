/**
 * Seeds the marketplace taxonomy: ServiceCategory + Skill rows with EN/SI/TA
 * labels so the job-posting form and category browse have real options.
 * Idempotent — safe to re-run (upserts by slug).
 *
 * Run: `pnpm --filter @repo/db db:seed` (loads apps/backend/.env via dotenv).
 *
 * Note: si/ta labels are best-effort and should be reviewed by a native speaker.
 */
import { prisma } from '../src/index.js';

type SkillSeed = {
  slug: string;
  nameEn: string;
  nameSi: string;
  nameTa: string;
};

type CategorySeed = {
  slug: string;
  nameEn: string;
  nameSi: string;
  nameTa: string;
  skills: SkillSeed[];
};

const categories: CategorySeed[] = [
  {
    slug: 'plumbing',
    nameEn: 'Plumbing',
    nameSi: 'ජල නල වැඩ',
    nameTa: 'குழாய் பணி',
    skills: [
      {
        slug: 'plumbing-leak-repair',
        nameEn: 'Leak repair',
        nameSi: 'කාන්දු අලුත්වැඩියාව',
        nameTa: 'கசிவு பழுதுபார்ப்பு',
      },
      {
        slug: 'plumbing-boiler-service',
        nameEn: 'Boiler service',
        nameSi: 'උණුජල යන්ත්‍ර සේවාව',
        nameTa: 'கொதிகலன் சேவை',
      },
      {
        slug: 'plumbing-drain-unblocking',
        nameEn: 'Drain unblocking',
        nameSi: 'බැස්ම ඉවත් කිරීම',
        nameTa: 'வடிகால் அடைப்பு நீக்கம்',
      },
      {
        slug: 'plumbing-fittings',
        nameEn: 'Taps & fittings',
        nameSi: 'කරාම සහ උපාංග',
        nameTa: 'குழாய்கள் & பொருத்துதல்',
      },
    ],
  },
  {
    slug: 'electrical',
    nameEn: 'Electrical',
    nameSi: 'විදුලි වැඩ',
    nameTa: 'மின் பணி',
    skills: [
      {
        slug: 'electrical-wiring',
        nameEn: 'Wiring & rewiring',
        nameSi: 'වයරින් සහ නැවත වයරින්',
        nameTa: 'கம்பி அமைப்பு',
      },
      {
        slug: 'electrical-sockets',
        nameEn: 'Sockets & switches',
        nameSi: 'සොකට් සහ ස්විච',
        nameTa: 'சாக்கெட்டுகள் & சுவிட்சுகள்',
      },
      {
        slug: 'electrical-lighting',
        nameEn: 'Lighting install',
        nameSi: 'ආලෝක ස්ථාපනය',
        nameTa: 'விளக்கு பொருத்தல்',
      },
      {
        slug: 'electrical-safety',
        nameEn: 'Safety inspection',
        nameSi: 'ආරක්ෂණ පරීක්ෂණය',
        nameTa: 'பாதுகாப்பு ஆய்வு',
      },
    ],
  },
  {
    slug: 'carpentry',
    nameEn: 'Carpentry',
    nameSi: 'වඩු වැඩ',
    nameTa: 'தச்சு வேலை',
    skills: [
      {
        slug: 'carpentry-doors-windows',
        nameEn: 'Doors & windows',
        nameSi: 'දොර සහ ජනේල',
        nameTa: 'கதவுகள் & ஜன்னல்கள்',
      },
      {
        slug: 'carpentry-flooring',
        nameEn: 'Flooring',
        nameSi: 'බිම් ඇතිරීම',
        nameTa: 'தரை அமைப்பு',
      },
      {
        slug: 'carpentry-furniture',
        nameEn: 'Custom furniture',
        nameSi: 'අභිරුචි ගෘහ භාණ්ඩ',
        nameTa: 'தனிப்பயன் தளபாடங்கள்',
      },
      {
        slug: 'carpentry-cabinets',
        nameEn: 'Cabinet fitting',
        nameSi: 'කැබිනට් සවි කිරීම',
        nameTa: 'அலமாரி பொருத்தல்',
      },
    ],
  },
  {
    slug: 'painting',
    nameEn: 'Painting',
    nameSi: 'තීන්ත ආලේපනය',
    nameTa: 'வர்ணம் பூசுதல்',
    skills: [
      {
        slug: 'painting-interior',
        nameEn: 'Interior painting',
        nameSi: 'අභ්‍යන්තර තීන්ත ආලේපනය',
        nameTa: 'உட்புற வர்ணம்',
      },
      {
        slug: 'painting-exterior',
        nameEn: 'Exterior painting',
        nameSi: 'බාහිර තීන්ත ආලේපනය',
        nameTa: 'வெளிப்புற வர்ணம்',
      },
      {
        slug: 'painting-wall-prep',
        nameEn: 'Wall preparation',
        nameSi: 'බිත්ති සකස් කිරීම',
        nameTa: 'சுவர் தயாரிப்பு',
      },
    ],
  },
  {
    slug: 'masonry',
    nameEn: 'Masonry',
    nameSi: 'පදික වැඩ',
    nameTa: 'கொத்து வேலை',
    skills: [
      {
        slug: 'masonry-bricklaying',
        nameEn: 'Bricklaying',
        nameSi: 'ගඩොල් බැඳීම',
        nameTa: 'செங்கல் அடுக்குதல்',
      },
      {
        slug: 'masonry-plastering',
        nameEn: 'Plastering',
        nameSi: 'බදාම ආලේපනය',
        nameTa: 'பூச்சு வேலை',
      },
      {
        slug: 'masonry-tiling',
        nameEn: 'Tiling',
        nameSi: 'උළු ඇතිරීම',
        nameTa: 'ஓடு பதித்தல்',
      },
    ],
  },
  {
    slug: 'cleaning',
    nameEn: 'Cleaning',
    nameSi: 'පිරිසිදු කිරීම',
    nameTa: 'சுத்தம் செய்தல்',
    skills: [
      {
        slug: 'cleaning-deep',
        nameEn: 'Deep cleaning',
        nameSi: 'ගැඹුරු පිරිසිදු කිරීම',
        nameTa: 'ஆழ்ந்த சுத்தம்',
      },
      {
        slug: 'cleaning-move-out',
        nameEn: 'Move-out cleaning',
        nameSi: 'පිටවීමේ පිරිසිදු කිරීම',
        nameTa: 'வெளியேறும் சுத்தம்',
      },
    ],
  },
];

async function main() {
  let categoryCount = 0;
  let skillCount = 0;

  for (const cat of categories) {
    const category = await prisma.serviceCategory.upsert({
      where: { slug: cat.slug },
      update: { nameEn: cat.nameEn, nameSi: cat.nameSi, nameTa: cat.nameTa },
      create: {
        slug: cat.slug,
        nameEn: cat.nameEn,
        nameSi: cat.nameSi,
        nameTa: cat.nameTa,
      },
    });
    categoryCount += 1;

    for (const skill of cat.skills) {
      await prisma.skill.upsert({
        where: { slug: skill.slug },
        update: {
          nameEn: skill.nameEn,
          nameSi: skill.nameSi,
          nameTa: skill.nameTa,
          categoryId: category.id,
        },
        create: {
          slug: skill.slug,
          nameEn: skill.nameEn,
          nameSi: skill.nameSi,
          nameTa: skill.nameTa,
          categoryId: category.id,
        },
      });
      skillCount += 1;
    }
  }

  console.log(`Seeded ${categoryCount} categories and ${skillCount} skills.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
