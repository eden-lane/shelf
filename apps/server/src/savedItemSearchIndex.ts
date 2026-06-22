import type { BookmarkItem } from "@bookmarks/shared";
import {
  nextSavedItemSearchCursor,
  type SavedItemSearchDocument,
  type SavedItemSearchIndex,
  type SearchBookmarksInput
} from "@bookmarks/api/bookmarks";

const SAVED_ITEMS_INDEX_UID = "saved_items";
const SEARCHABLE_ATTRIBUTES = [
  "title",
  "url",
  "description",
  "siteName",
  "folderName",
  "tagNames"
];
const FILTERABLE_ATTRIBUTES = ["libraryId"];
const SORTABLE_ATTRIBUTES = ["createdAt"];

export class MeilisearchSavedItemSearchIndex implements SavedItemSearchIndex {
  private ensureIndexPromise: Promise<void> | null = null;

  constructor(private readonly baseUrl: string) {}

  async search(input: SearchBookmarksInput) {
    await this.ensureIndex();

    const offset = input.cursor?.offset ?? 0;
    const limit = input.limit + 1;
    const response = await this.request<{
      hits: Array<Partial<SavedItemSearchDocument>>;
    }>(`/indexes/${SAVED_ITEMS_INDEX_UID}/search`, {
      body: {
        attributesToRetrieve: [
          "id",
          "libraryId",
          "libraryName",
          "folderId",
          "folderName",
          "url",
          "title",
          "description",
          "siteName",
          "imageUrl",
          "metadataStatus",
          "metadataFetchedAt",
          "faviconId",
          "faviconUrl",
          "createdAt",
          "updatedAt"
        ],
        filter: libraryFilter(input.libraryIds),
        limit,
        offset,
        q: input.query,
        sort: ["createdAt:desc"]
      },
      method: "POST"
    });
    const hits = response.hits.map(searchHitToBookmark).filter((item) => item !== null);
    const items = hits.slice(0, input.limit);

    return {
      items,
      nextCursor: nextSavedItemSearchCursor(offset, input.limit, hits.length)
    };
  }

  async upsert(documents: SavedItemSearchDocument[]): Promise<void> {
    if (documents.length === 0) {
      return;
    }

    await this.ensureIndex();
    await this.request(`/indexes/${SAVED_ITEMS_INDEX_UID}/documents`, {
      body: documents,
      method: "POST"
    });
  }

  async delete(savedItemIds: string[]): Promise<void> {
    if (savedItemIds.length === 0) {
      return;
    }

    await this.ensureIndex();
    await this.request(`/indexes/${SAVED_ITEMS_INDEX_UID}/documents/delete-batch`, {
      body: savedItemIds,
      method: "POST"
    });
  }

  async replaceAll(documents: SavedItemSearchDocument[]): Promise<void> {
    await this.ensureIndex();

    const deleteTask = await this.request<{ taskUid?: number }>(
      `/indexes/${SAVED_ITEMS_INDEX_UID}/documents`,
      {
        method: "DELETE"
      }
    );
    await this.waitForTask(deleteTask.taskUid);

    for (const chunk of chunkDocuments(documents, 500)) {
      const upsertTask = await this.request<{ taskUid?: number }>(
        `/indexes/${SAVED_ITEMS_INDEX_UID}/documents`,
        {
          body: chunk,
          method: "POST"
        }
      );
      await this.waitForTask(upsertTask.taskUid);
    }
  }

  private async ensureIndex(): Promise<void> {
    this.ensureIndexPromise ??= this.createOrUpdateIndex();

    return this.ensureIndexPromise;
  }

  private async createOrUpdateIndex(): Promise<void> {
    const indexResponse = await fetch(new URL(`/indexes/${SAVED_ITEMS_INDEX_UID}`, this.baseUrl));

    if (!indexResponse.ok && indexResponse.status !== 404) {
      throw new Error(`Meilisearch index lookup failed with ${indexResponse.status}`);
    }

    if (indexResponse.status === 404) {
      const createResponse = await fetch(new URL("/indexes", this.baseUrl), {
        body: JSON.stringify({
          primaryKey: "id",
          uid: SAVED_ITEMS_INDEX_UID
        }),
        headers: {
          "content-type": "application/json"
        },
        method: "POST"
      });

      if (!createResponse.ok) {
        throw new Error(`Meilisearch index creation failed with ${createResponse.status}`);
      }

      await this.waitForTask(await readTaskUid(createResponse));
    }

    const settingsResponse = await this.request<{ taskUid?: number }>(
      `/indexes/${SAVED_ITEMS_INDEX_UID}/settings`,
      {
        body: {
          filterableAttributes: FILTERABLE_ATTRIBUTES,
          searchableAttributes: SEARCHABLE_ATTRIBUTES,
          sortableAttributes: SORTABLE_ATTRIBUTES
        },
        method: "PATCH"
      }
    );

    await this.waitForTask(settingsResponse.taskUid);
  }

  private async waitForTask(taskUid: number | undefined): Promise<void> {
    if (typeof taskUid !== "number") {
      return;
    }

    const deadline = Date.now() + 10_000;

    while (Date.now() < deadline) {
      const task = await this.request<{ status?: string }>(`/tasks/${taskUid}`, {
        method: "GET"
      });

      if (task.status === "succeeded") {
        return;
      }

      if (task.status === "failed" || task.status === "canceled") {
        throw new Error(`Meilisearch task ${taskUid} ${task.status}`);
      }

      await sleep(100);
    }

    throw new Error(`Meilisearch task ${taskUid} timed out`);
  }

  private async request<T = unknown>(
    path: string,
    options: {
      body?: unknown;
      method: "DELETE" | "GET" | "PATCH" | "POST";
    }
  ): Promise<T> {
    const response = await fetch(new URL(path, this.baseUrl), {
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      headers:
        options.body === undefined
          ? undefined
          : {
              "content-type": "application/json"
            },
      method: options.method
    });

    if (!response.ok) {
      throw new Error(`Meilisearch ${options.method} ${path} failed with ${response.status}`);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }
}

const readTaskUid = async (response: Response): Promise<number | undefined> => {
  const body = (await response.json().catch(() => null)) as { taskUid?: unknown } | null;

  return typeof body?.taskUid === "number" ? body.taskUid : undefined;
};

const sleep = (durationMs: number) => new Promise((resolve) => setTimeout(resolve, durationMs));

const chunkDocuments = <T>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
};

const libraryFilter = (libraryIds: string[]) =>
  `libraryId IN [${libraryIds.map((libraryId) => JSON.stringify(libraryId)).join(", ")}]`;

const searchHitToBookmark = (hit: Partial<SavedItemSearchDocument>): BookmarkItem | null => {
  if (
    typeof hit.id !== "string" ||
    typeof hit.libraryId !== "string" ||
    typeof hit.url !== "string" ||
    typeof hit.createdAt !== "string" ||
    typeof hit.updatedAt !== "string"
  ) {
    return null;
  }

  return {
    id: hit.id,
    libraryId: hit.libraryId,
    libraryName: typeof hit.libraryName === "string" ? hit.libraryName : null,
    folderId: typeof hit.folderId === "string" ? hit.folderId : null,
    folderName: typeof hit.folderName === "string" ? hit.folderName : null,
    url: hit.url,
    title: typeof hit.title === "string" ? hit.title : null,
    description: typeof hit.description === "string" ? hit.description : null,
    siteName: typeof hit.siteName === "string" ? hit.siteName : null,
    imageUrl: typeof hit.imageUrl === "string" ? hit.imageUrl : null,
    metadataStatus:
      hit.metadataStatus === "fetched" || hit.metadataStatus === "failed"
        ? hit.metadataStatus
        : "pending",
    metadataFetchedAt: typeof hit.metadataFetchedAt === "string" ? hit.metadataFetchedAt : null,
    faviconId: typeof hit.faviconId === "string" ? hit.faviconId : null,
    faviconUrl: typeof hit.faviconUrl === "string" ? hit.faviconUrl : null,
    createdAt: hit.createdAt,
    updatedAt: hit.updatedAt
  };
};
