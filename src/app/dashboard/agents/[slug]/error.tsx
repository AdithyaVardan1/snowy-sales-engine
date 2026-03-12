"use client";

export default function AgentDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div>
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <h2 className="text-lg font-semibold text-red-700 mb-2">Something went wrong</h2>
        <p className="text-gray-500 text-sm mb-4">{error.message}</p>
        <button
          onClick={reset}
          className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-50"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
