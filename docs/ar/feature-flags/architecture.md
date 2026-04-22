---
title: "بنية نظام أعلام الميزات"
description: "البنية التقنية لنظام أعلام الميزات في WhyNot QA"
lang: ar
draft: false
---

# بنية نظام أعلام الميزات

## نموذج الجدولين

يستخدم نظام أعلام الميزات جدولين في قاعدة البيانات:

### `feature_flags` — تعريفات الأعلام العامة

| العمود | النوع | الوصف |
|--------|-------|-------|
| `key` | `text` (مفتاح أساسي) | معرّف بتنسيق snake_case، يطابق السجل |
| `name` | `text` | اسم قابل للقراءة |
| `description` | `text` | ما يتحكم به العلم |
| `default_enabled` | `boolean` | الحالة الافتراضية للمؤسسات الجديدة |
| `rollout_percent` | `integer` | نسبة الطرح (0–100) |
| `created_at` | `timestamptz` | وقت إنشاء الصف |
| `updated_at` | `timestamptz` | آخر تعديل |

### `organization_feature_flags` — تجاوزات لكل مؤسسة

| العمود | النوع | الوصف |
|--------|-------|-------|
| `organization_id` | `uuid` (مفتاح أساسي، مفتاح أجنبي) | مرجع إلى `organizations(id)` |
| `flag_key` | `text` (مفتاح أساسي، مفتاح أجنبي) | مرجع إلى `feature_flags(key)` |
| `enabled` | `boolean` | القيمة المتجاوزة لهذه المؤسسة |
| `set_by` | `uuid` (مفتاح أجنبي) | المسؤول الذي عيّن التجاوز |
| `set_at` | `timestamptz` | وقت تعيين التجاوز |

## السجل كمصدر الحقيقة

جميع مفاتيح الأعلام الصالحة معرّفة في `shared/constants/platform-features.ts`. هذا السجل:

- يُصدّر `PLATFORM_FEATURES` — كائن ثابت يربط المفاتيح بقيم snake_case في قاعدة البيانات
- يُصدّر `PlatformFeatureKey` — نوع الاتحاد لجميع المفاتيح الصالحة
- يُصدّر `isValidFeatureKey()` — حارس نوع للتحقق أثناء التشغيل
- يُصدّر `ALL_PLATFORM_FEATURE_KEYS` — مصفوفة بجميع المفاتيح الصالحة

## ترتيب حل العلم

1. تحقق من `organization_feature_flags` لوجود تجاوز خاص بالمؤسسة
2. إذا لم يوجد تجاوز، استخدم `feature_flags.default_enabled`
3. إذا كان `rollout_percent > 0` ولا يوجد تجاوز، استخدم تجزئة حتمية لـ `org_id + flag_key`

## إضافة علم جديد

1. أضف المفتاح إلى `PLATFORM_FEATURES` في `shared/constants/platform-features.ts`
2. أضف إدخال بذرة في `shared/database/seeds/feature-flags.ts`
3. شغّل سكريبت البذرة — إنه متساوي القوة (`ON CONFLICT ... DO UPDATE`)
4. استخدم `isValidFeatureKey()` عند حدود API للتحقق من المفاتيح الواردة

## التدقيق

كل تغيير في العلم (تفعيل، تعطيل، تجاوز) يُكتب في جدول `audit_log`.
