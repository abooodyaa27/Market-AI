# Market-AI


## V2.1 AI Decision build
AI owns BUY/SELL/WAIT; independent Risk/Safety gate remains mandatory. V1.9 rules are retained only as an evaluation baseline.

UI test updated for V2.1 cold-start fail-closed semantics.

V2.1 UI readiness test now waits on journal/AI state and preserves strict feed validation.

Build trigger: latest V2.1 UI readiness fix.


<!-- V2.9 build trigger: holdout fix + stable V2.8 signing key -->

<!-- PR build trigger for V2.9 CI -->

<!-- V3.0 M15 + validation fix2 build -->

<!-- trigger corrected V3.0 gap validation build -->

<!-- V3.0.3 model quality, observed outcomes and missed-opportunity accuracy -->

<!-- build local M15 + validation calibration fix -->

<!-- rerun after M15 regression test correction -->

<!-- corrected M15 assertion build -->

<!-- M15 provider fetch removed at source -->

<!-- semantic M15 regression test rerun -->

<!-- seventh-pass: derived M15 + atomic holdout validation -->

<!-- canonical M1 root-cause feed fix -->

<!-- verify native higher timeframe history coverage -->

## V3.0.4 — بيانات المصدر والاستهلاك

- حد محافظ **10,000 طلب REST في اليوم بتوقيت UTC** على الجهاز، محفوظ بين تشغيلات التطبيق. يعرض التطبيق المستهلك والمتبقي، ويوقف الطلبات عند نفاده أو عند HTTP 429 مؤقتًا. هذا حد للتطبيق ولا يمثل وعدًا بحد مزود الخدمة.
- تحديث سعر الأصل المحدد فقط كل 12 ثانية تقريبًا، وجلب M1/M5/H1/H4 عند إغلاق إطار كل منها، مع إعادة محاولة فشل الشموع بعد دقيقة. يظل السعر القديم غير صالح للإشارات بعد خمس ثوان وفق محرك المخاطر. لا يعمل الجمع في الخلفية بعد إيقاف WebView.
- إصلاح الشمعة الناقصة من بيانات المصدر نفسه عند توفر **جميع** شموع الإطار الأصغر المغلقة؛ الفجوة غير القابلة للإصلاح تمنع الإشارات وتعرض وقتها وعدد الشموع المطلوبة.
- عند ظهور صفر عينات بعد إعادة التثبيت، يمكن استعادة ملف Decision Journal السابق عبر Import Decisions؛ لا يمكن استعادة سجل محلي حُذف بلا تصدير. تبقى بيانات Train/Validation/Test منفصلة.
