# EngazPRO Core Design System Components (`ui/`)

مكتبة المكونات الأساسية لواجهة منصة EngazPRO المبنية بالكامل على Semantic Design Tokens (بدون أي ألوان Tailwind خام أو أكواد Hex ثابتة).

---

## 1. جدول المكونات والخصائص (Components & Props)

| المكوّن | الملف | الخصائص الأساسية (Props) | الوصف |
| :--- | :--- | :--- | :--- |
| **`Button`** | `Button.tsx` | `variant` (`primary`, `secondary`, `ghost`, `danger`), `size` (`sm`, `md`, `lg`), `isLoading` (boolean), `disabled` (boolean), `leftIcon`, `rightIcon` | زر تفاعلي بارتفاع $\ge 44\text{px}$ للمقاسين md و lg مع حالة تحميل ودعم إمكانية الوصول. |
| **`Card`** | `Card.tsx` | `as` (HTML element type), `className`, `children` | حاوية بطاقة بتصميم زجاجي هادئ وخلفية `panel` وحدود `line` وزوايا مستديرة `rounded-2xl`. |
| **`Badge`** | `Badge.tsx` | `tone` (`brand`, `ok`, `warn`, `bad`, `info`, `neutral`), `dot` (boolean), `children` | شارة نصية دلالية لعرض الحالات بألوان متوافقة مع الوضعين الفاتح والداكن. |
| **`Input`** | `Input.tsx` | `label` (string), `error` (string), `helperText` (string), `leftIcon`, `rightIcon`, Standard input HTML attributes | حقل إدخال بنصوص مساعدة وتنبيهات أخطاء متوافق مع قارئات الشاشة `aria-invalid`. |
| **`Select`** | `Select.tsx` | `label` (string), `error` (string), `helperText` (string), `options` (`{value, label, disabled}[]`), Standard select HTML attributes | قائمة منسدلة بمؤشر أنيق ودعم للأخطاء والتعطيل مع ارتفاع مريح للّمس. |
| **`Textarea`** | `Textarea.tsx` | `label` (string), `error` (string), `helperText` (string), `rows` (number), Standard textarea HTML attributes | حقل نصوص متعدد الأسطر مع دعم التنبيهات والأخطاء. |
| **`Tabs`** | `Tabs.tsx` | `tabs` (`{id, label, count?, disabled?}[]`), `activeTab` (string), `onChange` (`(id: string) => void`) | شريط تبويبات متجاوب مع دعم العدادات `count` وحالة النشاط. |
| **`DataTable`** | `DataTable.tsx` | `tableClassName` (string), `children`, Standard div HTML attributes | غلاف متجاوب للجداول يوفر تمرير أفقي سلس `overflow-x-auto` وحدود ناعمة. |
| **`PageHeader`** | `PageHeader.tsx` | `title` (string), `description` (string), `badge` (ReactNode), `actions` (ReactNode) | ترويسة قياسية للصفحات مع دعم العنوان والوصف وأزرار الإجراءات. |
| **`EmptyState`** | `EmptyState.tsx` | `icon` (ReactNode), `title` (string), `description` (string), `action` (ReactNode) | واجهة الحالة الفارغة لعرض رسائل عدم توفر البيانات مع زر استدعاء الإجراء. |

---

## 2. قواعد الاستخدام الصارمة

1. **الاعتماد الكلي على الـ Semantic Tokens:**
   يُمنع منعاً باتاً استخدام أي لون خام من ألوان Tailwind الافتراضية (مثل `slate-500` أو `emerald-600`) أو أي قيمة Hex مباشرة داخل هذا المجلد.
2. **فحص الـ Linter الآلي:**
   أي إضافة أو تعديل في هذا المجلد يخضع لفحص صارم بنسبة تسامح صفرية (Zero Tolerance) عبر السكريبت:
   ```bash
   npm run check:design
   ```
