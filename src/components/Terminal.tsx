/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import { Terminal as TerminalIcon, ShieldAlert, Sparkles, Send, Trash2 } from "lucide-react";
import { TerminalLine } from "../types";
import { setAdminApiKey, getAdminAuthHeaders, getDangerousActionHeaders } from "../utils/apiAuth";

export default function Terminal() {
  const [lines, setLines] = useState<TerminalLine[]>([
    {
      id: "term-1",
      type: "system",
      text: "Aziz Assistant Secure Kernel Terminal [Authenticated]",
      timestamp: new Date().toISOString()
    },
    {
      id: "term-2",
      type: "system",
      text: "Type 'help' to print the executive command directory.",
      timestamp: new Date().toISOString()
    }
  ]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  const handleCommandSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = inputValue.trim();
    if (!cmd) return;

    // Append user input to terminal
    const userLineId = `user-${Date.now()}`;
    const userLine: TerminalLine = {
      id: userLineId,
      type: "input",
      text: cmd,
      timestamp: new Date().toISOString()
    };
    setLines((prev) => [...prev, userLine]);
    setInputValue("");

    // Check for client-side local command 'key'
    const parts = cmd.split(" ");
    if (parts[0].toLowerCase() === "key") {
      const providedKey = parts.slice(1).join(" ").trim();
      if (!providedKey) {
        setLines((prev) => [
          ...prev,
          {
            id: `out-${Date.now()}`,
            type: "error",
            text: "Usage: key <AZIZ_API_KEY>",
            timestamp: new Date().toISOString()
          }
        ]);
        return;
      }
      setAdminApiKey(providedKey);
      setLines((prev) => [
        ...prev,
        {
          id: `out-${Date.now()}`,
          type: "system",
          text: "System: Developer API Key successfully loaded and stored in local cache.",
          timestamp: new Date().toISOString()
        }
      ]);
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/terminal/execute", {
        method: "POST",
        headers: getDangerousActionHeaders({ 
          "Content-Type": "application/json"
        }),
        body: JSON.stringify({ command: cmd, confirmDangerous: true })
      });
      
      if (response.status === 401) {
        setLines((prev) => [
          ...prev,
          {
            id: `out-${Date.now()}`,
            type: "error",
            text: "Error 401: Unauthorized. High-impact commands require a valid AZIZ_API_KEY.\nUse the command 'key <YOUR_KEY>' in this terminal to authenticate.",
            timestamp: new Date().toISOString()
          }
        ]);
        return;
      }

      const data = await response.json();

      const outputLine: TerminalLine = {
        id: `out-${Date.now()}`,
        type: data.isError ? "error" : "output",
        text: data.output || "Command completed successfully with no output.",
        timestamp: new Date().toISOString()
      };
      setLines((prev) => [...prev, outputLine]);
    } catch (err: any) {
      const errLine: TerminalLine = {
        id: `err-${Date.now()}`,
        type: "error",
        text: `Network Error: Unable to reach Aziz Kernel. Detail: ${err.message}`,
        timestamp: new Date().toISOString()
      };
      setLines((prev) => [...prev, errLine]);
    } finally {
      setLoading(false);
    }
  };

  const clearTerminal = () => {
    setLines([
      {
        id: "term-clear-1",
        type: "system",
        text: "Terminal state reset. Secure Shell active.",
        timestamp: new Date().toISOString()
      }
    ]);
  };

  return (
    <div className="bg-slate-950 rounded-xl border border-slate-800 shadow-2xl flex flex-col h-[calc(100vh-120px)]" id="terminal-wrapper">
      {/* Terminal Title Bar */}
      <div className="bg-slate-900 px-4 py-3 border-b border-slate-800 rounded-t-xl flex justify-between items-center" id="terminal-bar">
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-4 h-4 text-emerald-400" />
          <span className="font-mono text-xs font-semibold text-slate-200" id="terminal-title">
            kernel@aziz-os:~
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={clearTerminal}
            className="text-slate-400 hover:text-rose-400 p-1 rounded hover:bg-slate-800 transition-colors"
            title="Reset Terminal Log"
            id="terminal-clear-btn"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <div className="flex gap-1.5">
            <span className="w-3 h-3 rounded-full bg-slate-800" />
            <span className="w-3 h-3 rounded-full bg-slate-800" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
          </div>
        </div>
      </div>

      {/* Terminal Display */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2.5 font-mono text-sm leading-relaxed" id="terminal-display">
        {lines.map((line) => {
          if (line.type === "input") {
            return (
              <div key={line.id} className="flex items-start gap-1 text-slate-100" id={`term-line-${line.id}`}>
                <span className="text-emerald-400 select-none">$</span>
                <span className="font-medium">{line.text}</span>
              </div>
            );
          } else if (line.type === "system") {
            return (
              <div key={line.id} className="text-blue-400 flex items-center gap-2 text-xs py-1" id={`term-line-${line.id}`}>
                <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                <span>{line.text}</span>
              </div>
            );
          } else if (line.type === "error") {
            return (
              <div key={line.id} className="text-rose-400 border-l-2 border-rose-500 pl-2 text-xs my-1" id={`term-line-${line.id}`}>
                <pre className="whitespace-pre-wrap">{line.text}</pre>
              </div>
            );
          } else {
            return (
              <div key={line.id} className="text-slate-300 pl-3 border-l border-slate-800 text-xs py-0.5" id={`term-line-${line.id}`}>
                <pre className="whitespace-pre-wrap font-mono">{line.text}</pre>
              </div>
            );
          }
        })}

        {loading && (
          <div className="text-slate-500 flex items-center gap-2 text-xs py-1" id="terminal-loading">
            <Sparkles className="w-3.5 h-3.5 animate-spin text-emerald-400" />
            <span>Processing command on server...</span>
          </div>
        )}
        <div ref={terminalEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleCommandSubmit} className="p-3 bg-slate-900 border-t border-slate-800 rounded-b-xl flex gap-2" id="terminal-form">
        <span className="text-emerald-400 font-mono flex items-center select-none pl-1">$</span>
        <input
          type="text"
          id="terminal-input"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          disabled={loading}
          autoComplete="off"
          placeholder="Execute system script... (e.g. 'help', 'diagnostics')"
          className="flex-1 bg-transparent border-0 outline-none focus:ring-0 text-slate-100 font-mono text-sm placeholder-slate-600"
        />
        <button
          type="submit"
          id="terminal-submit-btn"
          disabled={loading || !inputValue.trim()}
          className="bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white p-1.5 rounded-lg transition-colors duration-150 disabled:opacity-50 disabled:hover:bg-slate-800"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
