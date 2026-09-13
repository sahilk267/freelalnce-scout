/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Tag, 
  DollarSign, 
  Edit3, 
  Check, 
  X, 
  RefreshCw, 
  History, 
  AlertCircle, 
  CheckCircle2, 
  ShieldCheck, 
  Power, 
  ArrowRight,
  TrendingUp,
  Sparkles,
  Info
} from "lucide-react";
import { PricingTier, PricingAuditLog, isValidISO4217 } from "../domain/models/PricingTier";
import { apiFetch, getAuthUser } from "../utils/apiAuth";

export default function PricingManager() {
  const currentUser = getAuthUser();
  const [tiers, setTiers] = useState<PricingTier[]>([]);
  const [auditLogs, setAuditLogs] = useState<PricingAuditLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Edit Modal State
  const [editingTier, setEditingTier] = useState<PricingTier | null>(null);
  const [formData, setFormData] = useState({
    displayName: "",
    priceMajor: 0,
    currency: "INR",
    revisionLimit: 1,
    isActive: true,
    reason: ""
  });
  const [formError, setFormError] = useState<string | null>(null);

  // View toggle: Tiers vs Audit History
  const [activeView, setActiveView] = useState<"tiers" | "audit">("tiers");
  const [auditFilterTier, setAuditFilterTier] = useState<string>("all");

  useEffect(() => {
    loadTiers();
    loadAuditLogs();
  }, []);

  const loadTiers = async () => {
    setLoading(true);
    setError(null);
    try {
      // Admin request to see all tiers including deactivated ones
      const res = await apiFetch("/api/admin/pricing");
      if (!res.ok) {
        // Fallback to /api/pricing?all=true
        const fallbackRes = await apiFetch("/api/pricing?all=true");
        if (!fallbackRes.ok) {
          const errData = await fallbackRes.json();
          throw new Error(errData.error || "Failed to load pricing configuration");
        }
        const data = await fallbackRes.json();
        setTiers(data);
        return;
      }
      const data = await res.json();
      setTiers(data);
    } catch (err: any) {
      setError(err.message || "Failed to fetch pricing tiers");
    } finally {
      setLoading(false);
    }
  };

  const loadAuditLogs = async (tierId?: string) => {
    try {
      const url = tierId && tierId !== "all" 
        ? `/api/pricing/audit?tierId=${encodeURIComponent(tierId)}`
        : "/api/pricing/audit";
      const res = await apiFetch(url);
      if (res.ok) {
        const logs = await res.json();
        setAuditLogs(logs);
      }
    } catch {
      // Non-blocking audit log load
    }
  };

  const handleStartEdit = (tier: PricingTier) => {
    setEditingTier(tier);
    setFormData({
      displayName: tier.displayName,
      priceMajor: tier.priceMinorUnits / 100,
      currency: tier.currency || "INR",
      revisionLimit: tier.revisionLimit,
      isActive: tier.isActive,
      reason: ""
    });
    setFormError(null);
  };

  const handleQuickToggleActive = async (tier: PricingTier) => {
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const updatedIsActive = !tier.isActive;
      const res = await apiFetch(`/api/pricing/${tier.tierId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isActive: updatedIsActive,
          reason: updatedIsActive ? "Administrative re-activation" : "Administrative deactivation"
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update tier active status");
      }

      setSuccess(`Tier '${tier.displayName}' is now ${updatedIsActive ? "ACTIVE" : "DEACTIVATED"}`);
      await loadTiers();
      await loadAuditLogs(auditFilterTier);
    } catch (err: any) {
      setError(err.message || "Failed to toggle tier status");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTier) return;

    setFormError(null);
    setError(null);
    setSuccess(null);

    // Client-side validations
    if (formData.priceMajor <= 0) {
      setFormError("Price must be greater than zero.");
      return;
    }
    if (formData.revisionLimit < 0) {
      setFormError("Revision limit must be greater than or equal to 0.");
      return;
    }
    const cleanCurrency = formData.currency.trim().toUpperCase();
    if (!isValidISO4217(cleanCurrency)) {
      setFormError(`'${cleanCurrency}' is not a recognized ISO 4217 3-letter currency code (e.g. INR, USD, EUR, GBP).`);
      return;
    }
    if (!formData.reason.trim()) {
      setFormError("Please provide an audit reason for this pricing modification.");
      return;
    }

    setSaving(true);
    try {
      const priceMinorUnits = Math.round(formData.priceMajor * 100);
      const res = await apiFetch(`/api/pricing/${editingTier.tierId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: formData.displayName.trim(),
          priceMinorUnits,
          price: formData.priceMajor,
          currency: cleanCurrency,
          revisionLimit: Number(formData.revisionLimit),
          isActive: formData.isActive,
          reason: formData.reason.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save pricing tier updates");
      }

      setSuccess(`Pricing tier '${editingTier.displayName}' updated successfully! New price: ${cleanCurrency} ${formData.priceMajor}.`);
      setEditingTier(null);
      await loadTiers();
      await loadAuditLogs(auditFilterTier);
    } catch (err: any) {
      setFormError(err.message || "Failed to save updates");
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (minorUnits: number, curr: string = "INR") => {
    const major = minorUnits / 100;
    if (curr === "INR") {
      return `₹${major.toLocaleString("en-IN")}`;
    }
    return `${curr} ${major.toLocaleString()}`;
  };

  return (
    <div className="space-y-8" id="pricing-manager-module">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl" id="pricing-manager-header">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 rounded-xl" id="header-pricing-icon">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2" id="pricing-manager-title">
                Dynamic Pricing & Service Tiers
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  Live Sync
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5 font-mono" id="pricing-manager-desc">
                Single source of truth for candidate resume order tiers, paise-precision storage & audit trails.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex text-xs font-mono">
            <button
              onClick={() => setActiveView("tiers")}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                activeView === "tiers" 
                  ? "bg-slate-800 text-white font-semibold shadow-sm" 
                  : "text-slate-400 hover:text-slate-200"
              }`}
              id="tab-view-tiers"
            >
              Configured Tiers
            </button>
            <button
              onClick={() => {
                setActiveView("audit");
                loadAuditLogs(auditFilterTier);
              }}
              className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
                activeView === "audit" 
                  ? "bg-slate-800 text-white font-semibold shadow-sm" 
                  : "text-slate-400 hover:text-slate-200"
              }`}
              id="tab-view-audit"
            >
              <History className="w-3.5 h-3.5 text-indigo-400" />
              Audit Log ({auditLogs.length})
            </button>
          </div>

          <button
            onClick={() => {
              loadTiers();
              loadAuditLogs(auditFilterTier);
            }}
            disabled={loading || saving}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-colors"
            title="Refresh pricing tables"
            id="btn-refresh-pricing"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Status Banners */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center gap-3 animate-fadeIn" id="pricing-error-banner">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs flex items-center gap-3 animate-fadeIn" id="pricing-success-banner">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Info Callout */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 flex items-start gap-3 text-xs text-slate-300 font-mono">
        <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-slate-200">Zero Code Deploy Dynamic Tiers & Snapshot Protection:</p>
          <p className="text-slate-400 leading-relaxed">
            Prices are saved in minor units (paise/cents) to eliminate floating point rounding. Existing candidate orders
            permanently snapshot <code className="text-indigo-300">priceAtOrderTime</code> and will never be retroactively altered when tier pricing changes.
          </p>
        </div>
      </div>

      {/* VIEW 1: CONFIGURED TIERS GRID */}
      {activeView === "tiers" && (
        <div className="space-y-4" id="configured-tiers-container">
          <div className="flex justify-between items-center px-1">
            <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold">
              Live Service Tiers ({tiers.length})
            </h3>
            <span className="text-[11px] text-slate-500 font-mono">
              Changes propagate instantaneously to order checkout
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6" id="pricing-tiers-grid">
            {tiers.map((tier) => {
              const isDeactivated = !tier.isActive;
              return (
                <div 
                  key={tier.tierId}
                  id={`tier-card-${tier.tierId}`}
                  className={`bg-slate-900 border rounded-2xl p-6 transition-all duration-200 flex flex-col justify-between relative overflow-hidden ${
                    isDeactivated 
                      ? "border-slate-800/60 opacity-70 bg-slate-950/40" 
                      : "border-slate-800 hover:border-slate-700 shadow-lg"
                  }`}
                >
                  {/* Top Status & Currency indicator */}
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500 block mb-1">
                        TIER ID: {tier.tierId}
                      </span>
                      <h4 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                        {tier.displayName}
                        {tier.tierId === "standard" && (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                            Most Popular
                          </span>
                        )}
                      </h4>
                    </div>

                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold flex items-center gap-1.5 ${
                      tier.isActive 
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                        : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${tier.isActive ? "bg-emerald-400" : "bg-rose-400"}`} />
                      {tier.isActive ? "ACTIVE" : "DISABLED"}
                    </span>
                  </div>

                  {/* Price & Quotas Display */}
                  <div className="my-5 p-4 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-3 font-mono">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-slate-400">Live Price:</span>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-white tracking-tight">
                          {formatCurrency(tier.priceMinorUnits, tier.currency)}
                        </div>
                        <span className="text-[10px] text-slate-500">
                          {tier.priceMinorUnits.toLocaleString()} {tier.currency === "INR" ? "paise" : "minor units"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs">
                      <span className="text-slate-400">Revision Quota:</span>
                      <span className="text-indigo-300 font-semibold">
                        {tier.revisionLimit} {tier.revisionLimit === 1 ? "Revision" : "Revisions"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">Currency Standard:</span>
                      <span className="text-slate-200 font-semibold px-2 py-0.5 rounded bg-slate-800 text-[11px]">
                        {tier.currency} (ISO 4217)
                      </span>
                    </div>
                  </div>

                  {/* Metadata & Actions */}
                  <div className="space-y-4 pt-2">
                    <div className="text-[10px] font-mono text-slate-500 space-y-0.5">
                      <div>Updated: {new Date(tier.updatedAt).toLocaleString()}</div>
                      <div>By: <span className="text-slate-400">{tier.updatedBy}</span></div>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-slate-800/60">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(tier)}
                        className="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                        id={`btn-edit-${tier.tierId}`}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit Pricing</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleQuickToggleActive(tier)}
                        disabled={saving}
                        className={`p-2 rounded-xl text-xs font-semibold border transition-colors flex items-center justify-center ${
                          tier.isActive 
                            ? "bg-rose-950/30 hover:bg-rose-900/40 text-rose-300 border-rose-800/50" 
                            : "bg-emerald-950/30 hover:bg-emerald-900/40 text-emerald-300 border-emerald-800/50"
                        }`}
                        title={tier.isActive ? "Deactivate Tier (stops new orders)" : "Activate Tier (enable purchasing)"}
                        id={`btn-toggle-active-${tier.tierId}`}
                      >
                        <Power className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 2: AUDIT HISTORY LOG */}
      {activeView === "audit" && (
        <div className="space-y-4" id="pricing-audit-section">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 px-1">
            <div>
              <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 font-semibold">
                Pricing Modification Audit Log
              </h3>
              <p className="text-[11px] text-slate-500 font-mono">
                Immutable record of all price adjustments, revision quota updates, and active state changes.
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-slate-400">Filter Tier:</span>
              <select
                value={auditFilterTier}
                onChange={(e) => {
                  setAuditFilterTier(e.target.value);
                  loadAuditLogs(e.target.value);
                }}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 focus:outline-none focus:border-indigo-500"
                id="select-audit-filter"
              >
                <option value="all">All Tiers</option>
                {tiers.map((t) => (
                  <option key={t.tierId} value={t.tierId}>{t.displayName} ({t.tierId})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg" id="audit-log-table-wrapper">
            {auditLogs.length === 0 ? (
              <div className="p-8 text-center text-slate-500 font-mono text-xs">
                No pricing audit entries recorded yet. Modifications will appear here automatically.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300 font-mono" id="audit-log-table">
                  <thead className="bg-slate-950 text-slate-400 font-semibold text-[11px] uppercase tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="px-5 py-3">Timestamp</th>
                      <th className="px-5 py-3">Tier</th>
                      <th className="px-5 py-3">Price Adjustment</th>
                      <th className="px-5 py-3">Revisions</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Modified By</th>
                      <th className="px-5 py-3">Reason / Context</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {auditLogs.map((log) => {
                      const oldPrice = log.oldPriceMinorUnits / 100;
                      const newPrice = log.newPriceMinorUnits / 100;
                      const priceChanged = log.oldPriceMinorUnits !== log.newPriceMinorUnits;
                      const revisionsChanged = log.oldRevisionLimit !== log.newRevisionLimit;
                      const statusChanged = log.oldIsActive !== log.newIsActive;

                      return (
                        <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="px-5 py-3 text-slate-400 whitespace-nowrap">
                            {new Date(log.changedAt).toLocaleString()}
                          </td>
                          <td className="px-5 py-3 font-semibold text-white uppercase whitespace-nowrap">
                            {log.tierId}
                          </td>
                          <td className="px-5 py-3 whitespace-nowrap">
                            {priceChanged ? (
                              <div className="flex items-center gap-1.5">
                                <span className="text-slate-500 line-through">
                                  {log.oldCurrency} {oldPrice}
                                </span>
                                <ArrowRight className="w-3 h-3 text-indigo-400" />
                                <span className={`font-bold ${newPrice > oldPrice ? "text-amber-400" : "text-emerald-400"}`}>
                                  {log.newCurrency} {newPrice}
                                </span>
                              </div>
                            ) : (
                              <span className="text-slate-400">
                                {log.newCurrency} {newPrice} (Unchanged)
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3 whitespace-nowrap">
                            {revisionsChanged ? (
                              <div className="flex items-center gap-1.5">
                                <span className="text-slate-500">{log.oldRevisionLimit}</span>
                                <ArrowRight className="w-3 h-3 text-indigo-400" />
                                <span className="font-bold text-indigo-300">{log.newRevisionLimit}</span>
                              </div>
                            ) : (
                              <span className="text-slate-400">{log.newRevisionLimit}</span>
                            )}
                          </td>
                          <td className="px-5 py-3 whitespace-nowrap">
                            {statusChanged ? (
                              <div className="flex items-center gap-1.5">
                                <span className={log.oldIsActive ? "text-emerald-400" : "text-rose-400"}>
                                  {log.oldIsActive ? "Active" : "Disabled"}
                                </span>
                                <ArrowRight className="w-3 h-3 text-indigo-400" />
                                <span className={`font-bold ${log.newIsActive ? "text-emerald-400" : "text-rose-400"}`}>
                                  {log.newIsActive ? "Active" : "Disabled"}
                                </span>
                              </div>
                            ) : (
                              <span className={log.newIsActive ? "text-emerald-400" : "text-slate-500"}>
                                {log.newIsActive ? "Active" : "Disabled"}
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3 text-slate-300 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                              {log.changedBy}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-slate-300 max-w-xs truncate" title={log.reason}>
                            {log.reason || "Dynamic pricing configuration update"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* EDIT MODAL DIALOG */}
      {editingTier && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" id="edit-pricing-modal">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-6 shadow-2xl animate-fadeIn">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500">
                  Editing Tier Configuration
                </span>
                <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                  {editingTier.displayName} ({editingTier.tierId})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingTier(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                id="btn-close-edit-modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs flex items-center gap-2.5" id="form-error-banner">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Form Inputs */}
            <form onSubmit={handleSaveEdit} className="space-y-4">
              {/* Display Name */}
              <div className="space-y-1.5">
                <label className="text-xs font-mono text-slate-400 flex justify-between">
                  <span>Display Name</span>
                  <span className="text-[10px] text-slate-500">User-facing label</span>
                </label>
                <input
                  type="text"
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                  placeholder="e.g. Standard"
                  required
                  id="input-tier-displayName"
                />
              </div>

              {/* Price & Currency Row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-400 flex justify-between">
                    <span>Price ({formData.currency})</span>
                    <span className="text-[10px] text-indigo-400 font-bold">&gt; 0</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    value={formData.priceMajor}
                    onChange={(e) => setFormData({ ...formData, priceMajor: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono font-bold"
                    placeholder="e.g. 800"
                    required
                    id="input-tier-priceMajor"
                  />
                  <span className="text-[10px] font-mono text-slate-500 block">
                    = {Math.round(formData.priceMajor * 100).toLocaleString()} {formData.currency === "INR" ? "paise" : "minor units"}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-400 flex justify-between">
                    <span>Currency</span>
                    <span className="text-[10px] text-slate-500">ISO 4217</span>
                  </label>
                  <input
                    type="text"
                    maxLength={3}
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value.toUpperCase() })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono uppercase font-bold"
                    placeholder="INR"
                    required
                    id="input-tier-currency"
                  />
                  <span className="text-[10px] font-mono text-slate-500 block">
                    {isValidISO4217(formData.currency.trim().toUpperCase()) ? (
                      <span className="text-emerald-400">✓ Valid ISO code</span>
                    ) : (
                      <span className="text-rose-400">✗ Unrecognized code</span>
                    )}
                  </span>
                </div>
              </div>

              {/* Revision Limit & Active Toggle Row */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-400 flex justify-between">
                    <span>Revision Limit</span>
                    <span className="text-[10px] text-slate-500">&gt;= 0</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={formData.revisionLimit}
                    onChange={(e) => setFormData({ ...formData, revisionLimit: parseInt(e.target.value, 10) || 0 })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                    placeholder="2"
                    required
                    id="input-tier-revisionLimit"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-slate-400">
                    Active for Checkout
                  </label>
                  <div className="flex items-center h-[42px] px-3.5 bg-slate-950 border border-slate-800 rounded-xl">
                    <label className="flex items-center gap-2 cursor-pointer w-full text-xs font-mono text-slate-300">
                      <input
                        type="checkbox"
                        checked={formData.isActive}
                        onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                        className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-0 w-4 h-4 cursor-pointer"
                        id="checkbox-tier-isActive"
                      />
                      <span>{formData.isActive ? "Active (Purchasable)" : "Deactivated"}</span>
                    </label>
                  </div>
                </div>
              </div>

              {/* Audit Reason */}
              <div className="space-y-1.5 pt-1">
                <label className="text-xs font-mono text-slate-400 flex justify-between">
                  <span>Reason for Change</span>
                  <span className="text-[10px] text-indigo-400 font-bold">Required Audit Log</span>
                </label>
                <input
                  type="text"
                  value={formData.reason}
                  onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                  placeholder="e.g. Festive discount, Q3 rate revision, or international pricing"
                  required
                  id="input-tier-reason"
                />
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingTier(null)}
                  className="px-4 py-2 text-xs font-mono text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
                  id="btn-cancel-tier-edit"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-mono font-semibold flex items-center gap-2 transition-colors disabled:opacity-50"
                  id="btn-save-tier-edit"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Writing Audit Log...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Commit Price Update</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
