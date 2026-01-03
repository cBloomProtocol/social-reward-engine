export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Social Reward Engine</h1>
        <p className="text-gray-400">
          Visit <code className="bg-gray-800 px-2 py-1 rounded">/claim/[tweetId]</code> to claim your reward
        </p>
      </div>
    </main>
  );
}
