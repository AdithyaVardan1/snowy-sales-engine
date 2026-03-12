import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Metadata } from "next";

export const dynamic = "force-dynamic";

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await db.blogPost.findUnique({
    where: { slug: params.slug },
    select: { title: true, metaDescription: true, keywords: true },
  });

  if (!post) return { title: "Not Found" };

  return {
    title: `${post.title} — Snowy AI Blog`,
    description: post.metaDescription || undefined,
    keywords: post.keywords || undefined,
  };
}

export default async function BlogPostPage({ params }: Props) {
  const post = await db.blogPost.findUnique({
    where: { slug: params.slug },
  });

  if (!post || post.status !== "published") {
    notFound();
  }

  // Simple markdown to HTML (headers, bold, italic, code, links, lists)
  function renderMarkdown(md: string) {
    return md
      .split("\n\n")
      .map((block, i) => {
        const trimmed = block.trim();
        if (!trimmed) return null;

        if (trimmed.startsWith("### ")) {
          return (
            <h3 key={i} className="text-lg font-semibold text-gray-900 mt-8 mb-3">
              {trimmed.slice(4)}
            </h3>
          );
        }
        if (trimmed.startsWith("## ")) {
          return (
            <h2 key={i} className="text-xl font-bold text-gray-900 mt-10 mb-4">
              {trimmed.slice(3)}
            </h2>
          );
        }
        if (trimmed.startsWith("# ")) {
          return (
            <h1 key={i} className="text-2xl font-bold text-gray-900 mt-10 mb-4">
              {trimmed.slice(2)}
            </h1>
          );
        }
        if (trimmed.startsWith("```")) {
          const code = trimmed.replace(/^```\w*\n?/, "").replace(/\n?```$/, "");
          return (
            <pre
              key={i}
              className="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto text-sm my-4"
            >
              <code>{code}</code>
            </pre>
          );
        }
        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
          const items = trimmed.split("\n").map((line) => line.replace(/^[-*] /, ""));
          return (
            <ul key={i} className="list-disc list-inside space-y-1 text-gray-700 my-4">
              {items.map((item, j) => (
                <li key={j}>{item}</li>
              ))}
            </ul>
          );
        }
        if (/^\d+\. /.test(trimmed)) {
          const items = trimmed.split("\n").map((line) => line.replace(/^\d+\. /, ""));
          return (
            <ol key={i} className="list-decimal list-inside space-y-1 text-gray-700 my-4">
              {items.map((item, j) => (
                <li key={j}>{item}</li>
              ))}
            </ol>
          );
        }
        if (trimmed.startsWith("> ")) {
          return (
            <blockquote
              key={i}
              className="border-l-4 border-blue-500 pl-4 italic text-gray-600 my-4"
            >
              {trimmed.replace(/^> /gm, "")}
            </blockquote>
          );
        }

        return (
          <p key={i} className="text-gray-700 leading-relaxed my-4">
            {trimmed}
          </p>
        );
      })
      .filter(Boolean);
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-6 py-6">
          <Link
            href="/blog"
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            &larr; Back to blog
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <article>
          <h1 className="text-3xl font-bold text-gray-900">{post.title}</h1>
          <div className="flex items-center gap-3 mt-4 text-sm text-gray-400">
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
                {post.keywords.split(",").map((kw) => (
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

          <div className="mt-8">{renderMarkdown(post.content)}</div>
        </article>
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
