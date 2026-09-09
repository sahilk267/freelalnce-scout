/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from "fs";
import path from "path";
import { SQLiteFreelancerRepository } from "../repositories/SQLiteFreelancerRepository";
import { FreelancerNotification, NormalizedFreelanceProject, FreelanceProposal } from "../agent/freelancerTypes";
import { resolveDirectJobUrl } from "../utils/projectUrlHelper";

export class NotificationService {
  constructor(private freelanceRepo: SQLiteFreelancerRepository) {}

  public sendNotification(
    type: "MATCH" | "APPROVAL_REQUIRED" | "SUBMISSION" | "SYSTEM" | "ERROR",
    message: string,
    projectId?: string | null,
    proposalId?: string | null
  ): void {
    const notification: FreelancerNotification = {
      id: `notif-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      type,
      message,
      projectId,
      proposalId,
      read: false,
      createdAt: new Date().toISOString()
    };

    try {
      this.freelanceRepo.saveNotification(notification);
      this.freelanceRepo.addLog(
        type === "ERROR" ? "error" : type === "SUBMISSION" ? "success" : "info",
        `[Notification] [${type}] ${message}`
      );
    } catch (e) {
      console.error("[NotificationService] Failed to persist notification:", e);
    }

    // Non-blocking background dispatch to Telegram if configured
    this.dispatchTelegramNotification(type, message, projectId, proposalId).catch((err) => {
      console.warn("[NotificationService] Telegram dispatch error (non-fatal):", err?.message || err);
    });
  }

  private async dispatchTelegramNotification(
    type: "MATCH" | "APPROVAL_REQUIRED" | "SUBMISSION" | "SYSTEM" | "ERROR",
    message: string,
    projectId?: string | null,
    proposalId?: string | null
  ): Promise<void> {
    try {
      const configPath = path.join(process.cwd(), "data", "integrations.json");
      if (!fs.existsSync(configPath)) {
        return;
      }
      const raw = fs.readFileSync(configPath, "utf-8");
      const config = JSON.parse(raw);

      const telegram = config?.telegram;
      if (!telegram?.configured || !telegram?.token || !telegram?.chatId) {
        return;
      }

      let project: NormalizedFreelanceProject | null = null;
      let proposal: FreelanceProposal | null = null;

      if (projectId) {
        try {
          project = this.freelanceRepo.getProject(projectId);
        } catch {}
      }

      if (proposalId) {
        try {
          proposal = this.freelanceRepo.getProposal(proposalId);
        } catch {}
      }

      let text = "";

      switch (type) {
        case "MATCH":
          const directListingUrl = project ? resolveDirectJobUrl({
            source: project.source,
            title: project.title,
            skills: project.skills,
            projectUrl: project.projectUrl,
            id: project.id
          }) : "";
          text = `🎯 *HIGH-VALUE FREELANCE MATCH!*\n\n` +
                 `📌 *Role:* ${project ? project.title : message}\n` +
                 `💼 *Platform:* ${project ? project.source : "Freelance Network"}\n` +
                 `💰 *Budget:* ${project ? project.budget : "Negotiable"} (${project?.hourlyOrFixed || "contract"})\n` +
                 `⭐ *Score:* ${project?.score ? `${project.score}/100` : "80+"}\n` +
                 (project?.skills && project.skills.length > 0 ? `🛠 *Skills:* ${project.skills.slice(0, 5).join(", ")}\n` : "") +
                 (directListingUrl ? `\n🔗 [Open Direct Contract Listing](${directListingUrl})` : "");
          break;

        case "APPROVAL_REQUIRED":
          text = `📝 *PROPOSAL PENDING HUMAN APPROVAL*\n\n` +
                 `📌 *Project:* ${project ? project.title : (proposal?.title || "Draft Proposal")}\n` +
                 `💼 *Source:* ${project ? project.source : "Freelance Platform"}\n` +
                 `💰 *Budget / Rate:* ${project?.budget || "Market Rate"}\n` +
                 `🎨 *Tone:* ${proposal?.tone || "Professional"}\n\n` +
                 `⚡ _Log into your Aziz Assistant Dashboard to review and approve submission._`;
          break;

        case "SUBMISSION":
          text = `🚀 *PROPOSAL SUBMITTED SAFELY!*\n\n` +
                 `📌 *Project:* ${project ? project.title : "Client Bid"}\n` +
                 `💼 *Platform:* ${project ? project.source : "Marketplace"}\n` +
                 `⏱ *Submitted At:* ${new Date().toLocaleTimeString()}\n\n` +
                 `✅ Submission confirmed by Autonomous Agent.`;
          break;

        case "ERROR":
          text = `⚠️ *Aziz Assistant Alert: Issue Encountered*\n\n${message}`;
          break;

        default:
          text = `🤖 *Aziz Assistant Update*\n\n${message}`;
          break;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(`https://api.telegram.org/bot${encodeURIComponent(telegram.token)}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: telegram.chatId,
          text,
          parse_mode: "Markdown"
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        // Fallback without parse_mode so formatting or markdown parse issues never drop the notification
        const fallbackController = new AbortController();
        const fallbackTimeout = setTimeout(() => fallbackController.abort(), 6000);
        await fetch(`https://api.telegram.org/bot${encodeURIComponent(telegram.token)}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: telegram.chatId,
            text: text.replace(/[*_`[\]()]/g, "")
          }),
          signal: fallbackController.signal
        });
        clearTimeout(fallbackTimeout);
      }
    } catch (err: any) {
      console.warn("[NotificationService] Telegram dispatch error (non-fatal):", err?.message || err);
    }
  }

  public notifyMatch(project: NormalizedFreelanceProject, score: number): void {
    const message = `High-value match discovered! "${project.title}" on ${project.source} scored ${score}% compatibility.`;
    this.sendNotification("MATCH", message, project.id);
  }

  public notifyApprovalRequired(project: NormalizedFreelanceProject, proposal: FreelanceProposal): void {
    const message = `Proposal bid generated and pending your human review: "${project.title}" (${project.budget}).`;
    this.sendNotification("APPROVAL_REQUIRED", message, project.id, proposal.id);
  }

  public notifySubmission(project: NormalizedFreelanceProject, proposal: FreelanceProposal): void {
    const message = `Proposal bid submitted successfully to ${project.source} for "${project.title}"!`;
    this.sendNotification("SUBMISSION", message, project.id, proposal.id);
  }

  public notifyError(message: string): void {
    this.sendNotification("ERROR", message);
  }

  public notifySystem(message: string): void {
    this.sendNotification("SYSTEM", message);
  }
}
