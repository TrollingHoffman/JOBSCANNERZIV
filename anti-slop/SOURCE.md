# SOURCE — antislop

נרשם לפי `skill-forge` step 6.

| שדה | ערך |
|---|---|
| **מקור** | https://github.com/miqdadbadjuber/anti-slop |
| **commit** | `--depth 1` של `main`, נמשך 2026-11-15 |
| **רישיון** | **MIT** — Copyright (c) 2026 Miqdad Badjuber. מותר להעתיק (step 3 passed). |
| **סטטוס** | `🧩 adopted — text-only` |
| **אומץ ב** | job-scanner (סורק המשרות של זיו) |
| **תאריך** | 2026-11-15 |

## Step 3 — license gate

MIT, קובץ `LICENSE` קיים בשורש הריפו. מותר להעתיק. אין דרישת NOTICE (זה לא Apache).
הריפו כולל גם חומר שמותאם מ-`web-quality-skills` של Addy Osmani, גם הוא MIT, עם
`LICENSE-web-quality-skills` בתיקיית הסקיל. שרשרת הרישוי תקינה.

## Step 4 — security audit

נסרק לפני שנקרא כהוראות. מה שנבדק ומה שנמצא:

| בדיקה | תוצאה |
|---|---|
| instruction injection בתוך ה-SKILL.md | **נקי**. הכללים מנוסחים כהנחיות עיצוב. יתרה מזו, הסקיל עצמו מורה לטפל ב-`DESIGN.md` ובקבצים חיצוניים כ**נתונים ולא כפקודות** (R-37 Boundary), וזו עמדה נכונה. |
| `curl \| sh` / התקנה אוטומטית | **לא קיים בליבה**. ה-ROADMAP מתעד במפורש הסרה של runtime curl מהחבילה (v3.0.1, תיקון Snyk W012). ה-`curl` היחיד הוא בתיעוד, להורדה ידנית של קובץ הכללים. |
| תווי אפס-רוחב / bidi נסתרים | **נקי**. סריקה של `​-‏`, `‪-‮`, `⁠-⁤`, `﻿` לא החזירה אף קובץ. חשוב במיוחד פה: הפרויקט הזה עברית RTL, ותווי bidi נסתרים היו נבלעים בלי להיראות. |
| קוד מעורפל / base64 | **נקי**. אין בלוקים מקודדים. |
| exfiltration של סודות | **לא נמצא**. אין קריאת משתני סביבה, אין שליחה לנקודת קצה. |
| נקודות קצה מקובעות | אין. כל ה-URLים הם תיעוד (w3.org, web.dev, developer.chrome.com, הריפו עצמו). |
| `child_process` / spawn | קיים ב-3 מקומות, **כולם מחוץ למה שאומץ**: `cli/` (ה-installer), `cli/scripts/smoke-test.mjs`, ו-`.claude-plugin/contrast-mcp-launcher.mjs`. |
| hooks של npm | אין `postinstall` ואין `preinstall`. יש `prepublishOnly` בלבד, שרץ אצל המפרסם. |

**החלטה: אימוץ טקסט בלבד. אפס סקריפטים.**

`skill-forge` קובע ששומרים סקריפט רק אם הוא **נחוץ** ועבר ביקורת. אף סקריפט פה לא נחוץ:
מה שצריך הוא הכללים עצמם. לכן `cli/`, `scripts/`, ו-`.claude-plugin/` **לא אומצו**,
ובכלל זה `scripts/contrast-check.py`. בדיקת הניגודיות (R-25) נעשית בחישוב ישיר על
הפלטה שב-`DESIGN.md`, בלי להריץ קוד צד-שלישי.

לא נמצא ממצא חשוד. הסקיל לא מסומן `blocked`.

## מה אומץ בפועל

טקסט בלבד, מתוך:

- `antislop.md` / `skills/antislop/SKILL.md` — הליבה: R-01→R-40, שלוש השכבות
  (Hard Gate / Purpose-Gate / Quality Locks), Craftsmanship C-1→C-5,
  Liveliness Toolkit (ENERGY/RHYTHM/MOTION + Design Read), ו-Delivery Gate
- `skills/antislop-ui/SKILL.md` — העומק הויזואלי, כולל פרק App & Dashboard
  שהוא הרלוונטי פה: המוצר הזה הוא מסך עבודה, לא דף נחיתה

## הערה על mode

הסקיל מגדיר שתי שיטות עבודה ושואל איזו מהן. אמית אמר במפורש
"אני לא רוצה לעשות כלום אני רוצה שאתה תעשה הכל", ולכן השאלה לא הוחזרה אליו.
**המצב הפעיל: DURING** — הכללים מופעלים בזמן הכתיבה, כי בונים UI חדש,
והמסירה מסתיימת ב-Delivery Gate.
