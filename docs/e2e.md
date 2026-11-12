# بيئة الاختبار الشاملة والربط المحلي (E2E Environment Guide)

دليل تشغيل واختبار مشروع **EngazPRO** داخل بيئة Docker معزولة للتواصل ثنائي الاتجاه مع متجر ووكومرس وبلاجين **Anoofy** عبر شبكة مشتركة.

---

## 1. متطلبات النظام وإعدادات ملف الـ Hosts

يجب أن يحتوي ملف `hosts` على جهاز المطور (`C:\Windows\System32\drivers\etc\hosts`) على السطرين التاليين للوصول للمتجر وللنظام من المتصفح ومن الجهاز:

```text
127.0.0.1 anoofy-wp.test
127.0.0.1 engazpro.test
```

---

## 2. بنية الخدمات والمنافذ (Ports & Network Architecture)

| الخدمة | الحاوية | المنافذ (Host:Container) | الشبكات | الوصف والدور |
| :--- | :--- | :--- | :--- | :--- |
| **mysql** | `engaz-e2e-mysql` | `28306:3306` | `default` | قاعدة بيانات MySQL 8 معزولة مع Volume مستقل `engaz_e2e_mysql_data`. |
| **api** | `engaz-e2e-api` | `28180:28180` | `default`, `engaz-e2e` | خادم الـ API عبر Laravel Serve بـ alias `engazpro.test` على شبكة `engaz-e2e`. |
| **queue** | `engaz-e2e-queue` | - | `default`, `engaz-e2e` | عامل طابور المهام (`queue:work --tries=3`). |
| **scheduler** | `engaz-e2e-scheduler` | - | `default`, `engaz-e2e` | مجدول المهام الدورية (`schedule:work`). |
| **web** | `engaz-e2e-web` | `28181:28181` | `default` | واجهة المستخدم (Vite / React) متاحة للمتصفح الخارجي. |

### قواعد عزل الشبكة:
1. **`mysql`**: موضوعة على شبكة `default` فقط لمنع أي وصول خارجي غير مصرح به من الحاويات الأخرى على الشبكة المشتركة.
2. **`api` و `queue` و `scheduler`**: مشتركون في `default` (للتحدث مع قاعدة البيانات) و `engaz-e2e` (للتحدث مع المتجر `anoofy-wp.test:28080`).
3. **`engazpro.test` Alias**: محجوز حصرياً لخدمة الـ `api` على شبكة `engaz-e2e` لتمكين البلاجين من إرسال الأحداث وتأكيدات الربط إليه مباشرة بدون الاعتماد على `host.docker.internal` أو `extra_hosts`.

---

## 3. لماذا تم ضبط `PHP_CLI_SERVER_WORKERS=4`؟

خادم التطوير المدمج في لارافيل (`php artisan serve`) يعمل افتراضياً بمسار تنفيذ أحادي الخيط (single-threaded / single process).
في سيناريو الربط المباشر مع Anoofy:
- يقوم EngazPRO بطلب تحقق أو مزامنة إلى المتجر (`anoofy-wp.test:28080`).
- أثناء معالجة الطلب، يقوم المتجر بالرد فوراً أو استدعاء ويب هوك عكسي للـ API (`engazpro.test:28180`).
- إذا كان هناك worker واحد فقط، ستتعلق الحاوية في انتظار انتهاء الطلب الخارجي بينما الطلب العكسي معلق في انتظار توفر الخادم، مما يسبب **قفل متبادل (Deadlock)**.
لذلك تم تثبيت `PHP_CLI_SERVER_WORKERS=4` (مع تفعيل إضافة `pcntl`) لمعالجة حتى 4 طلبات متزامنة بسلاسة وأمان.

---

## 4. ووكومرس ومصادقة HTTP في بيئة التطوير (WooCommerce over HTTP)

لا يتطلب الربط أي تعديل على كود `WooCommerceApiClient` في EngazPRO:
- بلاجين `anoofy-woo` على الووردبريس مزود بـ `mu-plugin` مخصص للتطوير (`anoofy-e2e-dev.mu.php`).
- يقوم هذا الـ plugin بمعالجة وتمرير ترويسات المصادقة الأساسية (Basic Auth / Application Passwords) عبر بروتوكول `http://` في بيئة التطوير المحلية دون اشتراط شهادة SSL/HTTPS.

---

## 5. أوامر التشغيل والإدارة اليومية

### إقلاع بيئة الـ E2E:
```bash
docker compose -f docker-compose.e2e.yml up -d --build
```

### فحص حالة الحاويات:
```bash
docker compose -f docker-compose.e2e.yml ps
```

### تنفيذ الهجرات والتغذية الأولية (Migrate & Seed):
```bash
docker compose -f docker-compose.e2e.yml exec api php artisan migrate:fresh --seed
```

### إنشاء مستخدم تجريبي بصلاحية Owner:
```bash
docker compose -f docker-compose.e2e.yml exec api php artisan tinker --execute="
\$user = App\Models\User::firstOrCreate(
    ['email' => 'admin@engazpro.test'],
    ['name' => 'E2E Admin', 'password' => bcrypt('password'), 'role' => App\Enums\UserRole::OWNER->value, 'is_active' => true]
);
App\Models\Subscription::firstOrCreate(
    ['user_id' => \$user->id],
    ['status' => 'ACTIVE', 'plan' => 'ANNUAL', 'price' => 1000, 'start_date' => now()->toDateString(), 'end_date' => now()->addYear()->toDateString()]
);
echo 'User ready: ' . \$user->email . PHP_EOL;
"
```

### إيقاف البيئة:
```bash
docker compose -f docker-compose.e2e.yml down
```
