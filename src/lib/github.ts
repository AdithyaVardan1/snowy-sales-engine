interface RawPost {
  externalId: string;
  source: string;
  title: string;
  body: string;
  author: string;
  url: string;
}

const KEYWORDS = [
  "hosting",
  "deploy",
  "docker",
  "VPS",
  "SSL",
  "memory",
  "crash",
  "setup",
  "install",
  "server",
  "self-host",
  "selfhost",
];

export async function fetchGitHubIssues(): Promise<RawPost[]> {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_REPO_OWNER || "openclaw";
  const repo = process.env.GITHUB_REPO_NAME || "openclaw";

  const query = KEYWORDS.slice(0, 5).join("+");
  const url = `https://api.github.com/search/issues?q=repo:${owner}/${repo}+${query}+is:issue+is:open&sort=created&order=desc&per_page=30`;

  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "SnowyAI-SalesEngine",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    const res = await fetch(url, { headers });
    if (!res.ok) {
      console.error("GitHub API error:", res.status, await res.text());
      return [];
    }

    const data = await res.json();
    return (data.items || []).map((item: any) => ({
      externalId: `github_issue_${item.id}`,
      source: "github_issue",
      title: item.title,
      body: (item.body || "").slice(0, 2000),
      author: item.user?.login || "unknown",
      url: item.html_url,
    }));
  } catch (e) {
    console.error("GitHub fetch failed:", e);
    return [];
  }
}

export async function fetchGitHubDiscussions(): Promise<RawPost[]> {
  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_REPO_OWNER || "openclaw";
  const repo = process.env.GITHUB_REPO_NAME || "openclaw";

  if (!token) {
    console.warn("No GITHUB_TOKEN set, skipping discussions fetch");
    return [];
  }

  const query = `
    query {
      search(query: "repo:${owner}/${repo} hosting OR deploy OR docker OR setup", type: DISCUSSION, first: 20) {
        nodes {
          ... on Discussion {
            id
            title
            body
            url
            author { login }
            createdAt
          }
        }
      }
    }
  `;

  try {
    const res = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "SnowyAI-SalesEngine",
      },
      body: JSON.stringify({ query }),
    });

    if (!res.ok) {
      console.error("GitHub GraphQL error:", res.status);
      return [];
    }

    const data = await res.json();
    const nodes = data?.data?.search?.nodes || [];

    return nodes.map((d: any) => ({
      externalId: `github_discussion_${d.id}`,
      source: "github_discussion",
      title: d.title,
      body: (d.body || "").slice(0, 2000),
      author: d.author?.login || "unknown",
      url: d.url,
    }));
  } catch (e) {
    console.error("GitHub discussions fetch failed:", e);
    return [];
  }
}
