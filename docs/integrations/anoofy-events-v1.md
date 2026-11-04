# مواصفات تكامل Anoofy-Woo مع EngazPRO (الإصدار v1)

وثيقة العقد الفني لبروتوكول استقبال الأحداث الواردة (Inbound Events) من إضافة Anoofy لووكومرس إلى منصة EngazPRO.

---

## 1. الترويسات الأمنية (Request Headers)

يتم توقيع كل طلب وارد من إضافة Anoofy باستخدام HMAC-SHA256 عبر الترويسات التالية:

| الترويسة | النوع | الوصف |
| :--- | :--- | :--- |
| `X-Anoofy-Key-Id` | String | معرف مفتاح الربط (`kid`) المولد من EngazPRO (بصيغة ULID). |
| `X-Anoofy-Timestamp` | Integer | وقت إنشاء الطلب بالثواني (Unix Timestamp UTC). تُرفض أي طلبات خارج نافذة 300 ثانية. |
| `X-Anoofy-Signature` | String | التوقيع الرقمي بصيغة Hex lowercase محسوباً كالتالي:<br>`hex(HMAC-SHA256(secret, timestamp + "." + raw_body))` |

---

## 2. بنية الغلاف (Envelope Schema)

كل حدث يُرسل في جسم الطلب (JSON Payload) داخل غلاف موحد:

```json
{
  "schema_version": 1,
  "event_id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  "event_type": "order.confirmed",
  "occurred_at": "2026-11-04T12:00:00Z",
  "order_version": 1,
  "data": {}
}
```

- `schema_version` (int): رقم إصدار العقد (القيمة الحالية: `1`).
- `event_id` (string): معرف فريد لكل حدث بنسق UUID v4 لمنع تكرار المعالجة (Idempotency).
- `event_type` (string): نوع الحدث (`connection.verify` أو `order.confirmed`).
- `occurred_at` (string): توقيت وقوع الحدث بصيغة ISO-8601 UTC.
- `order_version` (int|null): رقم إصدار الطلب لترتيب الأحداث ومنع الأحداث القديمة (Stale).
- `data` (object): البيانات الخاصة بنوع الحدث.

---

## 3. أنواع الأحداث (Event Types)

### أ. حدث تأكيد الاتصال (`connection.verify`)
يُرسل من الإضافة للتحقق من سلامة الربط والمفاتيح وحفظ رابط الاستدعاء.

**بنية `data`:**
```json
{
  "site_url": "https://mystore.com",
  "callback_url": "https://mystore.com/wp-json/anoofy/v1/callback",
  "plugin_version": "1.0.0"
}
```

### ب. حدث تأكيد الطلب من الكول سنتر (`order.confirmed`)
يُرسل عند تأكيد مندوب الكول سنتر للطلب مع العميل، وقد يتضمن تعديل بيانات العميل أو الأصناف.

**بنية `data`:**
```json
{
  "wc_order_id": 5001,
  "confirmed_at": "2026-11-04T12:00:00Z",
  "confirmed_by_name": "سارة أحمد",
  "customer": {
    "phone": "01011223344",
    "address_1": "15 شارع النصر",
    "address_2": "شقة 4",
    "city": "مدينة نصر",
    "state": "القاهرة"
  },
  "line_items": [
    {
      "wc_product_id": 901,
      "wc_variation_id": null,
      "quantity": 2,
      "name": "قميص قطني",
      "sku": "SHIRT-01",
      "price": 100,
      "total": 200
    }
  ]
}
```

---

## 4. استجابات النظام (Responses)

| كود الحالة | المعنى | بنية الاستجابة |
| :--- | :--- | :--- |
| `200 OK` | تمت المعالجة بنجاح أو تم رصد حالة خاصة | `{"success": true, "data": {"result": "processed" \| "duplicate" \| "stale" \| "ignored", "reason": "..."}}` |
| `401 Unauthorized` | توقيع غير صالح، انتهاء وقت التوقيع، أو المتجر غير مربوط بعد | `{"success": false, "message": "...", "error_code": "..."}` |
| `409 Conflict` | الطلب لم يُسحب بعد من ووكومرس (`ORDER_NOT_YET_SYNCED`) | `{"success": false, "message": "الطلب غير متزامن بعد بالنظام", "error_code": "ORDER_NOT_YET_SYNCED"}` *(لا يُسجل في الـ inbox ليتمكن الـ plugin من إعادة المحاولة)* |
| `422 Unprocessable` | خلل في بنية البيانات أو عدم تطابق النطاق | `{"success": false, "message": "بيانات غير صالحة", "errors": {...}}` |

---

## 5. نتائج المعالجة (`result` في رد 200)

- `processed`: تم استلام الحدث وتطبيقه بنجاح.
- `duplicate`: معرف الحدث `event_id` تم استلامه ومعالجته مسبقاً (لن يتكرر التنفيذ).
- `stale`: رقم إصدار الطلب `order_version` أقل من أو يساوي الإصدار المسجل في النظام.
- `ignored`: تم تجاهل الحدث لسبب منطقي (مثال: تأكيد قديم قبل وقت الربط `before_connection`، أو حالة الطلب ليست `PENDING_CONFIRMATION`).
