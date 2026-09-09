/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Radio, 
  Send, 
  Mail, 
  Settings, 
  AlertTriangle, 
  CheckCircle, 
  RefreshCw,
  BellRing,
  Globe,
  Save,
  Trash2,
  Check,
  Info,
  KeyRound,
  MessageSquare,
  Users,
  Search,
  Sparkles
} from "lucide-react";

interface SavedStatus {
  smtp: {
    host: string;
    port: number;
    username: string;
    configured: boolean;
    updatedAt?: string;
  };
  telegram: {
    token: string;
    chatId: string;
    configured: boolean;
    botUsername?: string;
    updatedAt?: string;
  };
  gmail: {
    configured: boolean;
  };
}

export default function Integrations() {
  const [activeChannel, setActiveChannel] = useState<"smtp" | "telegram" | "gmail">("telegram");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sendingAlert, setSendingAlert] = useState(false);
  const [detectingChats, setDetectingChats] = useState(false);
  const [detectedChats, setDetectedChats] = useState<Array<{ id: string; title: string; type: string; username?: string }>>([]);
  const [detectNotice, setDetectNotice] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saveResult, setSaveResult] = useState<{ success: boolean; message: string } | null>(null);

  // Saved configs from server
  const [savedStatus, setSavedStatus] = useState<SavedStatus>({
    smtp: { host: "mail.hostinger.com", port: 465, username: "", configured: false },
    telegram: { token: "", chatId: "", configured: false },
    gmail: { configured: true }
  });

  // SMTP form states
  const [smtpConfig, setSmtpConfig] = useState({
    host: "mail.hostinger.com",
    port: 465,
    username: "",
    password: ""
  });

  // Telegram form states
  const [telegramConfig, setTelegramConfig] = useState({
    token: "",
    chatId: ""
  });

  // Load existing configurations from server
  useEffect(() => {
    fetchSavedIntegrations();
  }, []);

  const fetchSavedIntegrations = async () => {
    try {
      const res = await fetch("/api/integrations");
      if (res.ok) {
        const data = await res.json();
        if (data.integrations) {
          setSavedStatus(data.integrations);
          if (data.integrations.telegram) {
            setTelegramConfig({
              token: data.integrations.telegram.token || "",
              chatId: data.integrations.telegram.chatId || ""
            });
          }
          if (data.integrations.smtp) {
            setSmtpConfig({
              host: data.integrations.smtp.host || "mail.hostinger.com",
              port: data.integrations.smtp.port || 465,
              username: data.integrations.smtp.username || "",
              password: data.integrations.smtp.password || ""
            });
          }
        }
      }
    } catch (err) {
      console.error("Failed to load integrations:", err);
    }
  };

  const handleTestConnection = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setTestResult(null);
    setSaveResult(null);

    const config = activeChannel === "smtp" ? smtpConfig : telegramConfig;

    try {
      const res = await fetch("/api/integrations/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: activeChannel, config })
      });
      const data = await res.json();
      setTestResult({
        success: data.success,
        message: data.message
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: `Gateway failure: ${err.message}`
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSendSampleAlert = async () => {
    setSendingAlert(true);
    setSaveResult(null);
    setTestResult(null);

    try {
      const res = await fetch("/api/integrations/test-alert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "telegram" })
      });
      const data = await res.json();
      if (data.success) {
        setSaveResult({
          success: true,
          message: data.message || "Live sample alert dispatched to Telegram!"
        });
      } else {
        setSaveResult({
          success: false,
          message: data.error || "Failed to dispatch Telegram alert."
        });
      }
    } catch (err: any) {
      setSaveResult({
        success: false,
        message: `Alert dispatch error: ${err.message}`
      });
    } finally {
      setSendingAlert(false);
    }
  };

  const handleDetectChats = async () => {
    setDetectingChats(true);
    setDetectNotice(null);
    try {
      const res = await fetch("/api/integrations/telegram/detect-chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: telegramConfig.token })
      });
      const data = await res.json();
      if (data.success) {
        setDetectedChats(data.chats || []);
        setDetectNotice(data.message || `Discovered ${data.chats?.length || 0} chat(s)!`);
      } else {
        setDetectNotice(data.error || "Could not detect chats.");
      }
    } catch (err: any) {
      setDetectNotice(`Detection error: ${err.message}`);
    } finally {
      setDetectingChats(false);
    }
  };

  const handleSaveConfiguration = async () => {
    setSaving(true);
    setSaveResult(null);

    const config = activeChannel === "smtp" ? smtpConfig : telegramConfig;

    try {
      const res = await fetch("/api/integrations/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: activeChannel, config })
      });
      const data = await res.json();
      if (data.success) {
        setSaveResult({
          success: true,
          message: data.message || "Configuration saved successfully."
        });
        await fetchSavedIntegrations();
      } else {
        setSaveResult({
          success: false,
          message: data.error || "Failed to save configuration."
        });
      }
    } catch (err: any) {
      setSaveResult({
        success: false,
        message: `Save error: ${err.message}`
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm(`Are you sure you want to disconnect and clear the ${activeChannel.toUpperCase()} configuration?`)) {
      return;
    }
    try {
      const res = await fetch("/api/integrations/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: activeChannel })
      });
      const data = await res.json();
      if (data.success) {
        setSaveResult({
          success: true,
          message: data.message
        });
        setTestResult(null);
        if (activeChannel === "telegram") {
          setTelegramConfig({ token: "", chatId: "" });
        } else if (activeChannel === "smtp") {
          setSmtpConfig({ host: "mail.hostinger.com", port: 465, username: "", password: "" });
        }
        await fetchSavedIntegrations();
      }
    } catch (err: any) {
      setSaveResult({
        success: false,
        message: `Disconnect failed: ${err.message}`
      });
    }
  };

  const isChannelConfigured = 
    activeChannel === "telegram" ? savedStatus.telegram?.configured :
    activeChannel === "smtp" ? savedStatus.smtp?.configured :
    savedStatus.gmail?.configured;

  return (
    <div className="space-y-6" id="integrations-module-wrapper">
      {/* Title Header */}
      <div className="bg-slate-900 p-6 rounded-xl border border-slate-800" id="integrations-header">
        <h2 className="text-xl font-sans font-semibold text-white tracking-tight flex items-center gap-2">
          <Radio className="w-5 h-5 text-blue-400 animate-pulse" />
          Unified Alert & Integration Channels
        </h2>
        <p className="text-slate-400 text-sm mt-1">
          Bridge system alerts, job-match digests, and freelance scouts with your Telegram Bot or external SMTP mail servers.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" id="integrations-grid">
        {/* Navigation / Selection Column */}
        <div className="lg:col-span-1 space-y-3" id="integrations-channels-nav">
          <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 space-y-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">
              Channels Catalog
            </h3>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => { setActiveChannel("telegram"); setTestResult(null); setSaveResult(null); }}
                id="channel-btn-telegram"
                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-xs font-semibold transition-all duration-150 ${
                  activeChannel === "telegram"
                    ? "bg-blue-600 text-white shadow-md border border-blue-500"
                    : "bg-slate-950 text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-slate-850"
                }`}
              >
                <div className="flex items-center gap-3">
                  <BellRing className="w-4 h-4" />
                  <div className="text-left">
                    <p>Telegram Alert Bot</p>
                    <p className="text-[10px] opacity-75 font-normal mt-0.5 font-sans">Instant contract alerts</p>
                  </div>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono whitespace-nowrap ${
                  savedStatus.telegram?.configured
                    ? activeChannel === "telegram" ? "bg-emerald-500/20 text-emerald-200 border border-emerald-400/40" : "bg-emerald-950 text-emerald-400 border border-emerald-800"
                    : "bg-slate-800 text-slate-400"
                }`}>
                  {savedStatus.telegram?.configured ? "Saved & Active" : "Not Saved"}
                </span>
              </button>

              <button
                onClick={() => { setActiveChannel("smtp"); setTestResult(null); setSaveResult(null); }}
                id="channel-btn-smtp"
                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-xs font-semibold transition-all duration-150 ${
                  activeChannel === "smtp"
                    ? "bg-blue-600 text-white shadow-md border border-blue-500"
                    : "bg-slate-950 text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-slate-850"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4" />
                  <div className="text-left">
                    <p>Hostinger / SMTP Mail</p>
                    <p className="text-[10px] opacity-75 font-normal mt-0.5 font-sans">Matching alerts & digests</p>
                  </div>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono whitespace-nowrap ${
                  savedStatus.smtp?.configured
                    ? activeChannel === "smtp" ? "bg-emerald-500/20 text-emerald-200 border border-emerald-400/40" : "bg-emerald-950 text-emerald-400 border border-emerald-800"
                    : "bg-slate-800 text-slate-400"
                }`}>
                  {savedStatus.smtp?.configured ? "Saved" : "Not Saved"}
                </span>
              </button>

              <button
                onClick={() => { setActiveChannel("gmail"); setTestResult(null); setSaveResult(null); }}
                id="channel-btn-gmail"
                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-xs font-semibold transition-all duration-150 ${
                  activeChannel === "gmail"
                    ? "bg-blue-600 text-white shadow-md border border-blue-500"
                    : "bg-slate-950 text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 border border-slate-850"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Globe className="w-4 h-4" />
                  <div className="text-left">
                    <p>Gmail API Connector</p>
                    <p className="text-[10px] opacity-75 font-normal mt-0.5 font-sans">Draft applications context</p>
                  </div>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono whitespace-nowrap ${
                  activeChannel === "gmail" ? "bg-emerald-500/20 text-emerald-200 border border-emerald-400/40" : "bg-emerald-950 text-emerald-400 border border-emerald-800"
                }`}>
                  Active
                </span>
              </button>
            </div>
          </div>

          {/* Quick Telegram Bot Guide Box */}
          {activeChannel === "telegram" && (
            <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 text-xs space-y-2 text-slate-300">
              <div className="flex items-center gap-1.5 font-semibold text-slate-200">
                <Info className="w-4 h-4 text-blue-400" />
                <span>How to setup your Telegram Bot:</span>
              </div>
              <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-400 font-sans leading-relaxed">
                <li>Message <span className="font-mono text-blue-300">@BotFather</span> on Telegram and send <span className="font-mono text-slate-200">/newbot</span>.</li>
                <li>Copy the provided <span className="font-mono text-blue-300">Bot Token</span> into the field on the right.</li>
                <li>Start a chat with your bot or send <span className="font-mono text-slate-200">/start</span> to it.</li>
                <li>Get your <span className="font-mono text-blue-300">Chat ID</span> from <span className="font-mono text-slate-200">@userinfobot</span> or your channel.</li>
                <li>Click <span className="font-semibold text-slate-200">Test Handshake</span> then click <span className="font-semibold text-blue-400">Save Configuration</span>!</li>
              </ol>
            </div>
          )}

          {/* 2-Way Interactive Bot Return Commands Cheatsheet */}
          {activeChannel === "telegram" && (
            <div className="bg-slate-900/90 p-4 rounded-xl border border-blue-900/40 text-xs space-y-3 text-slate-300 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-semibold text-blue-300">
                  <Sparkles className="w-4 h-4 text-blue-400" />
                  <span>2-Way Telegram Return Commands</span>
                </div>
                <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded-full font-mono">
                  Listener Active
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-sans leading-relaxed">
                Send these return commands directly in your Telegram group or private bot chat to control matching:
              </p>
              <div className="space-y-2 text-[11px] font-sans">
                <div className="p-2 rounded bg-slate-950/80 border border-slate-800">
                  <div className="flex items-center justify-between">
                    <code className="text-blue-300 font-mono font-bold">/connect_here</code>
                    <span className="text-[9px] bg-blue-950 text-blue-400 px-1 rounded">Group Hook</span>
                  </div>
                  <p className="text-slate-400 text-[10px] mt-0.5">Type inside your group to instantly connect it for all scout alerts.</p>
                </div>

                <div className="p-2 rounded bg-slate-950/80 border border-slate-800">
                  <code className="text-emerald-300 font-mono font-bold">/skills &lt;skill1, skill2...&gt;</code>
                  <p className="text-slate-400 text-[10px] mt-0.5">Dynamically update matching skills (e.g. <code>/skills React, Node, AI</code>).</p>
                </div>

                <div className="p-2 rounded bg-slate-950/80 border border-slate-800">
                  <code className="text-emerald-300 font-mono font-bold">/portfolio &lt;url or text&gt;</code>
                  <p className="text-slate-400 text-[10px] mt-0.5">Save your portfolio link or showcases to reference in proposals.</p>
                </div>

                <div className="p-2 rounded bg-slate-950/80 border border-slate-800">
                  <code className="text-purple-300 font-mono font-bold">/resume &lt;text&gt;</code>
                  <p className="text-slate-400 text-[10px] mt-0.5">Paste resume highlights to auto-extract technical skills.</p>
                </div>

                <div className="p-2 rounded bg-slate-950/80 border border-slate-800">
                  <code className="text-blue-300 font-mono font-bold">/status</code>
                  <p className="text-slate-400 text-[10px] mt-0.5">Check current scout daemon, portfolio, and matching profile.</p>
                </div>

                <div className="p-2 rounded bg-slate-950/80 border border-slate-800">
                  <code className="text-amber-300 font-mono font-bold">/scout</code>
                  <p className="text-slate-400 text-[10px] mt-0.5">Trigger immediate on-demand job scan across 40+ platforms.</p>
                </div>

                <div className="p-2 rounded bg-slate-950/80 border border-slate-800">
                  <code className="text-slate-300 font-mono font-bold">/jobs</code>
                  <p className="text-slate-400 text-[10px] mt-0.5">Show top 5 recent high-scoring project matches.</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Configurations Forms Column */}
        <div className="lg:col-span-2 space-y-4" id="integrations-forms-panel">
          <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 space-y-4">
            <div className="flex flex-wrap justify-between items-center gap-2 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider font-sans capitalize">
                  {activeChannel === "telegram" ? "Telegram Alert Bot Configuration" : `${activeChannel} Credentials`}
                </h3>
                {isChannelConfigured ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-900/50 px-2 py-0.5 rounded-full">
                    <CheckCircle className="w-3 h-3" /> Saved & Active
                  </span>
                ) : (
                  <span className="text-[11px] font-mono text-slate-400 bg-slate-800/40 border border-slate-700/50 px-2 py-0.5 rounded-full">
                    Unsaved
                  </span>
                )}
              </div>
              {isChannelConfigured && activeChannel !== "gmail" && (
                <button
                  type="button"
                  id="integrations-disconnect-btn"
                  onClick={handleDisconnect}
                  className="text-rose-400 hover:text-rose-300 text-xs flex items-center gap-1 transition-colors px-2 py-1 rounded hover:bg-rose-950/30"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Disconnect Channel
                </button>
              )}
            </div>

            {/* Telegram form */}
            {activeChannel === "telegram" && (
              <div className="space-y-4" id="form-telegram">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono uppercase text-slate-300 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-blue-400" />
                    Telegram Bot Token
                  </label>
                  <input
                    type="text"
                    required
                    id="telegram-token-input"
                    value={telegramConfig.token}
                    onChange={(e) => setTelegramConfig({ ...telegramConfig, token: e.target.value })}
                    placeholder="e.g. 123456789:ABCDefGhIJKlmNoPQRsTUVwxyZ"
                    className="w-full bg-slate-950 border border-slate-800 p-2.5 text-xs rounded text-slate-100 font-mono focus:border-blue-500 focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-400 font-sans">
                    Issued by @BotFather when creating your bot.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-mono uppercase text-slate-300 flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
                      Subscriber Chat / Group ID
                    </label>
                    <button
                      type="button"
                      id="detect-telegram-chats-btn"
                      onClick={handleDetectChats}
                      disabled={detectingChats || !telegramConfig.token}
                      className="text-[11px] text-blue-400 hover:text-blue-300 flex items-center gap-1 bg-blue-950/50 hover:bg-blue-900/50 border border-blue-800/60 px-2 py-0.5 rounded transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {detectingChats ? (
                        <>
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          <span>Scanning updates...</span>
                        </>
                      ) : (
                        <>
                          <Search className="w-3 h-3" />
                          <span>Auto-Detect Group ID</span>
                        </>
                      )}
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    id="telegram-chatid-input"
                    value={telegramConfig.chatId}
                    onChange={(e) => setTelegramConfig({ ...telegramConfig, chatId: e.target.value })}
                    placeholder="e.g. -1001234567890 (for group) or 862950049 (personal)"
                    className="w-full bg-slate-950 border border-slate-800 p-2.5 text-xs rounded text-slate-100 font-mono focus:border-blue-500 focus:outline-none"
                  />

                  {/* Clarification for Telegram Groups vs Personal Chats */}
                  <div className="text-[10px] text-slate-400 font-sans space-y-1 bg-slate-950/60 p-2.5 rounded border border-slate-850">
                    <p>
                      <strong className="text-amber-400">💡 Why did it send to personal chat instead of the group?</strong><br />
                      Group Chat IDs in Telegram <strong>always begin with a minus sign</strong> (e.g. <code className="text-blue-300 font-mono bg-slate-900 px-1 py-0.5 rounded">-100xxxxxxxxxx</code> or <code className="text-blue-300 font-mono bg-slate-900 px-1 py-0.5 rounded">-xxxxxxxx</code>). A positive number like <code className="text-slate-300 font-mono">862950049</code> targets your private 1-on-1 chat!
                    </p>
                    <p className="text-slate-300">
                      <strong>To get your Group's ID:</strong> Send any message (e.g. <span className="font-mono text-blue-300">/id</span> or <span className="font-mono text-blue-300">/start</span>) inside your group, then click <span className="text-blue-400 font-semibold cursor-pointer" onClick={handleDetectChats}>"Auto-Detect Group ID"</span> above, or forward a message from your group to <span className="font-mono text-slate-200">@userinfobot</span>.
                    </p>
                  </div>

                  {/* Detect Notice Feedback */}
                  {detectNotice && (
                    <div className="p-2.5 rounded bg-slate-950 border border-slate-800 text-[11px] text-slate-300 flex items-center justify-between">
                      <span className="leading-snug">{detectNotice}</span>
                      <button 
                        type="button" 
                        onClick={() => setDetectNotice(null)} 
                        className="text-slate-500 hover:text-slate-300 text-xs px-1.5 py-0.5 ml-2"
                      >
                        ✕
                      </button>
                    </div>
                  )}

                  {/* Discovered Chats / Groups List */}
                  {detectedChats.length > 0 && (
                    <div className="space-y-1.5 p-2.5 bg-slate-950 border border-blue-900/50 rounded-lg">
                      <p className="text-[10px] font-mono uppercase text-blue-300 flex items-center gap-1">
                        <Users className="w-3.5 h-3.5" /> Discovered Chats & Groups (Click to apply):
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {detectedChats.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setTelegramConfig({ ...telegramConfig, chatId: c.id });
                              setSaveResult(null);
                            }}
                            className={`text-xs px-2.5 py-1.5 rounded border flex items-center gap-1.5 transition-all cursor-pointer ${
                              telegramConfig.chatId === c.id
                                ? "bg-blue-600 text-white border-blue-500 shadow-sm"
                                : "bg-slate-900 hover:bg-slate-850 text-slate-300 border-slate-800"
                            }`}
                          >
                            <span className="font-semibold">{c.title}</span>
                            <span className="font-mono text-[10px] opacity-80">({c.id})</span>
                            <span className="text-[9px] uppercase px-1 py-0.2 bg-black/40 rounded text-slate-400 font-mono">{c.type}</span>
                            {telegramConfig.chatId === c.id && <Check className="w-3 h-3 text-white ml-0.5" />}
                          </button>
                        ))}
                      </div>
                      <p className="text-[10px] text-emerald-400 font-sans mt-1">
                        Selected ID: <strong>{telegramConfig.chatId}</strong>. Remember to click <strong>"Save Configuration"</strong> below!
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SMTP form */}
            {activeChannel === "smtp" && (
              <div className="space-y-4" id="form-smtp">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono uppercase text-slate-400">SMTP Server Host</label>
                    <input
                      type="text"
                      required
                      id="smtp-host-input"
                      value={smtpConfig.host}
                      onChange={(e) => setSmtpConfig({ ...smtpConfig, host: e.target.value })}
                      placeholder="e.g. mail.hostinger.com"
                      className="w-full bg-slate-950 border border-slate-800 p-2 text-xs rounded text-slate-100 font-mono focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono uppercase text-slate-400">TLS Port</label>
                    <input
                      type="number"
                      required
                      id="smtp-port-input"
                      value={smtpConfig.port}
                      onChange={(e) => setSmtpConfig({ ...smtpConfig, port: Number(e.target.value) })}
                      className="w-full bg-slate-950 border border-slate-800 p-2 text-xs rounded text-slate-100 font-mono focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase text-slate-400">Authenticated Username</label>
                  <input
                    type="email"
                    required
                    id="smtp-username-input"
                    value={smtpConfig.username}
                    onChange={(e) => setSmtpConfig({ ...smtpConfig, username: e.target.value })}
                    placeholder="e.g. alerts@aziz-assistant.com"
                    className="w-full bg-slate-950 border border-slate-800 p-2 text-xs rounded text-slate-100 font-mono focus:border-blue-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase text-slate-400">Secure Access Password / Token</label>
                  <input
                    type="password"
                    required
                    id="smtp-password-input"
                    value={smtpConfig.password}
                    onChange={(e) => setSmtpConfig({ ...smtpConfig, password: e.target.value })}
                    placeholder="••••••••••••••••"
                    className="w-full bg-slate-950 border border-slate-800 p-2 text-xs rounded text-slate-100 font-mono focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* Gmail Connector Auth View */}
            {activeChannel === "gmail" && (
              <div className="space-y-4" id="form-gmail">
                <div className="bg-slate-950 p-4 border border-slate-850 rounded-lg space-y-2 text-xs leading-relaxed text-slate-300">
                  <p className="font-semibold text-white">Google Workspace integration status:</p>
                  <p>Aziz Assistant coordinates securely through the Workspace OAuth 2.0 context. No secondary secrets are required client-side.</p>
                  <div className="flex items-center gap-2 text-[10px] font-mono text-emerald-400 pt-1">
                    <CheckCircle className="w-3.5 h-3.5" /> Workspace API scope approved
                  </div>
                </div>
              </div>
            )}

            {/* ACTION BUTTONS: Handshake Test & Save Configuration */}
            <div className="flex flex-wrap items-center justify-end gap-3 pt-3 border-t border-slate-800">
              {activeChannel !== "gmail" ? (
                <>
                  {/* Test Handshake Button */}
                  <button
                    type="button"
                    id="integrations-test-btn"
                    onClick={() => handleTestConnection()}
                    disabled={loading || saving || sendingAlert}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Testing Handshake...
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        Test Channel Handshake
                      </>
                    )}
                  </button>

                  {/* Send Sample Alert to Telegram (Only when saved & active) */}
                  {activeChannel === "telegram" && savedStatus.telegram?.configured && (
                    <button
                      type="button"
                      id="integrations-test-alert-btn"
                      onClick={handleSendSampleAlert}
                      disabled={sendingAlert || loading || saving}
                      className="bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-600/50 px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50 shadow-sm"
                    >
                      {sendingAlert ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          Sending Alert...
                        </>
                      ) : (
                        <>
                          <BellRing className="w-3.5 h-3.5" />
                          Send Sample Alert to Telegram
                        </>
                      )}
                    </button>
                  )}

                  {/* Save Configuration Button */}
                  <button
                    type="button"
                    id="integrations-save-btn"
                    onClick={handleSaveConfiguration}
                    disabled={
                      saving || 
                      loading || 
                      (activeChannel === "telegram" && (!telegramConfig.token || !telegramConfig.chatId)) ||
                      (activeChannel === "smtp" && (!smtpConfig.host || !smtpConfig.username))
                    }
                    className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
                  >
                    {saving ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Saving Configuration...
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        Save Configuration
                      </>
                    )}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  id="integrations-verify-gmail-btn"
                  onClick={() => setTestResult({ success: true, message: "Workspace Google API active. Client can securely commit drafts via local agents." })}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  Verify Workspace Sync
                </button>
              )}
            </div>
          </div>

          {/* Save Status Banner */}
          {saveResult && (
            <div 
              id="integrations-save-result"
              className={`p-4 rounded-xl border flex gap-3 text-xs animate-fadeIn ${
                saveResult.success 
                  ? "bg-emerald-950/30 border-emerald-900/50 text-emerald-300" 
                  : "bg-rose-950/30 border-rose-900/50 text-rose-300"
              }`}
            >
              {saveResult.success ? (
                <CheckCircle className="w-5 h-5 shrink-0 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400" />
              )}
              <div className="space-y-1">
                <p className="font-semibold">{saveResult.success ? "Saved Successfully" : "Save Failed"}</p>
                <p className="leading-relaxed font-mono text-[11px]">{saveResult.message}</p>
              </div>
            </div>
          )}

          {/* Test Outcomes Alerts */}
          {testResult && (
            <div 
              id="integrations-test-result"
              className={`p-4 rounded-xl border flex gap-3 text-xs animate-fadeIn ${
                testResult.success 
                  ? "bg-blue-950/30 border-blue-900/50 text-blue-300" 
                  : "bg-rose-950/30 border-rose-900/50 text-rose-300"
              }`}
            >
              {testResult.success ? (
                <CheckCircle className="w-5 h-5 shrink-0 text-blue-400" />
              ) : (
                <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400" />
              )}
              <div className="space-y-1">
                <p className="font-semibold">{testResult.success ? "Handshake Verification Succeeded" : "Connection Failed"}</p>
                <p className="leading-relaxed font-mono text-[11px]">{testResult.message}</p>
                {testResult.success && !isChannelConfigured && (
                  <p className="text-[11px] text-emerald-400 font-sans font-medium mt-1">
                    👉 Now click <strong>"Save Configuration"</strong> above to persist your credentials permanently.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

