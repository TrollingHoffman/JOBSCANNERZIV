export const MARKETING_TAXONOMY: Record<string, string[]> = {
  'שיווק דיגיטלי': ['שיווק דיגיטלי', 'דיגיטל', 'אונליין', 'performance', 'פרפורמנס', 'growth', 'לידים', 'leads', 'שיווק', 'מרקום'],
  'פרסום ממומן': ['ppc', 'קמפיינים', 'קמפיין', 'קמפיינר', 'google ads', 'meta ads', 'facebook ads', 'taboola', 'outbrain', 'roas', 'cpa', 'cpc', 'ctr', 'אופטימיזציה', 'סוכנות פרסום'],
  'סושיאל': ['סושיאל', 'רשתות חברתיות', 'social media', 'קהילה', 'אינסטגרם', 'instagram', 'טיקטוק', 'tiktok', 'linkedin', 'משפיענים', 'ugc'],
  'תוכן': ['תוכן', 'כתיבה שיווקית', 'קופירייטינג', 'copywriting', 'עורך תוכן', 'עורכת תוכן', 'בלוג', 'ניוזלטר', 'content'],
  'SEO': ['seo', 'קידום אורגני', 'קידום אתרים', 'מילות מפתח'],
  'אימייל ואוטומציה': ['דיוור', 'email marketing', 'automation', 'crm', 'hubspot', 'salesforce', 'activetrail', 'mailchimp'],
  'אנליטיקס ודאטה': ['אנליטיקס', 'analytics', 'google analytics', 'ga4', 'דאטה', 'ניתוח נתונים', 'kpi', 'אקסל', 'excel'],
  'איקומרס': ['איקומרס', 'e-commerce', 'ecommerce', 'מסחר אלקטרוני', 'shopify', 'וורדפרס', 'wordpress', 'עמודי נחיתה', 'המרות', 'cro'],
  'מותג ואסטרטגיה': ['מיתוג', 'ברנדינג', 'branding', 'מחקר שוק', 'קהל יעד', 'מותג'],
  'מוצר ופרויקטים': ['מנהל מוצר', 'מנהלת מוצר', 'product marketing', 'ניהול פרויקטים'],
  'כלים ועיצוב': ['פוטושופ', 'photoshop', 'illustrator', 'canva', 'קנבה', 'figma', 'עריכת וידאו'],
};

const ALL_TERMS = Object.values(MARKETING_TAXONOMY).flat();
function normalize(t: string) { return t.toLowerCase().replace(/[\u05f4"'\u05f3`]/g, '').replace(/[\u0591-\u05C7]/g, '').replace(/\s+/g, ' '); }

export function extractTerms(text: string): string[] {
  const hay = normalize(text);
  const found = new Set<string>();
  for (const term of ALL_TERMS) if (hay.includes(normalize(term))) found.add(term);
  return [...found];
}

export function matchedCategories(text: string): string[] {
  const hay = normalize(text);
  const cats: string[] = [];
  for (const [cat, terms] of Object.entries(MARKETING_TAXONOMY)) if (terms.some((t) => hay.includes(normalize(t)))) cats.push(cat);
  return cats;
}
