// src/pages/CheckoutPage.tsx - Full-page registration checkout (Shopify-style:
// accordion form + sticky order summary, payment via full-page Midtrans redirect)

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { message, Modal, Select, Button, Input, DatePicker } from "antd";
import dayjs from "dayjs";
import { getData } from "country-list";
import getUnicodeFlagIcon from "country-flag-icons/unicode";
import {
  parseAgeBrackets,
  getAgeCategory,
  calculateAgeOnRaceDay,
  FlagImg,
} from "./EventPage";

interface EventData {
  id: string;
  name: string;
  slug: string;
  eventDate: string;
  logoUrl?: string | null;
  bibCustomPrice?: number;
  categories?: any[];
  content?: any;
}

interface CategoryDetail {
  id: string;
  name: string;
  price: number;
  quota: number;
  sold: number;
  isClosed?: boolean;
}

interface RegistrationField {
  id: string;
  label: string;
  type: string;
  required: boolean;
  options: string | null;
  order: number;
}

interface TshirtStock {
  id: string;
  size: string;
  quota: number;
  sold: number;
  width?: string;
  height?: string;
}

// Map custom field labels -> autocomplete tokens so browsers fill the right
// inputs. Without these, Chrome heuristics treat "Emergency Contact Name" as a
// name field and overwrite participant names from the browser autofill profile.
// Unmapped custom fields get "off" — never let autofill guess.
function autocompleteFor(field: RegistrationField): string {
  const l = field.label.toLowerCase();
  if (field.type === "nik" || /instagram|blood|emergency|club|komunitas/.test(l)) return "off";
  if (/first name|nama depan/.test(l)) return "given-name";
  if (/last name|nama belakang/.test(l)) return "family-name";
  if (/full name|nama lengkap|^name$|^nama$/.test(l)) return "name";
  if (/phone|telp|whatsapp|nomor hp|no hp/.test(l)) return "tel";
  if (/email/.test(l)) return "email";
  if (/birth|lahir/.test(l)) return "bday";
  if (/gender|kelamin/.test(l)) return "sex";
  if (/address|alamat/.test(l)) return "street-address";
  return "off";
}

function SectionCard({
  n,
  title,
  state,
  summary,
  onOpen,
  children,
}: {
  n: number;
  title: string;
  state: "open" | "done" | "locked";
  summary?: string;
  onOpen: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={state === "locked" ? undefined : onOpen}
        disabled={state === "locked"}
        className={`w-full flex items-center gap-4 p-5 text-left transition-colors ${
          state === "locked" ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-stone-50"
        }`}
      >
        <span
          className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shrink-0 ${
            state === "done"
              ? "bg-emerald-500 text-white"
              : "bg-stone-950 text-white"
          }`}
        >
          {state === "done" ? "✓" : n}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-black uppercase tracking-widest text-stone-900">
            {title}
          </span>
          {state !== "open" && summary && (
            <span className="block text-sm text-stone-500 truncate mt-0.5">{summary}</span>
          )}
        </span>
        {state !== "open" && state !== "locked" && (
          <span className="text-xs font-bold uppercase tracking-widest text-stone-500 shrink-0">
            Ubah
          </span>
        )}
      </button>
      {state === "open" && (
        <div className="px-5 pb-5 border-t border-stone-100 pt-5">{children}</div>
      )}
    </div>
  );
}

export default function CheckoutPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const [event, setEvent] = useState<EventData | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "error" | "ready">("loading");

  const [categoryDetails, setCategoryDetails] = useState<CategoryDetail[]>([]);
  const [customFields, setCustomFields] = useState<RegistrationField[]>([]);
  const [tshirtInventory, setTshirtInventory] = useState<TshirtStock[]>([]);

  const [openSection, setOpenSection] = useState(1);

  // Section 1 — contact
  const [email, setEmail] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);

  // Section 2 — registration data
  const [categoryId, setCategoryId] = useState("");
  const [bulkQty, setBulkQty] = useState(1);
  const [activeTabIdx, setActiveTabIdx] = useState(0);
  const [bulkParticipants, setBulkParticipants] = useState<Record<string, string>[]>([{}]);

  // Section 3 — payment
  const [voucherCode, setVoucherCode] = useState("");
  const [voucherResult, setVoucherResult] = useState<{
    valid: boolean;
    discountAmount?: number;
    reason?: string;
  } | null>(null);
  const [voucherLoading, setVoucherLoading] = useState(false);
  const [tncAgreed, setTncAgreed] = useState(false);
  const [dataAgreed, setDataAgreed] = useState(false);
  const [tncModalOpen, setTncModalOpen] = useState(false);
  const [helpSheetOpen, setHelpSheetOpen] = useState(false);
  const [registering, setRegistering] = useState(false);

  const allowBulkNoOtp = !!event?.content?.allowBulkNoOtp;
  const ageBrackets = useMemo(
    () => parseAgeBrackets(event?.content?.ageCategories),
    [event?.content?.ageCategories],
  );

  const eventOver =
    !!event?.eventDate &&
    new Date(event.eventDate).setHours(0, 0, 0, 0) < new Date().setHours(0, 0, 0, 0);

  // Load event + form definitions
  useEffect(() => {
    if (!slug) return;
    (async () => {
      try {
        const res = await fetch(`/api/events?eventId=${slug}`);
        if (!res.ok) {
          setLoadState("error");
          return;
        }
        const eventData = await res.json();
        setEvent(eventData);

        const [catRes, fieldsRes, invRes] = await Promise.all([
          fetch(`/api/categories?eventId=${eventData.id}`),
          fetch(`/api/registration-fields?eventId=${eventData.id}`),
          fetch(`/api/tshirt-inventory?eventId=${eventData.id}`),
        ]);
        if (catRes.ok) setCategoryDetails((await catRes.json()).categories || []);
        if (fieldsRes.ok) {
          const fields = ((await fieldsRes.json()).fields || []).map((f: any) =>
            f.label.trim() === "Nationality" && f.type !== "nationality"
              ? { ...f, type: "nationality" }
              : f,
          );
          setCustomFields(fields);
        }
        if (invRes.ok) setTshirtInventory((await invRes.json()).inventory || []);
        setLoadState("ready");
      } catch {
        setLoadState("error");
      }
    })();
  }, [slug]);

  const selectedCategoryDetail = categoryDetails.find((c) => c.id === categoryId);
  const totalPrice = (selectedCategoryDetail?.price || 0) * bulkQty;

  // Voucher preview is only valid for the current total — reset when it changes
  useEffect(() => {
    setVoucherResult(null);
  }, [totalPrice, email]);

  const finalPrice = voucherResult?.valid
    ? totalPrice - (voucherResult.discountAmount || 0)
    : totalPrice;

  const onEmailChange = (value: string) => {
    setEmail(value);
    setEmailVerified(false);
    setOtpSent(false);
    setOtpCode("");
  };

  const handleSendOtp = async () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      message.error("Format email tidak valid");
      return;
    }
    const sendCountKey = `otp_send_count_${email}`;
    const sendCount = parseInt(localStorage.getItem(sendCountKey) || "0", 10);
    if (sendCount >= 2) {
      message.error("Batas pengiriman OTP harian tercapai untuk email ini di browser Anda.");
      return;
    }
    setOtpLoading(true);
    try {
      const res = await fetch("/api/send-email-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem(sendCountKey, (sendCount + 1).toString());
        setOtpSent(true);
        message.success(data.message || "Kode verifikasi telah dikirim");
      } else {
        message.error(data.error || "Gagal mengirim kode verifikasi");
      }
    } catch {
      message.error("Terjadi kesalahan saat mengirim kode");
    } finally {
      setOtpLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode || otpCode.length !== 6) {
      message.error("Masukkan 6 digit kode verifikasi");
      return;
    }
    setOtpLoading(true);
    try {
      const res = await fetch("/api/verify-email-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: otpCode }),
      });
      const data = await res.json();
      if (res.ok && data.verified) {
        setEmailVerified(true);
        message.success(data.message || "Email berhasil diverifikasi");
      } else {
        message.error(data.error || "Kode verifikasi salah atau expired");
      }
    } catch {
      message.error("Terjadi kesalahan saat verifikasi kode");
    } finally {
      setOtpLoading(false);
    }
  };

  const applyVoucher = async () => {
    if (!voucherCode.trim()) {
      message.error("Masukkan kode voucher terlebih dahulu");
      return;
    }
    setVoucherLoading(true);
    try {
      const res = await fetch("/api/voucher/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: voucherCode,
          eventId: event?.id,
          totalAmount: totalPrice,
          email,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memeriksa voucher");
      setVoucherResult(
        data.valid
          ? { valid: true, discountAmount: data.discountAmount }
          : { valid: false, reason: data.reason },
      );
    } catch {
      setVoucherResult({ valid: false, reason: "Gagal memeriksa voucher" });
    } finally {
      setVoucherLoading(false);
    }
  };

  // Section 1 → 2: contact must be complete
  const contactComplete = allowBulkNoOtp
    ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    : emailVerified;

  // Section 2 → 3: same per-participant validation as the old wizard
  const goToPayment = () => {
    if (!categoryId) {
      message.error("Pilih kategori terlebih dahulu");
      return;
    }
    for (let i = 0; i < bulkQty; i++) {
      const p = bulkParticipants[i] || {};
      const missing = customFields.filter((f) => f.required && !p[f.id]);
      if (tshirtInventory.length > 0 && !p["tshirtSize"]) {
        missing.push({ label: "Ukuran Kaos / Jersey" } as any);
      }
      if (missing.length > 0) {
        setActiveTabIdx(i);
        message.error(`Peserta ${i + 1}: Harap isi: ${missing.map((f) => f.label).join(", ")}`);
        return;
      }
      const nikFields = customFields.filter((f) => f.type === "nik");
      for (const nf of nikFields) {
        const val = p[nf.id];
        if (val) {
          if (!/^\d+$/.test(val)) {
            setActiveTabIdx(i);
            message.error(`Peserta ${i + 1}: Format ${nf.label} salah. Harus berupa angka.`);
            return;
          }
          if (val !== "0" && val.length < 12) {
            setActiveTabIdx(i);
            message.error(`Peserta ${i + 1}: ${nf.label} harus diisi 0 (WNA) atau minimal 12 digit.`);
            return;
          }
        }
      }
    }
    setOpenSection(3);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCheckout = async () => {
    const tncUrls =
      event?.content?.tncUrls || (event?.content?.tncUrl ? [event.content.tncUrl] : []);
    if (tncUrls.length > 0 && (!tncAgreed || !dataAgreed)) {
      message.error("Anda harus menyetujui seluruh Syarat dan Ketentuan serta validitas data terlebih dahulu.");
      return;
    }
    if (!contactComplete) {
      message.error("Silakan verifikasi email kamu terlebih dahulu.");
      setOpenSection(1);
      return;
    }

    // Re-check required fields + email/phone formats for all participants
    for (let i = 0; i < bulkQty; i++) {
      const p = bulkParticipants[i] || {};
      const missingFields = customFields.filter((f) => f.required && !p[f.id]);
      if (missingFields.length > 0) {
        setActiveTabIdx(i);
        message.error(`Peserta ${i + 1}: Harap isi kolom: ${missingFields.map((f) => f.label).join(", ")}`);
        return;
      }
      for (const field of customFields) {
        const val = p[field.id];
        if (val) {
          if (field.type === "email") {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(val)) {
              setActiveTabIdx(i);
              message.error(`Peserta ${i + 1}: Format email pada '${field.label}' tidak valid`);
              return;
            }
          }
          if (field.type === "tel") {
            const telRegex = /^[0-9+\-\s()]+$/;
            if (!telRegex.test(val)) {
              setActiveTabIdx(i);
              message.error(`Peserta ${i + 1}: Nomor telepon pada '${field.label}' hanya boleh berisi angka, +, -, dan spasi`);
              return;
            }
          }
        }
      }
    }

    setRegistering(true);
    try {
      const participantsToSend = bulkParticipants.slice(0, bulkQty).map((p) => {
        const mappedCustomData: Record<string, string> = {};
        Object.keys(p).forEach((fieldId) => {
          if (fieldId === "Age Category") {
            mappedCustomData["Age Category"] = p[fieldId];
            return;
          }
          const field = customFields.find((f) => f.id === fieldId);
          if (field) {
            mappedCustomData[field.label] = p[fieldId];
          }
        });
        return {
          email,
          tshirtSize: p.tshirtSize,
          bibName: p.bibName,
          customData:
            Object.keys(mappedCustomData).length > 0 ? mappedCustomData : undefined,
        };
      });

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: event?.id,
          categoryId,
          email,
          bulkParticipants: participantsToSend,
          voucherCode: voucherResult?.valid ? voucherCode.trim().toUpperCase() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        message.error(data.error || "Gagal checkout");
        return;
      }
      if (data.isFree) {
        navigate(`/event/${slug}?tab=Registered&order_id=${data.orderId}`);
        return;
      }
      if (data.snapUrl) {
        // Full-page redirect to Midtrans — user returns to the event page
        window.location.href = data.snapUrl;
        return;
      }
      message.info("Midtrans belum dikonfigurasi. Registrasi disimpan sebagai pending.");
      navigate(`/event/${slug}?tab=Registered&order_id=${data.orderId}`);
    } catch {
      message.error("Terjadi kesalahan");
    } finally {
      setRegistering(false);
    }
  };

  const setParticipantField = (fieldId: string, value: string) => {
    setBulkParticipants((prev) => {
      const updated = [...prev];
      updated[activeTabIdx] = { ...updated[activeTabIdx], [fieldId]: value };
      return updated;
    });
  };

  const tncUrls =
    event?.content?.tncUrls || (event?.content?.tncUrl ? [event.content.tncUrl] : []);

  // Display name of the first participant (for the section summary) — surfaces
  // autofill mistakes before submit, the name is what goes on ticket/certificate.
  const firstParticipantName = (() => {
    const p = bulkParticipants[0] || {};
    const get = (re: RegExp) => {
      const f = customFields.find((x) => re.test(x.label.toLowerCase()));
      return f ? p[f.id] || "" : "";
    };
    return (
      get(/full name|nama lengkap|^name$|^nama$/) ||
      `${get(/first name|nama depan/)} ${get(/last name|nama belakang/)}`.trim()
    );
  })();

  // ---------- Order summary (sidebar + mobile accordion share this) ----------
  // Plain JSX variable, NOT a component: an inline component gets a new type on
  // every render, so React remounts this subtree and the voucher input loses
  // focus after each keystroke (the "can only type 1 char" bug).
  const orderSummary = (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm font-bold text-stone-900">
            {selectedCategoryDetail?.name || "Belum pilih kategori"}
          </div>
          <div className="text-xs text-stone-500 mt-0.5">
            {selectedCategoryDetail
              ? `Rp ${selectedCategoryDetail.price.toLocaleString("id-ID")} / orang`
              : "Pilih kategori di langkah 2"}
          </div>
        </div>
        <span className="text-xs font-black bg-stone-200 text-stone-700 rounded-full px-2.5 py-1 shrink-0">
          ×{bulkQty}
        </span>
      </div>

      {totalPrice > 0 && (
        <div>
          <div className="flex gap-2">
            <input
              value={voucherCode}
              onChange={(e) => {
                setVoucherCode(e.target.value.toUpperCase());
                setVoucherResult(null);
              }}
              placeholder="Kode voucher"
              className="flex-1 border-2 border-stone-200 rounded-xl px-3 h-11 text-sm uppercase tracking-wide bg-white focus:outline-none focus:border-stone-800"
            />
            {voucherCode.trim() && (
              <button
                onClick={applyVoucher}
                disabled={voucherLoading}
                className="shrink-0 h-11 px-5 rounded-xl border-2 border-stone-200 font-bold text-sm hover:border-stone-900 transition-colors disabled:opacity-40 bg-white"
              >
                {voucherLoading ? "..." : "Terapkan"}
              </button>
            )}
          </div>
          {voucherResult?.valid && (
            <p className="text-xs text-green-600 mt-2">
              Voucher {voucherCode.trim()} berhasil dipakai.
            </p>
          )}
          {voucherResult && !voucherResult.valid && (
            <p className="text-xs text-red-600 mt-2">{voucherResult.reason}</p>
          )}
        </div>
      )}

      <div className="border-t border-stone-200 pt-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-stone-500">Subtotal</span>
          <span className="font-medium">Rp {totalPrice.toLocaleString("id-ID")}</span>
        </div>
        {voucherResult?.valid && (
          <div className="flex justify-between text-sm">
            <span className="text-stone-500">Diskon voucher</span>
            <span className="font-medium text-red-600">
              −Rp {(voucherResult.discountAmount || 0).toLocaleString("id-ID")}
            </span>
          </div>
        )}
        <div className="flex justify-between items-baseline pt-2">
          <span className="font-bold text-sm">Total</span>
          <span className="text-2xl font-bold text-stone-900 tabular-nums">
            Rp {finalPrice.toLocaleString("id-ID")}
          </span>
        </div>
      </div>

      <div className="border-t border-stone-200 pt-4 space-y-2 text-left">
        <button
          className="block text-xs text-stone-500 underline underline-offset-2 hover:text-stone-900"
          onClick={() => setHelpSheetOpen(true)}
        >
          Refund Policy
        </button>
        {tncUrls.length > 0 && (
          <button
            className="block text-xs text-stone-500 underline underline-offset-2 hover:text-stone-900"
            onClick={() => setTncModalOpen(true)}
          >
            Syarat &amp; Ketentuan
          </button>
        )}
        <button
          className="block text-xs text-stone-500 underline underline-offset-2 hover:text-stone-900"
          onClick={() => setHelpSheetOpen(true)}
        >
          Contact Us
        </button>
      </div>
    </div>
  );

  // ---------- Render ----------
  if (loadState !== "ready" || !event) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        {loadState === "error" ? (
          <div className="text-center">
            <h2 className="text-xl font-black uppercase tracking-tighter mb-3">Event tidak ditemukan</h2>
            <Link to="/event" className="text-sm font-bold underline underline-offset-4">
              Kembali ke Events
            </Link>
          </div>
        ) : (
          <div className="w-8 h-8 border-[3px] border-stone-200 border-t-stone-900 rounded-full animate-spin" />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-stone-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link to={`/event/${slug}`} className="flex items-center gap-3 min-w-0">
            {event.logoUrl ? (
              <img src={event.logoUrl} alt={event.name} className="h-8 w-8 object-contain rounded-lg" />
            ) : (
              <span className="text-xl font-black uppercase tracking-widest text-stone-900">Lumpat</span>
            )}
            <span className="text-sm text-stone-500 truncate hidden sm:block">{event.name}</span>
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {eventOver ? (
          <div className="max-w-md mx-auto text-center py-16">
            <h1 className="text-2xl font-black uppercase tracking-tighter mb-2">Event Selesai</h1>
            <p className="text-sm text-stone-500 mb-6">
              Pendaftaran untuk event ini sudah ditutup.
            </p>
            <Link
              to={`/event/${slug}`}
              className="inline-block bg-stone-950 text-white rounded-xl px-6 h-12 leading-[3rem] font-bold"
            >
              Kembali ke Event
            </Link>
          </div>
        ) : (
          <>
            <div className="grid lg:grid-cols-2 gap-6 lg:gap-8 items-start">
              {/* Left — form sections */}
              <div className="space-y-4 max-w-2xl mx-auto lg:mx-0 lg:max-w-none w-full min-w-0">
                <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tighter mb-2">
                  Pendaftaran
                </h1>

                <SectionCard
                  n={1}
                  title="Kontak"
                  state={openSection === 1 ? "open" : "done"}
                  summary={email}
                  onOpen={() => setOpenSection(1)}
                >
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1.5">
                        Email <span className="text-red-500">*</span>
                      </label>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                          <Input
                            placeholder="email@example.com"
                            type="email"
                            size="large"
                            className="w-full"
                            value={email}
                            onChange={(e) => onEmailChange(e.target.value)}
                            disabled={(emailVerified && !allowBulkNoOtp) || otpLoading}
                          />
                        </div>
                        {!allowBulkNoOtp && !emailVerified && (
                          <button
                            onClick={handleSendOtp}
                            disabled={otpLoading || !email || !email.includes("@")}
                            className="w-full sm:w-auto h-12 px-6 rounded-xl border-2 border-stone-200 font-bold text-sm hover:border-stone-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0 bg-white"
                          >
                            {otpLoading ? "Mengirim..." : otpSent ? "Kirim Ulang" : "Kirim Kode"}
                          </button>
                        )}
                        {!allowBulkNoOtp && emailVerified && (
                          <span className="flex items-center gap-1.5 bg-emerald-50 px-4 rounded-xl border border-emerald-200 text-xs font-black text-green-600 whitespace-nowrap">
                            ✓ Terverifikasi
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-amber-600 mt-2">
                        *Pastikan alamat email benar, tiket akan dikirim ke email ini.
                      </p>
                    </div>

                    {!allowBulkNoOtp && otpSent && !emailVerified && (
                      <div className="pt-4 border-t border-stone-100">
                        <p className="text-xs font-bold text-stone-500 uppercase mb-2">
                          Masukkan 6 Digit OTP
                        </p>
                        <div className="flex flex-col sm:flex-row gap-3">
                          <Input
                            placeholder="000000"
                            size="large"
                            className="text-center font-mono tracking-[0.5em] text-xl"
                            maxLength={6}
                            value={otpCode}
                            onChange={(e) => setOtpCode(e.target.value.replace(/[^0-9]/g, ""))}
                          />
                          <button
                            onClick={handleVerifyOtp}
                            disabled={otpLoading || otpCode.length !== 6}
                            className="w-full sm:w-auto h-12 px-8 rounded-xl bg-stone-950 text-white font-bold uppercase tracking-widest text-xs hover:bg-stone-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {otpLoading ? "Memeriksa..." : "Verifikasi"}
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end pt-2">
                      <button
                        className="w-full sm:w-auto bg-stone-950 text-white rounded-xl h-12 px-8 font-bold uppercase tracking-widest text-xs hover:bg-stone-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        disabled={!contactComplete}
                        onClick={() => {
                          setOpenSection(2);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                      >
                        Lanjut
                      </button>
                    </div>
                  </div>
                </SectionCard>

                <SectionCard
                  n={2}
                  title="Data Peserta"
                  state={
                    openSection === 2
                      ? "open"
                      : openSection > 2
                        ? "done"
                        : "locked"
                  }
                  summary={
                    openSection !== 2 && selectedCategoryDetail
                      ? `${firstParticipantName ? `${firstParticipantName} · ` : ""}${selectedCategoryDetail.name}${bulkQty > 1 ? ` · ${bulkQty} peserta` : ""}`
                      : undefined
                  }
                  onOpen={() => setOpenSection(2)}
                >
                  <div className="space-y-6">
                    {/* Category */}
                    <div>
                      <label className="block text-xs font-bold text-stone-700 mb-1.5">
                        Kategori <span className="text-red-500">*</span>
                      </label>
                      <Select
                        className="w-full"
                        size="large"
                        virtual={false}
                        getPopupContainer={() => document.body}
                        placeholder="Pilih Kategori Perlombaan"
                        value={categoryId || undefined}
                        onChange={(val) => {
                          setCategoryId(val);
                          setBulkQty(1);
                          setBulkParticipants([{}]);
                        }}
                        options={categoryDetails
                          .filter((c) => c.quota === 0 || c.sold < c.quota)
                          .filter((c) => !c.isClosed)
                          .map((c) => ({
                            label: `${c.name} - Rp ${c.price.toLocaleString("id-ID")}${c.quota > 0 ? ` (${c.quota - c.sold} slot)` : ""}`,
                            value: c.id,
                          }))}
                      />
                    </div>

                    {/* Bulk qty */}
                    {allowBulkNoOtp && (
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-xs text-stone-500 uppercase">Jumlah Peserta</span>
                        <Select
                          size="small"
                          virtual={false}
                          getPopupContainer={() => document.body}
                          value={bulkQty}
                          onChange={(val) => {
                            setBulkQty(val);
                            setBulkParticipants((prev) => {
                              const updated = [...prev];
                              while (updated.length < val) updated.push({});
                              return updated;
                            });
                            if (activeTabIdx >= val) setActiveTabIdx(val - 1);
                          }}
                          options={(() => {
                            const available = selectedCategoryDetail
                              ? selectedCategoryDetail.quota > 0
                                ? selectedCategoryDetail.quota - selectedCategoryDetail.sold
                                : 10
                              : 10;
                            const max = Math.min(10, available);
                            return Array.from({ length: max }, (_, i) => i + 1).map((v) => ({
                              label: v.toString(),
                              value: v,
                            }));
                          })()}
                          className="w-20"
                        />
                      </div>
                    )}

                    {/* Participant tabs */}
                    {bulkQty > 1 && (
                      <div className="flex flex-wrap gap-2 pb-3 border-b border-stone-100">
                        {Array.from({ length: bulkQty }).map((_, idx) => (
                          <button
                            key={idx}
                            onClick={() => setActiveTabIdx(idx)}
                            className={`px-4 py-2 text-xs font-bold whitespace-nowrap rounded-lg transition-colors ${
                              activeTabIdx === idx
                                ? "bg-stone-950 text-white"
                                : "bg-stone-100 text-stone-500 hover:bg-stone-200"
                            }`}
                          >
                            PESERTA {idx + 1}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Custom fields */}
                    {customFields.length === 0 && tshirtInventory.length === 0 ? (
                      <div className="text-center py-6 text-stone-500 text-sm">
                        Admin belum mengatur kolom pendaftaran untuk event ini.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {customFields.map((field) => (
                          <div
                            key={field.id}
                            className={`min-w-0 overflow-hidden ${field.type === "textarea" ? "md:col-span-2" : ""}`}
                          >
                            <label className="block text-xs font-bold text-stone-700 mb-1.5">
                              {field.label}{" "}
                              {field.required ? <span className="text-red-500">*</span> : null}
                            </label>

                            {field.type === "dropdown" ? (
                              <Select
                                className="w-full"
                                size="large"
                                virtual={false}
                                getPopupContainer={() => document.body}
                                placeholder={`Pilih ${field.label}`}
                                value={bulkParticipants[activeTabIdx]?.[field.id] || undefined}
                                onChange={(val) => setParticipantField(field.id, val)}
                                options={(field.options ? field.options.split(",") : []).map(
                                  (opt) => ({ label: opt.trim(), value: opt.trim() }),
                                )}
                              />
                            ) : field.type === "nationality" ? (
                              <Select
                                showSearch
                                className="w-full"
                                size="large"
                                virtual={false}
                                getPopupContainer={() => document.body}
                                placeholder={`Pilih ${field.label}`}
                                filterOption={(input, option) =>
                                  String(option?.value || "")
                                    .toLowerCase()
                                    .includes(input.toLowerCase())
                                }
                                value={bulkParticipants[activeTabIdx]?.[field.id] || undefined}
                                onChange={(val) => setParticipantField(field.id, val)}
                                options={getData().map((c) => {
                                  const icon = getUnicodeFlagIcon(c.code);
                                  return {
                                    label: (
                                      <span>
                                        <FlagImg emoji={icon} name={c.name} />
                                        {c.name}
                                      </span>
                                    ),
                                    value: `${icon} ${c.name}`,
                                  };
                                })}
                              />
                            ) : field.type === "date" ? (
                              <DatePicker
                                className="w-full"
                                size="large"
                                inputReadOnly
                                getPopupContainer={() => document.body}
                                placeholder={`Pilih ${field.label}`}
                                value={
                                  bulkParticipants[activeTabIdx]?.[field.id]
                                    ? dayjs(bulkParticipants[activeTabIdx][field.id])
                                    : null
                                }
                                onChange={(d) => {
                                  const val = d ? d.format("YYYY-MM-DD") : "";
                                  setParticipantField(field.id, val);

                                  // Auto-assign Age Category from DOB
                                  const age = calculateAgeOnRaceDay(
                                    val,
                                    event?.eventDate || "",
                                  );
                                  const category = getAgeCategory(age, ageBrackets);
                                  setBulkParticipants((prev) => {
                                    const updated = [...prev];
                                    updated[activeTabIdx] = { ...updated[activeTabIdx] };
                                    if (category) {
                                      updated[activeTabIdx]["Age Category"] = category;
                                    } else {
                                      delete updated[activeTabIdx]["Age Category"];
                                    }
                                    return updated;
                                  });
                                }}
                              />
                            ) : field.type === "textarea" ? (
                              <Input.TextArea
                                rows={3}
                                className="w-full min-w-0"
                                autoComplete="off"
                                placeholder={`Masukkan ${field.label}`}
                                value={bulkParticipants[activeTabIdx]?.[field.id] || ""}
                                onChange={(e) => setParticipantField(field.id, e.target.value)}
                              />
                            ) : (
                              <Input
                                size="large"
                                className="w-full min-w-0"
                                name={field.id}
                                autoComplete={autocompleteFor(field)}
                                type={field.type === "nik" ? "text" : field.type}
                                inputMode={field.type === "nik" ? "numeric" : undefined}
                                pattern={field.type === "nik" ? "[0-9]*" : undefined}
                                maxLength={field.type === "nik" ? 16 : undefined}
                                placeholder={`Masukkan ${field.label}`}
                                value={bulkParticipants[activeTabIdx]?.[field.id] || ""}
                                onChange={(e) => {
                                  if (field.type === "nik") {
                                    setParticipantField(field.id, e.target.value.replace(/\D/g, ""));
                                    return;
                                  }
                                  setParticipantField(field.id, e.target.value);

                                  // Auto-assign Age Category from DOB
                                  const labelLower = field.label.toLowerCase();
                                  if (
                                    labelLower.includes("date of birth") ||
                                    labelLower.includes("tanggal lahir") ||
                                    labelLower === "dob"
                                  ) {
                                    const age = calculateAgeOnRaceDay(
                                      e.target.value,
                                      event?.eventDate || "",
                                    );
                                    const category = getAgeCategory(age, ageBrackets);
                                    setBulkParticipants((prev) => {
                                      const updated = [...prev];
                                      updated[activeTabIdx] = { ...updated[activeTabIdx] };
                                      if (category) {
                                        updated[activeTabIdx]["Age Category"] = category;
                                      } else {
                                        delete updated[activeTabIdx]["Age Category"];
                                      }
                                      return updated;
                                    });
                                  }
                                }}
                              />
                            )}
                          </div>
                        ))}

                        {/* T-shirt */}
                        {tshirtInventory.length > 0 && (
                          <div className="md:col-span-2 mt-2 pt-4 border-t border-stone-200">
                            <label className="block text-xs font-bold text-stone-700 mb-1.5">
                              Ukuran Kaos / Jersey <span className="text-red-500">*</span>
                            </label>
                            <Select
                              className="w-full mb-3"
                              size="large"
                              virtual={false}
                              getPopupContainer={() => document.body}
                              placeholder="Pilih Ukuran"
                              value={bulkParticipants[activeTabIdx]?.["tshirtSize"] || undefined}
                              onChange={(val) => setParticipantField("tshirtSize", val)}
                              options={tshirtInventory.map((t) => {
                                const selectedCount = bulkParticipants.filter(
                                  (p, i) => i !== activeTabIdx && p.tshirtSize === t.size,
                                ).length;
                                const remaining = t.quota - t.sold - selectedCount;
                                return {
                                  label: `${t.size} ${t.quota > 0 ? (remaining <= 0 ? "(Habis)" : `(${remaining} tersisa)`) : ""}`,
                                  value: t.size,
                                  disabled: t.quota > 0 && remaining <= 0,
                                };
                              })}
                            />
                            <div className="mt-4">
                              <div className="flex items-center gap-2 mb-3">
                                <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">
                                  Size Chart Guide
                                </span>
                                <div className="h-px flex-1 bg-stone-100" />
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                {tshirtInventory.map((t, idx) => (
                                  <div
                                    key={idx}
                                    className="bg-stone-50/50 border border-stone-100 rounded-xl p-3 flex flex-col items-center justify-center transition-all hover:border-red-200 hover:bg-white group"
                                  >
                                    <span className="text-lg font-black text-stone-900 mb-1 group-hover:text-red-600 transition-colors">
                                      {t.size}
                                    </span>
                                    <div className="flex flex-col items-center text-[10px] text-stone-500 font-medium uppercase tracking-tighter">
                                      <span>W: {t.width || "-"} cm</span>
                                      <span>H: {t.height || "-"} cm</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <p className="text-[9px] text-stone-400 mt-3 italic text-center">
                                * Ukuran dalam centimeter (cm). Toleransi ukuran ±1-2cm.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex justify-end pt-2">
                      <button
                        className="w-full sm:w-auto bg-stone-950 text-white rounded-xl h-12 px-8 font-bold uppercase tracking-widest text-xs hover:bg-stone-800 transition-colors"
                        onClick={goToPayment}
                      >
                        Lanjut Pembayaran
                      </button>
                    </div>
                  </div>
                </SectionCard>

                <SectionCard
                  n={3}
                  title="Pembayaran"
                  state={openSection === 3 ? "open" : "locked"}
                  summary={openSection > 3 ? `Rp ${finalPrice.toLocaleString("id-ID")}` : undefined}
                  onOpen={() => setOpenSection(3)}
                >
                  <div className="space-y-5">
                    {/* Mobile: order summary (incl. voucher input) lives here in
                        the payment step, right above the pay button — desktop
                        keeps the sticky sidebar instead */}
                    <div className="lg:hidden bg-stone-50 border border-stone-200 rounded-xl p-4">
                      {orderSummary}
                    </div>
                    {tncUrls.length > 0 && (
                      <div className="space-y-3 bg-stone-50 p-4 rounded-xl border border-stone-200">
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            className="w-5 h-5 accent-emerald-500 cursor-pointer mt-0.5"
                            checked={tncAgreed}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setTncModalOpen(true);
                              } else {
                                setTncAgreed(false);
                              }
                            }}
                          />
                          <span className="text-sm font-medium text-stone-600 leading-relaxed">
                            Saya telah membaca dan menyetujui seluruh{" "}
                            <button
                              className="text-emerald-600 font-bold hover:underline"
                              onClick={() => setTncModalOpen(true)}
                            >
                              Syarat dan Ketentuan
                            </button>{" "}
                            perlombaan ini.
                          </span>
                        </div>
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            className="w-5 h-5 accent-emerald-500 cursor-pointer mt-0.5"
                            checked={dataAgreed}
                            onChange={(e) => setDataAgreed(e.target.checked)}
                          />
                          <span className="text-sm font-medium text-stone-600 leading-relaxed">
                            Saya menyatakan bahwa seluruh data yang saya isi adalah benar, valid,
                            dan dapat dipertanggungjawabkan.
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="text-sm font-bold text-center text-stone-500">
                      {event?.content?.checkoutWarningText ||
                        "Pastikan data dan kategori yang Anda pilih sudah sesuai."}
                    </div>

                    <button
                      className="w-full bg-stone-950 text-white rounded-xl h-14 font-bold uppercase tracking-widest text-sm hover:bg-stone-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      disabled={registering}
                      onClick={handleCheckout}
                    >
                      {registering
                        ? "Memproses..."
                        : finalPrice <= 0
                          ? "Daftar Sekarang"
                          : "Bayar Sekarang"}
                    </button>

                    <p className="text-center text-xs text-stone-400">
                      Kamu akan diarahkan ke halaman pembayaran Midtrans yang aman.
                    </p>
                  </div>
                </SectionCard>
              </div>

              {/* Right — sticky order summary (desktop only, mobile uses the accordion above) */}
              <aside className="hidden lg:block">
                <div className="bg-stone-50 border border-stone-200 rounded-2xl p-6 lg:sticky lg:top-8">
                  <h2 className="text-[10px] font-black uppercase tracking-widest text-stone-500 mb-4">
                    Ringkasan Order
                  </h2>
                  {orderSummary}
                </div>
              </aside>
            </div>
          </>
        )}
      </main>

      {/* Refund & contact bottom sheet */}
      {helpSheetOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-[2px] animate-in fade-in duration-200"
            onClick={() => setHelpSheetOpen(false)}
          />
          <div className="relative w-full max-w-md bg-white rounded-t-3xl p-6 pb-10 shadow-2xl animate-in fade-in slide-in-from-bottom duration-300">
            <div className="w-10 h-1 bg-stone-200 rounded-full mx-auto mb-6" />
            <h3 className="text-lg font-black uppercase tracking-tighter text-stone-900 text-center mb-1">
              Refund &amp; Bantuan
            </h3>
            <p className="text-sm text-stone-500 text-center mb-6 leading-relaxed">
              Ada kendala pembayaran atau ingin mengajukan refund? Hubungi tim
              kami lewat:
            </p>
            <div className="space-y-3">
              <a
                href="https://wa.me/6285110513220?text=Halo%20Lumpat%2C%20saya%20butuh%20bantuan%20terkait%20pembayaran%20pendaftaran"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 w-full border-2 border-stone-200 rounded-xl p-4 hover:border-emerald-400 hover:bg-emerald-50/40 transition-colors"
              >
                <span className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                  </svg>
                </span>
                <span className="text-left">
                  <span className="block text-sm font-bold text-stone-900">WhatsApp</span>
                  <span className="block text-xs text-stone-500">0851-1051-3220</span>
                </span>
              </a>
              <a
                href="mailto:lumpat2026@gmail.com"
                className="flex items-center gap-3 w-full border-2 border-stone-200 rounded-xl p-4 hover:border-stone-900 hover:bg-stone-50 transition-colors"
              >
                <span className="w-10 h-10 rounded-full bg-stone-900 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </span>
                <span className="text-left">
                  <span className="block text-sm font-bold text-stone-900">Email</span>
                  <span className="block text-xs text-stone-500">lumpat2026@gmail.com</span>
                </span>
              </a>
            </div>
            <button
              onClick={() => setHelpSheetOpen(false)}
              className="w-full mt-5 text-sm font-bold text-stone-500 hover:text-stone-900 transition-colors"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* T&C document modal */}
      <Modal
        title={<div className="font-black text-xl">Syarat dan Ketentuan</div>}
        open={tncModalOpen}
        onCancel={() => setTncModalOpen(false)}
        styles={{ body: { maxHeight: "70vh", overflowY: "auto" } }}
        footer={
          <div className="flex justify-end pt-4 border-t border-stone-200 mt-4">
            <Button
              type="primary"
              size="large"
              className="bg-emerald-500 hover:bg-emerald-600 font-bold border-none"
              onClick={async () => {
                setTncAgreed(true);
                setTncModalOpen(false);
                try {
                  await fetch("/api/client-logs", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      action: "TNC_AGREED",
                      detail: `Peserta telah membaca/scroll dan menyetujui Syarat & Ketentuan. Waktu (Local): ${new Date().toLocaleString("id-ID")}`,
                      metadata: {
                        userEmail: email || "guest",
                        eventId: event?.id || "",
                      },
                    }),
                  });
                } catch (err) {
                  console.error("Failed to log TNC agreement", err);
                }
              }}
            >
              Setuju &amp; Lanjutkan
            </Button>
          </div>
        }
        width={800}
        centered
      >
        <div className="flex flex-col h-[70vh]">
          {tncUrls.length > 0 ? (
            <>
              <div
                className="w-full flex-1 overflow-y-auto bg-stone-50 rounded-xl border border-stone-200 p-2 relative flex flex-col gap-4"
                style={{ WebkitOverflowScrolling: "touch" }}
              >
                {tncUrls.map((url: string, idx: number) => (
                  <iframe
                    key={idx}
                    src={`${url}#toolbar=0`}
                    className="w-full min-h-[50vh] rounded-lg border-0 shadow-sm"
                  />
                ))}
              </div>
              <div className="mt-3 text-center">
                <p className="text-xs text-stone-500">
                  Anda harus menyetujui syarat &amp; ketentuan di atas sebelum melanjutkan
                  pendaftaran.
                </p>
                <div className="flex flex-wrap gap-2 justify-center mt-3">
                  {tncUrls.map((url: string, idx: number) => (
                    <a
                      key={idx}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block px-4 py-2 bg-stone-800 text-white text-xs font-bold rounded-lg hover:bg-stone-900 transition-colors"
                    >
                      Buka Dokumen {tncUrls.length > 1 ? idx + 1 : "T&C"}
                    </a>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-stone-400 italic">Belum ada dokumen Syarat dan Ketentuan.</p>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
