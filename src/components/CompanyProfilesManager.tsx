/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import {
  Building2,
  Globe,
  Plus,
  Trash2,
  Edit3,
  Send,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  MapPin,
  Laptop,
  ShieldCheck,
  Tag,
  X,
  ExternalLink,
  Sparkles,
  Sliders,
  Bell,
  Play,
  Pause,
  ChevronRight,
  Filter,
  Check,
  Briefcase,
  Mail,
  Server,
  Radio,
  CheckSquare,
  Square
} from "lucide-react";
import { CompanyProfile, FreelanceCategory } from "../types";

export const CATEGORY_METADATA: Record<
  FreelanceCategory,
  {
    icon: string;
    description: string;
    samplePlatforms: string[];
    sampleKeywords: string[];
  }
> = {
  "Writing & Content": {
    icon: "✍️",
    description: "ProBlogger, Content Writing Jobs, FreelanceWritingGigs (Copywriting, SEO Blogs, Ghostwriting)",
    samplePlatforms: ["ProBlogger", "Content Writing Jobs", "FreelanceWritingGigs", "FlexJobs"],
    sampleKeywords: ["Copywriting", "SEO Blogs", "Ghostwriting", "Technical Writing", "Whitepapers", "Blog Editing"]
  },
  "Design & Creative": {
    icon: "🎨",
    description: "Behance, Designhill, 99designs (UI/UX, Logo Design, 3D, Figma)",
    samplePlatforms: ["Behance", "Designhill", "99designs", "Fiverr Pro", "Dribbble"],
    sampleKeywords: ["Figma", "UI/UX", "Brand Design", "Vector Illustration", "Design Systems", "3D Rendering"]
  },
  "Virtual Assistant & Tasks": {
    icon: "📋",
    description: "Zirtual, OnlineJobs.ph, SkipTheDrive (Data Entry, Customer Support, Admin)",
    samplePlatforms: ["Zirtual", "OnlineJobs.ph", "SkipTheDrive", "TaskRabbit"],
    sampleKeywords: ["Data Entry", "Customer Support", "Admin", "Virtual Assistant", "Excel", "Transcription"]
  },
  "Digital Marketing": {
    icon: "📈",
    description: "SEO, Meta Ads, Google Ads, Lead Generation",
    samplePlatforms: ["CloudPeeps", "Talent.com", "Jobspresso", "Hubstaff Talent", "Upwork"],
    sampleKeywords: ["SEO", "Meta Ads", "Google Ads", "Lead Generation", "Growth Marketing", "PPC Campaigns"]
  },
  "Video Editing & Media": {
    icon: "🎬",
    description: "Premiere Pro, After Effects, YouTube Editing",
    samplePlatforms: ["Behance Jobs", "Freelancer.com", "Fiverr Pro", "Upwork", "YouTube Jobs"],
    sampleKeywords: ["Premiere Pro", "After Effects", "YouTube Editing", "Motion Graphics", "Color Grading"]
  },
  "Tech & Software": {
    icon: "💻",
    description: "Full-Stack, AI, DevOps",
    samplePlatforms: ["LinkedIn Jobs", "Upwork", "RemoteOK", "We Work Remotely", "Toptal", "Guru"],
    sampleKeywords: ["Full-Stack", "AI", "DevOps", "React", "Node.js", "TypeScript", "Python", "API", "Docker"]
  },
  "Aaditech Solution – IT & Infrastructure": {
    icon: "🛡️",
    description: "Microsoft 365, Windows Server, Active Directory, Networking, Cybersecurity, Remote IT Support, Automation, AI",
    samplePlatforms: ["Spiceworks", "LinkedIn IT Jobs", "Indeed", "Upwork Enterprise", "Guru", "Freelancer"],
    sampleKeywords: [
      "Microsoft 365", "Exchange Online", "Active Directory (AD)", "Windows Server",
      "System Administration", "Network Engineering", "Firewall", "VPN",
      "Cloud Migration", "Remote IT Support", "Cybersecurity", "AI Automation", "Python Automation"
    ]
  }
};

const ALL_CATEGORIES: FreelanceCategory[] = [
  "Writing & Content",
  "Design & Creative",
  "Virtual Assistant & Tasks",
  "Digital Marketing",
  "Video Editing & Media",
  "Tech & Software",
  "Aaditech Solution – IT & Infrastructure"
];

interface CompanyProfilesManagerProps {
  onCompanySelected?: (companyId: string) => void;
}

export default function CompanyProfilesManager({ onCompanySelected }: CompanyProfilesManagerProps) {
  const [companies, setCompanies] = useState<CompanyProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<CompanyProfile | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Fields State
  const [formData, setFormData] = useState<{
    name: string;
    website: string;
    description: string;
    isPrimary: boolean;
    categories: FreelanceCategory[];
    targetKeywordsText: string;
    negativeKeywordsText: string;
    physicalLocationsText: string;
    allowRemote: boolean;
    telegramEnabled: boolean;
    telegramChatId: string;
    hostingerEnabled: boolean;
    hostingerEmail: string;
    gmailEnabled: boolean;
    gmailEmail: string;
  }>({
    name: "",
    website: "",
    description: "",
    isPrimary: false,
    categories: ["Aaditech Solution – IT & Infrastructure", "Tech & Software"],
    targetKeywordsText: "",
    negativeKeywordsText: "",
    physicalLocationsText: "Mumbai, Navi Mumbai, Thane",
    allowRemote: true,
    telegramEnabled: true,
    telegramChatId: "-1003793331993",
    hostingerEnabled: true,
    hostingerEmail: "contact@aaditechs.in",
    gmailEnabled: true,
    gmailEmail: "sahil.k00267@gmail.com"
  });

  // Targeted Scout Drawer State
  const [scoutingCompany, setScoutingCompany] = useState<CompanyProfile | null>(null);
  const [scoutedLeads, setScoutedLeads] = useState<any[]>([]);
  const [isScouting, setIsScouting] = useState(false);
  const [testingDelivery, setTestingDelivery] = useState<{ id: string; channel: string } | null>(null);
  const [deliveryFeedback, setDeliveryFeedback] = useState<{ companyId: string; message: string; type: "success" | "error" | "info" } | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  const fetchCompanies = async () => {
    try {
      setIsRefreshing(true);
      const res = await fetch("/api/companies");
      if (res.ok) {
        const data = await res.json();
        setCompanies(data);
      }
    } catch (err: any) {
      console.error("Failed to fetch companies:", err);
      showToast("Could not load company profiles.", "error");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  const openCreateModal = () => {
    setEditingCompany(null);
    setFormData({
      name: "",
      website: "",
      description: "",
      isPrimary: companies.length === 0,
      categories: ["Aaditech Solution – IT & Infrastructure", "Tech & Software"],
      targetKeywordsText: "Microsoft 365, Windows Server, Active Directory, Networking, Cybersecurity, Remote IT Support, Automation, AI",
      negativeKeywordsText: "Data Entry, Cold Calling, Typing",
      physicalLocationsText: "Mumbai, Navi Mumbai, Thane",
      allowRemote: true,
      telegramEnabled: true,
      telegramChatId: "-1003793331993",
      hostingerEnabled: true,
      hostingerEmail: "contact@aaditechs.in",
      gmailEnabled: true,
      gmailEmail: "sahil.k00267@gmail.com"
    });
    setIsModalOpen(true);
  };

  const openEditModal = (comp: CompanyProfile) => {
    setEditingCompany(comp);
    setFormData({
      name: comp.name,
      website: comp.website || "",
      description: comp.description || "",
      isPrimary: Boolean(comp.isPrimary),
      categories: (comp.categories && comp.categories.length > 0) ? comp.categories : ["Aaditech Solution – IT & Infrastructure"],
      targetKeywordsText: (comp.targetKeywords || []).join(", "),
      negativeKeywordsText: (comp.negativeKeywords || []).join(", "),
      physicalLocationsText: (comp.physicalLocations || []).join(", "),
      allowRemote: comp.allowRemote !== false,
      telegramEnabled: comp.telegramEnabled !== false,
      telegramChatId: comp.telegramChatId || "-1003793331993",
      hostingerEnabled: comp.hostingerEnabled !== false,
      hostingerEmail: comp.hostingerEmail || "contact@aaditechs.in",
      gmailEnabled: comp.gmailEnabled !== false,
      gmailEmail: comp.gmailEmail || "sahil.k00267@gmail.com"
    });
    setIsModalOpen(true);
  };

  const handleToggleCategory = (cat: FreelanceCategory) => {
    setFormData((prev) => {
      const exists = prev.categories.includes(cat);
      if (exists) {
        if (prev.categories.length === 1) {
          showToast("At least one category must be selected.", "error");
          return prev;
        }
        return { ...prev, categories: prev.categories.filter((c) => c !== cat) };
      } else {
        return { ...prev, categories: [...prev.categories, cat] };
      }
    });
  };

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showToast("Company name is required.", "error");
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        name: formData.name.trim(),
        website: formData.website.trim(),
        description: formData.description.trim(),
        isPrimary: formData.isPrimary,
        categories: formData.categories,
        targetKeywords: formData.targetKeywordsText
          .split(/[,;\n]/)
          .map((k) => k.trim())
          .filter(Boolean),
        negativeKeywords: formData.negativeKeywordsText
          .split(/[,;\n]/)
          .map((k) => k.trim())
          .filter(Boolean),
        physicalLocations: formData.physicalLocationsText
          .split(/[,;\n]/)
          .map((l) => l.trim())
          .filter(Boolean),
        allowRemote: formData.allowRemote,
        telegramEnabled: formData.telegramEnabled,
        telegramChatId: formData.telegramChatId.trim(),
        hostingerEnabled: formData.hostingerEnabled,
        hostingerEmail: formData.hostingerEmail.trim(),
        gmailEnabled: formData.gmailEnabled,
        gmailEmail: formData.gmailEmail.trim()
      };

      let res: Response;
      if (editingCompany) {
        res = await fetch(`/api/companies/${editingCompany.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch("/api/companies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      }

      if (res.ok) {
        showToast(
          editingCompany
            ? `Company "${payload.name}" updated successfully!`
            : `New company profile "${payload.name}" created!`,
          "success"
        );
        setIsModalOpen(false);
        fetchCompanies();
      } else {
        const err = await res.json();
        showToast(err.error || "Failed to save company profile.", "error");
      }
    } catch (err: any) {
      showToast(err.message || "Failed to save.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCompany = async (comp: CompanyProfile) => {
    if (!window.confirm(`Are you sure you want to delete profile for "${comp.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/companies/${comp.id}`, { method: "DELETE" });
      if (res.ok) {
        showToast(`Company profile "${comp.name}" deleted.`, "info");
        fetchCompanies();
      } else {
        const err = await res.json();
        showToast(err.error || "Failed to delete company.", "error");
      }
    } catch (err: any) {
      showToast(err.message || "Network error.", "error");
    }
  };

  const handleToggleStatus = async (comp: CompanyProfile) => {
    const nextStatus = comp.status === "active" ? "paused" : "active";
    try {
      const res = await fetch(`/api/companies/${comp.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus })
      });
      if (res.ok) {
        showToast(`Company "${comp.name}" is now ${nextStatus.toUpperCase()}.`, "info");
        fetchCompanies();
      }
    } catch (err) {
      showToast("Failed to update status.", "error");
    }
  };

  // Quick inline toggle for delivery channels
  const handleQuickToggleChannel = async (comp: CompanyProfile, channel: "telegram" | "hostinger" | "gmail") => {
    try {
      const fieldMap = {
        telegram: "telegramEnabled",
        hostinger: "hostingerEnabled",
        gmail: "gmailEnabled"
      };
      const fieldName = fieldMap[channel];
      const currentVal = comp[fieldName as keyof CompanyProfile] !== false;
      const nextVal = !currentVal;

      const res = await fetch(`/api/companies/${comp.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [fieldName]: nextVal })
      });

      if (res.ok) {
        showToast(
          `${channel.toUpperCase()} Delivery ${nextVal ? "ENABLED" : "DISABLED"} for ${comp.name}!`,
          nextVal ? "success" : "info"
        );
        fetchCompanies();
      } else {
        showToast("Failed to update channel setting.", "error");
      }
    } catch (err) {
      showToast("Error toggling delivery channel.", "error");
    }
  };

  // Test delivery channels (telegram, hostinger, gmail, or all)
  const handleTestDelivery = async (comp: CompanyProfile, channel: "all" | "telegram" | "hostinger" | "gmail") => {
    try {
      setTestingDelivery({ id: comp.id, channel });
      setDeliveryFeedback(null);

      const res = await fetch(`/api/companies/${comp.id}/test-delivery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel })
      });

      const data = await res.json();
      if (res.ok) {
        if (channel === "all") {
          const summaries = Object.entries(data.results || {})
            .map(([ch, r]: [string, any]) => `${ch.toUpperCase()}: ${r.success ? "✅ Sent" : "⚠️ " + r.message}`)
            .join(" • ");
          showToast(`Delivery Test Complete: ${summaries}`, "success");
          setDeliveryFeedback({
            companyId: comp.id,
            message: summaries,
            type: "success"
          });
        } else {
          const chResult = data.results?.[channel];
          if (chResult?.success) {
            showToast(`${channel.toUpperCase()}: ${chResult.message}`, "success");
            setDeliveryFeedback({
              companyId: comp.id,
              message: chResult.message,
              type: "success"
            });
          } else {
            showToast(`${channel.toUpperCase()}: ${chResult?.message || "Delivery route not ready"}`, "error");
            setDeliveryFeedback({
              companyId: comp.id,
              message: chResult?.message || "Delivery dispatch failed.",
              type: "error"
            });
          }
        }
      } else {
        showToast(data.error || "Failed to trigger delivery test.", "error");
        setDeliveryFeedback({
          companyId: comp.id,
          message: data.error || "Delivery test failed.",
          type: "error"
        });
      }
    } catch (err: any) {
      showToast("Network dispatch failure during test.", "error");
    } finally {
      setTestingDelivery(null);
    }
  };

  const handleRunTargetedScout = async (comp: CompanyProfile) => {
    try {
      setScoutingCompany(comp);
      setIsScouting(true);
      const res = await fetch(`/api/companies/${comp.id}/scout`, {
        method: "POST"
      });
      if (res.ok) {
        const data = await res.json();
        setScoutedLeads(data.projects || []);
        showToast(`Scouted ${data.totalMatched} matching leads for ${comp.name}!`, "success");
        fetchCompanies();
      } else {
        showToast("Scout failed to query database.", "error");
      }
    } catch (err) {
      showToast("Scout execution error.", "error");
    } finally {
      setIsScouting(false);
    }
  };

  return (
    <div className="space-y-6" id="company-profiles-module">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-2xl border font-sans text-xs font-semibold animate-in slide-in-from-bottom-3 ${
            toast.type === "success"
              ? "bg-emerald-950/90 text-emerald-300 border-emerald-800"
              : toast.type === "error"
              ? "bg-rose-950/90 text-rose-300 border-rose-800"
              : "bg-blue-950/90 text-blue-300 border-blue-800"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : toast.type === "error" ? (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          ) : (
            <Sparkles className="w-4 h-4 text-blue-400 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 relative overflow-hidden backdrop-blur-md">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="space-y-1 max-w-3xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="p-2 bg-blue-950/80 border border-blue-800 rounded-lg text-blue-400">
                <Building2 className="w-5 h-5" />
              </span>
              <h2 className="text-xl font-bold text-white tracking-tight">Company Profiles & Multi-Channel Lead Routing</h2>
              <span className="bg-blue-950/60 border border-blue-800 text-blue-300 text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold">
                7 VERTICALS • 3 DELIVERY CHANNELS
              </span>
            </div>
            <p className="text-slate-400 text-xs leading-relaxed pt-1">
              Configure targeted freelance scout filters for <strong>Aaditech Solution</strong> and client companies. Every incoming freelance contract is evaluated across all 7 supported service categories with automated delivery toggles for <strong>Telegram Delivery</strong>, <strong>Hostinger Delivery</strong>, and <strong>Gmail Delivery</strong>.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={fetchCompanies}
              disabled={isRefreshing}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs font-semibold px-3.5 py-2.5 rounded-xl flex items-center gap-2 cursor-pointer transition-colors"
              id="btn-refresh-companies"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-blue-400" : ""}`} />
              Sync Profiles
            </button>
            <button
              onClick={openCreateModal}
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4.5 py-2.5 rounded-xl flex items-center gap-2 shadow-lg shadow-blue-500/20 cursor-pointer transition-all"
              id="btn-add-company"
            >
              <Plus className="w-4 h-4" />
              Add Company Profile
            </button>
          </div>
        </div>

        {/* Quick Metrics Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-800/80">
          <div className="bg-slate-950/60 border border-slate-850 rounded-xl p-3">
            <div className="text-[11px] font-mono text-slate-400">Total Registered</div>
            <div className="text-xl font-bold text-white mt-0.5">{companies.length} Companies</div>
          </div>
          <div className="bg-slate-950/60 border border-slate-850 rounded-xl p-3">
            <div className="text-[11px] font-mono text-slate-400">Primary Entity</div>
            <div className="text-xl font-bold text-emerald-400 mt-0.5 truncate">
              {companies.find((c) => c.isPrimary)?.name || "Aaditech Solution"}
            </div>
          </div>
          <div className="bg-slate-950/60 border border-slate-850 rounded-xl p-3">
            <div className="text-[11px] font-mono text-slate-400">Supported Verticals</div>
            <div className="text-xl font-bold text-blue-400 mt-0.5">7 Categories</div>
          </div>
          <div className="bg-slate-950/60 border border-slate-850 rounded-xl p-3">
            <div className="text-[11px] font-mono text-slate-400">Delivery Channels</div>
            <div className="text-xl font-bold text-amber-400 mt-0.5 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Telegram • Hostinger • Gmail
            </div>
          </div>
        </div>
      </div>

      {/* 7 Supported Categories Visual Guide */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-5 space-y-3" id="categories-catalog-guide">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-400" />
            <h3 className="text-xs font-bold font-mono uppercase text-slate-300 tracking-wider">
              Scout Supported Verticals (All 7 Categories)
            </h3>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            Click any company profile below to adjust routing filters
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 pt-1">
          {ALL_CATEGORIES.map((cat) => {
            const meta = CATEGORY_METADATA[cat];
            const isItCategory = cat.includes("IT & Infrastructure");
            return (
              <div
                key={cat}
                className={`border rounded-xl p-3 space-y-1.5 transition-colors ${
                  isItCategory
                    ? "bg-blue-950/40 border-blue-800/80 hover:border-blue-600"
                    : "bg-slate-950/40 border-slate-800 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">{meta.icon}</span>
                    <h4 className="text-xs font-bold text-white font-sans">{cat}</h4>
                  </div>
                  {isItCategory && (
                    <span className="text-[9px] font-mono bg-blue-500/20 text-blue-300 border border-blue-500/30 px-1.5 py-0.5 rounded font-bold">
                      NEW
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed font-sans">
                  {meta.description}
                </p>
                <div className="flex flex-wrap gap-1 pt-1">
                  {meta.samplePlatforms.slice(0, 3).map((p) => (
                    <span
                      key={p}
                      className="text-[9px] font-mono bg-slate-900 text-slate-400 border border-slate-800 px-1.5 py-0.5 rounded"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Company Cards Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-bold text-white font-sans">
              Configured Company Profiles ({companies.length})
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            Direct real-time lead routing with independent delivery switches
          </span>
        </div>

        {/* Global Feedback Banner for test results */}
        {deliveryFeedback && (
          <div
            className={`p-3.5 rounded-xl border text-xs font-mono flex items-start justify-between gap-3 animate-in fade-in ${
              deliveryFeedback.type === "success"
                ? "bg-emerald-950/50 border-emerald-800 text-emerald-300"
                : "bg-rose-950/50 border-rose-800 text-rose-300"
            }`}
          >
            <div className="flex items-start gap-2">
              <span className="mt-0.5">
                {deliveryFeedback.type === "success" ? "✅" : "⚠️"}
              </span>
              <div>
                <strong>Delivery Route Pipeline Feedback:</strong> {deliveryFeedback.message}
              </div>
            </div>
            <button
              onClick={() => setDeliveryFeedback(null)}
              className="text-slate-400 hover:text-white p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {loading ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 font-mono text-xs flex flex-col items-center gap-3">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            Loading company profiles & routing pipelines...
          </div>
        ) : companies.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-3">
            <Building2 className="w-10 h-10 text-slate-600 mx-auto" />
            <h4 className="text-base font-bold text-white font-sans">No Company Profiles Registered</h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
              Create your first profile for Aaditech Solution to activate targeted freelance scout alerts across all 7 categories and 3 delivery channels.
            </p>
            <button
              onClick={openCreateModal}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl cursor-pointer shadow-lg shadow-blue-500/20 inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create Primary Profile
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {companies.map((comp) => (
              <div
                key={comp.id}
                className={`bg-slate-900 border rounded-2xl p-5 space-y-4 transition-all relative ${
                  comp.isPrimary
                    ? "border-blue-500/60 shadow-lg shadow-blue-950/40 bg-gradient-to-b from-blue-950/20 to-slate-900"
                    : "border-slate-800 hover:border-slate-700"
                }`}
                id={`company-card-${comp.id}`}
              >
                {/* Top status line */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {comp.isPrimary ? (
                      <span className="bg-blue-500/20 text-blue-300 border border-blue-500/30 text-[10px] font-mono px-2 py-0.5 rounded-md font-bold uppercase tracking-wider flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-blue-400" />
                        Primary Company
                      </span>
                    ) : (
                      <span className="bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-mono px-2 py-0.5 rounded-md font-semibold uppercase tracking-wider">
                        Client Partner
                      </span>
                    )}

                    <button
                      onClick={() => handleToggleStatus(comp)}
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
                        comp.status === "active"
                          ? "bg-emerald-950/60 text-emerald-300 border border-emerald-800 hover:bg-emerald-900/60"
                          : "bg-amber-950/60 text-amber-300 border border-amber-800 hover:bg-amber-900/60"
                      }`}
                      title="Click to toggle status"
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${comp.status === "active" ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
                      {comp.status.toUpperCase()}
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEditModal(comp)}
                      className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                      title="Edit Profile"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    {!comp.isPrimary && (
                      <button
                        onClick={() => handleDeleteCompany(comp)}
                        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                        title="Delete Profile"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Company Title & Link */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-lg font-bold text-white tracking-tight font-sans">{comp.name}</h4>
                    {comp.website && (
                      <a
                        href={comp.website}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-400 hover:text-blue-300 text-xs flex items-center gap-1 font-mono transition-colors"
                      >
                        <Globe className="w-3.5 h-3.5" />
                        <span className="underline underline-offset-2">{comp.website.replace(/^https?:\/\//, "")}</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </div>
                  {comp.description && (
                    <p className="text-xs text-slate-400 leading-relaxed font-sans">{comp.description}</p>
                  )}
                </div>

                {/* Categories */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
                    Targeted Verticals ({comp.categories?.length || 0}/7):
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {comp.categories.map((cat) => (
                      <span
                        key={cat}
                        className={`text-[11px] font-medium px-2 py-0.5 rounded-lg flex items-center gap-1.5 ${
                          cat.includes("IT & Infrastructure")
                            ? "bg-blue-950/80 border border-blue-700 text-blue-200"
                            : "bg-slate-950 border border-slate-800 text-slate-300"
                        }`}
                      >
                        <span>{CATEGORY_METADATA[cat]?.icon || "💼"}</span>
                        {cat}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Keywords & Exclusions */}
                <div className="space-y-2 pt-1">
                  <div>
                    <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block mb-1">
                      Target Keywords ({comp.targetKeywords.length}):
                    </span>
                    <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto">
                      {comp.targetKeywords.map((kw) => (
                        <span key={kw} className="text-[10px] font-mono bg-blue-950/40 border border-blue-900 text-blue-300 px-1.5 py-0.5 rounded">
                          +{kw}
                        </span>
                      ))}
                    </div>
                  </div>

                  {comp.negativeKeywords.length > 0 && (
                    <div>
                      <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block mb-1">
                        Negative Exclusions ({comp.negativeKeywords.length}):
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {comp.negativeKeywords.map((neg) => (
                          <span key={neg} className="text-[10px] font-mono bg-rose-950/30 border border-rose-900 text-rose-300 px-1.5 py-0.5 rounded">
                            -{neg}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* DELIVERY CHANNELS TOGGLES & STATUS (Telegram, Hostinger, Gmail) */}
                <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1.5 font-bold">
                      <Radio className="w-3.5 h-3.5 text-blue-400" />
                      Delivery Channels (Click to Toggle)
                    </span>
                    <button
                      onClick={() => handleTestDelivery(comp, "all")}
                      disabled={testingDelivery?.id === comp.id}
                      className="text-[10px] font-mono text-blue-400 hover:text-blue-300 font-semibold cursor-pointer underline underline-offset-2 flex items-center gap-1"
                    >
                      {testingDelivery?.id === comp.id && testingDelivery?.channel === "all" ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : null}
                      Test All 3
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {/* 1. Telegram Channel Card */}
                    <div
                      className={`p-2.5 rounded-lg border flex flex-col justify-between gap-1.5 transition-colors ${
                        comp.telegramEnabled !== false
                          ? "bg-blue-950/30 border-blue-800/80"
                          : "bg-slate-900/50 border-slate-800/60 opacity-60"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white flex items-center gap-1">
                          ✈️ Telegram
                        </span>
                        <button
                          onClick={() => handleQuickToggleChannel(comp, "telegram")}
                          className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold cursor-pointer transition-colors ${
                            comp.telegramEnabled !== false
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                              : "bg-slate-800 text-slate-400 border border-slate-700"
                          }`}
                          title="Click to enable or disable Telegram delivery"
                        >
                          {comp.telegramEnabled !== false ? "ENABLED" : "DISABLED"}
                        </button>
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 truncate" title={comp.telegramChatId || "-1003793331993"}>
                        ID: {comp.telegramChatId || "-1003793331993"}
                      </div>
                      <button
                        onClick={() => handleTestDelivery(comp, "telegram")}
                        disabled={testingDelivery?.id === comp.id && testingDelivery?.channel === "telegram"}
                        className="text-[10px] font-mono bg-slate-800 hover:bg-slate-700 text-slate-300 py-1 px-2 rounded flex items-center justify-center gap-1 cursor-pointer transition-colors mt-0.5"
                      >
                        <Send className="w-2.5 h-2.5 text-blue-400" />
                        {testingDelivery?.id === comp.id && testingDelivery?.channel === "telegram" ? "Sending..." : "Test Telegram"}
                      </button>
                    </div>

                    {/* 2. Hostinger Delivery Card */}
                    <div
                      className={`p-2.5 rounded-lg border flex flex-col justify-between gap-1.5 transition-colors ${
                        comp.hostingerEnabled !== false
                          ? "bg-purple-950/30 border-purple-800/80"
                          : "bg-slate-900/50 border-slate-800/60 opacity-60"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white flex items-center gap-1">
                          🌐 Hostinger
                        </span>
                        <button
                          onClick={() => handleQuickToggleChannel(comp, "hostinger")}
                          className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold cursor-pointer transition-colors ${
                            comp.hostingerEnabled !== false
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                              : "bg-slate-800 text-slate-400 border border-slate-700"
                          }`}
                          title="Click to enable or disable Hostinger delivery"
                        >
                          {comp.hostingerEnabled !== false ? "ENABLED" : "DISABLED"}
                        </button>
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 truncate" title={comp.hostingerEmail || "contact@aaditechs.in"}>
                        {comp.hostingerEmail || "contact@aaditechs.in"}
                      </div>
                      <button
                        onClick={() => handleTestDelivery(comp, "hostinger")}
                        disabled={testingDelivery?.id === comp.id && testingDelivery?.channel === "hostinger"}
                        className="text-[10px] font-mono bg-slate-800 hover:bg-slate-700 text-slate-300 py-1 px-2 rounded flex items-center justify-center gap-1 cursor-pointer transition-colors mt-0.5"
                      >
                        <Server className="w-2.5 h-2.5 text-purple-400" />
                        {testingDelivery?.id === comp.id && testingDelivery?.channel === "hostinger" ? "Testing..." : "Test Hostinger"}
                      </button>
                    </div>

                    {/* 3. Gmail Delivery Card */}
                    <div
                      className={`p-2.5 rounded-lg border flex flex-col justify-between gap-1.5 transition-colors ${
                        comp.gmailEnabled !== false
                          ? "bg-rose-950/30 border-rose-800/80"
                          : "bg-slate-900/50 border-slate-800/60 opacity-60"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white flex items-center gap-1">
                          ✉️ Gmail
                        </span>
                        <button
                          onClick={() => handleQuickToggleChannel(comp, "gmail")}
                          className={`text-[9px] font-mono px-1.5 py-0.5 rounded font-bold cursor-pointer transition-colors ${
                            comp.gmailEnabled !== false
                              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                              : "bg-slate-800 text-slate-400 border border-slate-700"
                          }`}
                          title="Click to enable or disable Gmail delivery"
                        >
                          {comp.gmailEnabled !== false ? "ENABLED" : "DISABLED"}
                        </button>
                      </div>
                      <div className="text-[10px] font-mono text-slate-400 truncate" title={comp.gmailEmail || "sahil.k00267@gmail.com"}>
                        {comp.gmailEmail || "sahil.k00267@gmail.com"}
                      </div>
                      <button
                        onClick={() => handleTestDelivery(comp, "gmail")}
                        disabled={testingDelivery?.id === comp.id && testingDelivery?.channel === "gmail"}
                        className="text-[10px] font-mono bg-slate-800 hover:bg-slate-700 text-slate-300 py-1 px-2 rounded flex items-center justify-center gap-1 cursor-pointer transition-colors mt-0.5"
                      >
                        <Mail className="w-2.5 h-2.5 text-rose-400" />
                        {testingDelivery?.id === comp.id && testingDelivery?.channel === "gmail" ? "Testing..." : "Test Gmail"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Location & Routing Rule */}
                <div className="bg-slate-950/60 border border-slate-850 rounded-xl p-3 space-y-2 text-xs font-mono">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-amber-400" />
                      Physical Region:
                    </span>
                    <span className="text-slate-200 font-semibold truncate max-w-[200px]">
                      {comp.physicalLocations.join(", ")}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Laptop className="w-3.5 h-3.5 text-cyan-400" />
                      Remote Policy:
                    </span>
                    <span className={comp.allowRemote ? "text-emerald-400 font-semibold" : "text-slate-500"}>
                      {comp.allowRemote ? "Allowed (Pan-India & Global)" : "Restricted to On-Site"}
                    </span>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-850 flex-wrap gap-2">
                  <button
                    onClick={() => openEditModal(comp)}
                    className="text-xs font-mono bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Sliders className="w-3.5 h-3.5 text-blue-400" />
                    Configure Routing & Channels
                  </button>

                  <button
                    onClick={() => handleRunTargetedScout(comp)}
                    className="text-xs font-semibold bg-blue-600/90 hover:bg-blue-600 text-white px-3.5 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm shadow-blue-500/10 cursor-pointer transition-all"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Scout Leads for {comp.name.split(" ")[0]}
                    <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL: ADD / EDIT COMPANY PROFILE */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full p-6 space-y-5 my-8 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-blue-950 border border-blue-800 rounded-lg text-blue-400">
                  <Building2 className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-white font-sans">
                    {editingCompany ? `Edit "${editingCompany.name}"` : "Create New Company Profile"}
                  </h3>
                  <p className="text-xs text-slate-400 font-sans">
                    Configure 7 freelance categories and delivery toggles for Telegram, Hostinger, and Gmail.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCompany} className="space-y-4.5">
              {/* Name & Website */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 font-sans">Company / Agency Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Aaditech Solution"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-sans"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 font-sans">Website URL</label>
                  <input
                    type="text"
                    placeholder="https://aaditechs.in/"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 font-sans">Core Agency Focus / Bio</label>
                <textarea
                  rows={2}
                  placeholder="IT & Infrastructure, Enterprise Systems, M365, Cloud Migration, Full-Stack & AI Automation"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-sans"
                />
              </div>

              {/* 7 Verticals Selection Grid */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300 font-sans flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5 text-blue-400" />
                    Target Freelance Verticals (Select applicable categories) *
                  </label>
                  <span className="text-[10px] font-mono text-slate-400">
                    {formData.categories.length} of 7 Selected
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {ALL_CATEGORIES.map((cat) => {
                    const isSelected = formData.categories.includes(cat);
                    const meta = CATEGORY_METADATA[cat];
                    const isItCat = cat.includes("IT & Infrastructure");
                    return (
                      <div
                        key={cat}
                        onClick={() => handleToggleCategory(cat)}
                        className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start gap-2.5 ${
                          isSelected
                            ? isItCat
                              ? "bg-blue-950/60 border-blue-500 text-white shadow-sm shadow-blue-500/20"
                              : "bg-blue-950/40 border-blue-600 text-white shadow-sm shadow-blue-500/10"
                            : "bg-slate-950/50 border-slate-800/80 text-slate-400 hover:border-slate-700"
                        }`}
                      >
                        <div className="mt-0.5">
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-blue-400 shrink-0" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-600 shrink-0" />
                          )}
                        </div>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm">{meta.icon}</span>
                            <span className="text-xs font-bold font-sans">{cat}</span>
                          </div>
                          <p className="text-[10px] text-slate-400 line-clamp-2 leading-relaxed font-sans">
                            {meta.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Target & Negative Keywords */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 font-sans flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-emerald-400" />
                    Target Keywords (comma-separated)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Microsoft 365, Active Directory, Windows Server, Networking, React, Node.js, Python"
                    value={formData.targetKeywordsText}
                    onChange={(e) => setFormData({ ...formData, targetKeywordsText: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 font-sans flex items-center gap-1.5">
                    <X className="w-3.5 h-3.5 text-rose-400" />
                    Negative Exclusion Keywords (comma-separated)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Data Entry, Cold Calling, Typing, Survey, Copy Paste"
                    value={formData.negativeKeywordsText}
                    onChange={(e) => setFormData({ ...formData, negativeKeywordsText: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
              </div>

              {/* DELIVERY CHANNELS TOGGLES & SETTINGS SECTION */}
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-850 pb-2">
                  <span className="text-xs font-bold text-white font-sans flex items-center gap-2">
                    <Radio className="w-4 h-4 text-blue-400" />
                    Delivery Channel Enable / Disable Settings
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    Real-Time Lead Alerts Configuration
                  </span>
                </div>

                {/* 1. Telegram Delivery */}
                <div className="space-y-2 p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base">✈️</span>
                      <div>
                        <div className="text-xs font-bold text-white font-sans">Telegram Delivery</div>
                        <div className="text-[10px] text-slate-400 font-sans">
                          Send matching freelance leads directly to your Telegram Bot / Group
                        </div>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.telegramEnabled}
                        onChange={(e) => setFormData({ ...formData, telegramEnabled: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                      <span className="ml-2 text-xs font-mono font-bold text-slate-300">
                        {formData.telegramEnabled ? "ENABLED" : "DISABLED"}
                      </span>
                    </label>
                  </div>

                  {formData.telegramEnabled && (
                    <div className="pt-2 border-t border-slate-850 space-y-1">
                      <label className="text-[11px] font-semibold text-slate-300 font-sans">
                        Telegram Chat / Group ID:
                      </label>
                      <input
                        type="text"
                        placeholder="-1003793331993"
                        value={formData.telegramChatId}
                        onChange={(e) => setFormData({ ...formData, telegramChatId: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                      />
                      <p className="text-[10px] text-slate-500">
                        Default group ID: -1003793331993. Or specify a private chat ID.
                      </p>
                    </div>
                  )}
                </div>

                {/* 2. Hostinger Delivery */}
                <div className="space-y-2 p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base">🌐</span>
                      <div>
                        <div className="text-xs font-bold text-white font-sans">Hostinger Delivery (SMTP)</div>
                        <div className="text-[10px] text-slate-400 font-sans">
                          Send leads to your official domain mailbox via Hostinger SMTP (mail.hostinger.com)
                        </div>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.hostingerEnabled}
                        onChange={(e) => setFormData({ ...formData, hostingerEnabled: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                      <span className="ml-2 text-xs font-mono font-bold text-slate-300">
                        {formData.hostingerEnabled ? "ENABLED" : "DISABLED"}
                      </span>
                    </label>
                  </div>

                  {formData.hostingerEnabled && (
                    <div className="pt-2 border-t border-slate-850 space-y-1">
                      <label className="text-[11px] font-semibold text-slate-300 font-sans">
                        Hostinger Recipient Email:
                      </label>
                      <input
                        type="email"
                        placeholder="contact@aaditechs.in"
                        value={formData.hostingerEmail}
                        onChange={(e) => setFormData({ ...formData, hostingerEmail: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                      />
                      <p className="text-[10px] text-slate-500">
                        Configured to route to contact@aaditechs.in via Hostinger Mail Server.
                      </p>
                    </div>
                  )}
                </div>

                {/* 3. Gmail Delivery */}
                <div className="space-y-2 p-3 rounded-lg bg-slate-900/60 border border-slate-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base">✉️</span>
                      <div>
                        <div className="text-xs font-bold text-white font-sans">Gmail Delivery</div>
                        <div className="text-[10px] text-slate-400 font-sans">
                          Send real-time contract notifications directly to your personal Gmail inbox
                        </div>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.gmailEnabled}
                        onChange={(e) => setFormData({ ...formData, gmailEnabled: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-rose-600"></div>
                      <span className="ml-2 text-xs font-mono font-bold text-slate-300">
                        {formData.gmailEnabled ? "ENABLED" : "DISABLED"}
                      </span>
                    </label>
                  </div>

                  {formData.gmailEnabled && (
                    <div className="pt-2 border-t border-slate-850 space-y-1">
                      <label className="text-[11px] font-semibold text-slate-300 font-sans">
                        Gmail Recipient Address:
                      </label>
                      <input
                        type="email"
                        placeholder="sahil.k00267@gmail.com"
                        value={formData.gmailEmail}
                        onChange={(e) => setFormData({ ...formData, gmailEmail: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                      />
                      <p className="text-[10px] text-slate-500">
                        Contract alerts will be forwarded directly to your personal Gmail inbox.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Location Rules */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3.5 space-y-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 font-sans flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-amber-400" />
                    Physical / On-Site Target Cities (comma-separated)
                  </label>
                  <input
                    type="text"
                    placeholder="Mumbai, Navi Mumbai, Thane"
                    value={formData.physicalLocationsText}
                    onChange={(e) => setFormData({ ...formData, physicalLocationsText: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                  />
                  <p className="text-[10px] text-slate-500">
                    If a job is physical / in-person, it will only match if located in these specified regions.
                  </p>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div>
                    <div className="text-xs font-semibold text-slate-200">Allow Remote Opportunities</div>
                    <div className="text-[10px] text-slate-400">Accept global & Pan-India remote projects</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.allowRemote}
                    onChange={(e) => setFormData({ ...formData, allowRemote: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600 bg-slate-900 border-slate-700 cursor-pointer"
                  />
                </div>
              </div>

              {/* Primary Toggle */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="chk-primary-company"
                  checked={formData.isPrimary}
                  onChange={(e) => setFormData({ ...formData, isPrimary: e.target.checked })}
                  className="w-4 h-4 rounded text-blue-600 bg-slate-950 border-slate-700 cursor-pointer"
                />
                <label htmlFor="chk-primary-company" className="text-xs text-slate-300 font-sans cursor-pointer">
                  Set as <strong>Primary Master Company</strong> (e.g. Aaditech Solution)
                </label>
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-blue-500/20 cursor-pointer transition-all flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : editingCompany ? (
                    "Update Profile"
                  ) : (
                    "Create Company Profile"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DRAWER / MODAL: TARGETED SCOUT LEADS VIEWER */}
      {scoutingCompany && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full p-6 space-y-5 my-8 shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 shrink-0">
              <div className="flex items-center gap-2.5">
                <span className="p-2 bg-blue-950 border border-blue-800 rounded-lg text-blue-400">
                  <Sparkles className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-white font-sans">
                    Scouted Leads for {scoutingCompany.name}
                  </h3>
                  <p className="text-xs text-slate-400 font-sans">
                    Matched against {scoutingCompany.categories.join(", ")} & target keywords.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setScoutingCompany(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {isScouting ? (
                <div className="p-12 text-center text-slate-400 font-mono text-xs flex flex-col items-center gap-3">
                  <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  Scouting matching contracts across 40 platforms...
                </div>
              ) : scoutedLeads.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <AlertCircle className="w-6 h-6 text-amber-400 mx-auto" />
                  <div className="text-sm font-semibold text-slate-200">No leads matched current criteria</div>
                  <p className="text-xs text-slate-400">
                    Try adding broader keywords or selecting additional service verticals in this profile.
                  </p>
                </div>
              ) : (
                scoutedLeads.map((job, idx) => (
                  <div
                    key={job.id || idx}
                    className="bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl p-4 space-y-2.5 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-[10px] font-mono text-blue-400 font-bold uppercase bg-blue-950/60 border border-blue-900 px-1.5 py-0.5 rounded">
                          {job.source || "Freelance Platform"}
                        </span>
                        <h5 className="text-sm font-bold text-white mt-1 font-sans">{job.title}</h5>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-bold font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-900 px-2 py-0.5 rounded-full">
                          {job.companyMatchScore || job.score || 95}% Match
                        </span>
                        <div className="text-xs font-semibold text-slate-300 font-mono mt-1">{job.budget}</div>
                      </div>
                    </div>

                    <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed font-sans">{job.description}</p>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-900 flex-wrap gap-2 text-xs">
                      <div className="flex flex-wrap gap-1">
                        {(job.skills || []).slice(0, 4).map((s: string) => (
                          <span key={s} className="text-[10px] font-mono bg-slate-900 border border-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
                            {s}
                          </span>
                        ))}
                      </div>

                      {job.projectUrl && (
                        <a
                          href={job.projectUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-400 hover:text-blue-300 text-xs font-semibold flex items-center gap-1 font-sans transition-colors"
                        >
                          Direct Contract Link
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-slate-800 pt-3 flex justify-end shrink-0">
              <button
                onClick={() => setScoutingCompany(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
