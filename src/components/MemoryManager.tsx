/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Brain, Search, Database, Plus, RefreshCw, Layers, CheckCircle } from "lucide-react";
import { MemoryEntry } from "../types";

export default function MemoryManager() {
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [newContent, setNewContent] = useState("");
  const [newCategory, setNewCategory] = useState<MemoryEntry["category"]>("knowledge");

  const fetchMemory = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/memory");
      const data = await response.json();
      setEntries(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim()) return;

    try {
      const response = await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: newCategory, content: newContent })
      });
      if (response.ok) {
        setNewContent("");
        fetchMemory();
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchMemory();
  }, []);

  const filteredEntries = filterCategory === "all"
    ? entries
    : entries.filter((e) => e.category === filterCategory);

  const categories = [
    { value: "all", label: "All Blocks" },
    { value: "system_rule", label: "Rules" },
    { value: "user_preference", label: "User Preferences" },
    { value: "knowledge", label: "Knowledge" },
    { value: "context", label: "Context" }
  ];

  return (
    <div className="space-y-6" id="memory-wrapper">
      {/* Module Title Header */}
      <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 flex justify-between items-center flex-wrap gap-4" id="memory-header">
        <div>
          <h2 className="text-xl font-sans font-semibold text-white tracking-tight flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-400" />
            Semantic Memory Indexes
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Browse and inject local contextual data. This memory acts as a persistent vector pool for your agents.
          </p>
        </div>
        <button 
          onClick={fetchMemory}
          id="memory-refresh-btn"
          className="bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white p-2.5 rounded-lg border border-slate-700 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="memory-grid">
        {/* Memory Injector Column */}
        <div className="lg:col-span-1" id="memory-injector">
          <form onSubmit={handleAddMemory} className="bg-slate-900 p-5 rounded-xl border border-slate-800 space-y-4">
            <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider font-sans">
              Inject Semantic Block
            </h3>

            {/* Category Selector */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 font-medium">Memory Classification</label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as MemoryEntry["category"])}
                className="w-full bg-slate-950 text-slate-100 rounded p-2.5 text-xs border border-slate-800 focus:outline-none focus:border-blue-500 font-sans"
                id="memory-category-select"
              >
                <option value="system_rule">System Rule (Instruction Modification)</option>
                <option value="user_preference">User Preference (UI / Theme)</option>
                <option value="knowledge">Core Knowledge (FAQ / Business Docs)</option>
                <option value="context">Workspace Context (SMTP / Client Credentials)</option>
              </select>
            </div>

            {/* Content Textarea */}
            <div className="space-y-1.5">
              <label className="text-xs text-slate-400 font-medium">Content Body</label>
              <textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                rows={5}
                className="w-full bg-slate-950 text-slate-100 rounded p-3 text-xs border border-slate-800 focus:outline-none focus:border-blue-500 resize-none leading-relaxed font-sans"
                placeholder="Enter context or specific instruction constraints to embed..."
                id="memory-content-textarea"
              />
            </div>

            <button
              type="submit"
              id="memory-submit-btn"
              disabled={!newContent.trim()}
              className="w-full bg-purple-600 hover:bg-purple-500 text-white px-4 py-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              Index Block
            </button>
          </form>
        </div>

        {/* Browser Column */}
        <div className="lg:col-span-2 space-y-4" id="memory-browser">
          {/* Category Filter Pills */}
          <div className="flex gap-1.5 flex-wrap" id="memory-filters">
            {categories.map((c) => (
              <button
                key={c.value}
                id={`filter-${c.value}`}
                onClick={() => setFilterCategory(c.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  filterCategory === c.value
                    ? "bg-purple-900/30 text-purple-300 border-purple-700"
                    : "bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Records List */}
          <div className="space-y-3" id="memory-list">
            {loading ? (
              <div className="text-center py-12 text-slate-500 flex flex-col items-center gap-3" id="memory-loading">
                <RefreshCw className="w-6 h-6 animate-spin text-purple-500" />
                <span className="text-xs font-mono">Querying vector indexes...</span>
              </div>
            ) : filteredEntries.map((entry) => (
              <div 
                key={entry.id} 
                id={`memory-card-${entry.id}`}
                className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2.5 hover:border-slate-750 transition-colors"
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono uppercase bg-slate-950 text-purple-300 border border-slate-850 px-2 py-0.5 rounded">
                      {entry.category.replace("_", " ")}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      ID: {entry.id}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    {entry.embeddingStatus}
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed font-sans bg-slate-950/60 p-3 rounded border border-slate-850/50">
                  {entry.content}
                </p>
                <div className="text-[9px] font-mono text-slate-500 text-right">
                  Indexed {new Date(entry.timestamp).toLocaleString()}
                </div>
              </div>
            ))}

            {!loading && filteredEntries.length === 0 && (
              <div className="text-center py-12 text-slate-600 font-mono text-xs border border-dashed border-slate-800 rounded-xl" id="memory-empty">
                No semantic records indexed in this category.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
