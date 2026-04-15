# إعداد Nginx

يستخدم WhyNot ملف إعداد Nginx واحد لخدمة ثلاثة أسماء مضيفين:

| اسم المضيف | الخدمة الخلفية | المنفذ |
|-------------|----------------|--------|
| `whynot.skrum.io` | واجهة المستخدم الأمامية (SPA) | 5183 |
| `admin.whynot.skrum.io` | واجهة لوحة الإدارة (SPA) | 5184 |
| `superadmin.whynot.skrum.io` | واجهة لوحة الإدارة (نطاق المشرف الأعلى) | 5184 |

`superadmin.whynot.skrum.io` هو اسم مضيف بديل يوجّه الطلبات إلى نفس خدمة لوحة الإدارة. يكتشف التطبيق اسم المضيف ويقيّد الواجهة بأقسام المشرف الأعلى فقط.

## المتطلبات الأساسية

- DNS: سجلات A/AAAA لجميع أسماء المضيفين الثلاثة يجب أن تشير إلى الخادم.
- تثبيت Nginx على الخادم المضيف.
- تثبيت Certbot لتوفير شهادات TLS.

## التثبيت

ملف الإعداد موجود في المستودع في `docker/nginx/whynot.skrum.io`. استخدم رابطًا رمزيًا ليتم تحديث التغييرات تلقائيًا:

```bash
# إزالة الإعداد القديم غير المُدار بالإصدار إن وُجد
sudo rm -f /etc/nginx/sites-available/whynot
sudo rm -f /etc/nginx/sites-enabled/whynot

# إنشاء رابط رمزي من المستودع
sudo ln -sf /home/serverlessbase/whynot/docker/nginx/whynot.skrum.io \
            /etc/nginx/sites-available/whynot.skrum.io
sudo ln -sf /etc/nginx/sites-available/whynot.skrum.io \
            /etc/nginx/sites-enabled/whynot.skrum.io

# اختبار وإعادة تحميل
sudo nginx -t && sudo systemctl reload nginx
```

## شهادات TLS مع Certbot

شغّل Certbot مع أسماء المضيفين الثلاثة:

```bash
sudo certbot --nginx \
  -d whynot.skrum.io \
  -d admin.whynot.skrum.io \
  -d superadmin.whynot.skrum.io
```

يضيف Certbot تلقائيًا كتل `listen 443 ssl` وتوجيهات `ssl_*`. يشمل التجديد جميع أسماء المضيفين الثلاثة.

## المزامنة اليدوية (بديل)

إذا كنت تفضل النسخ بدلاً من الرابط الرمزي:

```bash
sudo cp /home/serverlessbase/whynot/docker/nginx/whynot.skrum.io \
        /etc/nginx/sites-available/whynot.skrum.io
sudo nginx -t && sudo systemctl reload nginx
```

ملاحظة: بهذه الطريقة، يجب إعادة النسخ بعد كل تغيير.

## التحقق

```bash
# اختبار صحة الإعداد
sudo nginx -t

# التحقق من استجابة جميع أسماء المضيفين الثلاثة
curl -I https://whynot.skrum.io
curl -I https://admin.whynot.skrum.io
curl -I https://superadmin.whynot.skrum.io
```

## Stripe Webhooks

نقطة الوصول `/api/webhooks/stripe` متاحة عبر جميع أسماء المضيفين الثلاثة. ثبّت عنوان webhook على `https://whynot.skrum.io/api/webhooks/stripe` في لوحة تحكم Stripe لتجنب عدم تطابق التوقيعات.

## تحديد معدل الطلبات

تم إعداد منطقتين لتحديد معدل الطلبات:

- `whynot_api_limit`: 30 طلب/ثانية مع حد أقصى مؤقت 50 لمسارات `/api/`.
- `whynot_auth_limit`: 5 طلبات/ثانية مع حد أقصى مؤقت 10 لنقاط المصادقة.

تُطبق كلتا المنطقتين بشكل متماثل على جميع أسماء المضيفين الثلاثة.
