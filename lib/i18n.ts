// Repo-local translation dictionary. The whole app's Arabic comes from HERE — switching
// the language in Settings looks every UI string up in this map (no browser/Chrome
// translation, no per-screen inline strings). Keyed by the exact English source string;
// any string missing from the map gracefully falls back to its English text.
//
// Add a new translatable string by wrapping it with t('English text') in a component and
// adding an entry below. See components/AccessibilityProvider.tsx → t().

// LLMs (Llama, etc.) occasionally return the WRONG language for a field we asked to be
// Arabic — Vietnamese, Chinese, English, … isArabicText detects this so callers can
// reject it: the citizen must NEVER see a non-Arabic string in an "Arabic" section.
export function isArabicText(s: string | null | undefined): boolean {
  const t = String(s ?? '').trim()
  if (!t) return false
  // Arabic block + Arabic Supplement/Extended-A + presentation forms.
  const arabic = (t.match(/[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/g) || []).length
  const letters = (t.match(/\p{L}/gu) || []).length
  return letters > 0 && arabic / letters >= 0.5
}

// Demo/debug transparency: when MARK_FALLBACKS=true, prefix any deterministic (non-LLM)
// fallback text with "(fallback)" so you can tell at a glance whether the LLM actually
// produced the text or the system fell back. Set MARK_FALLBACKS=false (or unset) for the
// real demo so citizens never see the marker.
export function markFallback(text: string | null | undefined): string {
  const t = String(text ?? '')
  if (!t || process.env.MARK_FALLBACKS !== 'true') return t
  return `(fallback) ${t}`
}

// Use the LLM's Arabic only if it is genuinely Arabic; otherwise the known-Arabic
// fallback (tagged via markFallback so a swapped-in Arabic string is visible too).
export function arabicOrFallback(candidate: string | null | undefined, fallback: string): string {
  return isArabicText(candidate) ? String(candidate).trim() : markFallback(fallback)
}

export const AR: Record<string, string> = {
  // ── Common / chrome ─────────────────────────────────────────────
  Submit: 'إرسال',
  Processing: 'المعالجة',
  Settings: 'الإعدادات',
  Logout: 'تسجيل الخروج',
  Dashboard: 'لوحة المعلومات',
  'Officer View': 'الموظف',
  Back: 'رجوع',
  Cancel: 'إلغاء',
  Refresh: 'تحديث',
  Continue: 'متابعة',
  'Home': 'الرئيسية',
  'Services': 'الخدمات',
  'Housing Arrears Rescheduling': 'إعادة جدولة متأخرات السكن',

  // ── Login ───────────────────────────────────────────────────────
  'For a personalised experience, please sign in.': 'لتجربة مخصّصة، يرجى تسجيل الدخول.',
  'Sign in with UAE PASS': 'الدخول عبر الهوية الرقمية',
  'What is UAE PASS?': 'ما هي الهوية الرقمية؟',
  'Continue as an Officer': 'الدخول كموظف',
  'Sign In': 'دخول',
  'Signing in…': 'جارٍ الدخول…',
  'Officer Login': 'دخول الموظف',
  'Officer Username / ID': 'اسم المستخدم / المعرّف',
  Password: 'كلمة المرور',
  'Log In': 'تسجيل الدخول',
  'Logging in…': 'جارٍ الدخول…',
  'Got it': 'حسناً',
  'UAE PASS is the first national digital identity for all citizens, residents, and visitors in the United Arab Emirates. It allows you to access various government and private sector services securely online, sign documents digitally, and verify your identity without needing physical visits.':
    'الهوية الرقمية هي أول هوية رقمية وطنية لجميع المواطنين والمقيمين والزوار في دولة الإمارات. تتيح لك الوصول إلى خدمات حكومية وخاصة بأمان عبر الإنترنت، وتوقيع المستندات رقمياً، والتحقق من هويتك دون الحاجة إلى الحضور الشخصي.',
  'Application ID not found. Please enter a valid ID (e.g. MSZHP_111325).': 'رقم الطلب غير موجود. يرجى إدخال رقم صحيح (مثال: MSZHP_111325).',
  'Invalid credentials.': 'بيانات الدخول غير صحيحة.',
  'Could not reach the sign-in service.': 'تعذّر الوصول إلى خدمة الدخول.',

  // ── Submission wizard ───────────────────────────────────────────
  'SADDAD — Housing Arrears Rescheduling': 'سدّد — إعادة جدولة متأخرات السكن',
  'Verify Application': 'التحقق من الطلب',
  'Financial Details': 'التفاصيل المالية',
  Documents: 'المستندات',
  Reason: 'السبب',
  'Review & Submit': 'المراجعة والإرسال',
  'Enter your Application ID to retrieve your loan record.': 'أدخل رقم الطلب لاسترداد سجل القرض الخاص بك.',
  'Application ID': 'رقم الطلب',
  'Retrieving Profile…': 'جارٍ استرداد الملف…',
  'Retrieve Profile': 'استرداد الملف',
  'Confirm the financial details retrieved from MOEI systems.': 'تأكيد التفاصيل المالية المستردة من أنظمة الوزارة.',
  'Change Case': 'تغيير الطلب',
  'UAE PASS — Verified Identity & Social Profile': 'الهوية الرقمية — الهوية والحالة الاجتماعية',
  'Priority care': 'رعاية ذات أولوية',
  'Full Name': 'الاسم الكامل',
  'Emirates ID': 'الهوية الإماراتية',
  Phone: 'الهاتف',
  'Marital Status': 'الحالة الاجتماعية',
  'Family Size': 'حجم الأسرة',
  Children: 'الأبناء',
  'Social Status': 'الفئة الاجتماعية',
  'Retrieved Programme Data — MOEI Systems / Financial Services': 'البيانات المُستردة — أنظمة الوزارة / الخدمات المالية',
  Bank: 'البنك',
  'Loan Account': 'رقم الحساب',
  'Original Loan (AED)': 'القرض الأصلي (درهم)',
  'Remaining Balance (AED)': 'الرصيد المتبقي (درهم)',
  'Current Installment (AED/mo)': 'القسط الحالي (درهم/شهر)',
  'Remaining Period': 'المدة المتبقية',
  'Payment History (last 8mo)': 'سجل السداد (آخر ٨ أشهر)',
  'Months in Arrears': 'أشهر التأخر',
  'Auto DDA Enrolled': 'مسجّل في الخصم التلقائي',
  'Income change on record': 'تغيّر في الدخل مسجّل',
  'Enter these two values': 'أدخل هاتين القيمتين',
  'Monthly Salary (AED)': 'الراتب الشهري (درهم)',
  'Amount Due (AED)': 'المبلغ المستحق (درهم)',
  'Confirm & Continue': 'تأكيد ومتابعة',
  'Upload Documents': 'رفع المستندات',
  'Please upload your current Salary Certificate to verify your income.': 'يرجى رفع شهادة الراتب الحالية للتحقق من دخلك.',
  'Drag & drop your salary certificate': 'اسحب وأفلت شهادة الراتب',
  'PDF up to 5MB': 'ملف PDF حتى ٥ ميجابايت',
  'Browse Files': 'تصفّح الملفات',
  'Click to upload a different file': 'انقر لرفع ملف آخر',
  'Reason for Rescheduling': 'سبب إعادة الجدولة',
  'Explain why you require a rescheduling of your housing loan payments.': 'اشرح سبب حاجتك لإعادة جدولة أقساط قرض السكن.',
  'Reschedule Reason': 'سبب إعادة الجدولة',
  Details: 'التفاصيل',
  'Review your application details before submitting to SADDAD.': 'راجع تفاصيل طلبك قبل الإرسال إلى سدّد.',
  'Retrieved Applicant Name': 'اسم مقدّم الطلب المسترد',
  'Total Arrears Amount': 'إجمالي المبلغ المتأخر',
  'Salary Certificate': 'شهادة الراتب',
  'Not uploaded (optional)': 'لم يتم الرفع (اختياري)',
  'Required — not uploaded': 'مطلوب — لم يتم الرفع',
  'Rescheduling Reason': 'سبب إعادة الجدولة',
  'I agree to a total monthly salary deduction capped at 20% of my salary (≈ AED {x}/month) in accordance with the MOEI Terms and Conditions.': '',
  'I certify that all details and documents provided are accurate and authentic, and understand that false or altered declarations will lead to rescheduling cancellation.':
    'أقرّ بأن جميع التفاصيل والمستندات المقدّمة صحيحة وأصلية، وأفهم أن أي إقرار كاذب أو مُعدّل سيؤدي إلى إلغاء إعادة الجدولة.',
  'Submit to SADDAD': 'إرسال إلى سدّد',
  'Queuing Case…': 'جارٍ إضافة الطلب…',

  // ── Case submitted ──────────────────────────────────────────────
  'Case Submitted': 'تم استلام الطلب',
  'Case Number': 'رقم القضية',
  'Queue Position': 'الترتيب في قائمة الانتظار',
  'Next up': 'التالي',
  'Est. Wait Time': 'وقت الانتظار المتوقع',
  Now: 'الآن',
  'You will receive a WhatsApp notification when your case is processed.': 'ستتلقى إشعاراً عبر واتساب عند معالجة طلبك.',
  'Watch Live Processing': 'متابعة المعالجة المباشرة',

  // ── Citizen home / cards ────────────────────────────────────────
  'My Applications': 'طلباتي',
  'My Cases': 'طلباتي',
  'Your housing-arrears rescheduling applications and their status.': 'طلبات إعادة جدولة متأخرات السكن الخاصة بك وحالتها.',
  'New Application': 'طلب جديد',
  'No applications yet': 'لا توجد طلبات بعد',
  'Start a housing-arrears rescheduling request to see it here.': 'ابدأ طلب إعادة جدولة لمتأخرات السكن لتظهر هنا.',
  'Start your application': 'ابدأ طلبك',
  Arrears: 'المتأخرات',
  'Monthly plan': 'الخطة الشهرية',
  Duration: 'المدة',
  'View Progress': 'متابعة الحالة',
  'Submit Documents': 'رفع المستندات',
  'Re-apply': 'إعادة التقديم',
  'View Details': 'عرض التفاصيل',
  'Awaiting Officer Review': 'بانتظار مراجعة الموظف',
  'Back to my applications': 'العودة إلى طلباتي',
  "Awaiting officer review — you'll be notified": 'بانتظار مراجعة الموظف — سيتم إشعارك',
  'Your rescheduling plan is active': 'خطة إعادة الجدولة الخاصة بك فعّالة',
  'This application is still being processed': 'لا يزال هذا الطلب قيد المعالجة',
  'Open the live view to watch the AI agents evaluate your request.': 'افتح العرض المباشر لمتابعة تقييم الوكلاء لطلبك.',
  'Loading your applications…': 'جارٍ تحميل طلباتك…',

  // ── Citizen statuses ────────────────────────────────────────────
  Approved: 'تمت الموافقة',
  'Human Review Required': 'مطلوب مراجعة موظف',
  Rejected: 'مرفوض',
  'Additional Information Required': 'مطلوب معلومات إضافية',

  // ── Request status / processing ─────────────────────────────────
  'Request Status': 'حالة الطلب',
  'Citizen View': 'عرض المواطن',
  'Decision Trace': 'مسار القرار',
  'Citizen Access View': 'عرض المواطن',
  'Displaying client-safe plain-language status timeline.': 'عرض الجدول الزمني للحالة بلغة مبسّطة.',
  'Officer Decision Trace (Developer & Auditor Demo)': 'مسار قرار الموظف (عرض المطوّر والمدقّق)',
  'Displaying auditable step-by-step agent telemetry trace.': 'عرض مسار خطوات الوكلاء القابل للتدقيق.',
  'Case Review Underway': 'قيد المراجعة والتدقيق',
  'Expected Verification Time: 3 to 5 Working Days': 'المدة المتوقعة للتحقق: ٣ إلى ٥ أيام عمل',
  'Application Progress Timeline': 'الجدول الزمني لتقدّم الطلب',
  'Back to Home': 'العودة إلى الرئيسية',
  'Connection Error': 'خطأ في الاتصال',
  Prev: 'السابق',
  Pause: 'إيقاف',
  Play: 'تشغيل',
  Next: 'التالي',
  'Skip to Verdict': 'الانتقال إلى القرار',
  Restart: 'إعادة التشغيل',
  'Expand All Details': 'عرض كل التفاصيل',
  'Show Technical Details': 'عرض التفاصيل التقنية',
  'Hide Technical Details': 'إخفاء التفاصيل التقنية',
  'trace step': 'خطوة المسار',

  // ── Decision detail panels ──────────────────────────────────────
  'Rescheduling Plan': 'خطة إعادة الجدولة',
  'Structured Assessment': 'التقييم المنظّم',
  'Document Verification': 'التحقق من المستند',
  'How to get approved': 'كيفية الحصول على الموافقة',
  'AI Rationale': 'المبررات',
  'Processing Time': 'زمن المعالجة',
  'Application Status': 'حالة الطلب',
  Complete: 'مكتمل',
  Incomplete: 'غير مكتمل',
  Recommendation: 'التوصية',
  'confidence': 'ثقة',

  // ── Feedback ────────────────────────────────────────────────────
  'Rate your experience': 'قيّم تجربتك',
  'Your feedback helps us improve the service.': 'ملاحظاتك تساعدنا على تحسين الخدمة.',
  'Your name': 'الاسم',
  'Comments (optional)': 'ملاحظات (اختياري)',
  'Tell us about your experience…': 'أخبرنا عن تجربتك…',
  'Submit Feedback': 'إرسال الملاحظات',
  'Submitting…': 'جارٍ الإرسال…',
  'Thank you for your feedback!': 'شكراً لتقييمك!',

  // ── Officer portal ──────────────────────────────────────────────
  'Officer Portal': 'بوابة الموظف',
  'Internal Use Only': 'للاستخدام الداخلي فقط',
  'Escalated Cases': 'الحالات المُصعّدة',
  'Cases referred for officer review — requires manual decision.': 'حالات مُحالة لمراجعة الموظف — تتطلب قراراً يدوياً.',
  pending: 'قيد الانتظار',
  priority: 'أولوية',
  '★ Priority — Fast-Track': '★ أولوية — مسار سريع',
  'Priority beneficiaries escalated for a genuine reason — handle first.': 'مستفيدون ذوو أولوية صُعّدوا لسبب فعلي — تُعالَج أولاً.',
  'Standard Escalations': 'التصعيدات العادية',
  'No escalated cases': 'لا توجد حالات مُصعّدة',
  'AI Analysis (English)': 'تحليل الذكاء الاصطناعي',
  Approve: 'موافقة',
  Reject: 'رفض',
  'Citizen Feedback': 'ملاحظات المواطنين',
  'Ratings and comments submitted after a decision.': 'التقييمات والملاحظات المقدّمة بعد القرار.',
  'average rating': 'متوسط التقييم',
  'total responses': 'إجمالي الردود',
  'No feedback yet': 'لا توجد ملاحظات بعد',
}
