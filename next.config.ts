import type { NextConfig } from "next";

const isDevelopment = process.env.NODE_ENV === "development";

function getSupabaseSources() {
  const fallbackHttp = "https://*.supabase.co";
  const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const makeSources = (http: string, webSocket: string) => ({
    http,
    imagePattern: new URL(`${http}/storage/v1/object/public/public-media/**`),
    webSocket,
  });

  if (!configuredUrl) {
    return makeSources(fallbackHttp, "wss://*.supabase.co");
  }

  try {
    const url = new URL(configuredUrl);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return makeSources(fallbackHttp, "wss://*.supabase.co");
    }

    return makeSources(
      url.origin,
      `${url.protocol === "https:" ? "wss:" : "ws:"}//${url.host}`,
    );
  } catch {
    return makeSources(fallbackHttp, "wss://*.supabase.co");
  }
}

const supabaseSources = getSupabaseSources();

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  `connect-src 'self' ${supabaseSources.http} ${supabaseSources.webSocket}`,
  "font-src 'self' data:",
  "form-action 'self'",
  "frame-ancestors 'none'",
  `img-src 'self' data: blob: ${supabaseSources.http}`,
  "object-src 'none'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  images: {
    formats: ["image/webp"],
    remotePatterns: [supabaseSources.imagePattern],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
