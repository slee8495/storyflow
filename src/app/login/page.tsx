export const metadata = { title: "Storyflow" };

export default async function Login({ searchParams }: { searchParams: Promise<{ wrong?: string; next?: string }> }) {
  const { wrong, next } = await searchParams;
  return (
    <main className="mx-auto max-w-sm px-4 pt-24">
      <h1 className="text-xl font-bold">Storyflow</h1>
      <form action="/api/login" method="post" className="mt-6 flex gap-2">
        <input type="hidden" name="next" value={next ?? "/"} />
        <input
          name="pin"
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          autoComplete="one-time-code"
          placeholder="PIN"
          autoFocus
          required
          className="min-w-0 flex-1 rounded-xl border border-current/20 bg-transparent px-4 py-3 text-lg tracking-widest"
        />
        <button className="cursor-pointer rounded-xl border border-current/20 px-5 font-medium">열기</button>
      </form>
      {wrong && <p className="mt-3 text-sm text-red-600">PIN이 맞지 않아요. 다시 넣어 주세요.</p>}
    </main>
  );
}
