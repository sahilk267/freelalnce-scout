/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from "fs";
import path from "path";
import { DIContainer } from "../di/DIContainer";
import { SQLiteFreelancerRepository } from "../repositories/SQLiteFreelancerRepository";
import { ICandidateRepository } from "../repositories/ICandidateRepository";
import { AgentManager } from "../agent/AgentManager";
import { TaskQueue } from "../agent/TaskQueue";
import { Task } from "../agent/types";
import { ResumeParserService } from "./ResumeParserService";
import { FreelancerAgent } from "../agent/FreelancerAgent";
import { CompanyProfileService } from "./CompanyProfileService";
import { CompanyProfile } from "../../types";
import { resolveDirectJobUrl } from "../utils/projectUrlHelper";

export class TelegramBotService {
  private static instance: TelegramBotService;
  private isRunning = false;
  private lastUpdateId = 0;
  private isPolling = false;
  private pollTimer: NodeJS.Timeout | null = null;
  private parserService: ResumeParserService;

  private constructor() {
    this.parserService = new ResumeParserService();
  }

  public static getInstance(): TelegramBotService {
    if (!TelegramBotService.instance) {
      TelegramBotService.instance = new TelegramBotService();
    }
    return TelegramBotService.instance;
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log("[TelegramBotService] Interactive Telegram Bot Command Listener started.");
    this.scheduleNextPoll(1000);
  }

  public stop(): void {
    this.isRunning = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    console.log("[TelegramBotService] Interactive Telegram Bot Listener stopped.");
  }

  private scheduleNextPoll(delayMs = 3000): void {
    if (!this.isRunning) return;
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.pollTimer = setTimeout(() => {
      this.pollCycle().catch((err) => {
        console.warn("[TelegramBotService] Error in poll cycle:", err?.message || err);
      }).finally(() => {
        if (this.isRunning) {
          this.scheduleNextPoll(3000);
        }
      });
    }, delayMs);
  }

  private loadConfig(): { token?: string; chatId?: string; configured?: boolean } | null {
    try {
      const configPath = path.join(process.cwd(), "data", "integrations.json");
      if (!fs.existsSync(configPath)) return null;
      const raw = fs.readFileSync(configPath, "utf-8");
      const data = JSON.parse(raw);
      return data?.telegram || null;
    } catch {
      return null;
    }
  }

  private saveTelegramChatId(chatId: string): boolean {
    try {
      const configPath = path.join(process.cwd(), "data", "integrations.json");
      if (!fs.existsSync(configPath)) return false;
      const raw = fs.readFileSync(configPath, "utf-8");
      const data = JSON.parse(raw);
      if (!data.telegram) data.telegram = {};
      data.telegram.chatId = String(chatId);
      data.telegram.configured = true;
      data.telegram.updatedAt = new Date().toISOString();
      fs.writeFileSync(configPath, JSON.stringify(data, null, 2), "utf-8");
      return true;
    } catch (e) {
      console.error("[TelegramBotService] Failed to save updated chatId:", e);
      return false;
    }
  }

  private getTargetCompany(chatId: string | number): CompanyProfile | null {
    try {
      const compService = CompanyProfileService.getInstance();
      const companies = compService.getAll();
      const strChatId = String(chatId);
      return (
        companies.find((c) => String(c.telegramChatId) === strChatId && c.status === "active") ||
        companies.find((c) => c.isPrimary && c.status === "active") ||
        companies.find((c) => c.status === "active") ||
        companies[0] ||
        null
      );
    } catch {
      return null;
    }
  }

  private async pollCycle(): Promise<void> {
    if (this.isPolling) return;
    const config = this.loadConfig();
    if (!config?.token) return;

    this.isPolling = true;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const offsetParam = this.lastUpdateId > 0 ? `?offset=${this.lastUpdateId}&limit=10` : `?limit=10`;
      const res = await fetch(`https://api.telegram.org/bot${encodeURIComponent(config.token)}/getUpdates${offsetParam}`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const data: any = await res.json();
      if (!data.ok || !Array.isArray(data.result)) {
        return;
      }

      for (const update of data.result) {
        if (update.update_id >= this.lastUpdateId) {
          this.lastUpdateId = update.update_id + 1;
        }

        const msg = update.message || update.channel_post;
        if (!msg || !msg.text) continue;

        await this.handleIncomingMessage(config.token, msg);
      }
    } catch {
      // Non-fatal, retry next cycle
    } finally {
      this.isPolling = false;
    }
  }

  private async sendMessage(token: string, chatId: string | number, text: string): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(`https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: "Markdown"
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      const data: any = await res.json();
      if (data.ok) return true;

      console.warn("[TelegramBotService] Markdown send failed, retrying plain text:", data?.description);
      // Fallback: Strip markdown syntax and send as plain text
      const fallbackController = new AbortController();
      const fallbackTimeout = setTimeout(() => fallbackController.abort(), 6000);
      const fallbackRes = await fetch(`https://api.telegram.org/bot${encodeURIComponent(token)}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: text.replace(/[*_`[\]()]/g, "")
        }),
        signal: fallbackController.signal
      });
      clearTimeout(fallbackTimeout);
      const fallbackData: any = await fallbackRes.json();
      return !!fallbackData.ok;
    } catch (e) {
      console.warn("[TelegramBotService] Failed to send Telegram reply:", e);
      return false;
    }
  }

  private async handleIncomingMessage(token: string, msg: any): Promise<void> {
    const rawText = (msg.text || "").trim();
    const chatId = msg.chat?.id;
    if (!chatId) return;

    // Only process slash commands
    if (!rawText.startsWith("/")) return;

    const parts = rawText.split(/\s+/);
    // Strip bot mention if in group e.g. /status@AzizBot -> /status
    const command = (parts[0] || "").toLowerCase().split("@")[0];
    const args = rawText.substring(parts[0].length).trim();

    const freelanceRepo = DIContainer.get<SQLiteFreelancerRepository>("SQLiteFreelancerRepository");
    const candidateRepo = DIContainer.get<ICandidateRepository>("ICandidateRepository");

    switch (command) {
      case "/start":
      case "/help": {
        const welcomeText =
          `🤖 *Aziz Assistant — Autonomous Freelance Bot*\n\n` +
          `Welcome! You can control your freelance intelligence pipeline directly from this chat:\n\n` +
          `📌 */connect_here* — Connect this group/chat for all automated freelance alerts\n` +
          `📊 */status* — View current scout daemon, matching profile & metrics\n` +
          `🛠 */skills <skill1, skill2, ...>* — Update target skills for accurate job matching\n` +
          `💼 */portfolio <link or text>* — Save your portfolio & work showcases\n` +
          `📄 */resume <text>* — Analyze and import CV highlights into your profile\n` +
          `🔎 */scout* — Run autonomous scraper across 40+ platforms right now\n` +
          `📋 */jobs* — Show top 5 recent high-value matched contracts\n` +
          `🆔 */id* — View this chat's numeric ID\n\n` +
          `💡 *Quick Setup Tip:* Type \`/connect_here\` in your group so all high-value deals arrive here!`;

        await this.sendMessage(token, chatId, welcomeText);
        break;
      }

      case "/connect_here": {
        const isGroup = String(chatId).startsWith("-");
        const title = msg.chat?.title || "Direct Chat";
        const saved = this.saveTelegramChatId(String(chatId));

        if (saved) {
          const reply =
            `🎉 *Destination Connected Successfully!*\n\n` +
            `📍 *Target:* ${isGroup ? `Group: "${title}"` : "Private Chat"}\n` +
            `🆔 *Chat ID:* \`${chatId}\`\n\n` +
            `⚡ All real-time freelance scout discoveries, high-value contracts (80%+ score), and proposal approvals will be delivered here automatically!`;
          await this.sendMessage(token, chatId, reply);
        } else {
          await this.sendMessage(token, chatId, `⚠️ Failed to save chat configuration. Check server permissions.`);
        }
        break;
      }

      case "/id": {
        const isGroup = String(chatId).startsWith("-");
        const type = msg.chat?.type || (isGroup ? "group" : "private");
        const title = msg.chat?.title || [msg.chat?.first_name, msg.chat?.last_name].filter(Boolean).join(" ") || "Personal Chat";

        const reply =
          `🆔 *Telegram Chat Details*\n\n` +
          `• *Title:* ${title}\n` +
          `• *Type:* ${type}\n` +
          `• *Chat ID:* \`${chatId}\`\n\n` +
          `💡 _Tip: You can use \`/connect_here\` to automatically direct all freelance alerts to this destination._`;
        await this.sendMessage(token, chatId, reply);
        break;
      }

      case "/skills": {
        const targetCompany = this.getTargetCompany(chatId);
        const compService = CompanyProfileService.getInstance();

        if (!args) {
          let currentSkills: string[] = [];
          if (targetCompany && targetCompany.targetKeywords?.length > 0) {
            currentSkills = targetCompany.targetKeywords;
          } else {
            try {
              const candidates = await candidateRepo?.getAll();
              if (candidates && candidates.length > 0) {
                currentSkills = candidates[0].skills || [];
              }
            } catch {}
          }

          if (currentSkills.length === 0) {
            const stored = freelanceRepo?.getMetric("freelancer_skills");
            if (stored) {
              try { currentSkills = JSON.parse(stored); } catch {}
            }
          }

          const compHeader = targetCompany ? `🏢 *Company Profile:* ${targetCompany.name}\n📁 *Active Verticals:* ${targetCompany.categories.join(", ")}\n\n` : "";
          const reply =
            `🛠 *Current Target Freelance Keywords:*\n\n` +
            compHeader +
            (currentSkills.length > 0 ? currentSkills.map(s => `• \`${s}\``).join("\n") : `_No keywords specified yet._`) +
            `\n\n*To update keywords, type:*\n\`/skills Microsoft 365, Active Directory, Windows Server, Networking, Cybersecurity, Remote IT Support\``;
          await this.sendMessage(token, chatId, reply);
          return;
        }

        const newSkills = args
          .split(/[,;\n]+/)
          .map(s => s.trim())
          .filter(s => s.length > 0);

        if (newSkills.length === 0) {
          await this.sendMessage(token, chatId, `⚠️ Please provide at least one valid keyword, e.g. \`/skills Microsoft 365, Windows Server, Active Directory\``);
          return;
        }

        try {
          if (targetCompany) {
            compService.update(targetCompany.id, {
              targetKeywords: newSkills
            });
          }

          if (candidateRepo) {
            const candidates = await candidateRepo.getAll();
            let primaryCand = candidates.length > 0 ? candidates[0] : null;
            if (primaryCand) {
              primaryCand.skills = newSkills;
              await candidateRepo.save(primaryCand);
            } else {
              await candidateRepo.save({
                id: "cand-primary",
                name: targetCompany?.name || "Lead Engineer",
                skills: newSkills,
                experienceYears: 5,
                locationPreference: "Remote"
              });
            }
          }

          if (freelanceRepo) {
            freelanceRepo.saveMetric("freelancer_skills", JSON.stringify(newSkills));
            freelanceRepo.addLog("info", `Target matching keywords updated via Telegram by Chat ID ${chatId}: ${newSkills.join(", ")}`);
          }

          const reply =
            `✅ *Freelance Matching Keywords Updated!*\n\n` +
            (targetCompany ? `🏢 *Company Profile:* ${targetCompany.name}\n📁 *Active Verticals:* ${targetCompany.categories.join(", ")}\n\n` : "") +
            `🎯 *Active Keywords Indexed (${newSkills.length}):*\n` +
            newSkills.map(s => `• \`${s}\``).join("\n") +
            `\n\n🚀 The Autonomous Scout will now prioritize contracts matching your exact selected capabilities! Use \`/scout\` to scan right now.`;
          await this.sendMessage(token, chatId, reply);
        } catch (err: any) {
          await this.sendMessage(token, chatId, `⚠️ Failed to save skills: ${err.message}`);
        }
        break;
      }

      case "/portfolio": {
        if (!args) {
          const currentPortfolio = freelanceRepo?.getMetric("freelancer_portfolio") || "None added yet.";
          const reply =
            `💼 *Current Portfolio Configuration:*\n\n` +
            `${currentPortfolio}\n\n` +
            `*To update, send:*\n\`/portfolio https://github.com/myname or https://myportfolio.dev (Built 15+ React/Node web apps)\``;
          await this.sendMessage(token, chatId, reply);
          return;
        }

        try {
          freelanceRepo?.saveMetric("freelancer_portfolio", args);
          freelanceRepo?.addLog("info", `Portfolio link/summary updated via Telegram: ${args.substring(0, 100)}`);

          const reply =
            `✅ *Portfolio Successfully Updated!*\n\n` +
            `💼 *Saved Showcase:* \n${args}\n\n` +
            `📝 Our proposal generator will reference this portfolio when drafting bids to clients!`;
          await this.sendMessage(token, chatId, reply);
        } catch (err: any) {
          await this.sendMessage(token, chatId, `⚠️ Failed to update portfolio: ${err.message}`);
        }
        break;
      }

      case "/resume": {
        if (!args) {
          await this.sendMessage(
            token,
            chatId,
            `📄 *Upload Resume Highlights*\n\nSend a summary or paste your resume text after the command:\n\n*Example:*\n\`/resume Senior Full-Stack Engineer with 6 years experience in React, TypeScript, Express, PostgreSQL, AWS, and Gemini AI.\``
          );
          return;
        }

        await this.sendMessage(token, chatId, `⏳ *Analyzing resume text & extracting technical skills...*`);

        try {
          const parsed = await this.parserService.parseResume(args);
          const extractedSkills = parsed.skills || [];

          if (extractedSkills.length > 0 && candidateRepo) {
            const candidates = await candidateRepo.getAll();
            let primaryCand = candidates.length > 0 ? candidates[0] : null;
            if (primaryCand) {
              primaryCand.skills = Array.from(new Set([...primaryCand.skills, ...extractedSkills]));
              primaryCand.name = parsed.name || primaryCand.name;
              primaryCand.experienceYears = parsed.experienceYears || primaryCand.experienceYears;
              await candidateRepo.save(primaryCand);
            } else {
              await candidateRepo.save({
                id: "cand-primary",
                name: parsed.name || "Lead Freelancer",
                skills: extractedSkills,
                experienceYears: parsed.experienceYears || 4,
                locationPreference: parsed.locationPreference || "Remote"
              });
            }
          }

          freelanceRepo?.saveMetric("last_resume_text", args.substring(0, 2000));

          const reply =
            `✅ *Resume Successfully Processed!*\n\n` +
            `👤 *Candidate:* ${parsed.name || "Lead Freelancer"}\n` +
            `⏱ *Experience:* ${parsed.experienceYears || 4} Years\n` +
            `📍 *Location Preference:* ${parsed.locationPreference || "Remote"}\n` +
            `🛠 *Extracted Skills (${extractedSkills.length}):*\n` +
            (extractedSkills.length > 0 ? extractedSkills.map(s => `• \`${s}\``).join("\n") : "_No distinct skills parsed._") +
            `\n\n🎯 Skills synced with autonomous scout matching engine!`;
          await this.sendMessage(token, chatId, reply);
        } catch (err: any) {
          await this.sendMessage(token, chatId, `⚠️ Error processing resume: ${err.message}`);
        }
        break;
      }

      case "/status": {
        const targetCompany = this.getTargetCompany(chatId);
        const state = freelanceRepo?.getAgentState();
        const portfolio = freelanceRepo?.getMetric("freelancer_portfolio") || "Not set";
        
        let skills: string[] = [];
        if (targetCompany?.targetKeywords && targetCompany.targetKeywords.length > 0) {
          skills = targetCompany.targetKeywords;
        } else {
          try {
            const candidates = await candidateRepo?.getAll();
            if (candidates && candidates.length > 0) skills = candidates[0].skills || [];
          } catch {}
        }

        const projects = freelanceRepo?.getProjects() || [];
        const proposals = freelanceRepo?.getProposals() || [];
        const pendingProposals = proposals.filter(p => p.status === "Pending Approval");

        let matchedCount = 0;
        if (targetCompany) {
          const compService = CompanyProfileService.getInstance();
          matchedCount = projects.filter(p => compService.evaluateMatch(targetCompany, p).isMatch).length;
        } else {
          matchedCount = projects.filter(p => (p.score || 0) >= 80).length;
        }

        const reply =
          `📊 *Aziz Assistant System Status*\n\n` +
          (targetCompany ? `🏢 *Target Company:* ${targetCompany.name}\n📁 *Active Verticals:* ${targetCompany.categories.join(", ")}\n\n` : "") +
          `🤖 *Scout Daemon:* ${state?.isEnabled ? "🟢 Active & Scheduling" : "🟡 Paused"}\n` +
          `⏱ *Interval:* Every ${state?.intervalMinutes || 15} minutes\n` +
          `📅 *Next Scheduled Run:* ${state?.nextRun ? new Date(state.nextRun).toLocaleTimeString() : "Pending"}\n\n` +
          `🎯 *Active Keywords:* ${skills.length > 0 ? skills.slice(0, 6).join(", ") : "Configured profile keywords"}\n` +
          `💼 *Portfolio:* ${portfolio.length > 60 ? portfolio.substring(0, 60) + "..." : portfolio}\n\n` +
          `📈 *Pipeline Metrics:*\n` +
          `• Total Scanned Projects: *${projects.length}*\n` +
          `• Company Matched Contracts: *${matchedCount}*\n` +
          `• Proposals Pending Review: *${pendingProposals.length}*\n\n` +
          `_Use \`/scout\` to run an immediate job search, or \`/skills\` to adjust match parameters._`;

        await this.sendMessage(token, chatId, reply);
        break;
      }

      case "/scout": {
        const targetCompany = this.getTargetCompany(chatId);
        const compService = CompanyProfileService.getInstance();
        const agentManager = AgentManager.getInstance();

        const searchPromptText = targetCompany
          ? `🔎 *Autonomous Scout Initiated for ${targetCompany.name}!*\n\nScanning global remote job feeds and freelance platforms...\n📁 *Matching Verticals:* ${targetCompany.categories.join(", ")}\n🔍 *Keywords:* ${targetCompany.targetKeywords.slice(0, 5).join(", ")}\n\n_Evaluating compatibility against company criteria... Please wait a moment._`
          : `🔎 *Autonomous Scout Initiated!*\n\nScanning global remote job feeds and freelance platforms...\n\n_Matching against your active skills... Please wait a moment._`;

        await this.sendMessage(token, chatId, searchPromptText);

        const taskId = `task-tg-${Date.now()}`;
        const task: Task = {
          id: taskId,
          agentId: "agent-scout",
          priority: 9,
          createdTime: new Date().toISOString(),
          retries: 0,
          maxRetries: 1,
          currentStep: "Telegram On-Demand Scan",
          progress: 0,
          status: "Running",
          logs: [],
          metadata: { action: "search_and_analyze", triggeredBy: `telegram_${chatId}` }
        };

        try {
          let agent = agentManager.getAgent("agent-scout") as FreelancerAgent;
          if (!agent) {
            agent = new FreelancerAgent("agent-scout", "Freelance Automation Scout");
            agentManager.registerAgent(agent);
          }
          await agent.initialize().catch(() => {});

          freelanceRepo?.addLog("info", `On-demand freelance scout initiated from Telegram Chat ID ${chatId}`);

          // Run scan and scoring
          await agent.execute(task);
          task.status = "Completed";
          task.progress = 100;

          // Retrieve best matching projects
          const rawProjects = freelanceRepo?.getProjects() || [];
          if (rawProjects.length === 0) {
            await this.sendMessage(
              token,
              chatId,
              `📋 *Scout Scan Finished*\n\nNo projects indexed. Try adjusting your target keywords using \`/skills\`.`
            );
            return;
          }

          // Strict company profile matching evaluation
          let qualifiedProjects: Array<any> = [];
          if (targetCompany) {
            for (const proj of rawProjects) {
              const evalRes = compService.evaluateMatch(targetCompany, {
                title: proj.title,
                description: proj.description,
                skills: proj.skills,
                source: proj.source,
                location: proj.location
              });
              if (evalRes.isMatch) {
                qualifiedProjects.push({
                  ...proj,
                  score: evalRes.score,
                  scoreReasons: evalRes.reasons
                });
              }
            }
          } else {
            qualifiedProjects = [...rawProjects];
          }

          // If user gave a query e.g. /scout m365 or /scout windows
          let filtered = qualifiedProjects;
          if (args && args.trim()) {
            const q = args.trim().toLowerCase();
            const matching = filtered.filter(p =>
              (p.title && p.title.toLowerCase().includes(q)) ||
              (p.skills && p.skills.some((s: string) => s.toLowerCase().includes(q))) ||
              (p.source && p.source.toLowerCase().includes(q))
            );
            if (matching.length > 0) {
              filtered = matching;
            }
          }

          if (filtered.length === 0) {
            const compName = targetCompany ? targetCompany.name : "your company";
            const activeCats = targetCompany ? targetCompany.categories.join(", ") : "configured verticals";
            await this.sendMessage(
              token,
              chatId,
              `📋 *Scout Scan Finished for ${compName}*\n\n` +
              `⚠️ No contracts matched your current criteria.\n\n` +
              `• *Active Verticals:* ${activeCats}\n` +
              `• *Target Keywords:* ${targetCompany?.targetKeywords.slice(0, 6).join(", ") || "None"}\n\n` +
              `_Contracts outside your active categories (such as generic software full-developer roles) have been strictly excluded._`
            );
            return;
          }

          const topMatches = filtered
            .sort((a, b) => (b.score || 0) - (a.score || 0))
            .slice(0, 30);

          const chunkSize = 6;
          const totalBatches = Math.ceil(topMatches.length / chunkSize);

          for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
            const batch = topMatches.slice(batchIdx * chunkSize, (batchIdx + 1) * chunkSize);
            let reply = "";

            if (batchIdx === 0) {
              reply += `🎯 *Autonomous Freelance Scout Results*\n\n`;
              if (targetCompany) {
                reply += `🏢 *Company Profile:* ${targetCompany.name}\n`;
                reply += `📁 *Active Verticals:* ${targetCompany.categories.join(", ")}\n`;
                reply += `🔍 *Target Keywords:* ${targetCompany.targetKeywords.slice(0, 5).join(", ")}\n\n`;
              }
              reply += `Scanned *40+ platforms* — displaying *top ${topMatches.length}* verified matching contracts (Part 1/${totalBatches}):\n\n`;
            } else {
              reply += `📋 *Top Matching Contracts (Part ${batchIdx + 1}/${totalBatches} — Contracts ${batchIdx * chunkSize + 1} to ${Math.min((batchIdx + 1) * chunkSize, topMatches.length)} of ${topMatches.length}):*\n\n`;
            }

            for (let i = 0; i < batch.length; i++) {
              const globalIdx = batchIdx * chunkSize + i + 1;
              const p = batch[i];
              const cleanTitle = (p.title || "Project Contract").replace(/[*_`]/g, "");
              const cleanSource = (p.source || "Freelance Platform").replace(/[*_`]/g, "");
              const directUrl = resolveDirectJobUrl({
                source: p.source,
                title: p.title,
                skills: p.skills,
                projectUrl: p.projectUrl,
                id: p.id
              });
              reply +=
                `*${globalIdx}. ${cleanTitle}*\n` +
                `💼 *Platform:* ${cleanSource} | 💰 *Budget:* ${p.budget || "Negotiable"}\n` +
                `⭐ *Compatibility:* ${p.score || 0}%\n` +
                (p.scoreReasons && p.scoreReasons.length > 0 ? `🎯 *Matched:* ${p.scoreReasons.slice(0, 2).join(" • ")}\n` : "") +
                (p.skills && p.skills.length > 0 ? `🛠 *Skills:* ${p.skills.slice(0, 4).join(", ")}\n` : "") +
                `🔗 [Direct Contract Link / Apply](${directUrl})\n\n`;
            }

            if (batchIdx === totalBatches - 1) {
              reply += `💡 _All ${topMatches.length} top contracts scouted! Send \`/skills\` to change target keywords or \`/jobs\` anytime._`;
            }

            await this.sendMessage(token, chatId, reply);
            if (batchIdx < totalBatches - 1) {
              await new Promise(r => setTimeout(r, 300));
            }
          }
        } catch (err: any) {
          freelanceRepo?.addLog("error", `Telegram on-demand scout failed: ${err.message || err}`);
          await this.sendMessage(
            token,
            chatId,
            `⚠️ *Scout Error:* Could not complete search (${err.message || "Execution timeout"}). Please try again shortly.`
          );
        }
        break;
      }

      case "/jobs": {
        const targetCompany = this.getTargetCompany(chatId);
        const compService = CompanyProfileService.getInstance();
        const rawProjects = freelanceRepo?.getProjects() || [];

        if (rawProjects.length === 0) {
          await this.sendMessage(token, chatId, `📋 No projects indexed yet. Send \`/scout\` to scan freelance platforms!`);
          return;
        }

        let qualifiedProjects: Array<any> = [];
        if (targetCompany) {
          for (const proj of rawProjects) {
            const evalRes = compService.evaluateMatch(targetCompany, {
              title: proj.title,
              description: proj.description,
              skills: proj.skills,
              source: proj.source,
              location: proj.location
            });
            if (evalRes.isMatch) {
              qualifiedProjects.push({
                ...proj,
                score: evalRes.score,
                scoreReasons: evalRes.reasons
              });
            }
          }
        } else {
          qualifiedProjects = [...rawProjects];
        }

        if (qualifiedProjects.length === 0) {
          await this.sendMessage(
            token,
            chatId,
            `📋 *No Matching Jobs Available*\n\nAll indexed listings outside ${targetCompany?.name || "your company"}'s active verticals have been filtered out. Send \`/scout\` to refresh!`
          );
          return;
        }

        const topProjects = qualifiedProjects
          .sort((a, b) => (b.score || 0) - (a.score || 0))
          .slice(0, 30);

        const chunkSize = 6;
        const totalBatches = Math.ceil(topProjects.length / chunkSize);

        for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
          const batch = topProjects.slice(batchIdx * chunkSize, (batchIdx + 1) * chunkSize);
          let reply = "";

          if (batchIdx === 0) {
            reply += `📋 *Top Recent High-Scoring Freelance Matches (${topProjects.length} Contracts — Part 1/${totalBatches}):*\n\n`;
            if (targetCompany) {
              reply += `🏢 *Company Profile:* ${targetCompany.name} (${targetCompany.categories.join(", ")})\n\n`;
            }
          } else {
            reply += `📋 *Recent Matches (Part ${batchIdx + 1}/${totalBatches} — Contracts ${batchIdx * chunkSize + 1} to ${Math.min((batchIdx + 1) * chunkSize, topProjects.length)}):*\n\n`;
          }

          for (let i = 0; i < batch.length; i++) {
            const globalIdx = batchIdx * chunkSize + i + 1;
            const p = batch[i];
            const cleanTitle = (p.title || "Project Contract").replace(/[*_`]/g, "");
            const cleanSource = (p.source || "Freelance Platform").replace(/[*_`]/g, "");
            const directUrl = resolveDirectJobUrl({
              source: p.source,
              title: p.title,
              skills: p.skills,
              projectUrl: p.projectUrl,
              id: p.id
            });
            reply +=
              `*${globalIdx}. ${cleanTitle}*\n` +
              `💼 *Platform:* ${cleanSource} | 💰 *Budget:* ${p.budget || "Negotiable"}\n` +
              `⭐ *Score:* ${p.score || 0}/100\n` +
              (p.scoreReasons && p.scoreReasons.length > 0 ? `🎯 *Matched:* ${p.scoreReasons.slice(0, 2).join(" • ")}\n` : "") +
              (p.skills && p.skills.length > 0 ? `🛠 *Skills:* ${p.skills.slice(0, 4).join(", ")}\n` : "") +
              `🔗 [Direct Contract Link / Apply](${directUrl})\n\n`;
          }

          if (batchIdx === totalBatches - 1) {
            reply += `💡 _Send \`/scout\` to refresh and discover new opportunities._`;
          }

          await this.sendMessage(token, chatId, reply);
          if (batchIdx < totalBatches - 1) {
            await new Promise(r => setTimeout(r, 300));
          }
        }
        break;
      }

      default: {
        await this.sendMessage(
          token,
          chatId,
          `❓ Unknown command: \`${command}\`. Send \`/help\` to see available commands.`
        );
        break;
      }
    }
  }
}
