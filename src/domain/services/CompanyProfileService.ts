/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from "fs";
import path from "path";
import { CompanyProfile, FreelanceCategory } from "../../types";

const COMPANIES_FILE = path.join(process.cwd(), "data", "companies.json");

export const SUPPORTED_FREELANCE_CATEGORIES: {
  name: FreelanceCategory;
  description: string;
  samplePlatforms: string[];
  sampleSkills: string[];
}[] = [
  {
    name: "Writing & Content",
    description: "ProBlogger, Content Writing Jobs, FreelanceWritingGigs (Copywriting, SEO Blogs, Ghostwriting)",
    samplePlatforms: ["ProBlogger", "Content Writing Jobs", "FreelanceWritingGigs", "FlexJobs"],
    sampleSkills: ["Copywriting", "SEO Blogs", "Ghostwriting", "Technical Writing", "Whitepapers", "Article Writing"]
  },
  {
    name: "Design & Creative",
    description: "Behance, Designhill, 99designs (UI/UX, Logo Design, 3D, Figma)",
    samplePlatforms: ["Behance", "Designhill", "99designs", "Dribbble", "Fiverr Pro"],
    sampleSkills: ["UI/UX", "Logo Design", "3D Modeling", "Figma", "Brand Identity", "Vector Illustration"]
  },
  {
    name: "Virtual Assistant & Tasks",
    description: "Zirtual, OnlineJobs.ph, SkipTheDrive (Data Entry, Customer Support, Admin)",
    samplePlatforms: ["Zirtual", "OnlineJobs.ph", "SkipTheDrive", "TaskRabbit"],
    sampleSkills: ["Data Entry", "Customer Support", "Admin Support", "Executive Assistant", "Calendar Scheduling"]
  },
  {
    name: "Digital Marketing",
    description: "SEO, Meta Ads, Google Ads, Lead Generation",
    samplePlatforms: ["Upwork", "CloudPeeps", "Hubstaff Talent", "Jobspresso"],
    sampleSkills: ["SEO", "Meta Ads", "Google Ads", "Lead Generation", "Growth Marketing", "Email Outreach"]
  },
  {
    name: "Video Editing & Media",
    description: "Premiere Pro, After Effects, YouTube Editing",
    samplePlatforms: ["YouTube Jobs", "Behance", "Freelancer.com", "Fiverr Pro"],
    sampleSkills: ["Premiere Pro", "After Effects", "YouTube Editing", "Motion Graphics", "Color Grading"]
  },
  {
    name: "Tech & Software",
    description: "Full-Stack, AI, DevOps",
    samplePlatforms: ["LinkedIn Jobs", "Upwork", "RemoteOK", "We Work Remotely", "Toptal"],
    sampleSkills: ["Full-Stack", "AI", "DevOps", "React", "Node.js", "TypeScript", "Python", "Cloud"]
  },
  {
    name: "Aaditech Solution – IT & Infrastructure",
    description: "Microsoft 365, Windows Server, Active Directory, Networking, Cybersecurity, Remote IT Support, Automation, AI",
    samplePlatforms: ["Spiceworks", "LinkedIn IT Jobs", "Indeed", "Upwork Enterprise", "Guru", "Freelancer"],
    sampleSkills: [
      "Microsoft 365",
      "Exchange Online",
      "Active Directory (AD)",
      "Windows Server",
      "System Administration",
      "Network Engineering",
      "Firewall",
      "VPN",
      "Cloud Migration",
      "Remote IT Support",
      "Cybersecurity",
      "AI Automation",
      "Python Automation"
    ]
  }
];

const DEFAULT_COMPANIES: CompanyProfile[] = [
  {
    id: "aaditechs-primary",
    name: "Aaditech Solution",
    website: "https://aaditechs.in/",
    description: "Enterprise IT & Infrastructure, Computer Hardware, Network Engineering, System Administration & Remote Technical Support",
    isPrimary: true,
    categories: [
      "Aaditech Solution – IT & Infrastructure"
    ],
    targetKeywords: [
      "Computer Hardware",
      "Hardware Troubleshooting",
      "PC Assembly",
      "Desktop Support",
      "Laptop Repair",
      "Networking",
      "Network Engineering",
      "Network Administration",
      "System Administration",
      "SysAdmin",
      "IT Infrastructure",
      "IT Support",
      "Windows Server",
      "Linux Server",
      "Active Directory",
      "Domain Controller",
      "Microsoft 365",
      "Exchange Online",
      "Firewall",
      "VPN",
      "Cisco",
      "Fortinet",
      "MikroTik",
      "Ubiquiti",
      "Router & Switch",
      "LAN",
      "WAN",
      "DNS",
      "DHCP",
      "CCTV",
      "Biometric",
      "Server Maintenance",
      "Virtualization",
      "VMware",
      "Hyper-V",
      "Cloud Migration",
      "Cybersecurity",
      "Remote IT Support",
      "Data Backup",
      "Printer Support"
    ],
    negativeKeywords: [
      "React",
      "Next.js",
      "Vue",
      "Angular",
      "Frontend",
      "Front-End",
      "Backend Developer",
      "Full-Stack",
      "Fullstack",
      "Full Stack",
      "Web Developer",
      "Web Development",
      "Website Design",
      "PHP",
      "WordPress",
      "Shopify",
      "Mobile App",
      "iOS Developer",
      "Android Developer",
      "Flutter",
      "React Native",
      "Java Developer",
      "Python Flask",
      "Flask Web",
      "Django",
      "Software Development",
      "Data Entry",
      "Virtual Assistant",
      "Typing",
      "Cold Calling",
      "Copy Paste",
      "Content Writing",
      "Graphic Design",
      "Logo Design",
      "SEO Blogs"
    ],
    physicalLocations: [
      "Mumbai",
      "Navi Mumbai",
      "Thane",
      "MMR"
    ],
    allowRemote: true,
    telegramEnabled: true,
    telegramChatId: "-1003793331993",
    hostingerEnabled: true,
    hostingerEmail: "contact@aaditechs.in",
    gmailEnabled: true,
    gmailEmail: "sahil.k00267@gmail.com",
    status: "active",
    leadsCount: 137,
    lastScoutedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export class CompanyProfileService {
  private static instance: CompanyProfileService;

  public static getInstance(): CompanyProfileService {
    if (!CompanyProfileService.instance) {
      CompanyProfileService.instance = new CompanyProfileService();
    }
    return CompanyProfileService.instance;
  }

  public getAll(): CompanyProfile[] {
    try {
      if (fs.existsSync(COMPANIES_FILE)) {
        const raw = fs.readFileSync(COMPANIES_FILE, "utf-8");
        const list = JSON.parse(raw);
        if (Array.isArray(list) && list.length > 0) {
          return list.map((c: any) => ({
            ...c,
            telegramEnabled: c.telegramEnabled !== false,
            telegramChatId: c.telegramChatId || "-1003793331993",
            hostingerEnabled: c.hostingerEnabled !== false,
            hostingerEmail: c.hostingerEmail || "contact@aaditechs.in",
            gmailEnabled: c.gmailEnabled !== false,
            gmailEmail: c.gmailEmail || "sahil.k00267@gmail.com",
            categories: (c.categories && c.categories.length > 0) ? c.categories : ["Aaditech Solution – IT & Infrastructure", "Tech & Software"],
            allowRemote: c.allowRemote !== false
          }));
        }
      }
    } catch (err) {
      console.error("Error reading companies.json:", err);
    }
    this.saveAll(DEFAULT_COMPANIES);
    return DEFAULT_COMPANIES;
  }

  public getById(id: string): CompanyProfile | undefined {
    return this.getAll().find((c) => c.id === id);
  }

  public getPrimary(): CompanyProfile | undefined {
    const list = this.getAll();
    return list.find((c) => c.isPrimary && c.status === "active") || list.find((c) => c.status === "active") || list[0];
  }

  private validateNotificationTargets(targets: { hostingerEmail?: string; gmailEmail?: string; telegramChatId?: string }) {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (targets.hostingerEmail && !emailRegex.test(targets.hostingerEmail)) {
      throw new Error("Invalid Hostinger notification email format.");
    }
    if (targets.gmailEmail && !emailRegex.test(targets.gmailEmail)) {
      throw new Error("Invalid Gmail notification email format.");
    }
    if (targets.telegramChatId && !/^-?[0-9a-zA-Z_]+$/.test(targets.telegramChatId)) {
      throw new Error("Invalid Telegram Chat ID format. Must contain only digits, hyphen, or standard characters.");
    }
  }

  public create(data: Partial<CompanyProfile>): CompanyProfile {
    const list = this.getAll();
    const id = data.id || `comp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    
    // Validate notification targets
    this.validateNotificationTargets({
      hostingerEmail: data.hostingerEmail?.trim(),
      gmailEmail: data.gmailEmail?.trim(),
      telegramChatId: data.telegramChatId?.trim()
    });

    // If marked as primary, demote any existing primary
    if (data.isPrimary) {
      list.forEach((c) => (c.isPrimary = false));
    }

    const newCompany: CompanyProfile = {
      id,
      name: data.name?.trim() || "Untitled Agency",
      website: data.website?.trim() || "",
      description: data.description?.trim() || "",
      isPrimary: Boolean(data.isPrimary),
      categories: (data.categories && data.categories.length > 0) ? data.categories : ["Aaditech Solution – IT & Infrastructure", "Tech & Software"],
      targetKeywords: (data.targetKeywords || []).map((k) => k.trim()).filter(Boolean),
      negativeKeywords: (data.negativeKeywords || []).map((k) => k.trim()).filter(Boolean),
      physicalLocations: (data.physicalLocations && data.physicalLocations.length > 0) 
        ? data.physicalLocations.map((l) => l.trim()).filter(Boolean)
        : ["Mumbai", "Navi Mumbai", "Thane"],
      allowRemote: data.allowRemote !== false,
      telegramEnabled: data.telegramEnabled !== false,
      telegramChatId: data.telegramChatId?.trim() || "-1003793331993",
      telegramTopicId: data.telegramTopicId?.trim() || "",
      hostingerEnabled: data.hostingerEnabled !== false,
      hostingerEmail: data.hostingerEmail?.trim() || "contact@aaditechs.in",
      gmailEnabled: data.gmailEnabled !== false,
      gmailEmail: data.gmailEmail?.trim() || "sahil.k00267@gmail.com",
      email: data.email?.trim() || "",
      status: data.status === "paused" ? "paused" : "active",
      leadsCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    list.push(newCompany);
    this.saveAll(list);
    return newCompany;
  }

  public update(id: string, updates: Partial<CompanyProfile>): CompanyProfile | null {
    const list = this.getAll();
    const idx = list.findIndex((c) => c.id === id);
    if (idx === -1) return null;

    // Validate notification targets if provided
    this.validateNotificationTargets({
      hostingerEmail: updates.hostingerEmail !== undefined ? updates.hostingerEmail.trim() : undefined,
      gmailEmail: updates.gmailEmail !== undefined ? updates.gmailEmail.trim() : undefined,
      telegramChatId: updates.telegramChatId !== undefined ? updates.telegramChatId.trim() : undefined
    });

    if (updates.isPrimary) {
      list.forEach((c) => (c.isPrimary = false));
    }

    const current = list[idx];
    const updated: CompanyProfile = {
      ...current,
      ...updates,
      id: current.id, // Immutable ID
      name: updates.name ? updates.name.trim() : current.name,
      website: updates.website !== undefined ? updates.website.trim() : current.website,
      description: updates.description !== undefined ? updates.description.trim() : current.description,
      categories: updates.categories || current.categories,
      targetKeywords: updates.targetKeywords !== undefined 
        ? updates.targetKeywords.map((k) => k.trim()).filter(Boolean)
        : current.targetKeywords,
      negativeKeywords: updates.negativeKeywords !== undefined 
        ? updates.negativeKeywords.map((k) => k.trim()).filter(Boolean)
        : current.negativeKeywords,
      physicalLocations: updates.physicalLocations !== undefined
        ? updates.physicalLocations.map((l) => l.trim()).filter(Boolean)
        : current.physicalLocations,
      allowRemote: updates.allowRemote !== undefined ? updates.allowRemote : current.allowRemote,
      telegramEnabled: updates.telegramEnabled !== undefined ? updates.telegramEnabled : (current.telegramEnabled !== false),
      telegramChatId: updates.telegramChatId !== undefined ? updates.telegramChatId.trim() : (current.telegramChatId || ""),
      telegramTopicId: updates.telegramTopicId !== undefined ? updates.telegramTopicId.trim() : current.telegramTopicId,
      hostingerEnabled: updates.hostingerEnabled !== undefined ? updates.hostingerEnabled : (current.hostingerEnabled !== false),
      hostingerEmail: updates.hostingerEmail !== undefined ? updates.hostingerEmail.trim() : (current.hostingerEmail || "contact@aaditechs.in"),
      gmailEnabled: updates.gmailEnabled !== undefined ? updates.gmailEnabled : (current.gmailEnabled !== false),
      gmailEmail: updates.gmailEmail !== undefined ? updates.gmailEmail.trim() : (current.gmailEmail || "sahil.k00267@gmail.com"),
      status: updates.status || current.status,
      updatedAt: new Date().toISOString()
    };

    list[idx] = updated;
    this.saveAll(list);
    return updated;
  }

  public delete(id: string): boolean {
    const list = this.getAll();
    const filtered = list.filter((c) => c.id !== id);
    if (filtered.length === list.length) return false;

    // Ensure at least one primary remains if any companies are left
    if (filtered.length > 0 && !filtered.some((c) => c.isPrimary)) {
      filtered[0].isPrimary = true;
    }

    this.saveAll(filtered);
    return true;
  }

  public incrementLeadsCount(companyId: string, count = 1): void {
    const list = this.getAll();
    const comp = list.find((c) => c.id === companyId);
    if (comp) {
      comp.leadsCount = (comp.leadsCount || 0) + count;
      comp.lastScoutedAt = new Date().toISOString();
      this.saveAll(list);
    }
  }

  /**
   * Matches a freelance job/project against a company profile.
   * Returns match score (0-100), reasons, and qualification status.
   */
  public evaluateMatch(company: CompanyProfile, project: {
    title: string;
    description: string;
    skills?: string[];
    source?: string;
    location?: string;
  }): { isMatch: boolean; score: number; reasons: string[] } {
    if (company.status === "paused") {
      return { isMatch: false, score: 0, reasons: ["Company profile is currently paused."] };
    }

    const textToScan = `${project.title || ""} ${project.description || ""} ${(project.skills || []).join(" ")}`.toLowerCase();
    const reasons: string[] = [];

    // 1. Negative keywords exclusion check (Hard veto)
    for (const neg of company.negativeKeywords) {
      if (neg && textToScan.includes(neg.toLowerCase())) {
        return {
          isMatch: false,
          score: 0,
          reasons: [`Filtered out by negative keyword: "${neg}"`]
        };
      }
    }

    // 2. Location & Remote check
    const projectLoc = (project.location || "").toLowerCase();
    const isExplicitlyRemote = projectLoc.includes("remote") || projectLoc.includes("telecommute") || projectLoc.includes("global") || projectLoc.includes("anywhere") || !projectLoc;

    if (!isExplicitlyRemote) {
      // It is an on-site / physical gig
      const matchesPhysical = company.physicalLocations.some((loc) => 
        loc && projectLoc.includes(loc.toLowerCase())
      );
      if (!matchesPhysical) {
        return {
          isMatch: false,
          score: 0,
          reasons: [`Job requires on-site in "${project.location}", outside company target physical regions (${company.physicalLocations.join(", ")})`]
        };
      }
      reasons.push(`On-site location match: ${project.location}`);
    } else {
      if (!company.allowRemote) {
        return {
          isMatch: false,
          score: 0,
          reasons: ["Remote projects are disabled for this company profile."]
        };
      }
      reasons.push("Verified remote / telecommute friendly");
    }

    // 3. Category match check
    // Determine project category from platform or keywords
    const categoryKeywords: Record<FreelanceCategory, string[]> = {
      "Writing & Content": ["writer", "copywriting", "seo blog", "ghostwriter", "content", "article", "editor", "technical writing", "blogs", "problogger"],
      "Design & Creative": ["figma", "ui/ux", "designer", "graphic", "logo", "brand", "illustration", "3d", "vector", "creative", "behance", "designhill", "99designs"],
      "Virtual Assistant & Tasks": ["virtual assistant", "data entry", "admin", "customer support", "excel", "transcription", "helpdesk", "zirtual", "onlinejobs", "skipthedrive"],
      "Digital Marketing": ["marketing", "seo", "google ads", "meta ads", "facebook ads", "lead generation", "lead gen", "growth", "campaign", "ppc"],
      "Video Editing & Media": ["video", "premiere", "after effects", "youtube", "animation", "motion graphics", "audio editing", "video editing"],
      "Tech & Software": ["react", "node", "typescript", "python", "devops", "software", "api", "database", "engineer", "developer", "aws", "docker", "frontend", "backend", "full stack", "full-stack", "ai"],
      "Aaditech Solution – IT & Infrastructure": [
        "computer hardware", "hardware", "pc assembly", "desktop support", "laptop repair", "desktop", "laptop",
        "networking", "network engineering", "network administration", "sysadmin", "system administration",
        "it infrastructure", "it support", "remote it support", "windows server", "linux server", "active directory",
        "ad", "domain controller", "microsoft 365", "m365", "exchange online", "firewall", "vpn", "cisco", "fortinet",
        "mikrotik", "ubiquiti", "router", "switch", "switches", "lan", "wan", "vlan", "dns", "dhcp",
        "cctv", "biometric", "server maintenance", "virtualization", "vmware", "hyper-v", "proxmox", "cloud migration",
        "cybersecurity", "data backup", "printer", "helpdesk"
      ]
    };

    let categoryMatched = false;
    for (const cat of company.categories) {
      const kws = categoryKeywords[cat] || [];
      if (kws.some((k) => textToScan.includes(k))) {
        categoryMatched = true;
        reasons.push(`Category match: ${cat}`);
        break;
      }
    }

    // 4. Keyword relevance scoring
    let keywordHits = 0;
    const hitWords: string[] = [];
    for (const kw of company.targetKeywords) {
      if (kw && textToScan.includes(kw.toLowerCase())) {
        keywordHits++;
        hitWords.push(kw);
      }
    }

    if (keywordHits > 0) {
      reasons.push(`Keywords matched: ${hitWords.slice(0, 4).join(", ")}`);
    }

    // Strict Category Alignment Calculation
    // Base score: 25.
    // If company specified categories, a match MUST align with at least one active category OR have 2+ target keyword hits.
    const hasCategoryFilter = company.categories && company.categories.length > 0;
    
    let score = 25;
    if (categoryMatched) {
      score += 40;
    }
    score += Math.min(35, keywordHits * 10);

    const qualifiesCategory = hasCategoryFilter ? (categoryMatched || keywordHits >= 2) : (keywordHits >= 1);
    const isMatch = qualifiesCategory && score >= 65;

    if (!qualifiesCategory) {
      reasons.push(`Outside company target verticals (${company.categories.join(", ")})`);
    }

    return {
      isMatch,
      score: Math.min(100, Math.max(0, score)),
      reasons
    };
  }

  private saveAll(companies: CompanyProfile[]): void {
    try {
      const dir = path.dirname(COMPANIES_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(COMPANIES_FILE, JSON.stringify(companies, null, 2), "utf-8");
    } catch (err) {
      console.error("Failed to save companies.json:", err);
    }
  }
}
