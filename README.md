# Sanad — برنامج سندات لأمر

برنامج سطح مكتب لإصدار وطباعة السندات لأمر في دفاتر مرقمة.
A desktop app for issuing and printing promissory notes (سند لأمر) in numbered books.

**Stack:** Electron + React (Vite) + SQLite (`node:sqlite`, built into Electron — no native add-on)

## المميزات — Features

| عربي | English |
| --- | --- |
| دفاتر بعدد سندات محدد (مثلا 60)، وكل سند ياخد رقمه تلقائيا: 01 من 60 | Books with a fixed count (e.g. 60); each note gets its number automatically: 01 of 60 |
| الرقم يتحجز داخل transaction فمستحيل يتكرر، والسند الملغي يحتفظ برقمه | Numbers are reserved in a transaction (never duplicated); cancelled notes keep their number |
| الدفتر يتقفل تلقائيا لما يخلص | A book closes automatically when full |
| دفتر أقساط: مدة (سنين وشهور) + دورية من كل شهر لكل 12 شهر + إجمالي، فيحسب القسط ويولد سند لكل قسط | Installment book: duration (years + months) + period (every 1 to 12 months) + total; computes each installment and creates one note per installment |
| طباعة الدفتر كله مرة واحدة أو PDF واحد، أو كل سند لوحده | Print the whole book at once or as one PDF, or each note on its own |
| تفقيط المبلغ تلقائيا (ريال وهللة) | Amount written in Arabic words automatically (riyals and halalas) |
| التاريخ الهجري (أم القرى) يتحسب تلقائيا | Hijri date (Umm al-Qura) calculated automatically |
| حفظ بيانات العملاء والكفلاء واسترجاعها بالبحث | Customers and guarantors are saved and searchable |
| طباعة السند كامل على ورق أبيض (A4 / A5 / مقاس مخصص) | Prints the full note on blank paper (A4 / A5 / custom size) |
| معاينة، حفظ PDF، طباعة مباشرة بدون نافذة الطباعة | Preview, save as PDF, direct (silent) printing |
| إزاحة وتكبير للطباعة بالمللي | Print offset and scale in mm |
| واجهة عربي وإنجليزي | Arabic and English interface |
| نسخة احتياطية لقاعدة البيانات | Database backup |

## التشغيل — Running

```bash
npm install        # يثبت المكتبات
npm run dev        # تشغيل للتطوير (Vite + Electron)
npm test           # اختبارات التفقيط والتواريخ والترقيم (Node 22.13+)
npm run dist       # ملف تثبيت ويندوز + نسخة zip في مجلد release/
npm run dist:zip   # نسخة zip بس (تتبني كمان من Linux)
```

## مكان البيانات — Data location

قاعدة البيانات `sanad.db` في مجلد بيانات البرنامج:
The database `sanad.db` lives in the app data folder:

- Windows: `%APPDATA%\Sanad\sanad.db`

## هيكل المشروع — Structure

```
electron/
  main.cjs       # النافذة، IPC، الطباعة والـ PDF
  preload.cjs    # الجسر الآمن window.sanad
  db.cjs         # SQLite: الدفاتر، السندات، العملاء، الإعدادات
src/
  App.jsx        # التنقل واللغة
  pages/         # سند جديد، السندات، الدفاتر، الإعدادات
  print/         # قالب السند للطباعة (VoucherSheet)
  lib/           # التفقيط والتواريخ والأرقام
  i18n.js        # النصوص عربي / إنجليزي
  mockApi.js     # بيانات تجريبية لما الواجهة تفتح في متصفح عادي
tests/
```

## الطباعة — How printing works

البرنامج يفتح نافذة مخفية على `#/print/<id>`، ولما القالب يجهز يبعت `print:ready`،
وبعدها `webContents.print()` أو `printToPDF()`. مقاس الورق من الإعدادات.

A hidden window renders `#/print/<id>`; when ready it signals `print:ready`, then the main
process calls `webContents.print()` or `printToPDF()` with the paper size from settings.
