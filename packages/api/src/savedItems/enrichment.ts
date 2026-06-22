import type { SavedItem } from "@shelf/shared";
import { and, eq, sql } from "drizzle-orm";
import { getPreviewFromContent } from "link-preview-js";
import { Buffer } from "node:buffer";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { Database } from "../db";
import { schema } from "../db";

const PAGE_FETCH_TIMEOUT_MS = 7000;
const FAVICON_FETCH_TIMEOUT_MS = 5000;
const MAX_PAGE_BYTES = 5 * 1024 * 1024;
const MAX_FAVICON_BYTES = 256 * 1024;
const USER_AGENT =
  "Mozilla/5.0 (compatible; ShelfBot/1.0; +https://localhost/shelf)";

const SUPPORTED_FAVICON_CONTENT_TYPES = new Set([
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/vnd.microsoft.icon",
  "image/webp",
  "image/x-icon"
]);

export interface SavedItemEnrichmentQueue {
  enqueueSavedItem(savedItemId: string): Promise<void>;
}

export interface LinkPreviewMetadata {
  title: string | null;
  description: string | null;
  siteName: string | null;
  imageUrl: string | null;
  faviconCandidates: string[];
}

type LinkPreviewResult = Awaited<ReturnType<typeof getPreviewFromContent>>;

export const enrichSavedItem = async (db: Database, savedItemId: string): Promise<void> => {
  const [savedItem] = await db
    .select({
      description: schema.savedItems.description,
      id: schema.savedItems.id,
      url: schema.savedItems.url
    })
    .from(schema.savedItems)
    .where(eq(schema.savedItems.id, savedItemId))
    .limit(1);

  if (!savedItem) {
    return;
  }

  try {
    await assertSafeHttpUrl(savedItem.url);

    const preview = await fetchLinkPreview(savedItem.url);
    const metadata = mapLinkPreviewMetadata(preview);
    const favicon = await ensureFaviconForUrl(db, savedItem.url, metadata.faviconCandidates);

    await db
      .update(schema.savedItems)
      .set({
        description: savedItem.description ?? metadata.description,
        faviconId: favicon?.id ?? null,
        imageUrl: metadata.imageUrl,
        metadataFetchedAt: new Date(),
        metadataStatus: "fetched",
        siteName: metadata.siteName,
        title: metadata.title,
        updatedAt: sql`now()`
      })
      .where(eq(schema.savedItems.id, savedItem.id));
  } catch (error) {
    console.error("SavedItem enrichment failed", {
      error,
      savedItemId: savedItem.id,
      url: savedItem.url
    });
    await markMetadataFailed(db, savedItem.id);
  }
};

export const fetchLinkPreviewMetadata = async (url: string): Promise<LinkPreviewMetadata> =>
  mapLinkPreviewMetadata(await fetchLinkPreview(url));

export const mapLinkPreviewMetadata = (preview: LinkPreviewResult): LinkPreviewMetadata => {
  const record = preview as Partial<{
    description: string;
    favicons: string[];
    images: string[];
    siteName: string;
    title: string;
  }>;

  return {
    description: normalizeText(record.description),
    faviconCandidates: Array.isArray(record.favicons) ? record.favicons.filter(isNonEmptyString) : [],
    imageUrl: firstNonEmpty(record.images),
    siteName: normalizeText(record.siteName),
    title: normalizeText(record.title)
  };
};

export const assertSafeHttpUrl = async (url: string): Promise<URL> => {
  const parsed = new URL(url);

  if (!isPotentiallySafeHttpUrl(parsed.toString())) {
    throw new Error("URL is not safe to fetch");
  }

  await resolveSinglePublicAddress(parsed);

  return parsed;
};

export const isPotentiallySafeHttpUrl = (url: string): boolean => {
  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return false;
  }

  const hostname = parsed.hostname.toLowerCase();

  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "0.0.0.0" ||
    hostname === "::" ||
    hostname === "::1"
  ) {
    return false;
  }

  return true;
};

const ensureFaviconForUrl = async (
  db: Database,
  pageUrl: string,
  candidates: string[]
): Promise<{ id: string } | null> => {
  const origin = new URL(pageUrl).origin.toLowerCase();
  const [existing] = await db
    .select({
      id: schema.favicons.id,
      status: schema.favicons.status
    })
    .from(schema.favicons)
    .where(eq(schema.favicons.origin, origin))
    .limit(1);

  if (existing?.status === "fetched") {
    return { id: existing.id };
  }

  const faviconCandidates = normalizeFaviconCandidates(pageUrl, candidates);

  for (const candidate of faviconCandidates) {
    const image = await fetchFaviconImage(candidate).catch(() => null);

    if (!image) {
      continue;
    }

    const [row] = await db
      .insert(schema.favicons)
      .values({
        contentType: image.contentType,
        fetchedAt: new Date(),
        imageBytes: image.imageBytes,
        origin,
        sourceUrl: image.url,
        status: "fetched"
      })
      .onConflictDoUpdate({
        target: [schema.favicons.origin],
        set: {
          contentType: image.contentType,
          fetchedAt: new Date(),
          imageBytes: image.imageBytes,
          sourceUrl: image.url,
          status: "fetched",
          updatedAt: sql`now()`
        }
      })
      .returning({ id: schema.favicons.id });

    return row ?? null;
  }

  await db
    .insert(schema.favicons)
    .values({
      fetchedAt: new Date(),
      origin,
      status: "failed"
    })
    .onConflictDoUpdate({
      target: [schema.favicons.origin],
      set: {
        fetchedAt: new Date(),
        status: "failed",
        updatedAt: sql`now()`
      }
    });

  return null;
};

const fetchFaviconImage = async (
  url: string
): Promise<{ contentType: string; imageBytes: Buffer; url: string }> => {
  const parsed = await assertSafeHttpUrl(url);
  const response = await fetchWithValidatedRedirects(parsed, {
    accept: "image/avif,image/webp,image/png,image/jpeg,image/gif,image/x-icon,*/*;q=0.4",
    timeoutMs: FAVICON_FETCH_TIMEOUT_MS
  });

  if (!response.ok) {
    throw new Error(`Favicon returned ${response.status}`);
  }

  const contentType = normalizeContentType(response.headers.get("content-type"));

  if (!contentType || !SUPPORTED_FAVICON_CONTENT_TYPES.has(contentType)) {
    throw new Error("Unsupported favicon content type");
  }

  return {
    contentType,
    imageBytes: await readCappedResponseBytes(response, MAX_FAVICON_BYTES),
    url: response.url || parsed.toString()
  };
};

const fetchLinkPreview = async (url: string): Promise<LinkPreviewResult> => {
  const parsed = await assertSafeHttpUrl(url);
  const response = await fetchWithValidatedRedirects(parsed, {
    accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
    timeoutMs: PAGE_FETCH_TIMEOUT_MS
  });

  if (!response.ok) {
    throw new Error(`Page returned ${response.status}`);
  }

  const contentType = normalizeContentType(response.headers.get("content-type"));

  if (contentType !== "text/html" && contentType !== "application/xhtml+xml") {
    throw new Error("Unsupported page content type");
  }

  const data = new TextDecoder().decode(await readCappedResponseBytes(response, MAX_PAGE_BYTES));
  const headers = Object.fromEntries(response.headers.entries());

  return getPreviewFromContent({
    data,
    headers,
    url: response.url || parsed.toString()
  });
};

const fetchWithValidatedRedirects = async (
  url: URL,
  options: {
    accept: string;
    timeoutMs: number;
  },
  redirects = 0
): Promise<Response> => {
  if (redirects > 5) {
    throw new Error("Too many redirects");
  }

  await assertSafeHttpUrl(url.toString());

  const response = await fetch(url, {
    headers: {
      "accept": options.accept,
      "user-agent": USER_AGENT
    },
    redirect: "manual",
    signal: AbortSignal.timeout(options.timeoutMs)
  });

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");

    if (!location) {
      throw new Error("Redirect without location");
    }

    return fetchWithValidatedRedirects(new URL(location, url), options, redirects + 1);
  }

  return response;
};

const readCappedResponseBytes = async (response: Response, maxBytes: number): Promise<Buffer> => {
  const reader = response.body?.getReader();

  if (!reader) {
    throw new Error("Response does not have a readable body");
  }

  const chunks: Uint8Array[] = [];
  let size = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    size += value.byteLength;

    if (size > maxBytes) {
      await reader.cancel();
      throw new Error("Response is too large");
    }

    chunks.push(value);
  }

  return Buffer.concat(chunks);
};

const normalizeFaviconCandidates = (pageUrl: string, candidates: string[]): string[] => {
  const page = new URL(pageUrl);
  const normalized = [
    ...candidates,
    `${page.origin}/favicon.ico`
  ].flatMap((candidate) => {
    try {
      return [new URL(candidate, page).toString()];
    } catch {
      return [];
    }
  });

  return Array.from(new Set(normalized));
};

const resolveSinglePublicAddress = async (url: URL): Promise<string> => {
  const directIpVersion = isIP(url.hostname);

  if (directIpVersion !== 0) {
    assertPublicAddress(url.hostname);

    return url.hostname;
  }

  const addresses = await lookup(url.hostname, {
    all: true,
    verbatim: true
  });
  const address = addresses[0]?.address;

  if (!address) {
    throw new Error("Unable to resolve URL hostname");
  }

  for (const resolved of addresses) {
    assertPublicAddress(resolved.address);
  }

  return address;
};

const assertPublicAddress = (address: string): void => {
  const normalizedAddress = normalizeMappedIpv4(address);
  const version = isIP(normalizedAddress);

  if (version === 4 && isPrivateIpv4(normalizedAddress)) {
    throw new Error("URL resolves to a private IPv4 address");
  }

  if (version === 6 && isPrivateIpv6(normalizedAddress)) {
    throw new Error("URL resolves to a private IPv6 address");
  }

  if (version === 0) {
    throw new Error("URL did not resolve to an IP address");
  }
};

const isPrivateIpv4 = (address: string): boolean => {
  const parts = address.split(".").map((part) => Number(part));
  const [first, second] = parts;

  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true;
  }

  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    first >= 224 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19))
  );
};

const isPrivateIpv6 = (address: string): boolean => {
  const normalized = address.toLowerCase();

  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb")
  );
};

const normalizeMappedIpv4 = (address: string): string =>
  address.toLowerCase().startsWith("::ffff:") ? address.slice(7) : address;

const normalizeText = (value: string | undefined): string | null => {
  const trimmed = value?.trim();

  return trimmed ? trimmed : null;
};

const firstNonEmpty = (values: string[] | undefined): string | null =>
  values?.find(isNonEmptyString) ?? null;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const normalizeContentType = (contentType: string | null): string | null =>
  contentType?.split(";")[0]?.trim().toLowerCase() ?? null;

const markMetadataFailed = async (db: Database, savedItemId: string): Promise<void> => {
  await db
    .update(schema.savedItems)
    .set({
      metadataFetchedAt: new Date(),
      metadataStatus: "failed",
      updatedAt: sql`now()`
    })
    .where(
      and(
        eq(schema.savedItems.id, savedItemId),
        eq(schema.savedItems.metadataStatus, "pending"),
        sql`${schema.savedItems.title} is null`,
        sql`${schema.savedItems.description} is null`,
        sql`${schema.savedItems.siteName} is null`,
        sql`${schema.savedItems.faviconId} is null`
      )
    );
};
