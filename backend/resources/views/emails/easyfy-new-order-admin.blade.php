<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>تنبيه طلب متجر Easyfy</title>
</head>
<body style="font-family: Tahoma, Arial, sans-serif; background: #F5F6FA; margin: 0; padding: 24px; color: #111827;">
  <div style="max-width: 560px; margin: 0 auto; background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 16px; padding: 28px;">
    <div style="font-size: 18px; font-weight: bold; color: #5E3BEE; margin-bottom: 12px;">
      Easyfy Supplies — لوحة الإدارة
    </div>
    <h2 style="font-size: 18px; margin: 0 0 10px; color: #111827;">
      {{ $isProofReupload ? 'تم رفع إثبات تحويل محدث للطلب' : 'وصل طلب جديد من متجر مستلزمات الشحن' }} ({{ $order->order_number }})
    </h2>
    <p style="font-size: 14px; line-height: 1.7; color: #374151; margin: 0 0 14px;">
      <strong>المتجر:</strong> {{ $order->store_name }} ({{ $order->store_code }})<br />
      <strong>الأونر:</strong> {{ $order->owner_name }} — {{ $order->owner_phone }}<br />
      <strong>صاحب الطلب الفعلي:</strong> {{ $order->ordered_by_name }} ({{ $order->ordered_by_role }}) — {{ $order->ordered_by_phone }}<br />
      <strong>المحافظة والعنوان:</strong> {{ $order->governorate }} — {{ $order->shipping_address }}
    </p>
    <div style="background: #F6F4FF; border: 1px dashed #7C3AED; border-radius: 12px; padding: 14px; margin-bottom: 16px;">
      <strong>الإجمالي:</strong> {{ number_format((float) $order->total_amount, 2) }} ج.م<br />
      <strong>وسيلة الدفع:</strong> {{ $order->payment_method?->label() }}<br />
      @if($order->transfer_reference)
        <strong>المرجع البنكي / التحويل:</strong> {{ $order->transfer_reference }}<br />
      @endif
      <strong>حالة مراجعة التحويل:</strong> {{ $order->payment_verification_status?->label() }}
    </div>
    <p style="font-size: 12px; color: #6B7280; margin: 0;">
      يمكنك مراجعة إثبات التحويل وتأكيد الطلب وتحديث حالته من لوحة تحكم السوبر أدمن.
    </p>
  </div>
</body>
</html>
