// Web-screen PIN lock (see src/proxy.ts). The cookie holds a hash of APP_PIN, never the PIN itself,
// so changing APP_PIN on Vercel signs every device out.
export const PIN_COOKIE = "sf_pin";

export async function pinToken(pin: string): Promise<string> {
  const data = new TextEncoder().encode(`storyflow-web-pin:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
