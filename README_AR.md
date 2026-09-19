# Market AI Standalone Android

هذه النسخة لا تحتاج لابتوب ولا VPS ولا MT5 محلي.

مصدر البيانات المباشر:
- Gold: XAUUSD
- Bitcoin: BTCUSD
- Live tick every 1 second
- Candles: M1 / M5 / M15 / H1 / H4
- Source: https://biquote.io

مهم:
- الأسعار خارجية وليست أسعار Exness، لذلك قد تختلف قليلاً.
- التحليل داخل التطبيق محلي (structure + ATR + POI approximation).
- التطبيق لا يرسل صفقات.
- لا يوجد مفتاح OpenAI داخل التطبيق.

Cloud build:
GitHub Actions يبني Market_AI.apk تلقائياً.
