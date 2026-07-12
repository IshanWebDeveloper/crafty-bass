/**
 * Seeds the marketplace taxonomy: ServiceCategory + Skill rows with EN/SI/TA
 * labels so the job-posting form and category browse have real options.
 * Idempotent - safe to re-run (upserts by slug).
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
  // Handyman-style categories (inspired by taskrabbit.com/services/handyman),
  // adapted for Sri Lankan homes - adds the everyday odd-jobs, assembly,
  // mounting, appliance, A/C, garden, moving, roofing, pest and metalwork
  // services the original six trades didn't cover.
  {
    slug: 'handyman',
    nameEn: 'Handyman & general repairs',
    nameSi: 'සාමාන්‍ය අලුත්වැඩියා',
    nameTa: 'பொது பழுதுபார்ப்பு',
    skills: [
      {
        slug: 'handyman-general-repairs',
        nameEn: 'General repairs',
        nameSi: 'සාමාන්‍ය අලුත්වැඩියා',
        nameTa: 'பொது பழுதுபார்ப்பு',
      },
      {
        slug: 'handyman-hanging',
        nameEn: 'Picture & shelf hanging',
        nameSi: 'පින්තූර සහ රාක්ක එල්ලීම',
        nameTa: 'படம் & அலமாரி பொருத்துதல்',
      },
      {
        slug: 'handyman-doors-locks',
        nameEn: 'Door & lock repair',
        nameSi: 'දොර සහ අගුළු අලුත්වැඩියාව',
        nameTa: 'கதவு & பூட்டு பழுது',
      },
    ],
  },
  {
    slug: 'furniture-assembly',
    nameEn: 'Furniture assembly',
    nameSi: 'ගෘහ භාණ්ඩ එකලස් කිරීම',
    nameTa: 'தளபாடம் பொருத்துதல்',
    skills: [
      {
        slug: 'furniture-flatpack',
        nameEn: 'Flat-pack assembly',
        nameSi: 'ෆ්ලැට්-පැක් එකලස් කිරීම',
        nameTa: 'பிளாட்-பேக் பொருத்துதல்',
      },
      {
        slug: 'furniture-bed-wardrobe',
        nameEn: 'Bed & wardrobe assembly',
        nameSi: 'ඇඳ සහ අල්මාරි එකලස් කිරීම',
        nameTa: 'படுக்கை & அலமாரி பொருத்துதல்',
      },
      {
        slug: 'furniture-office',
        nameEn: 'Office furniture',
        nameSi: 'කාර්යාල ගෘහ භාණ්ඩ',
        nameTa: 'அலுவலக தளபாடம்',
      },
    ],
  },
  {
    slug: 'mounting',
    nameEn: 'Mounting & installation',
    nameSi: 'සවි කිරීම සහ ස්ථාපනය',
    nameTa: 'பொருத்துதல் & நிறுவல்',
    skills: [
      {
        slug: 'mounting-tv',
        nameEn: 'TV mounting',
        nameSi: 'රූපවාහිනී සවි කිරීම',
        nameTa: 'தொலைக்காட்சி பொருத்துதல்',
      },
      {
        slug: 'mounting-shelves-curtains',
        nameEn: 'Shelves & curtains',
        nameSi: 'රාක්ක සහ තිර',
        nameTa: 'அலமாரிகள் & திரைச்சீலைகள்',
      },
      {
        slug: 'mounting-fixtures',
        nameEn: 'Fixtures & fittings',
        nameSi: 'සවිකිරීම් සහ උපාංග',
        nameTa: 'பொருத்துதல்கள் & இணைப்புகள்',
      },
    ],
  },
  {
    slug: 'appliances',
    nameEn: 'Appliance repair & install',
    nameSi: 'උපකරණ අලුත්වැඩියාව සහ ස්ථාපනය',
    nameTa: 'வீட்டு உபகரண பழுது & நிறுவல்',
    skills: [
      {
        slug: 'appliances-washing-machine',
        nameEn: 'Washing machine',
        nameSi: 'රෙදි සෝදන යන්ත්‍රය',
        nameTa: 'சலவை இயந்திரம்',
      },
      {
        slug: 'appliances-refrigerator',
        nameEn: 'Refrigerator',
        nameSi: 'ශීතකරණය',
        nameTa: 'குளிர்சாதனப் பெட்டி',
      },
      {
        slug: 'appliances-cooker',
        nameEn: 'Cooker & oven',
        nameSi: 'උදුන සහ ලිප',
        nameTa: 'அடுப்பு & ஓவன்',
      },
    ],
  },
  {
    slug: 'air-conditioning',
    nameEn: 'Air conditioning',
    nameSi: 'වායුසමීකරණ',
    nameTa: 'குளிரூட்டல்',
    skills: [
      {
        slug: 'ac-installation',
        nameEn: 'A/C installation',
        nameSi: 'වායුසමීකරණ ස්ථාපනය',
        nameTa: 'குளிரூட்டி நிறுவல்',
      },
      {
        slug: 'ac-servicing',
        nameEn: 'A/C servicing',
        nameSi: 'වායුසමීකරණ සේවාව',
        nameTa: 'குளிரூட்டி சேவை',
      },
      {
        slug: 'ac-repair',
        nameEn: 'A/C repair',
        nameSi: 'වායුසමීකරණ අලුත්වැඩියාව',
        nameTa: 'குளிரூட்டி பழுது',
      },
    ],
  },
  {
    slug: 'gardening',
    nameEn: 'Gardening & landscaping',
    nameSi: 'උද්‍යාන සැකසීම',
    nameTa: 'தோட்டக்கலை',
    skills: [
      {
        slug: 'gardening-lawn',
        nameEn: 'Lawn mowing',
        nameSi: 'තණකොළ කැපීම',
        nameTa: 'புல்வெளி வெட்டுதல்',
      },
      {
        slug: 'gardening-maintenance',
        nameEn: 'Garden maintenance',
        nameSi: 'උද්‍යාන නඩත්තුව',
        nameTa: 'தோட்ட பராமரிப்பு',
      },
      {
        slug: 'gardening-tree-trimming',
        nameEn: 'Tree trimming',
        nameSi: 'ගස් කප්පාදුව',
        nameTa: 'மரம் கத்தரித்தல்',
      },
    ],
  },
  {
    slug: 'moving',
    nameEn: 'Moving & hauling',
    nameSi: 'ප්‍රවාහනය සහ ගෙනයාම',
    nameTa: 'இடம்பெயர்வு & எடுத்துச்செல்லல்',
    skills: [
      {
        slug: 'moving-help',
        nameEn: 'Help moving',
        nameSi: 'ගෙනයාමට උදව්',
        nameTa: 'இடம்பெயர உதவி',
      },
      {
        slug: 'moving-junk-removal',
        nameEn: 'Junk removal',
        nameSi: 'කසළ ඉවත් කිරීම',
        nameTa: 'குப்பை அகற்றல்',
      },
      {
        slug: 'moving-delivery',
        nameEn: 'Furniture delivery',
        nameSi: 'ගෘහ භාණ්ඩ බෙදාහැරීම',
        nameTa: 'தளபாடம் விநியோகம்',
      },
    ],
  },
  {
    slug: 'roofing',
    nameEn: 'Roofing & waterproofing',
    nameSi: 'වහල සහ ජල ආරක්ෂණය',
    nameTa: 'கூரை & நீர்ப்புகா',
    skills: [
      {
        slug: 'roofing-repair',
        nameEn: 'Roof repair',
        nameSi: 'වහල අලුත්වැඩියාව',
        nameTa: 'கூரை பழுது',
      },
      {
        slug: 'roofing-waterproofing',
        nameEn: 'Waterproofing',
        nameSi: 'ජල ආරක්ෂණය',
        nameTa: 'நீர்ப்புகா',
      },
      {
        slug: 'roofing-gutters',
        nameEn: 'Gutter cleaning',
        nameSi: 'වැසි බෑවුම් පිරිසිදු කිරීම',
        nameTa: 'மழைநீர்க் கால்வாய் சுத்தம்',
      },
    ],
  },
  {
    slug: 'pest-control',
    nameEn: 'Pest control',
    nameSi: 'පළිබෝධ පාලනය',
    nameTa: 'பூச்சி கட்டுப்பாடு',
    skills: [
      {
        slug: 'pest-general',
        nameEn: 'General pest control',
        nameSi: 'සාමාන්‍ය පළිබෝධ පාලනය',
        nameTa: 'பொது பூச்சி கட்டுப்பாடு',
      },
      {
        slug: 'pest-termite',
        nameEn: 'Termite treatment',
        nameSi: 'වේයන් ප්‍රතිකාර',
        nameTa: 'கறையான் சிகிச்சை',
      },
    ],
  },
  {
    slug: 'welding',
    nameEn: 'Welding & metalwork',
    nameSi: 'වෙල්ඩින් සහ ලෝහ වැඩ',
    nameTa: 'வெல்டிங் & உலோக வேலை',
    skills: [
      {
        slug: 'welding-gates-grills',
        nameEn: 'Gates & grills',
        nameSi: 'ගේට්ටු සහ ග්‍රිල්',
        nameTa: 'வாயில்கள் & கிரில்கள்',
      },
      {
        slug: 'welding-fabrication',
        nameEn: 'Metal fabrication',
        nameSi: 'ලෝහ නිෂ්පාදනය',
        nameTa: 'உலோக உருவாக்கம்',
      },
      {
        slug: 'welding-repairs',
        nameEn: 'Welding repairs',
        nameSi: 'වෙල්ඩින් අලුත්වැඩියා',
        nameTa: 'வெல்டிங் பழுது',
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
