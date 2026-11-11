# مواصفات تكامل Anoofy-Woo مع EngazPRO (الإصدار v1)

وثيقة العقد الفني لبروتوكول تبادل الأحداث بين إضافة Anoofy لووكومرس ومنصة EngazPRO (أحداث واردة وأحداث صادرة).

---

## 1. الترويسات الأمنية (Request Headers)

يتم توقيع كل طلب (سواء كان وارداً إلى EngazPRO أو صادراً منها إلى الـ Plugin) باستخدام HMAC-SHA256 عبر الترويسات التالية:

| الترويسة | النوع | الوصف |
| :--- | :--- | :--- |
| `X-Anoofy-Key-Id` | String | معرف مفتاح الربط (`kid`) المولد من EngazPRO (بصيغة ULID). |
| `X-Anoofy-Timestamp` | Integer | وقت إنشاء الطلب بالثواني (Unix Timestamp UTC). تُرفض أي طلبات خارج نافذة 300 ثانية. |
| `X-Anoofy-Signature` | String | التوقيع الرقمي بصيغة Hex lowercase محسوباً كالتالي:<br>`hex(HMAC-SHA256(secret, timestamp + "." + raw_body))` |

---

## 2. بنية الغلاف الموحد (Envelope Schema)

كل حدث يُرسل في جسم الطلب (JSON Payload) داخل غلاف موحد:

```json
{
  "schema_version": 1,
  "event_id": "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  "event_type": "order.stage_changed",
  "occurred_at": "2026-11-04T12:00:00Z",
  "order_version": 1,
  "data": {}
}
```

- `schema_version` (int): رقم إصدار العقد (القيمة الحالية: `1`).
- `event_id` (string): معرف فريد لكل حدث بنسق UUID v4 لمنع تكرار المعالجة (Idempotency).
- `event_type` (string): نوع الحدث (`connection.verify`, `order.confirmed`, `order.stage_changed`).
- `occurred_at` (string): توقيت وقوع الحدث بصيغة ISO-8601 UTC.
- `order_version` (int|null): رقم إصدار الطلب لترتيب الأحداث ومنع الأحداث القديمة (Stale).
- `data` (object): البيانات الخاصة بنوع الحدث.

---

## 3. الأحداث الواردة (Inbound: Plugin → EngazPRO)

- **نقطة النهاية (Inbound Endpoint):** `POST /api/webhooks/anoofy/events` (اسم المسار: `anoofy.inbound`).
- **عنوان API في مفتاح الربط (`connection_key`):** يُضمن الرابط الكامل لنقطة النهاية تلقائياً في حقل `api` داخل مفتاح الربط المشفر base64url:
  ```json
  {
    "v": 1,
    "api": "https://your-domain.com/api/webhooks/anoofy/events",
    "kid": "01JCEXAMPLEKID1234567890AB",
    "secret": "64_chars_hex_secret"
  }
  ```
- **حماية المسار:** محمي بمحدد المعدل `throttle:anoofy_inbound` والتحقق الإلزامي من التوقيع الرقمي HMAC-SHA256 عبر الترويسات الأمنية.

### أ. حدث تأكيد الاتصال (`connection.verify`)
يُرسل من الإضافة للتحقق من سلامة الربط والمفاتيح وحفظ رابط الاستدعاء `anoofy_callback_url`.

**بنية `data`:**
```json
{
  "site_url": "https://mystore.com",
  "callback_url": "https://mystore.com/wp-json/anoofy/v1/callback",
  "plugin_version": "1.0.0"
}
```

### ب. حدث تأكيد الطلب من الكول سنتر (`order.confirmed`)
يُرسل عند تأكيد مندوب الكول سنتر للطلب مع العميل في إضافة ووكومرس، وقد يتضمن تعديل بيانات العميل أو الأصناف.

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
      "price": "100.00",
      "total": "200.00"
    }
  ]
}
```

- `wc_order_id` (int): معرف الطلب في ووكومرس.
- `confirmed_at` (string): توقيت التأكيد بصيغة ISO-8601 UTC.
- `confirmed_by_name` (string): اسم الموظف الذي قام بالتأكيد الهاتفي.
- `customer` (object): بيانات العميل المحدثة (الهاتف والعنوان).
- `line_items` (array): قائمة بنود الطلب المؤكدة:
  - `price` (string): سعر الوحدة قبل الخصم، بصيغة string عشري بخانتين (مثل `"33.33"`) ومقرّب round-half-up.
  - `total` (string): قيمة السطر المحسوبة من ووكومرس، بصيغة string عشري بخانتين (مثل `"99.99"`).
  - `quantity` (int|float): كمية الصنف.
  - `wc_product_id` (int): معرف المنتج الأصلي في ووكومرس.
  - `wc_variation_id` (int|null): معرف الفاريانت في حال كان المنتج متغيراً.
  - `name` (string): اسم الصنف.
  - `sku` (string|null): رمز التخزين التعريفي للصنف.

---

## 4. الأحداث الصادرة (Outbound: EngazPRO → Plugin)

### حدث تغيير مرحلة الطلب (`order.stage_changed`)
يُرسل من منصة EngazPRO إلى إضافة ووكومرس عبر `anoofy_callback_url` كلما تغيرت حالة الطلب إلى أي حالة غير `PENDING_CONFIRMATION` (مثل: `CONFIRMED`, `PREPARING`, `DISPATCHED`, `SHIPPED_VIA_COURIER`, `DELIVERED`, `PARTIALLY_DELIVERED`, `RETURNED`, `CANCELLED`)، بشرط أن يكون المتجر مربوطاً (`anoofy_connected_at` غير فارغ).

**الترويسات:** نفس الترويسات الموقعة (`X-Anoofy-Key-Id`, `X-Anoofy-Timestamp`, `X-Anoofy-Signature`).

**بنية `data`:**
```json
{
  "wc_order_id": 5001,
  "stage": "CONFIRMED",
  "previous_stage": "PENDING_CONFIRMATION",
  "changed_at": "2026-11-04T12:10:00Z",
  "branch_name": "الفرع الرئيسي",
  "courier_name": "شركة أرامكس",
  "tracking_number": "TRK-987654321"
}
```

- `wc_order_id` (int): معرف الطلب في ووكومرس.
- `stage` (string): الحالة الجديدة للطلب (قيمة من `WcOrderStatus`).
- `previous_stage` (string|null): الحالة السابقة للطلب (قيمة من `WcOrderStatus` أو `null`).
- `changed_at` (string): توقيت تغيير الحالة بصيغة ISO-8601 UTC.
- `branch_name` (string|null): اسم الفرع المسند إليه الطلب (من علاقة `branch`).
- `courier_name` (string|null): اسم شركة الشحن (من عمود `courier_name` أو علاقة `courierParty`).
- `tracking_number` (string|null): رقم التتبع للشحنة (من عمود `tracking_number`).

**استجابات الـ Plugin المتوقعة للحدث الصادر:**
- `2xx Success`: نجاح الاستلام والمعالجة من قبل الإضافة (تشمل `processed`, `duplicate`, `stale` جميعها تُعامل كنجاح `200`).
- `401 Unauthorized` أو `4xx` (غير 429): خلل دائم في الربط أو البيانات (لا تتم إعادة المحاولة، وتتحول حالة الحدث إلى `FAILED`).
- `5xx`, `timeout`, `429 Too Many Requests`: خطأ مؤقت يستوجب إعادة المحاولة (Retry) مع Exponential Backoff.

---

## 5. استجابات النظام للطلبات الواردة (Inbound Responses)

| كود الحالة | المعنى | بنية الاستجابة |
| :--- | :--- | :--- |
| `200 OK` | تمت المعالجة بنجاح أو تم رصد حالة خاصة | `{"success": true, "data": {"result": "processed" \| "duplicate" \| "stale" \| "ignored", "reason": "..."}}` |
| `401 Unauthorized` | توقيع غير صالح، انتهاء وقت التوقيع، أو المتجر غير مربوط بعد | `{"success": false, "message": "...", "error_code": "..."}` |
| `409 Conflict` | الطلب لم يُسحب بعد من ووكومرس (`ORDER_NOT_YET_SYNCED`) | `{"success": false, "message": "الطلب غير متزامن بعد بالنظام", "error_code": "ORDER_NOT_YET_SYNCED"}` *(لا يُسجل في الـ inbox ليتمكن الـ plugin من إعادة المحاولة)* |
| `422 Unprocessable` | خلل في بنية البيانات أو عدم تطابق النطاق | `{"success": false, "message": "بيانات غير صالحة", "errors": {...}}` |

---

## 6. نتائج المعالجة الواردة (`result` في رد 200)

- `processed`: تم استلام الحدث وتطبيقه بنجاح.
- `duplicate`: معرف الحدث `event_id` تم استلامه ومعالجته مسبقاً (لن يتكرر التنفيذ).
- `stale`: رقم إصدار الطلب `order_version` أقل من أو يساوي الإصدار المسجل في النظام.
- `ignored`: تم تجاهل الحدث لسبب منطقي (مثال: تأكيد قديم قبل وقت الربط `before_connection`، أو حالة الطلب ليست `PENDING_CONFIRMATION`).
