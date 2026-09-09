/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { 
  FileText, 
  Sparkles, 
  AlertCircle, 
  CheckCircle, 
  RefreshCw, 
  Layers, 
  TrendingUp, 
  ArrowRight,
  BookOpen,
  Calendar
} from "lucide-react";
import SchedulingDashboard from "./SchedulingDashboard";

interface AtsReport {
  matchScore: number;
  extractedKeywords: string[];
  scoringBreakdown: {
    skillsScore: number;
    experienceScore: number;
    formattingScore: number;
  };
  refinementDirectives: string[];
  optimizedSummary: string;
}

export default function Ats() {
  const [hubMode, setHubMode] = useState<"ats" | "scheduling">("ats");
  const [resumeText, setResumeText] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [report, setReport] = useState<AtsReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOptimize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resumeText.trim() || !jobDescription.trim()) return;

    setLoading(true);
    setError(null);
    setReport(null);

    try {
      const res = await fetch("/api/ats/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeText, jobDescription })
      });
      const data = await res.json();

      if (res.ok) {
        setReport(data);
      } else {
        setError(data.error || "Failed to analyze resume alignment matrix.");
      }
    } catch (err: any) {
      setError(`Network connection failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSampleLoad = () => {
    setResumeText(`SAHIL KUMAR
Full Stack Engineer | sahil.k00267@gmail.com

SUMMARY
Passionate developer with experience building responsive React applications with Node.js backends.

EXPERIENCE
Frontend Developer @ Tech Solutions (2024 - Present)
- Developed clean UI layouts with Tailwind CSS.
- Handled state management with React contexts and custom hooks.

SKILLS
React, JavaScript, HTML, CSS, Git, Tailwind CSS.`);
    setJobDescription(`Senior Full Stack Engineer
We are seeking an expert engineer proficient in React, TypeScript, Express, Tailwind CSS, and the Google Gemini API.
You will write clean production-ready modular architectures, integrate advanced GenAI pipelines, manage semantic context repositories, and maintain real-time diagnostics endpoints.`);
  };

  return (
    <div className="space-y-6" id="ats-module-wrapper">
      {/* Sub-Navigation Bar */}
      <div className="flex border-b border-slate-800 space-x-6" id="recruitment-hub-tabs">
        <button
          onClick={() => setHubMode("ats")}
          id="hub-tab-ats-btn"
          className={`pb-3 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 ${
            hubMode === "ats"
              ? "border-indigo-500 text-indigo-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <FileText className="w-4 h-4" />
          ATS & Resume Optimizer
        </button>

        <button
          onClick={() => setHubMode("scheduling")}
          id="hub-tab-scheduling-btn"
          className={`pb-3 text-sm font-medium transition-colors border-b-2 flex items-center gap-2 ${
            hubMode === "scheduling"
              ? "border-indigo-500 text-indigo-400"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Calendar className="w-4 h-4" />
          Self-Scheduling Agent
        </button>
      </div>

      {hubMode === "scheduling" ? (
        <SchedulingDashboard />
      ) : (
        <>
          {/* Header Panel */}
          <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 flex justify-between items-center flex-wrap gap-4" id="ats-header">
            <div>
              <h2 className="text-xl font-sans font-semibold text-white tracking-tight flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-400" />
                Recruitment ATS & Resume Optimizer
              </h2>
              <p className="text-slate-400 text-sm mt-1">
                Validate resume keywords, optimize experience formatting, and maximize score metrics against live target descriptions.
              </p>
            </div>
            <button
              onClick={handleSampleLoad}
              id="ats-load-sample-btn"
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs px-3 py-2 rounded-lg border border-slate-700 font-mono transition-colors"
            >
              Load Developer Sample
            </button>
          </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" id="ats-io-grid">
        {/* Input Column */}
        <div className="space-y-4" id="ats-inputs">
          <form onSubmit={handleOptimize} className="bg-slate-900 p-5 rounded-xl border border-slate-800 space-y-4">
            <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider font-sans">
              Alignment Matrix Inputs
            </h3>

            {/* Resume Text Input */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 font-medium flex justify-between">
                <span>Resume Text / CV Markdown</span>
                <span className="text-[10px] text-slate-500 font-mono">{resumeText.length} chars</span>
              </label>
              <textarea
                value={resumeText}
                onChange={(e) => setResumeText(e.target.value)}
                rows={7}
                className="w-full bg-slate-950 text-slate-100 rounded p-3 text-xs border border-slate-800 focus:outline-none focus:border-indigo-500 font-mono resize-none leading-relaxed"
                placeholder="Paste original CV text or resume profile here..."
                id="ats-resume-textarea"
                required
              />
            </div>

            {/* Job Description Input */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 font-medium flex justify-between">
                <span>Target Job Description</span>
                <span className="text-[10px] text-slate-500 font-mono">{jobDescription.length} chars</span>
              </label>
              <textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                rows={5}
                className="w-full bg-slate-950 text-slate-100 rounded p-3 text-xs border border-slate-800 focus:outline-none focus:border-indigo-500 font-sans resize-none leading-relaxed"
                placeholder="Paste the target job advertisement description here..."
                id="ats-jd-textarea"
                required
              />
            </div>

            <button
              type="submit"
              id="ats-submit-btn"
              disabled={loading || !resumeText.trim() || !jobDescription.trim()}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Calculating Match Alignment...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-indigo-200" />
                  Optimize Alignment Matrix
                </>
              )}
            </button>
          </form>
        </div>

        {/* Output Report Column */}
        <div className="space-y-4" id="ats-outputs">
          {error && (
            <div className="bg-rose-950/20 border border-rose-900/40 rounded-xl p-5 flex gap-3 text-rose-300 animate-fadeIn" id="ats-error-banner">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
              <div className="text-xs space-y-1">
                <p className="font-semibold">Evaluation Failed</p>
                <p className="leading-relaxed">{error}</p>
              </div>
            </div>
          )}

          {!report && !loading && !error && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-500 text-xs font-mono h-full flex flex-col items-center justify-center gap-2.5" id="ats-placeholder">
              <BookOpen className="w-8 h-8 text-slate-700 animate-pulse" />
              <span>Awaiting input profiles. Optimize to generate ATS alignment metrics.</span>
            </div>
          )}

          {loading && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-500 text-xs font-mono h-full flex flex-col items-center justify-center gap-3" id="ats-loading-state">
              <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
              <span>Evaluating semantic vector matches across skills matrix...</span>
            </div>
          )}

          {report && (
            <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 space-y-5 animate-fadeIn" id="ats-report-panel">
              {/* Score Display Header */}
              <div className="flex items-center justify-between border-b border-slate-800 pb-4" id="ats-report-header">
                <div>
                  <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider font-sans">
                    ATS Audit Metrics
                  </h3>
                  <span className="text-[10px] text-slate-500 font-mono">Index completed successfully</span>
                </div>
                <div className="flex items-baseline gap-1" id="ats-score-badge">
                  <span className="text-4xl font-mono font-bold text-indigo-400">{report.matchScore}%</span>
                  <span className="text-xs text-slate-400">Match</span>
                </div>
              </div>

              {/* Subscores breakdowns */}
              <div className="grid grid-cols-3 gap-3" id="ats-subscores">
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-850 text-center font-mono" id="subscore-skills">
                  <div className="text-[10px] text-slate-500 uppercase">Skills Match</div>
                  <div className="text-base font-bold text-white mt-1">{report.scoringBreakdown.skillsScore}/100</div>
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-850 text-center font-mono" id="subscore-exp">
                  <div className="text-[10px] text-slate-500 uppercase">Exp Score</div>
                  <div className="text-base font-bold text-white mt-1">{report.scoringBreakdown.experienceScore}/100</div>
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-850 text-center font-mono" id="subscore-format">
                  <div className="text-[10px] text-slate-500 uppercase">Layout Format</div>
                  <div className="text-base font-bold text-white mt-1">{report.scoringBreakdown.formattingScore}/100</div>
                </div>
              </div>

              {/* Missing Keywords */}
              <div className="space-y-2" id="ats-keywords-section">
                <span className="text-xs text-slate-400 font-medium">Critical Missing Keywords:</span>
                <div className="flex gap-1.5 flex-wrap" id="ats-keywords-list">
                  {report.extractedKeywords.map((k) => (
                    <span 
                      key={k} 
                      className="bg-rose-950/40 text-rose-300 border border-rose-900/40 text-[10px] font-mono px-2 py-0.5 rounded"
                    >
                      + {k}
                    </span>
                  ))}
                  {report.extractedKeywords.length === 0 && (
                    <span className="text-xs text-emerald-400 font-mono flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" /> All job core keywords accounted for in CV!
                    </span>
                  )}
                </div>
              </div>

              {/* Action Directives */}
              <div className="space-y-2" id="ats-directives-section">
                <span className="text-xs text-slate-400 font-medium">Refinement Directives:</span>
                <ul className="space-y-1.5 text-xs text-slate-300" id="ats-directives-list">
                  {report.refinementDirectives.map((d, index) => (
                    <li key={index} className="flex items-start gap-2 leading-relaxed">
                      <ArrowRight className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Optimized Pitch / Summary */}
              <div className="bg-slate-950 p-4 rounded-lg border border-slate-850 space-y-1.5" id="ats-summary-section">
                <span className="text-[10px] font-mono font-bold text-indigo-400 uppercase tracking-wider block">
                  Optimized Core Elevator Pitch (Paste in Bio / Summary)
                </span>
                <p className="text-xs text-slate-300 leading-relaxed italic font-sans">
                  "{report.optimizedSummary}"
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
        </>
      )}
    </div>
  );
}
