<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>رمز استعادة كلمة المرور</title>
</head>
<body style="font-family: Tahoma, Arial, sans-serif; background: #F5F6FA; margin: 0; padding: 24px; color: #111827;">
  <div style="max-width: 520px; margin: 0 auto; background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 16px; padding: 28px;">
    <div style="font-size: 18px; font-weight: bold; color: #5E3BEE; margin-bottom: 12px;">
      EBMS — Easy Work
    </div>
    <h2 style="font-size: 18px; margin: 0 0 10px; color: #111827;">رمز استعادة كلمة المرور</h2>
    <p style="font-size: 14px; line-height: 1.7; color: #374151; margin: 0 0 18px;">
      مرحباً <strong>{{ $userName }}</strong>، تم طلب إعادة تعيين كلمة المرور لحساب متجرك في نظام EBMS. استخدم رمز التحقق التالي لإكمال التعيين:
    </p>
    <div style="background: #F6F4FF; border: 1px dashed #7C3AED; border-radius: 12px; padding: 16px; text-align: center; margin-bottom: 18px;">
      <span style="font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #4B29D6; font-family: monospace;">{{ $otpCode }}</span>
    </div>
    <p style="font-size: 13px; color: #6B7280; margin: 0 0 8px;">
      هذا الرمز صالح لمدة <strong>{{ $ttlMinutes }} دقائق</strong> فقط ولا تشاركه مع أي شخص.
    </p>
    <p style="font-size: 12px; color: #9CA3AF; margin: 0;">
      إذا لم تطلب تغيير كلمة المرور، يمكنك تجاهل هذه الرسالة بأمان.
    </p>
  </div>
</body>
</html>
