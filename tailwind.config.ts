import type { Config } from 'tailwindcss';

/**
 * הפלטה נגזרת מ-DESIGN.md: דיו / נייר / חרס. שמות הטוקנים לא השתנו,
 * כך שכל קומפוננטה קיימת מקבלת את הכיוון החדש בלי שינוי קוד.
 *
 * ניגודיות נבדקה מול הנייר (#F7F4EF) בחישוב WCAG ישיר, לא בהערכה (R-25):
 *   ink 16.3:1 · body 9.4:1 · muted 5.2:1 · accent-ink 6.7:1 · accent 4.7:1 · good 4.6:1
 *   לבן על חרס 5.2:1
 * accent משמש למילויים ולטקסט גדול, accent-ink לטקסט קטן על נייר.
 */
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ליבה
        paper: '#F7F4EF',      // הרקע. נייר חמים, לא לבן טהור, כדי לא ליפול ל-Sterile Default
        surface: '#FFFFFF',    // כרטיסים, נשארים לבנים כדי להתרומם מעל הנייר
        night: '#1C1917',      // משטחים כבדים
        ink: '#17171C',        // טקסט ראשי
        body: '#44403C',       // טקסט רץ
        muted: '#6B6560',      // טקסט משני
        line: '#E7E1D8',       // מסגרות, חמות ולא אפורות

        // האקסנט האחד, לפעולה שמקדמת את ההחלטה בלבד
        accent: '#C2410C',
        'accent-ink': '#9A3412',
        'accent-soft': '#FDEEE3',

        // צבעים פונקציונליים. מסמנים מצב, ולא נספרים בפלטה
        good: '#15803D',
        'good-soft': '#E7F3EB',
        weak: '#A8A29E',
        amber: '#92610E',
        'amber-soft': '#FBF3E2',
        flame: '#B4421F',
        'flame-soft': '#FCEDE6',
        danger: '#A32F1C',
        'danger-soft': '#FBE8E4',
        signal: '#F59E0B',
      },
      fontFamily: {
        display: ['var(--font-display)', 'serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(28,25,23,.04), 0 10px 30px -22px rgba(28,25,23,.3)',
        lift: '0 4px 10px rgba(28,25,23,.05), 0 26px 48px -28px rgba(28,25,23,.45)',
        modal: '0 40px 80px -30px rgba(28,25,23,.5)',
        toast: '0 18px 40px -18px rgba(28,25,23,.45)',
        hero: '0 2px 4px rgba(28,25,23,.05), 0 40px 70px -40px rgba(194,65,12,.45)',
      },
      borderRadius: { '2xl': '1.25rem', '3xl': '1.75rem', '4xl': '2.25rem' },
    },
  },
  plugins: [],
} satisfies Config;
