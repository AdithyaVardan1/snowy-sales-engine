import { db } from "@/lib/db";
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Snowy AI Blog — AI Agents, Sales Automation & Guides",
  description:
    "Guides, tutorials, and insights about Snowy AI by Snowball Labs, AI-powered sales agents, GTM automation, and developer tools.",
};

export default async function BlogIndexPage() {
  const posts = await db.blogPost.findMany({
    where: { status: "published" },
    orderBy: { publishedAt: "desc" },
    select: {
      title: true,
      slug: true,
      metaDescription: true,
      keywords: true,
      publishedAt: true,
    },
  });

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <Link href="/blog" className="text-2xl font-bold text-gray-900">
            Snowy AI Blog
          </Link>
          <p className="text-gray-500 mt-1">
            Guides, insights, and updates about AI-powered sales automation
          </p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        {posts.length === 0 ? (
          <p className="text-gray-400 text-center py-16">
            No posts published yet. Check back soon!
          </p>
        ) : (
          <div className="space-y-10">
            {posts.map((post) => (
              <article key={post.slug}>
                <Link href={`/blog/${post.slug}`}>
                  <h2 className="text-xl font-semibold text-gray-900 hover:text-blue-600 transition-colors">
                    {post.title}
                  </h2>
                </Link>
                {post.metaDescription && (
                  <p className="text-gray-600 mt-2">{post.metaDescription}</p>
                )}
                <div className="flex items-center gap-3 mt-3 text-sm text-gray-400">
                  {post.publishedAt && (
                    <time>
                      {new Date(post.publishedAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </time>
                  )}
                  {post.keywords && (
                    <div className="flex gap-1.5">
                      {post.keywords
                        .split(",")
                        .slice(0, 3)
                        .map((kw) => (
                          <span
                            key={kw}
                            className="text-xs px-2 py-0.5 bg-gray-100 rounded-full"
                          >
                            {kw.trim()}
                          </span>
                        ))}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      <footer className="border-t border-gray-100 mt-16">
        <div className="max-w-3xl mx-auto px-6 py-8 text-center text-sm text-gray-400">
          <a
            href="https://agent.snowballlabs.org"
            className="hover:text-blue-600 transition-colors"
          >
            Snowy AI
          </a>{" "}
          — AI-powered sales engine by Snowball Labs
        </div>
      </footer>
    </div>
  );
}
