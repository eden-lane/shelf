import {
  createDatabaseBookmarksStore,
  enrichSavedItem,
  type BookmarkEnrichmentQueue,
  type SavedItemSearchIndex
} from "@bookmarks/api/bookmarks";
import type { Database } from "@bookmarks/api/db";
import type Redis from "ioredis";

const BOOKMARK_ENRICHMENT_QUEUE_KEY = "bookmarks:enrichment";

interface BookmarkEnrichmentJob {
  savedItemId: string;
}

export class RedisBookmarkEnrichmentQueue implements BookmarkEnrichmentQueue {
  constructor(private readonly redis: Redis) {}

  async enqueueSavedItem(savedItemId: string): Promise<void> {
    await this.redis.lpush(
      BOOKMARK_ENRICHMENT_QUEUE_KEY,
      JSON.stringify({ savedItemId } satisfies BookmarkEnrichmentJob)
    );
  }
}

export class BookmarkEnrichmentWorker {
  private stopping = false;
  private workerRedis: Redis | null = null;
  private loopPromise: Promise<void> | null = null;

  constructor(
    private readonly options: {
      db: Database;
      redis: Redis;
      savedItemSearchIndex?: SavedItemSearchIndex;
    }
  ) {}

  start(): void {
    if (this.loopPromise) {
      return;
    }

    this.loopPromise = this.loop();
  }

  async stop(): Promise<void> {
    this.stopping = true;
    this.workerRedis?.disconnect();
    await this.loopPromise?.catch(() => {});
  }

  private async loop(): Promise<void> {
    const redis = this.options.redis.duplicate();
    this.workerRedis = redis;

    while (!this.stopping) {
      try {
        const result = await redis.brpop(BOOKMARK_ENRICHMENT_QUEUE_KEY, 2);
        const payload = result?.[1];

        if (!payload) {
          continue;
        }

        const job = parseJob(payload);

        if (job) {
          await enrichSavedItem(this.options.db, job.savedItemId);
          await this.syncSearchIndex(job.savedItemId);
        }
      } catch (error) {
        if (!this.stopping) {
          console.error("Bookmark enrichment worker failed", error);
        }
      }
    }

    redis.disconnect();
  }

  private async syncSearchIndex(savedItemId: string): Promise<void> {
    if (!this.options.savedItemSearchIndex) {
      return;
    }

    const store = createDatabaseBookmarksStore(this.options.db);
    const documents = await store.listSavedItemSearchDocuments({
      savedItemIds: [savedItemId]
    });

    if (documents.length === 0) {
      return;
    }

    await this.options.savedItemSearchIndex.upsert(documents).catch((error: unknown) => {
      console.error("Unable to sync enriched bookmark to search index", error);
    });
  }
}

const parseJob = (payload: string): BookmarkEnrichmentJob | null => {
  try {
    const parsed = JSON.parse(payload) as Partial<BookmarkEnrichmentJob>;

    return typeof parsed.savedItemId === "string" ? { savedItemId: parsed.savedItemId } : null;
  } catch {
    return null;
  }
};
