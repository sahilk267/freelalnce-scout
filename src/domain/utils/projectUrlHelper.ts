/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Checks if a project URL is merely a generic homepage or landing page
 * rather than a deep link or specific search URL.
 */
export function isGenericOrHomepageUrl(url?: string): boolean {
  if (!url || typeof url !== "string") return true;
  const trimmed = url.trim().toLowerCase();

  // Root-only or basic landing pages
  const genericPatterns = [
    /^https?:\/\/(www\.)?upwork\.com\/?(find-work\/?|jobs\/?)?$/,
    /^https?:\/\/(www\.)?freelancer\.com\/?(jobs\/?)?$/,
    /^https?:\/\/(www\.)?linkedin\.com\/?(jobs\/?)?$/,
    /^https?:\/\/(www\.)?indeed\.com\/?$/,
    /^https?:\/\/(www\.)?glassdoor\.com\/?$/,
    /^https?:\/\/(www\.)?flexjobs\.com\/?$/,
    /^https?:\/\/(www\.)?weworkremotely\.com\/?$/,
    /^https?:\/\/(www\.)?remote\.co\/?$/,
    /^https?:\/\/(www\.)?fiverr\.com\/?$/,
    /^https?:\/\/(www\.)?guru\.com\/?$/,
    /^https?:\/\/(www\.)?toptal\.com\/?$/,
    /^https?:\/\/(www\.)?wellfound\.com\/?$/,
    /^https?:\/\/(www\.)?talent\.hubstaff\.com\/?$/,
    /^https?:\/\/(www\.)?simplyhired\.com\/?(search\?q=remote)?$/,
    /^https?:\/\/(www\.)?remotive\.com\/?$/,
    /^https?:\/\/(www\.)?virtualvocations\.com\/?$/,
    /^https?:\/\/(www\.)?workingnomads\.com\/?$/,
    /^https?:\/\/(www\.)?hired\.com\/?$/,
    /^https?:\/\/(www\.)?cloudpeeps\.com\/?$/,
    /^https?:\/\/(www\.)?taskrabbit\.com\/?$/,
    /^https?:\/\/(www\.)?talent\.com\/?$/,
    /^https?:\/\/(www\.)?remoteok\.com\/?$/,
    /^https?:\/\/(www\.)?dremote\.io\/?$/,
    /^https?:\/\/(www\.)?jooble\.org\/?$/,
    /^https?:\/\/(www\.)?stackoverflow\.com\/jobs\/?$/,
    /^https?:\/\/(www\.)?jobspresso\.co\/?$/,
    /^https?:\/\/(www\.)?onlinejobs\.ph\/?$/,
    /^https?:\/\/(www\.)?themuse\.com\/?$/,
    /^https?:\/\/(www\.)?skipthedrive\.com\/?$/,
    /^https?:\/\/(www\.)?zirtual\.com\/?$/,
    /^https?:\/\/(www\.)?justremote\.co\/?$/,
    /^https?:\/\/(www\.)?hireable\.com\/?$/,
    /^https?:\/\/(www\.)?remoteworkhub\.com\/?$/,
    /^https?:\/\/(www\.)?jobbatical\.com\/?$/,
    /^https?:\/\/(www\.)?freelancewritinggigs\.com\/?$/,
    /^https?:\/\/(www\.)?contentwritingjobs\.com\/?$/,
    /^https?:\/\/(www\.)?problogger\.com\/(jobs\/?)?$/,
    /^https?:\/\/(www\.)?behance\.net\/?(joblist\/?)?$/,
    /^https?:\/\/(www\.)?designhill\.com\/?$/,
    /^https?:\/\/(www\.)?99designs\.com\/?$/,
    /^https?:\/\/(community\.)?spiceworks\.com\/?(jobs\/?)?$/,
    /^https?:\/\/(www\.)?dice\.com\/?$/,
    /^https?:\/\/(www\.)?peopleperhour\.com\/?$/
  ];

  return genericPatterns.some((pattern) => pattern.test(trimmed));
}

/**
 * Extracts a concise query string from title and skills for deep search
 */
function extractSearchQuery(title: string, skills?: string[]): string {
  // Strip platform markers or punctuation like "Behance Showcase:" or "Spiceworks:" or special chars
  let cleaned = title
    .replace(/^(Behance Showcase|Designhill Expert|ProBlogger|Upwork|Freelancer):\s*/i, "")
    .replace(/[—–\-]/g, " ")
    .replace(/\(.*?\)/g, "")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Pick top 4-5 salient terms so search engines return exact relevant postings
  const words = cleaned.split(" ").filter((w) => w.length > 2);
  if (words.length > 5) {
    cleaned = words.slice(0, 5).join(" ");
  }

  // Fallback to top skill if title was too short
  if (cleaned.length < 3 && skills && skills.length > 0) {
    cleaned = skills.slice(0, 2).join(" ");
  }

  return cleaned || "IT Infrastructure Freelance";
}

/**
 * Resolves a raw or generic project URL into a direct, high-precision job application/search link.
 */
export function resolveDirectJobUrl(params: {
  id?: string;
  source?: string;
  platform?: string;
  title: string;
  skills?: string[];
  projectUrl?: string;
  originalUrl?: string;
}): string {
  const existingUrl = (params.projectUrl || params.originalUrl || "").trim();

  // If already a deep search or specific project link with detailed path / query, keep it
  if (existingUrl && !isGenericOrHomepageUrl(existingUrl)) {
    // Confirm it's not just a root domain with trailing slash
    try {
      const parsed = new URL(existingUrl);
      if (parsed.pathname.length > 2 || parsed.search.length > 2) {
        return existingUrl;
      }
    } catch {
      // Invalid URL format, will generate new below
    }
  }

  const query = extractSearchQuery(params.title, params.skills);
  const encQuery = encodeURIComponent(query);
  const src = (params.source || params.platform || "").toLowerCase();

  if (src.includes("upwork")) {
    return `https://www.upwork.com/nx/search/jobs/?q=${encQuery}&sort=recency`;
  }
  if (src.includes("freelancer")) {
    return `https://www.freelancer.com/jobs/?keyword=${encQuery}`;
  }
  if (src.includes("linkedin")) {
    return `https://www.linkedin.com/jobs/search/?keywords=${encQuery}&f_TPR=r86400&f_WT=2`;
  }
  if (src.includes("indeed")) {
    return `https://www.indeed.com/jobs?q=${encQuery}&l=Remote`;
  }
  if (src.includes("guru")) {
    return `https://www.guru.com/d/jobs/q/${encQuery}/`;
  }
  if (src.includes("peopleperhour")) {
    return `https://www.peopleperhour.com/freelance-jobs?keywords=${encQuery}`;
  }
  if (src.includes("fiverr")) {
    return `https://www.fiverr.com/search/gigs?query=${encQuery}`;
  }
  if (src.includes("dice")) {
    return `https://www.dice.com/jobs?q=${encQuery}&filters.workplaceTypes=Remote`;
  }
  if (src.includes("flexjobs")) {
    return `https://www.flexjobs.com/search?search=${encQuery}&location=Remote`;
  }
  if (src.includes("spiceworks")) {
    return `https://community.spiceworks.com/search/everything?query=${encQuery}`;
  }
  if (src.includes("behance")) {
    return `https://www.behance.net/search/projects?search=${encQuery}`;
  }
  if (src.includes("designhill")) {
    return `https://www.designhill.com/design-contests?search=${encQuery}`;
  }
  if (src.includes("99designs")) {
    return `https://99designs.com/contests?category=${encQuery}`;
  }
  if (src.includes("problogger")) {
    return `https://problogger.com/jobs/search/?keywords=${encQuery}`;
  }
  if (src.includes("weworkremotely")) {
    return `https://weworkremotely.com/remote-jobs/search?term=${encQuery}`;
  }
  if (src.includes("remoteok")) {
    const slug = query.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    return `https://remoteok.com/remote-${slug}-jobs`;
  }
  if (src.includes("remotive")) {
    return `https://remotive.com/remote-jobs?search=${encQuery}`;
  }
  if (src.includes("skipthedrive")) {
    return `https://www.skipthedrive.com/?s=${encQuery}`;
  }
  if (src.includes("simplyhired")) {
    return `https://www.simplyhired.com/search?q=${encQuery}&l=Remote`;
  }
  if (src.includes("justremote")) {
    return `https://justremote.co/remote-jobs?search=${encQuery}`;
  }
  if (src.includes("hubstaff")) {
    return `https://talent.hubstaff.com/search/jobs?search%5Bkeywords%5D=${encQuery}`;
  }
  if (src.includes("wellfound")) {
    return `https://wellfound.com/jobs?query=${encQuery}`;
  }
  if (src.includes("glassdoor")) {
    return `https://www.glassdoor.com/Job/jobs.htm?sc.keyword=${encQuery}`;
  }

  // If existingUrl has domain, append query
  if (existingUrl && existingUrl.startsWith("http")) {
    try {
      const u = new URL(existingUrl);
      return `${u.origin}/search?q=${encQuery}`;
    } catch {}
  }

  return `https://www.google.com/search?q=${encodeURIComponent(`${params.source || "freelance"} ${query} jobs apply remote`)}`;
}
