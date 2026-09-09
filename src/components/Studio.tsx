/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Cpu, Send, RefreshCw, AlertCircle, Sparkles, FileText, CheckCircle } from "lucide-react";

export default function Studio() {
  const [prompt, setPrompt] = useState("");
  const [systemInstruction, setSystemInstruction] = useState(
    "You are the executive AI Kernel of Aziz Assistant. Always format output in precise developer markdown."
  );
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const presets = [
    {
      name: "AI OS Central Router",
      instruction: "You are the executive AI Kernel of Aziz Assistant. Always format output in precise developer markdown."
    },
    {
      name: "ATS Resume Optimizer",
      instruction: "You are a professional ATS recruiter. Analyze the given CV and suggest optimized keywords and structured refinements."
    },
    {
      name: "Freelance Cover Generator",
      instruction: "Generate personalized, persuasive Upwork / Freelancer cover letters based on user skills and client requirements."
    }
  ];

  const handleInference = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/gemini/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, systemInstruction })
      });
      const data = await res.json();

      if (res.ok) {
        setResult(data.text);
      } else {
        setError(data.error || "Failed to generate AI response.");
      }
    } catch (err: any) {
      setError(`Network connection failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6" id="studio-wrapper">
      {/* Module Title Header */}
      <div className="bg-slate-900 p-6 rounded-xl border border-slate-800" id="studio-header">
        <h2 className="text-xl font-sans font-semibold text-white tracking-tight flex items-center gap-2">
          <Cpu className="w-5 h-5 text-blue-500" />
          AI Kernel Studio
        </h2>
        <p className="text-slate-400 text-sm mt-1">
          Visual workspace to prototype core AI routing agents and system instructions on top of Google Gemini.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="studio-grid">
        {/* Configuration Column */}
        <div className="lg:col-span-1 space-y-4" id="studio-config">
          <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 space-y-4">
            <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider font-sans">
              Kernel Configurations
            </h3>

            {/* System Presets */}
            <div className="space-y-2">
              <label className="text-xs text-slate-400 font-medium">Instruction Presets</label>
              <div className="flex flex-col gap-1.5">
                {presets.map((p) => (
                  <button
                    key={p.name}
                    id={`preset-${p.name.replace(/\s+/g, "-").toLowerCase()}`}
                    type="button"
                    onClick={() => setSystemInstruction(p.instruction)}
                    className="w-full text-left text-xs bg-slate-950 hover:bg-slate-800/60 p-2.5 rounded border border-slate-800 text-slate-300 hover:text-white transition-colors"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            {/* System Instruction Textarea */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 font-medium">System Instruction</label>
              <textarea
                value={systemInstruction}
                onChange={(e) => setSystemInstruction(e.target.value)}
                rows={5}
                className="w-full bg-slate-950 text-slate-100 rounded p-3 text-xs border border-slate-800 focus:outline-none focus:border-blue-500 font-mono resize-none leading-relaxed"
                placeholder="Declare system instruction framework..."
                id="system-instruction-textarea"
              />
            </div>
          </div>
        </div>

        {/* Input/Inference Sandbox */}
        <div className="lg:col-span-2 space-y-4" id="studio-sandbox">
          <form onSubmit={handleInference} className="bg-slate-900 p-5 rounded-xl border border-slate-800 space-y-4">
            <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider font-sans">
              Sandbox Console
            </h3>

            {/* User Input prompt */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 font-medium">Agent Query / User Input</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                className="w-full bg-slate-950 text-slate-100 rounded p-3 text-sm border border-slate-800 focus:outline-none focus:border-blue-500 resize-none leading-relaxed"
                placeholder="Enter prompt or text to analyze (e.g. 'Generate a cover letter for a React developer')"
                id="studio-prompt-textarea"
              />
            </div>

            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono">
                <span>Model:</span>
                <span className="text-blue-400">gemini-3.5-flash</span>
              </div>
              <button
                type="submit"
                id="studio-submit-btn"
                disabled={loading || !prompt.trim()}
                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Inferencing...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Inference Script
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Results Output */}
          {error && (
            <div className="bg-rose-950/20 border border-rose-900/40 rounded-xl p-4 flex gap-3 text-rose-300" id="studio-error">
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
              <div className="text-xs space-y-1.5">
                <p className="font-semibold">Inference Error</p>
                <p className="leading-relaxed">{error}</p>
                <div className="bg-slate-950/80 p-2.5 rounded border border-slate-800 mt-2 font-mono text-slate-400 text-[10px]">
                  <strong>Setup Guide:</strong> Create or declare <code>GEMINI_API_KEY</code> in the Secrets drawer.
                </div>
              </div>
            </div>
          )}

          {result && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3" id="studio-result">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2.5">
                <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                  Execution Complete
                </span>
                <span className="text-xs text-slate-500 font-mono">Output (Markdown)</span>
              </div>
              <div className="text-slate-100 text-sm leading-relaxed whitespace-pre-wrap font-sans bg-slate-950 p-4 rounded-lg border border-slate-850">
                {result}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
