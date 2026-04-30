'use client';

import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import ValidatedInput from '@/components/ValidatedInput';
import ThemeSlideshow from '@/components/ThemeSlideshow';
import CharacterPreview from '@/components/CharacterPreview';
import { fetchCustomerStyleOptions, fetchEligibleThemes, type Theme } from '@/lib/themes';
import {
  HAIR_CODES,
  EYE_CODES,
  DEFAULT_HAIR,
  DEFAULT_EYE,
  buildAssetCode,
  type Gender,
  type ParentsContent,
  type PackageCode,
} from '@/lib/constants';
import {
  validateOrderCode,
  validateCustomerName,
  validateWhatsapp,
  validateEmail,
  validateChildNickname,
  validateChildFullName,
  validateBirthdayNumber,
  validateParentNickname,
  validateParentSweetname,
  type ValidationResult,
} from '@/lib/validation';
import {
  LOCALE_STORAGE_KEY,
  UI_COPY,
  birthdayAge,
  isLocale,
  packageLabel,
  parentsLabel,
  type Locale,
} from '@/lib/i18n';

// ============================================================================
// STATE TYPES
// ============================================================================
type OrderState = {
  step: number;
  // step 1
  order_code: string;
  package_code: PackageCode | '';
  package_label: string;
  live_session_id: string | null;
  attempts: number;
  // step 2
  customer_name: string;
  country_code: string;
  whatsapp_number: string;
  email: string;
  // step 3
  child_nickname: string;
  child_full_name: string;
  birthday_number: string;
  // step 4 — locked default Boy + HA + EA
  character_gender: Gender;
  hair_style_code: string;
  eyeglasses_code: string;
  // step 5
  parents_content: ParentsContent | '';
  // step 6
  theme_code: string;
  theme_name: string;
  theme_image: string;
  theme_nickname_usage: 'none' | 'video' | 'print' | 'both';
  theme_requires_parents_sweetname: boolean;
  mom_nickname: string;
  dad_nickname: string;
  mom_sweetname: string;
  dad_sweetname: string;
};

const INITIAL_STATE: OrderState = {
  step: 1,
  order_code: '',
  package_code: '',
  package_label: '',
  live_session_id: null,
  attempts: 0,
  customer_name: '',
  country_code: '+62',
  whatsapp_number: '',
  email: '',
  child_nickname: '',
  child_full_name: '',
  birthday_number: '',
  character_gender: 'boy',
  hair_style_code: DEFAULT_HAIR,
  eyeglasses_code: DEFAULT_EYE,
  parents_content: '',
  theme_code: '',
  theme_name: '',
  theme_image: '',
  theme_nickname_usage: 'none',
  theme_requires_parents_sweetname: false,
  mom_nickname: '',
  dad_nickname: '',
  mom_sweetname: '',
  dad_sweetname: '',
};

const TOTAL_STEPS = 8;

const LocaleContext = createContext<Locale>('id');

function useLocaleCopy() {
  const locale = useContext(LocaleContext);
  return { locale, copy: UI_COPY[locale] };
}

function getNicknameUsage(theme: Theme): 'none' | 'video' | 'print' | 'both' {
  const hasNewFlags =
    typeof theme.requires_parents_nickname_video === 'boolean' ||
    typeof theme.requires_parents_nickname_print === 'boolean';
  const video = hasNewFlags
    ? !!theme.requires_parents_nickname_video
    : !!theme.requires_parents_nickname;
  const print = !!theme.requires_parents_nickname_print;

  if (video && print) return 'both';
  if (video) return 'video';
  if (print) return 'print';
  return 'none';
}

function needsParentNickname(theme: Theme): boolean {
  return getNicknameUsage(theme) !== 'none';
}

function nicknameUsageText(theme: Theme, locale: Locale): string {
  const usage = getNicknameUsage(theme);
  if (usage === 'video') return locale === 'en' ? 'Used in the video.' : 'Dipakai di video.';
  if (usage === 'print') return locale === 'en' ? 'Used in the print-ready file.' : 'Dipakai di file siap cetak.';
  if (usage === 'both') return locale === 'en' ? 'Used in the video and print-ready file.' : 'Dipakai di video dan file siap cetak.';
  return '';
}

function nicknameUsageMessage(usage: 'none' | 'video' | 'print' | 'both', locale: Locale): string {
  if (usage === 'both') return locale === 'en' ? 'The nickname in this theme will appear in the VIDEO and print-ready file.' : 'Nickname dalam tema ini akan ditampilkan pada VIDEO dan file siap cetak.';
  if (usage === 'print') return locale === 'en' ? 'The nickname in this theme will ONLY appear in the print-ready file.' : 'Nickname dalam tema ini HANYA ditampilkan pada file siap cetak.';
  if (usage === 'video') return locale === 'en' ? 'The nickname in this theme will ONLY appear in the VIDEO.' : 'Nickname dalam tema ini HANYA ditampilkan pada VIDEO.';
  return '';
}

function sweetnameUsageMessage(required: boolean, locale: Locale): string {
  if (!required) return '';
  return locale === 'en' ? 'The sweetname in this theme will ONLY appear in the VIDEO.' : 'Sweetname dalam tema ini HANYA ditampilkan pada VIDEO.';
}

// ============================================================================
// MAIN PAGE
// ============================================================================
export default function CustomerPage() {
  const [locale, setLocale] = useState<Locale>('id');
  const [s, setS] = useState<OrderState>(INITIAL_STATE);
  const [orderCodeError, setOrderCodeError] = useState<ValidationResult | null>(null);
  const [validatingCode, setValidatingCode] = useState(false);
  const [adminBlocked, setAdminBlocked] = useState(false);
  const [adminCode, setAdminCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [orderId, setOrderId] = useState('');

  // Theme state
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loadingThemes, setLoadingThemes] = useState(false);
  const [visibleHairCodes, setVisibleHairCodes] = useState<string[]>(HAIR_CODES);
  const [visibleEyeCodes, setVisibleEyeCodes] = useState<string[]>(EYE_CODES);

  // Modal state
  const [pendingTheme, setPendingTheme] = useState<Theme | null>(null);
  const [modalErrors, setModalErrors] = useState<Record<string, string>>({});

  // Field-level validity tracking — block "Lanjut" until all valid
  const [validity, setValidity] = useState<Record<string, boolean>>({});
  const setFieldValid = useCallback((key: string, valid: boolean) => {
    setValidity((prev) => (prev[key] === valid ? prev : { ...prev, [key]: valid }));
  }, []);

  const update = useCallback(
    <K extends keyof OrderState>(key: K, value: OrderState[K]) => {
      setS((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const copy = UI_COPY[locale];

  useEffect(() => {
    const saved = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (isLocale(saved)) setLocale(saved);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    let active = true;
    fetchCustomerStyleOptions()
      .then((options) => {
        if (!active) return;
        const nextHairCodes = options.hair_codes.length > 0 ? options.hair_codes : HAIR_CODES;
        const nextEyeCodes = options.eyeglasses_codes.length > 0 ? options.eyeglasses_codes : EYE_CODES;

        setVisibleHairCodes(nextHairCodes);
        setVisibleEyeCodes(nextEyeCodes);
        setS((current) => ({
          ...current,
          hair_style_code: nextHairCodes.includes(current.hair_style_code)
            ? current.hair_style_code
            : nextHairCodes[0] ?? DEFAULT_HAIR,
          eyeglasses_code: nextEyeCodes.includes(current.eyeglasses_code)
            ? current.eyeglasses_code
            : nextEyeCodes[0] ?? DEFAULT_EYE,
        }));
      })
      .catch(() => {
        if (!active) return;
        setVisibleHairCodes(HAIR_CODES);
        setVisibleEyeCodes(EYE_CODES);
      });

    return () => {
      active = false;
    };
  }, []);

  // ==========================================================================
  // STEP 1 — Validate code
  // ==========================================================================
  const handleValidateCode = async () => {
    const code = s.order_code.toUpperCase().trim();
    const local = validateOrderCode(code, locale);
    if (!local.ok) {
      setOrderCodeError(local);
      return;
    }
    setValidatingCode(true);
    setOrderCodeError(null);
    try {
      const res = await fetch('/api/customer/validate-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, locale }),
      });
      const data = await res.json();
      if (!res.ok || !data.valid) {
        setS((prev) => ({ ...prev, attempts: prev.attempts + 1 }));
        const next = { ok: false, error: data.error || copy.submitFailed, hint: data.hint, example: data.example };
        setOrderCodeError(next);
        if (s.attempts + 1 >= 3) {
          setAdminBlocked(true);
        }
        return;
      }
      setS((prev) => ({
        ...prev,
        package_code: data.package_code,
        package_label: data.package_label,
        live_session_id: data.live_session_id,
        step: 2,
      }));
      setOrderCodeError(null);
    } catch (e) {
      setOrderCodeError({
        ok: false,
        error: copy.serverUnavailable,
      });
    } finally {
      setValidatingCode(false);
    }
  };

  const handleAdminValidation = async () => {
    if (!adminCode.trim()) {
      alert(copy.adminRequired);
      return;
    }
    try {
      const res = await fetch('/api/customer/validate-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: s.order_code,
          admin_validation_code: adminCode.trim(),
          locale,
        }),
      });
      const data = await res.json();
      if (data.valid) {
        setS((prev) => ({ ...prev, attempts: 0, step: 2, package_code: data.package_code, package_label: data.package_label, live_session_id: data.live_session_id }));
        setAdminBlocked(false);
        setAdminCode('');
        setOrderCodeError(null);
      } else {
        alert(data.error || copy.adminWrong);
      }
    } catch {
      alert(copy.serverUnavailable);
    }
  };

  // ==========================================================================
  // STEP 6 — Fetch themes when entering step 6
  // ==========================================================================
  useEffect(() => {
    if (s.step !== 6) return;
    if (!s.package_code || !s.parents_content || !s.character_gender) return;
    let active = true;
    setLoadingThemes(true);
    fetchEligibleThemes({
      gender: s.character_gender,
      parents_content: s.parents_content as ParentsContent,
      package_code: s.package_code as PackageCode,
    })
      .then((data) => {
        if (active) setThemes(data);
      })
      .catch((e) => {
        console.error('fetchEligibleThemes', e);
        if (active) setThemes([]);
      })
      .finally(() => {
        if (active) setLoadingThemes(false);
      });
    return () => {
      active = false;
    };
  }, [s.step, s.character_gender, s.parents_content, s.package_code]);

  // ==========================================================================
  // STEP 6 — Theme select handler
  // ==========================================================================
  const handleThemeSelect = (theme: Theme) => {
    const nicknameUsage = getNicknameUsage(theme);
    setS((prev) => ({
      ...prev,
      theme_code: theme.theme_code,
      theme_name: theme.name,
      theme_image: theme.images[0]?.image_url || theme.image_url,
      theme_nickname_usage: nicknameUsage,
      theme_requires_parents_sweetname: !!theme.requires_parents_sweetname,
    }));
    // Logika modal sesuai sync spec — independen
    const needsAny = needsParentNickname(theme) || theme.requires_parents_sweetname;
    if (s.parents_content === 'none' || !needsAny) {
      // langsung selected, no modal
      return;
    }
    setPendingTheme(theme);
    setModalErrors({});
  };

  const closeModal = () => {
    setPendingTheme(null);
    // revert tema selection kalau cancel
    setS((prev) => ({
      ...prev,
      theme_code: '',
      theme_name: '',
      theme_image: '',
      theme_nickname_usage: 'none',
      theme_requires_parents_sweetname: false,
    }));
  };

  const confirmModal = () => {
    if (!pendingTheme) return;
    const pc = s.parents_content;
    const errs: Record<string, string> = {};

    if (needsParentNickname(pendingTheme)) {
      if (pc === 'single_mom' || pc === 'mom_and_dad') {
        const r = validateParentNickname(s.mom_nickname, 'mom', locale);
        if (!r.ok) errs.mom_nickname = r.error!;
      }
      if (pc === 'single_father' || pc === 'mom_and_dad') {
        const r = validateParentNickname(s.dad_nickname, 'dad', locale);
        if (!r.ok) errs.dad_nickname = r.error!;
      }
    }
    if (pendingTheme.requires_parents_sweetname) {
      if (pc === 'single_mom' || pc === 'mom_and_dad') {
        const r = validateParentSweetname(s.mom_sweetname, 'mom', locale);
        if (!r.ok) errs.mom_sweetname = r.error!;
      }
      if (pc === 'single_father' || pc === 'mom_and_dad') {
        const r = validateParentSweetname(s.dad_sweetname, 'dad', locale);
        if (!r.ok) errs.dad_sweetname = r.error!;
      }
    }

    if (Object.keys(errs).length > 0) {
      setModalErrors(errs);
      return;
    }
    setPendingTheme(null);
    setModalErrors({});
  };

  // ==========================================================================
  // SUBMIT
  // ==========================================================================
  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError('');
    try {
      const wa_full = s.country_code.replace('+', '') + s.whatsapp_number;
      const payload = {
        order_code: s.order_code,
        theme_code: s.theme_code,
        nama_pemesan: s.customer_name,
        whatsapp_full: wa_full,
        email: s.email || null,
        nickname_anak: s.child_nickname,
        nama_lengkap_anak: s.child_full_name,
        usia_anak: birthdayAge(s.birthday_number, locale),
        character_gender: s.character_gender,
        birthday_number: Number(s.birthday_number),
        hair_style_code: s.hair_style_code,
        eyeglasses_code: s.eyeglasses_code,
        parents_content: s.parents_content,
        mom_nickname: s.mom_nickname || null,
        dad_nickname: s.dad_nickname || null,
        mom_sweetname: s.mom_sweetname || null,
        dad_sweetname: s.dad_sweetname || null,
        preferred_language: locale,
      };
      const res = await fetch('/api/customer/submit-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setSubmitError(locale === 'en' ? copy.submitFailed : (data.error || copy.submitFailed));
        return;
      }
      setOrderId(data.public_order_id);
      update('step', 8);
    } catch (e) {
      setSubmitError(copy.contactServerFailed);
    } finally {
      setSubmitting(false);
    }
  };

  // ==========================================================================
  // STEP NAV
  // ==========================================================================
  const canGoNext = useMemo(() => {
    switch (s.step) {
      case 1:
        return validateOrderCode(s.order_code, locale).ok && !adminBlocked && !validatingCode;
      case 2:
        return (
          validateCustomerName(s.customer_name, locale).ok &&
          validateWhatsapp(s.whatsapp_number, locale).ok &&
          validateEmail(s.email, false, locale).ok
        );
      case 3:
        return (
          validateChildNickname(s.child_nickname, locale).ok &&
          validateChildFullName(s.child_full_name, locale).ok &&
          validateBirthdayNumber(s.birthday_number, locale).ok
        );
      case 4:
        return !!s.character_gender && !!s.hair_style_code && !!s.eyeglasses_code;
      case 5:
        return !!s.parents_content;
      case 6:
        return !!s.theme_code && !pendingTheme;
      case 7:
        return !submitting;
      default:
        return false;
    }
  }, [s, adminBlocked, validatingCode, pendingTheme, submitting, locale]);

  const goNext = async () => {
    if (!canGoNext) return;
    if (s.step === 1) {
      await handleValidateCode();
      return;
    }
    if (s.step === 7) {
      await handleSubmit();
      return;
    }
    update('step', s.step + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const goBack = () => {
    if (s.step <= 1) return;
    update('step', s.step - 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const goToStep = (n: number) => {
    update('step', n);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ==========================================================================
  // RENDER
  // ==========================================================================
  return (
    <LocaleContext.Provider value={locale}>
      {/* TOPBAR */}
      <header className="sticky top-0 z-50 bg-paper border-b border-line-soft px-4 pt-3.5 pb-3">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2 font-display text-[18px] font-semibold tracking-tight">
            <span className="w-[9px] h-[9px] rounded-full bg-accent shadow-[0_0_0_4px_var(--accent-soft)]" />
            <span>Birthday Custom</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="flex rounded-full border border-line bg-bg-alt p-0.5" aria-label={copy.language}>
              {(['id', 'en'] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setLocale(item)}
                  className={[
                    'px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors',
                    locale === item ? 'bg-ink text-white' : 'text-ink-soft',
                  ].join(' ')}
                >
                  {item}
                </button>
              ))}
            </div>
            <span className="text-[11px] font-semibold text-ink-soft bg-bg-alt px-2.5 py-1 rounded-full uppercase tracking-wider">
              {copy.stepBadge} {s.step} / {TOTAL_STEPS}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-8 gap-1">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => {
            const n = i + 1;
            const done = n < s.step;
            const active = n === s.step;
            return (
              <div
                key={n}
                className={[
                  'h-1 rounded-full overflow-hidden bg-line-soft relative',
                  done && 'bg-accent',
                  active && 'bg-gradient-to-r from-accent via-accent to-line-sog',
                ].filter(Boolean).join(' ')}
              />
            );
          })}
        </div>
      </header>

      {/* SCREENS */}
      <main className="px-4 pt-5 pb-28">
        {s.step === 1 && (
          <Step1
            value={s.order_code}
            onChange={(v) => update('order_code', v)}
            error={orderCodeError}
            attempts={s.attempts}
            blocked={adminBlocked}
            adminCode={adminCode}
            onAdminCodeChange={setAdminCode}
            onAdminVerify={handleAdminValidation}
            validating={validatingCode}
          />
        )}

        {s.step === 2 && (
          <Step2
            customerName={s.customer_name}
            countryCode={s.country_code}
            whatsapp={s.whatsapp_number}
            email={s.email}
            onChange={update}
            onValidity={setFieldValid}
          />
        )}

        {s.step === 3 && (
          <Step3
            nickname={s.child_nickname}
            fullName={s.child_full_name}
            birthdayNumber={s.birthday_number}
            onChange={update}
            onValidity={setFieldValid}
          />
        )}

        {s.step === 4 && (
          <Step4
            gender={s.character_gender}
            hair={s.hair_style_code}
            eye={s.eyeglasses_code}
            hairCodes={visibleHairCodes}
            eyeCodes={visibleEyeCodes}
            onChange={update}
          />
        )}

        {s.step === 5 && (
          <Step5
            value={s.parents_content}
            onChange={(v) => update('parents_content', v)}
          />
        )}

        {s.step === 6 && (
          <Step6
            themes={themes}
            loading={loadingThemes}
            selectedCode={s.theme_code}
            onSelect={handleThemeSelect}
          />
        )}

        {s.step === 7 && (
          <Step7
            state={s}
            onEdit={goToStep}
            error={submitError}
          />
        )}

        {s.step === 8 && (
          <Step8 orderId={orderId} packageCode={s.package_code as string} />
        )}
      </main>

      {/* FOOTER NAV (hidden di success step) */}
      {s.step < 8 && (
        <nav className="fixed bottom-0 left-0 right-0 max-w-[440px] mx-auto bg-paper border-t border-line-soft px-4 py-3 flex gap-2.5 z-40">
          {s.step > 1 && (
            <button
              onClick={goBack}
              className="px-4 py-3.5 rounded-[14px] border-[1.5px] border-line bg-transparent text-ink-soft font-semibold transition-colors hover:bg-bg-alt"
              aria-label={copy.back}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <button
            onClick={goNext}
            disabled={!canGoNext}
            className={[
              'flex-1 px-5 py-3.5 rounded-[14px] font-semibold text-[15px] transition-all',
              canGoNext
                ? 'bg-ink text-white hover:bg-[#1d1b3a] active:translate-y-px'
                : 'bg-ink-faint text-white opacity-50 cursor-not-allowed',
            ].join(' ')}
          >
            {s.step === 7 ? (submitting ? copy.submitting : `${copy.submitOrder} ✨`) : (validatingCode ? copy.validating : copy.next)}
          </button>
        </nav>
      )}

      {/* PARENTS MODAL */}
      {pendingTheme && (
        <ParentsModal
          theme={pendingTheme}
          state={s}
          onChange={update}
          errors={modalErrors}
          onConfirm={confirmModal}
          onClose={closeModal}
        />
      )}
    </LocaleContext.Provider>
  );
}

// ============================================================================
// STEP 1 — CODE INPUT
// ============================================================================
function Step1(props: {
  value: string;
  onChange: (v: string) => void;
  error: ValidationResult | null;
  attempts: number;
  blocked: boolean;
  adminCode: string;
  onAdminCodeChange: (v: string) => void;
  onAdminVerify: () => void;
  validating: boolean;
}) {
  const { locale, copy } = useLocaleCopy();
  const remaining = Math.max(0, 3 - props.attempts);
  return (
    <div>
      <p className="font-display italic text-accent-deep text-[13px] font-medium mb-1">
        {copy.welcome} ✨
      </p>
      <h1 className="font-display font-semibold text-[26px] leading-[1.1] tracking-tight mb-1.5">
        {copy.orderCodeTitle}
      </h1>
      <p className="text-ink-soft text-[14px] leading-relaxed mb-5">
        {copy.orderCodeIntro} <b>HM</b>, <b>RG</b>, <b>ST</b>, <b>RL</b>, atau <b>SL</b>.
      </p>

      <div className="mb-4">
        <label className="block text-[12px] font-semibold text-ink-soft mb-1.5 tracking-wide uppercase">
          {copy.orderCodeLabel} <span className="text-danger">*</span>
        </label>
        <input
          type="text"
          inputMode="text"
          value={props.value}
          onChange={(e) => props.onChange(e.target.value.toUpperCase().trim())}
          maxLength={10}
          placeholder="HM7A!9KQ2P"
          autoComplete="off"
          spellCheck={false}
          disabled={props.blocked || props.validating}
          className={[
            'w-full px-3.5 py-3 rounded-[14px] outline-none transition-all',
            'border-[1.5px] font-mono tracking-widest text-center text-base',
            props.error?.ok === false
              ? 'border-danger bg-[#fff7f9]'
              : 'border-line focus:border-accent focus:shadow-[0_0_0_3px_rgba(139,145,232,0.2)]',
            props.blocked || props.validating ? 'opacity-50 cursor-not-allowed' : '',
          ].join(' ')}
        />

        {props.error && !props.error.ok && (
          <ErrorBlock result={props.error} />
        )}

        {props.attempts > 0 && !props.blocked && (
          <p className="text-[12px] text-danger mt-2 font-medium">
            {copy.attemptsLeft}: {remaining}
          </p>
        )}
      </div>

      {props.blocked && (
        <div className="mt-3 p-3.5 border-[1.5px] border-dashed border-danger rounded-[14px] bg-[#fff8fa]">
          <h4 className="text-[14px] text-danger font-semibold m-0 mb-1.5">🔒 {copy.temporarilyBlocked}</h4>
          <p className="text-[12px] text-ink-soft mb-2.5">
            {copy.adminCodeHelp}
          </p>
          <input
            value={props.adminCode}
            onChange={(e) => props.onAdminCodeChange(e.target.value.toUpperCase().trim())}
            placeholder="ADMIN1234"
            maxLength={20}
            className="w-full px-3.5 py-3 rounded-[14px] border-[1.5px] border-line bg-paper font-mono text-center tracking-widest text-base focus:border-accent outline-none"
          />
          <button
            onClick={props.onAdminVerify}
            className="w-full mt-2.5 py-3 rounded-[14px] bg-ink text-white font-semibold"
          >
            {copy.verify}
          </button>
        </div>
      )}

      <div className="bg-bg-alt rounded-[14px] p-3.5 mt-5 text-[13px] text-ink-soft leading-relaxed">
        <b className="text-ink">{copy.codePrefixTitle}</b>
        <ul className="mt-1.5 pl-4 list-disc">
          <li><b>HM</b> = {packageLabel('HM', 'Hemat', locale)} &nbsp;·&nbsp; <b>RG</b> = {packageLabel('RG', 'Reguler', locale)} &nbsp;·&nbsp; <b>ST</b> = {packageLabel('ST', 'Sultan', locale)}</li>
          <li><b>RL</b> = {packageLabel('RL', 'Reguler Live', locale)} &nbsp;·&nbsp; <b>SL</b> = {packageLabel('SL', 'Sultan Live', locale)}</li>
        </ul>
      </div>
    </div>
  );
}

function ErrorBlock({ result }: { result: ValidationResult }) {
  const { copy } = useLocaleCopy();
  if (result.ok) return null;
  return (
    <div className="mt-1.5 px-3 py-2 rounded-[10px] bg-[#fff4f6] border border-[#f6c8d2]">
      <div className="text-[12px] font-semibold text-danger flex items-start gap-1.5">
        <span className="leading-none mt-0.5">⚠</span>
        <span>{result.error}</span>
      </div>
      {result.hint && (
        <div className="text-[11px] text-ink-soft mt-1 leading-relaxed">{result.hint}</div>
      )}
      {result.example && (
        <div className="text-[11px] mt-1.5 flex items-center gap-1.5">
          <span className="text-ink-faint">{copy.example}</span>
          <span className="font-mono text-accent-deep bg-accent-soft px-1.5 py-0.5 rounded">{result.example}</span>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// STEP 2 — DATA PEMESAN
// ============================================================================
function Step2(props: {
  customerName: string;
  countryCode: string;
  whatsapp: string;
  email: string;
  onChange: (key: any, val: any) => void;
  onValidity: (key: string, valid: boolean) => void;
}) {
  const { locale, copy } = useLocaleCopy();
  return (
    <div>
      <p className="font-display italic text-accent-deep text-[13px] font-medium mb-1">{copy.step} 2</p>
      <h1 className="font-display font-semibold text-[26px] leading-[1.1] tracking-tight mb-1.5">
        {copy.customerDataTitle}
      </h1>
      <p className="text-ink-soft text-[14px] leading-relaxed mb-5">
        {copy.customerDataIntro}
      </p>

      <ValidatedInput
        label={copy.customerNameLabel}
        required
        value={props.customerName}
        onChange={(v) => props.onChange('customer_name', v)}
        validator={(v) => validateCustomerName(v, locale)}
        onValidityChange={(v) => props.onValidity('customerName', v)}
        placeholder="Rina Lestari"
        maxLength={32}
        showCounter
        helperText={copy.max32}
        exampleLabel={copy.example}
      />

      <div className="mb-4">
        <label className="block text-[12px] font-semibold text-ink-soft mb-1.5 tracking-wide uppercase">
          {copy.whatsappLabel} <span className="text-danger">*</span>
        </label>
        <div className="grid grid-cols-[110px_1fr] gap-2.5">
          <select
            value={props.countryCode}
            onChange={(e) => props.onChange('country_code', e.target.value)}
            className="px-3.5 py-3 rounded-[14px] border-[1.5px] border-line bg-paper text-[15px] focus:border-accent outline-none"
          >
            <option value="+62">🇮🇩 +62</option>
            <option value="+60">🇲🇾 +60</option>
            <option value="+65">🇸🇬 +65</option>
            <option value="+1">🇺🇸 +1</option>
            <option value="+44">🇬🇧 +44</option>
            <option value="+61">🇦🇺 +61</option>
            <option value="+81">🇯🇵 +81</option>
            <option value="+82">🇰🇷 +82</option>
          </select>
          <ValidatedInput
            label=""
            value={props.whatsapp}
            onChange={(v) => props.onChange('whatsapp_number', v.replace(/\D/g, ''))}
            validator={(v) => validateWhatsapp(v, locale)}
            onValidityChange={(v) => props.onValidity('whatsapp', v)}
            placeholder="8956182162"
            maxLength={15}
            type="tel"
            inputMode="numeric"
            required
            exampleLabel={copy.example}
          />
        </div>
        <p className="text-[11px] text-ink-faint mt-1">{copy.whatsappHelp}</p>
      </div>

      <ValidatedInput
        label={copy.emailLabel}
        value={props.email}
        onChange={(v) => props.onChange('email', v.trim())}
        validator={(v) => validateEmail(v, false, locale)}
        onValidityChange={(v) => props.onValidity('email', v)}
        placeholder="rina@gmail.com"
        type="email"
        maxLength={120}
        inputMode="email"
        exampleLabel={copy.example}
      />
    </div>
  );
}

// ============================================================================
// STEP 3 — DATA ANAK
// ============================================================================
function Step3(props: {
  nickname: string;
  fullName: string;
  birthdayNumber: string;
  onChange: (key: any, val: any) => void;
  onValidity: (key: string, valid: boolean) => void;
}) {
  const { locale, copy } = useLocaleCopy();
  const birthdayResult = validateBirthdayNumber(props.birthdayNumber, locale);
  const showBirthdayError = props.birthdayNumber !== '' && !birthdayResult.ok;

  return (
    <div>
      <p className="font-display italic text-accent-deep text-[13px] font-medium mb-1">{copy.step} 3</p>
      <h1 className="font-display font-semibold text-[26px] leading-[1.1] tracking-tight mb-1.5">
        {copy.childTitle}
      </h1>
      <p className="text-ink-soft text-[14px] leading-relaxed mb-5">
        {copy.childIntro}
      </p>

      <ValidatedInput
        label={copy.childNicknameLabel}
        required
        value={props.nickname}
        onChange={(v) => props.onChange('child_nickname', v)}
        validator={(v) => validateChildNickname(v, locale)}
        onValidityChange={(v) => props.onValidity('childNickname', v)}
        placeholder="Kenzie"
        maxLength={10}
        showCounter
        helperText={copy.childNicknameHelp}
        exampleLabel={copy.example}
      />

      <ValidatedInput
        label={copy.childFullNameLabel}
        required
        value={props.fullName}
        onChange={(v) => props.onChange('child_full_name', v)}
        validator={(v) => validateChildFullName(v, locale)}
        onValidityChange={(v) => props.onValidity('childFullName', v)}
        placeholder="Kenzie Alfarezi"
        maxLength={34}
        showCounter
        helperText={copy.childFullNameHelp}
        exampleLabel={copy.example}
      />

      <div className="mb-4">
        <label className="block text-[12px] font-semibold text-ink-soft mb-1.5 tracking-wide uppercase">
          {copy.birthdayNumberLabel} <span className="text-danger">*</span>
        </label>
        <select
          value={props.birthdayNumber}
          onChange={(e) => props.onChange('birthday_number', e.target.value)}
          className={[
            'w-full px-3.5 py-3 rounded-[14px] border-[1.5px] bg-paper text-[15px] outline-none',
            showBirthdayError ? 'border-danger' : 'border-line focus:border-accent',
          ].join(' ')}
        >
          <option value="">— {copy.selectPlaceholder} —</option>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        {showBirthdayError && <ErrorBlock result={birthdayResult} />}
      </div>
    </div>
  );
}

// ============================================================================
// STEP 4 — CUSTOM CHARACTER
// ============================================================================
function Step4(props: {
  gender: Gender;
  hair: string;
  eye: string;
  hairCodes: string[];
  eyeCodes: string[];
  onChange: (key: any, val: any) => void;
}) {
  const { locale, copy } = useLocaleCopy();
  return (
    <div>
      <p className="font-display italic text-accent-deep text-[13px] font-medium mb-1">{copy.step} 4</p>
      <h1 className="font-display font-semibold text-[26px] leading-[1.1] tracking-tight mb-1.5">
        {copy.characterTitle}
      </h1>
      <p className="text-ink-soft text-[14px] leading-relaxed mb-4">
        {copy.characterIntro}
      </p>

      {/* Gender row */}
      <div className="grid grid-cols-2 gap-3 mb-3.5">
        {(['boy', 'girl'] as const).map((g) => {
          const selected = props.gender === g;
          return (
            <button
              key={g}
              onClick={() => props.onChange('character_gender', g)}
              className={[
                'relative bg-paper rounded-[22px] p-4 text-center transition-all border-[2.5px]',
                selected
                  ? 'border-accent bg-accent-soft shadow-[0_0_0_4px_rgba(139,145,232,0.15)]'
                  : 'border-line hover:border-accent',
              ].join(' ')}
            >
              {selected && (
                <span className="absolute top-2 right-2.5 w-5 h-5 bg-accent text-white rounded-full text-[12px] font-bold flex items-center justify-center">
                  ✓
                </span>
              )}
              <div className="w-14 h-14 mx-auto mb-1 text-accent">
                {g === 'boy' ? <BoyIcon /> : <GirlIcon />}
              </div>
              <div className="font-display text-[22px] font-semibold text-accent tracking-tight">
                {g === 'boy' ? 'Boy' : 'Girl'}
              </div>
            </button>
          );
        })}
      </div>

      {/* Character preview */}
      <div className="mb-3.5">
        <CharacterPreview
          gender={props.gender}
          hair={props.hair}
          eye={props.eye}
          locale={locale}
        />
      </div>

      {/* Hair grid */}
      <StyleBlock
        title="Hair Style"
        codes={props.hairCodes}
        selected={props.hair}
        onSelect={(v) => props.onChange('hair_style_code', v)}
      />

      {/* Eye grid */}
      <StyleBlock
        title="Eyeglasses"
        codes={props.eyeCodes}
        selected={props.eye}
        onSelect={(v) => props.onChange('eyeglasses_code', v)}
      />
    </div>
  );
}

function StyleBlock({
  title,
  codes,
  selected,
  onSelect,
}: {
  title: string;
  codes: string[];
  selected: string;
  onSelect: (v: string) => void;
}) {
  const { copy } = useLocaleCopy();
  return (
    <div className="border-[2.5px] border-line rounded-[22px] bg-accent-soft p-3 mb-3.5">
      <div className="flex items-center justify-between mb-2.5 mx-1">
        <span className="text-[12px] font-bold text-accent-deep uppercase tracking-wider">{title}</span>
        <span className="font-mono text-[11px] bg-accent-soft text-accent-deep border border-line px-2 py-0.5 rounded-full">
          {selected}
        </span>
      </div>
      <div className="grid max-h-[196px] grid-cols-1 gap-2 overflow-y-auto scrollbar-thin px-1 pb-1">
        {codes.map((c) => {
          const letter = c.slice(1);
          const isSel = selected === c;
          return (
            <button
              key={c}
              onClick={() => onSelect(c)}
              className={[
                'flex min-h-[44px] items-center justify-between rounded-[14px] border-[1.5px] px-3.5 py-2 text-left text-[13px] font-medium transition-all font-display italic',
                isSel
                  ? 'bg-accent text-white border-accent shadow-[0_2px_0_var(--accent-deep)]'
                  : 'bg-paper text-accent-deep border-line hover:border-accent hover:bg-[#fafbff]',
              ].join(' ')}
            >
              <span>Style {letter}</span>
              <span className={['font-mono text-[11px] not-italic', isSel ? 'text-white/80' : 'text-ink-faint'].join(' ')}>
                {c}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function BoyIcon() {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 28 Q14 14 32 12 Q50 14 48 28 L48 30 Q42 28 32 28 Q22 28 16 30 Z" fill="currentColor" fillOpacity=".15" />
      <circle cx="32" cy="34" r="18" fill="currentColor" fillOpacity=".05" />
      <circle cx="26" cy="34" r="1.6" fill="currentColor" />
      <circle cx="38" cy="34" r="1.6" fill="currentColor" />
      <path d="M27 41 Q32 44 37 41" />
    </svg>
  );
}
function GirlIcon() {
  return (
    <svg viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 30 Q12 12 32 10 Q52 12 48 30 L52 46 L46 44 L46 36 Q42 30 32 30 Q22 30 18 36 L18 44 L12 46 Z" fill="currentColor" fillOpacity=".15" />
      <circle cx="32" cy="34" r="16" fill="currentColor" fillOpacity=".05" />
      <circle cx="26" cy="34" r="1.6" fill="currentColor" />
      <circle cx="38" cy="34" r="1.6" fill="currentColor" />
      <path d="M27 41 Q32 44 37 41" />
    </svg>
  );
}

// ============================================================================
// STEP 5 — PARENTS CONTENT
// ============================================================================
function Step5(props: { value: string; onChange: (v: ParentsContent) => void }) {
  const { locale, copy } = useLocaleCopy();
  const opts: { v: ParentsContent; icon: string; title: string; desc: string }[] = [
    { v: 'none', icon: '🎈', title: parentsLabel('none', locale), desc: locale === 'en' ? 'Only the child character' : 'Hanya tokoh anak saja' },
    { v: 'single_mom', icon: '👩‍👧', title: parentsLabel('single_mom', locale), desc: locale === 'en' ? 'Child with mom' : 'Anak bersama ibu' },
    { v: 'single_father', icon: '👨‍👦', title: parentsLabel('single_father', locale), desc: locale === 'en' ? 'Child with dad' : 'Anak bersama ayah' },
    { v: 'mom_and_dad', icon: '👨‍👩‍👧', title: parentsLabel('mom_and_dad', locale), desc: locale === 'en' ? 'Child with mom & dad' : 'Anak bersama ayah & ibu' },
  ];
  return (
    <div>
      <p className="font-display italic text-accent-deep text-[13px] font-medium mb-1">{copy.step} 5</p>
      <h1 className="font-display font-semibold text-[26px] leading-[1.1] tracking-tight mb-1.5">
        {copy.familyTitle}
      </h1>
      <p className="text-ink-soft text-[14px] leading-relaxed mb-5">
        {copy.familyIntro}
      </p>

      <div className="flex flex-col gap-2.5">
        {opts.map((o) => {
          const sel = props.value === o.v;
          return (
            <button
              key={o.v}
              onClick={() => props.onChange(o.v)}
              className={[
                'border-2 rounded-[14px] px-4 py-3.5 flex items-center gap-3 text-left transition-all',
                sel ? 'border-accent bg-accent-soft' : 'border-line hover:border-accent',
              ].join(' ')}
            >
              <span className="text-2xl">{o.icon}</span>
              <span className="flex-1 min-w-0">
                <span className="block font-semibold text-[15px] mb-0.5">{o.title}</span>
                <span className="block text-[12px] text-ink-soft">{o.desc}</span>
              </span>
              <span
                className={[
                  'w-5 h-5 rounded-full flex-shrink-0 relative border-2',
                  sel ? 'border-accent' : 'border-line',
                ].join(' ')}
              >
                {sel && <span className="absolute inset-[3px] bg-accent rounded-full" />}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// STEP 6 — THEMES
// ============================================================================
function Step6(props: {
  themes: Theme[];
  loading: boolean;
  selectedCode: string;
  onSelect: (t: Theme) => void;
}) {
  const { copy } = useLocaleCopy();
  return (
    <div>
      <p className="font-display italic text-accent-deep text-[13px] font-medium mb-1">{copy.step} 6</p>
      <h1 className="font-display font-semibold text-[26px] leading-[1.1] tracking-tight mb-1.5">
        {copy.themeTitle}
      </h1>
      <p className="text-ink-soft text-[14px] leading-relaxed mb-3">
        {copy.themeIntro}
      </p>
      <div className="bg-bg-alt rounded-[12px] px-3 py-2 text-[11px] text-ink-soft mb-5 flex items-start gap-2">
        <span className="text-base leading-none mt-0.5">💡</span>
        <span>
          {copy.themeHint}
        </span>
      </div>

      {props.loading ? (
        <div className="text-center py-12 text-ink-faint">
          <div className="inline-block w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mb-2" />
          <div className="text-[13px]">{copy.loadingThemes}</div>
        </div>
      ) : props.themes.length === 0 ? (
        <div className="text-center py-12 text-ink-faint">
          <div className="text-4xl mb-2">🎨</div>
          <div className="text-[13px]">{copy.noThemes}</div>
          <div className="text-[12px] mt-2">{copy.changePrevious}</div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {props.themes.map((t) => (
            <div key={t.id}>
              <ThemeSlideshow
                images={t.images}
                themeName={t.name}
                isSelected={props.selectedCode === t.theme_code}
                onClick={() => props.onSelect(t)}
                selectedLabel={copy.selected}
                noImageLabel={copy.noImage}
                previewLabel={copy.previewHold}
              />
              <div className="px-1 mt-2">
                <h4 className="font-display text-[14px] font-semibold leading-tight m-0">
                  {t.name}
                </h4>
                <div className="font-mono text-[10px] text-ink-faint tracking-wider mt-0.5">
                  {t.theme_code}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// STEP 7 — REVIEW
// ============================================================================
function Step7({
  state,
  onEdit,
  error,
}: {
  state: OrderState;
  onEdit: (n: number) => void;
  error: string;
}) {
  const { locale, copy } = useLocaleCopy();
  const wa = `${state.country_code}${state.whatsapp_number}`;
  const assetCode = buildAssetCode(state.character_gender, state.hair_style_code, state.eyeglasses_code);
  const selectedParentsLabel = state.parents_content ? parentsLabel(state.parents_content as ParentsContent, locale) : '—';
  const displayPackageLabel = packageLabel(state.package_code, state.package_label, locale);

  const parentsRows: [string, string][] = [];
  if (state.mom_nickname) parentsRows.push([copy.momNickname, state.mom_nickname]);
  if (state.dad_nickname) parentsRows.push([copy.dadNickname, state.dad_nickname]);
  if (state.mom_sweetname) parentsRows.push([copy.momSweetname, state.mom_sweetname]);
  if (state.dad_sweetname) parentsRows.push([copy.dadSweetname, state.dad_sweetname]);

  return (
    <div>
      <p className="font-display italic text-accent-deep text-[13px] font-medium mb-1">{copy.step} 7</p>
      <h1 className="font-display font-semibold text-[26px] leading-[1.1] tracking-tight mb-1.5">
        {copy.reviewTitle}
      </h1>
      <p className="text-ink-soft text-[14px] leading-relaxed mb-5">
        {copy.reviewIntro}
      </p>

      <ReviewBlock title={copy.codeAndPackage}>
        <Row k={copy.orderCodeLabel} v={state.order_code} mono />
        <Row k={copy.package} v={displayPackageLabel} />
      </ReviewBlock>

      <ReviewBlock title={copy.customer} onEdit={() => onEdit(2)}>
        <Row k={copy.name} v={state.customer_name} />
        <Row k="WhatsApp" v={wa} mono />
        {state.email && <Row k="Email" v={state.email} />}
      </ReviewBlock>

      <ReviewBlock title={copy.child} onEdit={() => onEdit(3)}>
        <Row k="Nickname" v={state.child_nickname} />
        <Row k={copy.fullName} v={state.child_full_name} />
        <Row k={copy.birthday} v={state.birthday_number} />
      </ReviewBlock>

      {/* KARAKTER — sekarang dengan preview asset */}
      <ReviewBlock title={copy.character} onEdit={() => onEdit(4)}>
        <div className="my-2">
          <div className="scale-90 origin-top">
            <CharacterPreview
              gender={state.character_gender}
              hair={state.hair_style_code}
              eye={state.eyeglasses_code}
              showCaption={false}
              size="md"
              locale={locale}
            />
          </div>
        </div>
        <Row k="Gender" v={state.character_gender === 'boy' ? 'Boy' : 'Girl'} />
        <Row k="Hair Style" v={state.hair_style_code} mono />
        <Row k="Eyeglasses" v={state.eyeglasses_code} mono />
        <Row k={copy.assetCode} v={assetCode} mono />
      </ReviewBlock>

      {/* TEMA — preview gambar tema */}
      <ReviewBlock title={copy.theme} onEdit={() => onEdit(6)}>
        {state.theme_image && (
          <div className="my-2 rounded-[14px] overflow-hidden border border-line aspect-[9/16] bg-accent-soft">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={state.theme_image} alt={state.theme_name} className="w-full h-full object-contain" />
          </div>
        )}
        <Row k={copy.themeName} v={state.theme_name} />
        <Row k={copy.themeCode} v={state.theme_code} mono />
      </ReviewBlock>

      {/* KETERANGAN KELUARGA — terpisah dari tema */}
      <ReviewBlock title={copy.familyInfo} onEdit={() => onEdit(5)}>
        {nicknameUsageMessage(state.theme_nickname_usage, locale) && (
          <p className="m-0 mb-2 text-[12px] leading-relaxed text-accent-deep">
            {nicknameUsageMessage(state.theme_nickname_usage, locale)}
          </p>
        )}
        {sweetnameUsageMessage(state.theme_requires_parents_sweetname, locale) && (
          <p className="m-0 mb-2 text-[12px] leading-relaxed text-accent-deep">
            {sweetnameUsageMessage(state.theme_requires_parents_sweetname, locale)}
          </p>
        )}
        <Row k={copy.structure} v={selectedParentsLabel} />
        {parentsRows.map(([k, v]) => (
          <Row key={k} k={k} v={v} />
        ))}
      </ReviewBlock>

      {error && (
        <div className="mt-4 p-3 rounded-[10px] bg-[#fff4f6] border border-[#f6c8d2] text-[13px] text-danger">
          ⚠ {error}
        </div>
      )}
    </div>
  );
}

function ReviewBlock({
  title,
  onEdit,
  children,
}: {
  title: string;
  onEdit?: () => void;
  children: React.ReactNode;
}) {
  const { copy } = useLocaleCopy();
  return (
    <div className="border-[1.5px] border-line-soft rounded-[14px] p-3.5 mb-3 bg-paper">
      <div className="flex items-center justify-between mb-2.5">
        <div className="font-display text-[14px] font-semibold">{title}</div>
        {onEdit && (
          <button
            onClick={onEdit}
            className="bg-transparent border-0 text-accent-deep text-[12px] font-semibold underline decoration-line underline-offset-2 cursor-pointer"
          >
            {copy.edit}
          </button>
        )}
      </div>
      <dl className="m-0">{children}</dl>
    </div>
  );
}
function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-2 py-1 text-[13px]">
      <dt className="text-ink-soft">{k}</dt>
      <dd className={['m-0 text-ink font-medium text-right max-w-[60%] break-words', mono ? 'font-mono' : ''].join(' ')}>
        {v}
      </dd>
    </div>
  );
}

// ============================================================================
// STEP 8 — SUCCESS
// ============================================================================
function Step8({ orderId, packageCode }: { orderId: string; packageCode: string }) {
  const { copy } = useLocaleCopy();
  const adminWA = process.env.NEXT_PUBLIC_ADMIN_WHATSAPP || '6281234567890';
  const message = encodeURIComponent(
    `${copy.waMessage} ${orderId}`
  );
  const onWA = () => window.open(`https://wa.me/${adminWA}?text=${message}`, '_blank');

  return (
    <div className="text-center pt-10 px-4">
      <div className="w-22 h-22 mx-auto mb-5 bg-gradient-to-br from-[#d4f0e0] to-accent-soft rounded-full flex items-center justify-center text-success text-5xl animate-pop"
        style={{ width: '88px', height: '88px' }}
      >
        ✓
      </div>
      <h1 className="font-display text-[28px] font-semibold mb-1.5 tracking-tight">
        {copy.successTitle}
      </h1>
      <p className="text-ink-soft text-[14px] mb-6 leading-relaxed">
        {copy.successIntro}
      </p>

      <div className="bg-bg-alt rounded-[14px] p-3.5 mb-6">
        <div className="text-[11px] text-ink-soft uppercase tracking-wider mb-1">{copy.orderId}</div>
        <div className="font-mono text-[18px] font-semibold tracking-wider">{orderId || '—'}</div>
      </div>

      <button
        onClick={onWA}
        className="w-full py-3.5 px-5 rounded-[14px] bg-[#25d366] text-white font-semibold text-[15px] flex items-center justify-center gap-2 hover:bg-[#1faf54] transition-colors"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.5 14.4c-.3-.1-1.7-.9-2-1-.3-.1-.5-.2-.7.2-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.2-1.2-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6.1-.1.3-.3.4-.5.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5 0-.1-.7-1.6-.9-2.2-.2-.5-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1.1 1-1.1 2.5s1.1 2.9 1.3 3.1c.2.2 2.2 3.4 5.4 4.7.7.3 1.3.5 1.8.6.7.2 1.4.2 1.9.1.6-.1 1.7-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.6-.4M12 2C6.5 2 2 6.5 2 12c0 1.7.4 3.4 1.3 4.9L2 22l5.3-1.3c1.5.8 3.1 1.2 4.7 1.2 5.5 0 10-4.5 10-10S17.5 2 12 2" />
        </svg>
        {copy.chatAdmin}
      </button>
      <button
        onClick={() => window.location.reload()}
        className="w-full py-3.5 px-5 mt-2.5 rounded-[14px] bg-transparent border-[1.5px] border-line text-ink-soft font-semibold text-[15px] hover:bg-bg-alt transition-colors"
      >
        {copy.newOrder}
      </button>
    </div>
  );
}

// ============================================================================
// PARENTS MODAL
// ============================================================================
function ParentsModal({
  theme,
  state,
  onChange,
  errors,
  onConfirm,
  onClose,
}: {
  theme: Theme;
  state: OrderState;
  onChange: (key: any, val: any) => void;
  errors: Record<string, string>;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { locale, copy } = useLocaleCopy();
  const pc = state.parents_content;
  const showMomNick = needsParentNickname(theme) && (pc === 'single_mom' || pc === 'mom_and_dad');
  const showDadNick = needsParentNickname(theme) && (pc === 'single_father' || pc === 'mom_and_dad');
  const showMomSweet = theme.requires_parents_sweetname && (pc === 'single_mom' || pc === 'mom_and_dad');
  const showDadSweet = theme.requires_parents_sweetname && (pc === 'single_father' || pc === 'mom_and_dad');
  const nickHelper = nicknameUsageText(theme, locale) || copy.max16OneSpace;
  const nicknameMessage = nicknameUsageMessage(getNicknameUsage(theme), locale);
  const sweetnameMessage = sweetnameUsageMessage(!!theme.requires_parents_sweetname, locale);

  return (
    <div className="fixed inset-0 z-[100] bg-black/55 backdrop-blur-sm flex items-end justify-center animate-fade-in">
      <div className="w-full max-w-[440px] bg-paper rounded-t-[22px] px-5 pt-6 pb-7 animate-slide-up max-h-[88vh] overflow-y-auto">
        <div className="w-10 h-1 bg-line rounded-sm mx-auto -mt-2 mb-3.5" />
        <h3 className="font-display text-[20px] font-semibold mb-1">
          {copy.modalTheme} "{theme.name}"
        </h3>
        <p className="text-[13px] text-ink-soft mb-4">
          {copy.modalIntro}
        </p>

        {(nicknameMessage || sweetnameMessage) && (
          <div className="mb-4 rounded-[14px] border border-line bg-bg-alt px-3.5 py-3 text-[12px] leading-relaxed text-ink-soft">
            {nicknameMessage && <p className="m-0">{nicknameMessage}</p>}
            {sweetnameMessage && <p className={nicknameMessage ? 'mt-2 mb-0' : 'm-0'}>{sweetnameMessage}</p>}
          </div>
        )}

        {showMomNick && (
          <ValidatedInput
            label={copy.momNickname}
            required
            value={state.mom_nickname}
            onChange={(v) => onChange('mom_nickname', v)}
            validator={(v) => validateParentNickname(v, 'mom', locale)}
            placeholder="Bunda Rina"
            maxLength={16}
            showCounter
            helperText={`${copy.nicknameHelperPrefix} ${nickHelper}`}
            exampleLabel={copy.example}
          />
        )}
        {showDadNick && (
          <ValidatedInput
            label={copy.dadNickname}
            required
            value={state.dad_nickname}
            onChange={(v) => onChange('dad_nickname', v)}
            validator={(v) => validateParentNickname(v, 'dad', locale)}
            placeholder="Ayah Budi"
            maxLength={16}
            showCounter
            helperText={`${copy.nicknameHelperPrefix} ${nickHelper}`}
            exampleLabel={copy.example}
          />
        )}
        {showMomSweet && (
          <ValidatedInput
            label={copy.momSweetname}
            required
            value={state.mom_sweetname}
            onChange={(v) => onChange('mom_sweetname', v)}
            validator={(v) => validateParentSweetname(v, 'mom', locale)}
            placeholder="Bunda"
            maxLength={7}
            showCounter
            helperText={copy.max7NoSpace}
            exampleLabel={copy.example}
          />
        )}
        {showDadSweet && (
          <ValidatedInput
            label={copy.dadSweetname}
            required
            value={state.dad_sweetname}
            onChange={(v) => onChange('dad_sweetname', v)}
            validator={(v) => validateParentSweetname(v, 'dad', locale)}
            placeholder="Ayah"
            maxLength={7}
            showCounter
            helperText={copy.max7NoSpace}
            exampleLabel={copy.example}
          />
        )}

        <div className="flex gap-2.5 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-3.5 rounded-[14px] border-[1.5px] border-line bg-transparent text-ink-soft font-semibold"
          >
            {copy.cancel}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-5 py-3.5 rounded-[14px] bg-ink text-white font-semibold"
          >
            {copy.saveTheme}
          </button>
        </div>
      </div>
    </div>
  );
}
