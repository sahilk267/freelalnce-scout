/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  CheckCircle2, 
  Sparkles, 
  ShieldCheck, 
  ArrowRight, 
  CreditCard, 
  RefreshCw, 
  FileText, 
  Check, 
  Clock, 
  AlertCircle,
  Zap,
  RotateCcw
} from "lucide-react";
import { PricingTier } from "../domain/models/PricingTier";
import { apiFetch, getAuthUser } from "../utils/apiAuth";

interface CreatedOrder {
  id: string;
  candidateId: string;
  tier: string;
  priceINR: number;
  priceAtOrderTime?: number;
  priceMinorUnits?: number;
  currency?: string;
  maxRevisions: number;
  paymentStatus: string;
  deliveryStatus: string;
  createdAt: string;
}

export default function ResumeOrderPlacement() {
  const [tiers, setTiers] = useState<PricingTier[]>([]);
  const [loadingTiers, setLoadingTiers] = useState<boolean>(true);
  const [tiersError, setTiersError] = useState<string | null>(null);

  const [selectedTier, setSelectedTier] = useState<string>("standard");
  const [candidateEmail, setCandidateEmail] = useState<string>("candidate@example.com");
  const [originalResumeText, setOriginalResumeText] = useState<string>("");
  const [targetJobDescription, setTargetJobDescription] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [createdOrder, setCreatedOrder] = useState<CreatedOrder | null>(null);
  const [paymentResult, setPaymentResult] = useState<any | null>(null);

  useEffect(() => {
    fetchPublicPricing();
  }, []);

  const fetchPublicPricing = async () => {
    setLoadingTiers(true);
    setTiersError(null);
    try {
      // Public endpoint: only returns active tiers
      const res = await fetch("/api/pricing");
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to load current pricing tiers");
      }
      const data: PricingTier[] = await res.json();
      setTiers(data);
      if (data.length > 0 && !data.some(t => t.tierId === selectedTier)) {
        setSelectedTier(data[0].tierId);
      }
    } catch (err: any) {
      setTiersError(err.message || "Failed to load pricing.");
    } finally {
      setLoadingTiers(false);
    }
  };

  const handleOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!originalResumeText.trim()) {
      setOrderError("Original resume text is required.");
      return;
    }

    setSubmitting(true);
    setOrderError(null);
    setCreatedOrder(null);
    setPaymentResult(null);

    try {
      // 1. Ensure or get a candidate ID
      let candidateId = "cand-default";
      try {
        const candRes = await apiFetch("/api/screening/candidates");
        if (candRes.ok) {
          const cands = await candRes.json();
          if (Array.isArray(cands) && cands.length > 0) {
            candidateId = cands[0].id;
          }
        }
      } catch {
        // use default fallback
      }

      // 2. Submit order to /api/orders
      const res = await apiFetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateId,
          tier: selectedTier,
          originalResumeText: originalResumeText.trim(),
          targetJobDescription: targetJobDescription.trim() || undefined,
          autoDeliverEnabled: false
        })
      });

      const orderData = await res.json();
      if (!res.ok) {
        throw new Error(orderData.error || "Failed to submit resume rewrite order");
      }

      setCreatedOrder(orderData);

      // 3. Automatically initiate payment intent with dynamic pricing
      const piRes = await apiFetch("/api/orders/create-payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: orderData.id,
          tier: selectedTier
        })
      });

      if (piRes.ok) {
        const piData = await piRes.json();
        setPaymentResult(piData);
      }
    } catch (err: any) {
      setOrderError(err.message || "Failed to place order");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSimulatePayment = async () => {
    if (!createdOrder) return;
    setSubmitting(true);
    try {
      const res = await apiFetch(`/api/orders/${createdOrder.id}/pay-simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ simulateFailure: false })
      });
      const data = await res.json();
      if (res.ok && data.order) {
        setCreatedOrder(data.order);
      }
    } catch (err: any) {
      setOrderError(err.message || "Failed to simulate payment");
    } finally {
      setSubmitting(false);
    }
  };

  const formatPrice = (minorUnits: number, curr: string = "INR") => {
    const major = minorUnits / 100;
    if (curr === "INR") {
      return `₹${major.toLocaleString("en-IN")}`;
    }
    return `${curr} ${major.toLocaleString()}`;
  };

  return (
    <div className="space-y-8" id="resume-order-placement-wrapper">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 font-mono text-xs uppercase tracking-wider mb-1">
            <Sparkles className="w-4 h-4" />
            <span>Candidate Career Advancement</span>
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight">
            Professional AI & Recruiter Resume Rewrite
          </h2>
          <p className="text-xs text-slate-400 mt-1 font-mono">
            Ground truth factual verification, ATS optimization, and guaranteed revision iterations.
          </p>
        </div>

        <button
          onClick={fetchPublicPricing}
          disabled={loadingTiers}
          className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-mono flex items-center gap-2 border border-slate-700 transition-colors"
          id="btn-refresh-public-pricing"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loadingTiers ? "animate-spin" : ""}`} />
          <span>Sync Live Tiers</span>
        </button>
      </div>

      {tiersError && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center gap-3">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{tiersError}</span>
        </div>
      )}

      {/* Tier Selection Cards */}
      <div className="space-y-3" id="public-pricing-tiers-section">
        <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold px-1">
          Select Your Service Tier (Configured Dynamically)
        </h3>

        {loadingTiers ? (
          <div className="p-8 bg-slate-900 border border-slate-800 rounded-2xl text-center text-slate-500 font-mono text-xs flex items-center justify-center gap-3">
            <RefreshCw className="w-5 h-5 animate-spin text-indigo-500" />
            <span>Querying active pricing registry...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6" id="order-tier-cards">
            {tiers.map((t) => {
              const isSelected = selectedTier === t.tierId;
              return (
                <div
                  key={t.tierId}
                  onClick={() => setSelectedTier(t.tierId)}
                  id={`select-tier-card-${t.tierId}`}
                  className={`cursor-pointer rounded-2xl p-6 transition-all duration-200 border relative flex flex-col justify-between ${
                    isSelected
                      ? "bg-slate-900 border-indigo-500 ring-2 ring-indigo-500/20 shadow-xl"
                      : "bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900"
                  }`}
                >
                  {isSelected && (
                    <div className="absolute top-4 right-4 p-1 rounded-full bg-indigo-500 text-white">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                  )}

                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500 block mb-1">
                      TIER: {t.tierId}
                    </span>
                    <h4 className="text-lg font-bold text-white tracking-tight">
                      {t.displayName}
                    </h4>

                    <div className="my-4">
                      <div className="text-3xl font-extrabold text-white tracking-tight font-mono">
                        {formatPrice(t.priceMinorUnits, t.currency)}
                      </div>
                      <span className="text-[11px] text-slate-500 font-mono">
                        Instant payment intent in {t.currency}
                      </span>
                    </div>

                    <ul className="space-y-2 text-xs text-slate-300 font-mono pt-2 border-t border-slate-800">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                        <span>{t.revisionLimit} Included {t.revisionLimit === 1 ? "Revision" : "Revisions"}</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0" />
                        <span>Grounded Fact Traceability Audit</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>ATS Score Comparison</span>
                      </li>
                    </ul>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-800">
                    <button
                      type="button"
                      className={`w-full py-2 px-3 rounded-xl text-xs font-semibold font-mono transition-colors flex items-center justify-center gap-1.5 ${
                        isSelected
                          ? "bg-indigo-600 text-white"
                          : "bg-slate-800 text-slate-300 hover:text-white"
                      }`}
                    >
                      <span>{isSelected ? "Selected Tier" : "Choose Tier"}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Order Submission Form */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6" id="order-submission-panel">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono mb-4 flex items-center gap-2">
          <FileText className="w-4 h-4 text-indigo-400" />
          <span>Submit Resume Details & Target Spec</span>
        </h3>

        {orderError && (
          <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center gap-3 mb-4">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{orderError}</span>
          </div>
        )}

        <form onSubmit={handleOrderSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-400">
                Candidate Contact Email
              </label>
              <input
                type="email"
                value={candidateEmail}
                onChange={(e) => setCandidateEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                required
                id="input-candidate-email"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono text-slate-400">
                Selected Package Snapshot
              </label>
              <div className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-indigo-300 font-mono flex justify-between items-center">
                <span className="uppercase font-bold">{selectedTier} TIER</span>
                <span>
                  {tiers.find(t => t.tierId === selectedTier) 
                    ? formatPrice(tiers.find(t => t.tierId === selectedTier)!.priceMinorUnits, tiers.find(t => t.tierId === selectedTier)!.currency) 
                    : "—"}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-mono text-slate-400 flex justify-between">
              <span>Original Resume Text / CV Markdown</span>
              <span className="text-[10px] text-slate-500">{originalResumeText.length} chars</span>
            </label>
            <textarea
              rows={6}
              value={originalResumeText}
              onChange={(e) => setOriginalResumeText(e.target.value)}
              placeholder="Paste raw resume text or markdown here..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono resize-none"
              required
              id="textarea-original-resume"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-mono text-slate-400 flex justify-between">
              <span>Target Job Description (Optional)</span>
              <span className="text-[10px] text-slate-500">{targetJobDescription.length} chars</span>
            </label>
            <textarea
              rows={4}
              value={targetJobDescription}
              onChange={(e) => setTargetJobDescription(e.target.value)}
              placeholder="Paste job description to calibrate ATS keywords and alignment..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono resize-none"
              id="textarea-target-jd"
            />
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={submitting || !originalResumeText.trim()}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-mono font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"
              id="btn-submit-resume-order"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Locking Dynamic Price Snapshot...</span>
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4" />
                  <span>Create Order & Generate Payment Intent</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Created Order Confirmation & Payment Intent Card */}
      {createdOrder && (
        <div className="bg-slate-900 border border-emerald-500/40 rounded-2xl p-6 space-y-4 animate-fadeIn" id="order-confirmation-card">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white tracking-tight">
                  Order Successfully Created & Price Snapshot Locked
                </h4>
                <p className="text-xs text-slate-400 font-mono">
                  Order ID: <code className="text-emerald-300">{createdOrder.id}</code>
                </p>
              </div>
            </div>

            <span className={`px-3 py-1 rounded-full text-xs font-mono font-bold uppercase ${
              createdOrder.paymentStatus === "paid" 
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" 
                : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
            }`}>
              {createdOrder.paymentStatus}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono">
            <div>
              <span className="text-slate-500 block">Tier</span>
              <span className="font-bold text-white uppercase">{createdOrder.tier}</span>
            </div>
            <div>
              <span className="text-slate-500 block">Locked Price</span>
              <span className="font-bold text-emerald-400">
                {createdOrder.currency || "INR"} {createdOrder.priceAtOrderTime ?? createdOrder.priceINR}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Revision Limit</span>
              <span className="font-bold text-indigo-300">{createdOrder.maxRevisions} Revisions</span>
            </div>
            <div>
              <span className="text-slate-500 block">Delivery Pipeline</span>
              <span className="font-bold text-slate-300 uppercase">{createdOrder.deliveryStatus}</span>
            </div>
          </div>

          {paymentResult && createdOrder.paymentStatus !== "paid" && (
            <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-800/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-mono text-indigo-300 block font-semibold">
                  Payment Intent Ready: {paymentResult.paymentIntentId}
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  Amount: {paymentResult.currency} {paymentResult.amount} ({paymentResult.amountMinorUnits} minor units)
                </span>
              </div>

              <button
                type="button"
                onClick={handleSimulatePayment}
                disabled={submitting}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-mono font-semibold flex items-center gap-2 transition-colors"
                id="btn-simulate-payment"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Simulate Successful Payment</span>
              </button>
            </div>
          )}

          {createdOrder.paymentStatus === "paid" && (
            <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs font-mono flex items-center gap-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Payment verified. The resume order is now in the pipeline and protected by its original pricing snapshot!
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
