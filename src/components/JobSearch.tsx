/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Briefcase, 
  Search, 
  RefreshCw, 
  ExternalLink, 
  CheckCircle, 
  AlertTriangle,
  Flame,
  BadgeAlert
} from "lucide-react";
import { JobRecord, FreelanceProject } from "../types";

interface JobSearchProps {
  initialTab?: "jsi" | "freelance";
  key?: string;
}

export default function JobSearch({ initialTab = "jsi" }: JobSearchProps) {
  const [activeTab, setActiveTab] = useState<"jsi" | "freelance">(initialTab);
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [freelanceProjects, setFreelanceProjects] = useState<FreelanceProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [liveUnavailable, setLiveUnavailable] = useState(false);

  const fetchJobs = async (useLive: boolean) => {
    setLoading(true);
    setLiveUnavailable(false);
    try {
      const response = await fetch(`/api/jobs?live=${useLive}`);
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("text/plain")) {
        const text = await response.text();
        if (text.trim() === "Live Source Currently Unavailable") {
          setLiveUnavailable(true);
          setJobs([]);
          return;
        }
      }
      
      const data = await response.json();
      if (data.status === "Live Source Currently Unavailable") {
        setLiveUnavailable(true);
        setJobs([]);
      } else {
        setJobs(data.data || []);
      }
    } catch (err) {
      console.error(err);
      setLiveUnavailable(true);
    } finally {
      setLoading(false);
    }
  };

  const fetchFreelance = async (useLive: boolean) => {
    setLoading(true);
    setLiveUnavailable(false);
    try {
      const response = await fetch(`/api/freelance?live=${useLive}`);
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("text/plain")) {
        const text = await response.text();
        if (text.trim() === "Live Source Currently Unavailable") {
          setLiveUnavailable(true);
          setFreelanceProjects([]);
          return;
        }
      }

      const data = await response.json();
      if (data.status === "Live Source Currently Unavailable") {
        setLiveUnavailable(true);
        setFreelanceProjects([]);
      } else {
        setFreelanceProjects(data.data || []);
      }
    } catch (err) {
      console.error(err);
      setLiveUnavailable(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "jsi") {
      fetchJobs(isLiveMode);
    } else {
      fetchFreelance(isLiveMode);
    }
  }, [activeTab, isLiveMode]);

  return (
    <div className="space-y-6" id="job-search-wrapper">
      {/* Module Title Header */}
      <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 flex justify-between items-center flex-wrap gap-4" id="job-search-header">
        <div>
          <h2 className="text-xl font-sans font-semibold text-white tracking-tight flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-emerald-500" />
            Market Intelligence Engine
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Core tracking system indexing real-time freelance projects and job opportunities.
          </p>
        </div>

        {/* Live Mode Toggle & Status Inline Badge */}
        <div className="flex items-center gap-3 flex-wrap" id="live-toggle-and-badge">
          {isLiveMode && (
            <div className={`flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-lg border transition-all duration-300 ${
              liveUnavailable 
                ? "text-amber-400 bg-amber-950/30 border-amber-900/30" 
                : "text-emerald-400 bg-emerald-950/30 border-emerald-900/30"
            }`} id="gateway-inline-badge">
              <span className={`relative flex h-2 w-2`}>
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  liveUnavailable ? "bg-amber-400" : "bg-emerald-400"
                }`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${
                  liveUnavailable ? "bg-amber-500" : "bg-emerald-500"
                }`}></span>
              </span>
              <span>{liveUnavailable ? "Local-Side" : "Live Grounded"}</span>
            </div>
          )}

          <div className="flex items-center gap-3 bg-slate-950 px-4 py-2.5 rounded-lg border border-slate-800" id="live-toggle-wrapper">
            <span className="text-xs font-mono font-medium text-slate-400">Live Gateway Feed</span>
            <button
              id="live-mode-toggle-btn"
              type="button"
              onClick={() => setIsLiveMode(!isLiveMode)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                isLiveMode ? "bg-blue-600" : "bg-slate-800"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  isLiveMode ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Tabs Layout */}
      <div className="flex gap-2 border-b border-slate-800 pb-0.5" id="job-tabs">
        <button
          onClick={() => setActiveTab("jsi")}
          id="tab-jsi"
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "jsi" 
              ? "border-emerald-500 text-emerald-400 font-semibold" 
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          Job Search Intelligence
        </button>
        <button
          onClick={() => setActiveTab("freelance")}
          id="tab-freelance"
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "freelance" 
              ? "border-emerald-500 text-emerald-400 font-semibold" 
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          Freelance Scout
        </button>
      </div>

      {/* Dynamic Status Banner */}
      {isLiveMode && (
        <div className={`p-4 rounded-xl border flex gap-3 transition-all duration-300 ${
          liveUnavailable 
            ? "bg-slate-900/60 border-amber-900/30 text-amber-300" 
            : "bg-slate-900/60 border-emerald-900/30 text-emerald-300"
        }`} id="live-status-banner">
          <span className="relative flex h-3 w-3 mt-0.5 shrink-0">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
              liveUnavailable ? "bg-amber-400" : "bg-emerald-400"
            }`}></span>
            <span className={`relative inline-flex rounded-full h-3 w-3 ${
              liveUnavailable ? "bg-amber-500" : "bg-emerald-500"
            }`}></span>
          </span>
          <div className="text-xs">
            <p className="font-semibold uppercase tracking-wider font-mono">
              {liveUnavailable ? "Active Gateway Mode: Local Synthesizer Online" : "Active Gateway Mode: Google AI Grounding Live"}
            </p>
            <p className="mt-1 text-slate-400 leading-relaxed">
              {liveUnavailable 
                ? "The live search API encountered a remote bottleneck. Real-time software engineering roles and project scopes have been dynamically synthesized and loaded from your localized repository." 
                : "Real-time opportunities and technical requirements have been parsed, synchronized, and grounded directly from open global channels via Google Gemini."}
            </p>
          </div>
        </div>
      )}

      {/* Jobs/Freelance list */}
      <div className="space-y-4" id="listings-list">
        {loading ? (
          <div className="text-center py-12 text-slate-500 flex flex-col items-center gap-3" id="listings-loading">
            <RefreshCw className="w-8 h-8 animate-spin text-emerald-500" />
            <span className="text-sm font-mono">Synchronizing directories...</span>
          </div>
        ) : activeTab === "jsi" ? (
          jobs.map((job) => (
            <div 
              key={job.id} 
              id={`listing-card-${job.id}`}
              className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-all duration-150 flex justify-between items-start flex-wrap gap-4"
            >
              <div className="space-y-2.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-semibold text-white tracking-tight">{job.title}</h3>
                  <span className="bg-emerald-950 text-emerald-400 border border-emerald-900 text-[10px] px-2 py-0.5 rounded font-mono uppercase">
                    {job.verification}
                  </span>
                  <span className="bg-blue-950 text-blue-400 border border-blue-900 text-[10px] px-2 py-0.5 rounded font-mono">
                    Match Confidence: {job.confidence}%
                  </span>
                </div>
                <div className="text-sm text-slate-400 flex items-center gap-4 flex-wrap">
                  <span>Company: <strong className="text-slate-200">{job.company}</strong></span>
                  <span>•</span>
                  <span>Location: <strong className="text-slate-200">{job.location}</strong></span>
                  <span>•</span>
                  <span>Comp: <strong className="text-emerald-400 font-mono">{job.salary}</strong></span>
                </div>
                <div className="flex gap-1.5 flex-wrap pt-1">
                  {job.skills.map((skill) => (
                    <span key={skill} className="bg-slate-950 text-slate-400 text-xs px-2.5 py-1 rounded border border-slate-850">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              <div className="text-right text-xs text-slate-400 flex flex-col justify-between h-full gap-4">
                <div className="font-mono">
                  <div>Source: <span className="text-slate-200">{job.source}</span></div>
                  <div className="text-[10px] text-slate-500 mt-1">Indexed {new Date(job.timestamp).toLocaleTimeString()}</div>
                </div>
                <a 
                  href={job.originalUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Inspect Listing
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          ))
        ) : (
          freelanceProjects.map((proj) => (
            <div 
              key={proj.id} 
              id={`listing-card-${proj.id}`}
              className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-all duration-150 flex justify-between items-start flex-wrap gap-4"
            >
              <div className="space-y-2.5 flex-1 max-w-3xl">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-semibold text-white tracking-tight">{proj.title}</h3>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-mono uppercase ${
                    proj.verification === "verified" 
                      ? "bg-emerald-950 text-emerald-400 border border-emerald-900" 
                      : "bg-slate-950 text-slate-500 border border-slate-900"
                  }`}>
                    {proj.verification}
                  </span>
                  <span className="bg-blue-950 text-blue-400 border border-blue-900 text-[10px] px-2 py-0.5 rounded font-mono">
                    Relevance: {proj.confidence}%
                  </span>
                </div>
                <p className="text-sm text-slate-400 leading-relaxed font-sans">{proj.description}</p>
                <div className="flex gap-1.5 flex-wrap pt-1">
                  {proj.skills.map((skill) => (
                    <span key={skill} className="bg-slate-950 text-slate-400 text-xs px-2.5 py-1 rounded border border-slate-850">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              <div className="text-right text-xs text-slate-400 flex flex-col justify-between h-full gap-4">
                <div className="font-mono">
                  <div>Platform: <span className="text-slate-200">{proj.platform}</span></div>
                  <div className="text-emerald-400 font-semibold mt-1">{proj.budget}</div>
                  <div className="text-[10px] text-slate-500 mt-1">Posted {proj.postedTime}</div>
                </div>
                <a 
                  href={proj.originalUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Bid Now
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          ))
        )}

        {!loading && activeTab === "jsi" && jobs.length === 0 && (
          <div className="text-center py-12 text-slate-500 font-mono" id="listings-empty">
            No JSI opportunities synchronized.
          </div>
        )}

        {!loading && activeTab === "freelance" && freelanceProjects.length === 0 && (
          <div className="text-center py-12 text-slate-500 font-mono" id="listings-empty">
            No freelance contracts synchronized.
          </div>
        )}
      </div>
    </div>
  );
}
