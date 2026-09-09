/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface RemotePlatformInfo {
  id: string;
  name: string;
  url: string;
  category: "Freelance Gigs" | "Enterprise & Tech" | "Startup & Remote" | "Writing & Content" | "Design & Creative" | "Virtual Assistant & Task";
  description: string;
  isLiveFeedSupported: boolean;
  rssOrApiUrl?: string;
}

export const REMOTE_PLATFORMS_40: RemotePlatformInfo[] = [
  { id: "linkedin", name: "LinkedIn Jobs", url: "https://www.linkedin.com/jobs", category: "Enterprise & Tech", description: "Global professional job network & remote recruiter portal", isLiveFeedSupported: true },
  { id: "indeed", name: "Indeed Remote", url: "https://www.indeed.com", category: "Enterprise & Tech", description: "Worldwide employment aggregator & remote openings", isLiveFeedSupported: true },
  { id: "glassdoor", name: "Glassdoor Jobs", url: "https://www.glassdoor.com", category: "Enterprise & Tech", description: "Company reviews, salaries, and remote job listings", isLiveFeedSupported: true },
  { id: "flexjobs", name: "FlexJobs", url: "https://www.flexjobs.com", category: "Startup & Remote", description: "Hand-screened remote, hybrid, and flexible positions", isLiveFeedSupported: true },
  { id: "weworkremotely", name: "We Work Remotely", url: "https://weworkremotely.com", category: "Startup & Remote", description: "Largest remote work community for tech, design, and product", isLiveFeedSupported: true, rssOrApiUrl: "https://weworkremotely.com/categories/remote-programming-jobs.rss" },
  { id: "remote_co", name: "Remote.co", url: "https://remote.co", category: "Startup & Remote", description: "Curated remote work opportunities across development & ops", isLiveFeedSupported: true },
  { id: "upwork", name: "Upwork", url: "https://www.upwork.com", category: "Freelance Gigs", description: "Global freelance marketplace for tech, design, and writing", isLiveFeedSupported: true, rssOrApiUrl: "https://www.upwork.com/ab/feed/jobs/rss?q=react+typescript" },
  { id: "freelancer", name: "Freelancer.com", url: "https://www.freelancer.com", category: "Freelance Gigs", description: "Global bidding portal for software, design, and marketing", isLiveFeedSupported: true },
  { id: "fiverr", name: "Fiverr / Fiverr Pro", url: "https://www.fiverr.com", category: "Freelance Gigs", description: "Digital services marketplace and vetted pro contractor contracts", isLiveFeedSupported: true },
  { id: "guru", name: "Guru", url: "https://www.guru.com", category: "Freelance Gigs", description: "Flexible freelance platform for developers and digital experts", isLiveFeedSupported: true },
  { id: "toptal", name: "Toptal", url: "https://www.toptal.com", category: "Freelance Gigs", description: "Exclusive network for top 3% freelance software engineers & designers", isLiveFeedSupported: true },
  { id: "wellfound", name: "Wellfound (AngelList)", url: "https://wellfound.com", category: "Startup & Remote", description: "Startup job board connecting candidate talent directly with founders", isLiveFeedSupported: true },
  { id: "hubstaff_talent", name: "Hubstaff Talent", url: "https://talent.hubstaff.com", category: "Freelance Gigs", description: "Zero-fee remote talent and agency marketplace", isLiveFeedSupported: true },
  { id: "simplyhired", name: "SimplyHired", url: "https://www.simplyhired.com", category: "Enterprise & Tech", description: "Job search engine indexing millions of remote opportunities", isLiveFeedSupported: true },
  { id: "remotive", name: "Remotive", url: "https://remotive.com", category: "Startup & Remote", description: "Live API and curated tech remote job board", isLiveFeedSupported: true, rssOrApiUrl: "https://remotive.com/api/remote-jobs?limit=50" },
  { id: "virtual_vocations", name: "Virtual Vocations", url: "https://www.virtualvocations.com", category: "Virtual Assistant & Task", description: "Family-owned remote work database with telecommute jobs", isLiveFeedSupported: true },
  { id: "working_nomads", name: "Working Nomads", url: "https://www.workingnomads.com", category: "Startup & Remote", description: "Curated list of remote jobs for digital nomads", isLiveFeedSupported: true },
  { id: "hired", name: "Hired", url: "https://hired.com", category: "Enterprise & Tech", description: "Reverse job marketplace where companies apply to tech talent", isLiveFeedSupported: true },
  { id: "cloudpeeps", name: "CloudPeeps", url: "https://www.cloudpeeps.com", category: "Freelance Gigs", description: "Freelance network for community managers, content, and growth", isLiveFeedSupported: true },
  { id: "taskrabbit", name: "TaskRabbit", url: "https://taskrabbit.com", category: "Virtual Assistant & Task", description: "Same-day task and virtual assistance gig network", isLiveFeedSupported: true },
  { id: "talent_com", name: "Talent.com", url: "https://www.talent.com", category: "Enterprise & Tech", description: "Centralized global job engine indexing international openings", isLiveFeedSupported: true },
  { id: "remoteok", name: "RemoteOK", url: "https://remoteok.com", category: "Startup & Remote", description: "Automated remote job board for developers, design, and marketing", isLiveFeedSupported: true, rssOrApiUrl: "https://remoteok.com/api" },
  { id: "dremote", name: "DRemote (Dremotech)", url: "https://dremote.io", category: "Startup & Remote", description: "Tech job search for developer & engineering roles", isLiveFeedSupported: true },
  { id: "jooble", name: "Jooble", url: "https://jooble.org", category: "Enterprise & Tech", description: "International vacancy search operating across 70+ countries", isLiveFeedSupported: true },
  { id: "stackoverflow_jobs", name: "Stack Overflow Jobs", url: "https://stackoverflow.com/jobs", category: "Enterprise & Tech", description: "Developer and engineering career ecosystem", isLiveFeedSupported: true },
  { id: "jobspresso", name: "Jobspresso", url: "https://jobspresso.co", category: "Startup & Remote", description: "Expertly curated remote jobs in tech, marketing, and support", isLiveFeedSupported: true },
  { id: "onlinejobs_ph", name: "OnlineJobs.ph", url: "https://www.onlinejobs.ph", category: "Virtual Assistant & Task", description: "Largest portal for virtual assistants, developers, and writers in the Philippines", isLiveFeedSupported: true },
  { id: "simplyhired_global", name: "SimplyHired Global", url: "https://www.simplyhired.com/search?q=remote", category: "Enterprise & Tech", description: "Global remote & hybrid job aggregator", isLiveFeedSupported: true },
  { id: "themuse", name: "The Muse", url: "https://www.themuse.com", category: "Enterprise & Tech", description: "Career platform featuring company culture profiles & remote roles", isLiveFeedSupported: true },
  { id: "skipthedrive", name: "Skip The Drive", url: "https://www.skipthedrive.com", category: "Virtual Assistant & Task", description: "Free remote job board with telecommuting and work-from-home roles", isLiveFeedSupported: true },
  { id: "zirtual", name: "Zirtual", url: "https://www.zirtual.com", category: "Virtual Assistant & Task", description: "Dedicated executive virtual assistant platform", isLiveFeedSupported: true },
  { id: "justremote", name: "JustRemote", url: "https://justremote.co", category: "Startup & Remote", description: "Discover hidden remote jobs that aren't advertised elsewhere", isLiveFeedSupported: true },
  { id: "hireable", name: "Hireable", url: "https://www.hireable.com", category: "Enterprise & Tech", description: "Smart job search engine with match recommendations", isLiveFeedSupported: true },
  { id: "remoteworkhub", name: "Remote Work Hub", url: "https://remoteworkhub.com", category: "Startup & Remote", description: "Global portal for verified remote jobs and flexible contracts", isLiveFeedSupported: true },
  { id: "jobbatical", name: "Jobbatical", url: "https://jobbatical.com", category: "Enterprise & Tech", description: "International career platform for tech and creative talent relocations", isLiveFeedSupported: true },
  { id: "freelancewritinggigs", name: "Freelance Writing Gigs", url: "https://www.freelancewritinggigs.com", category: "Writing & Content", description: "Daily updated freelance writing and copywriting project board", isLiveFeedSupported: true },
  { id: "contentwritingjobs", name: "Content Writing Jobs", url: "https://contentwritingjobs.com", category: "Writing & Content", description: "Remote content creation, technical writing, and SEO gigs", isLiveFeedSupported: true },
  { id: "problogger", name: "ProBlogger Jobs", url: "https://problogger.com/jobs", category: "Writing & Content", description: "Premier job board for bloggers, ghostwriters, and editors", isLiveFeedSupported: true },
  { id: "behance", name: "Behance Jobs", url: "https://www.behance.net/joblist", category: "Design & Creative", description: "Adobe Behance creative job board for UI/UX, 3D, and graphic design", isLiveFeedSupported: true },
  { id: "designhill", name: "Designhill", url: "https://www.designhill.com", category: "Design & Creative", description: "Creative design marketplace, logo contests, and custom design projects", isLiveFeedSupported: true }
];
