// src/pages/PaymentStatusPage.tsx - Post-payment landing page.
// Midtrans redirects back here (order_id appended by Snap preferences);
// we poll the payment status until it reaches a terminal state.

import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

type Status = "loading" | "pending" | "settlement" | "fail" | "notfound";

interface OrderInfo {
  eventName?: string;
  eventSlug?: string;
  categoryName?: string;
  participantCount?: number;
  total?: number;
}

function OrderDetails({ order }: { order: OrderInfo | null }) {
  if (!order) return null;
  const rows: [string, string][] = [];
  if (order.eventName) rows.push(["Event", order.eventName]);
  if (order.categoryName) rows.push(["Kategori", order.categoryName]);
  if (order.participantCount) rows.push(["Jumlah Peserta", `${order.participantCount} orang`]);
  if (order.total != null) rows.push(["Total", `Rp ${order.total.toLocaleString("id-ID")}`]);
  if (rows.length === 0) return null;
  return (
    <div className="w-full bg-stone-50 border border-stone-200 rounded-xl p-4 space-y-2">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-4 text-sm">
          <span className="text-stone-500">{label}</span>
          <span className="font-bold text-stone-900 text-right">{value}</span>
        </div>
      ))}
    </div>
  );
}

export default function PaymentStatusPage() {
  const [searchParams] = useSearchParams();
  const orderId =
    searchParams.get("order_id") || searchParams.get("orderId") || "";
  const [status, setStatus] = useState<Status>("loading");
  const [order, setOrder] = useState<OrderInfo | null>(null);
  const [checking, setChecking] = useState(false);

  const checkOnce = useCallback(async (): Promise<Status> => {
    if (!orderId) {
      setStatus("notfound");
      return "notfound";
    }
    setChecking(true);
    try {
      const res = await fetch("/api/check-payment-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      if (res.status === 404) {
        setStatus("notfound");
        return "notfound";
      }
      const data = await res.json();
      setOrder(data.order || null);
      if (data.status === "settlement") {
        setStatus("settlement");
        return "settlement";
      }
      if (["cancel", "deny", "expire"].includes(data.status)) {
        setStatus("fail");
        return "fail";
      }
      setStatus("pending");
      return "pending";
    } catch {
      // Network/Midtrans hiccup — stay pending, next retry will resolve it
      setStatus("pending");
      return "pending";
    } finally {
      setChecking(false);
    }
  }, [orderId]);

  // Initial check + auto-poll with backoff while pending
  useEffect(() => {
    if (!orderId) {
      setStatus("notfound");
      return;
    }
    let alive = true;
    const delays = [0, 3000, 5000, 8000, 12000, 20000, 30000, 30000];
    let i = 0;
    (async () => {
      while (alive) {
        const result = await checkOnce();
        if (!alive || result !== "pending") return;
        if (i < delays.length - 1) i++;
        await new Promise((r) => setTimeout(r, delays[i]));
      }
    })();
    return () => {
      alive = false;
    };
  }, [orderId, checkOnce]);

  const eventLink = order?.eventSlug ? `/event/${order.eventSlug}` : "/event";

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6 text-center">
        {/* Loading */}
        {status === "loading" && (
          <div className="flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-[3px] border-stone-200 border-t-stone-900 rounded-full animate-spin" />
            <p className="text-sm font-bold text-stone-500 uppercase tracking-widest">
              Memeriksa Pembayaran...
            </p>
          </div>
        )}

        {/* Success */}
        {status === "settlement" && (
          <>
            <div className="w-20 h-20 mx-auto bg-emerald-50 border-2 border-emerald-200 rounded-full flex items-center justify-center">
              <svg className="w-10 h-10 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tighter text-stone-900">
                Pembayaran Berhasil
              </h1>
              <p className="text-sm text-stone-500 mt-2">
                Terima kasih! Konfirmasi pendaftaran dikirim ke email kamu.
              </p>
            </div>
            <OrderDetails order={order} />
            <div className="space-y-3">
              <Link
                to={`${eventLink}?tab=Registered`}
                className="block w-full bg-stone-950 text-white rounded-xl h-12 leading-[3rem] font-bold hover:bg-stone-800 transition-colors"
              >
                Lihat Peserta Terdaftar
              </Link>
              <Link
                to="/"
                className="block w-full border-2 border-stone-200 rounded-xl h-12 leading-[3rem] font-bold hover:border-stone-400 transition-colors"
              >
                Kembali ke Beranda
              </Link>
            </div>
          </>
        )}

        {/* Pending */}
        {status === "pending" && (
          <>
            <div className="w-20 h-20 mx-auto bg-amber-50 border-2 border-amber-200 rounded-full flex items-center justify-center">
              <div className="w-9 h-9 border-[3px] border-amber-200 border-t-amber-500 rounded-full animate-spin" />
            </div>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tighter text-stone-900">
                Menunggu Pembayaran
              </h1>
              <p className="text-sm text-stone-500 mt-2 leading-relaxed">
                Selesaikan pembayaran di halaman Midtrans. Halaman ini akan memeriksa
                status secara otomatis — atau tekan tombol di bawah setelah kamu bayar.
              </p>
            </div>
            <OrderDetails order={order} />
            <div className="space-y-3">
              <button
                onClick={() => checkOnce()}
                disabled={checking}
                className="w-full bg-stone-950 text-white rounded-xl h-12 font-bold hover:bg-stone-800 transition-colors disabled:opacity-40"
              >
                {checking ? "Memeriksa..." : "Cek Status Pembayaran"}
              </button>
              <Link
                to={eventLink}
                className="block w-full border-2 border-stone-200 rounded-xl h-12 leading-[3rem] font-bold hover:border-stone-400 transition-colors"
              >
                Kembali ke Event
              </Link>
            </div>
          </>
        )}

        {/* Failed / expired */}
        {status === "fail" && (
          <>
            <div className="w-20 h-20 mx-auto bg-red-50 border-2 border-red-200 rounded-full flex items-center justify-center">
              <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tighter text-stone-900">
                Pembayaran Tidak Berhasil
              </h1>
              <p className="text-sm text-stone-500 mt-2">
                Pembayaran dibatalkan atau kedaluwarsa. Silakan lakukan pendaftaran ulang.
              </p>
            </div>
            <OrderDetails order={order} />
            <div className="space-y-3">
              <Link
                to={`${eventLink}`}
                className="block w-full bg-stone-950 text-white rounded-xl h-12 leading-[3rem] font-bold hover:bg-stone-800 transition-colors"
              >
                Daftar Ulang
              </Link>
              <a
                href="/bantuan"
                className="block text-sm text-stone-500 underline underline-offset-4 hover:text-stone-900"
              >
                Butuh bantuan?
              </a>
            </div>
          </>
        )}

        {/* Not found */}
        {status === "notfound" && (
          <>
            <div className="w-20 h-20 mx-auto bg-stone-100 border-2 border-stone-200 rounded-full flex items-center justify-center">
              <svg className="w-10 h-10 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tighter text-stone-900">
                Order Tidak Ditemukan
              </h1>
              <p className="text-sm text-stone-500 mt-2">
                Nomor order tidak valid atau tidak tercatat.
              </p>
            </div>
            <Link
              to="/event"
              className="block w-full bg-stone-950 text-white rounded-xl h-12 leading-[3rem] font-bold hover:bg-stone-800 transition-colors"
            >
              Cari Event
            </Link>
          </>
        )}

        {orderId && status !== "loading" && status !== "notfound" && (
          <p className="text-[10px] font-mono text-stone-300 break-all">{orderId}</p>
        )}
      </div>
    </div>
  );
}
