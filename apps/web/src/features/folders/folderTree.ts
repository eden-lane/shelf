import type { FolderItem } from "@bookmarks/shared";
import type { FolderNode } from "./types";

export const buildFolderTree = (folders: FolderItem[]): FolderNode[] => {
  const nodes = new Map<string, FolderNode>();

  for (const folder of folders) {
    nodes.set(folder.id, { ...folder, children: [] });
  }

  const roots: FolderNode[] = [];

  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : null;

    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return sortFolderNodes(roots);
};

const sortFolderNodes = (nodes: FolderNode[]): FolderNode[] =>
  nodes
    .sort(
      (left, right) =>
        left.sortOrder - right.sortOrder ||
        left.name.localeCompare(right.name) ||
        left.id.localeCompare(right.id)
    )
    .map((node) => ({
      ...node,
      children: sortFolderNodes(node.children)
    }));

export const filterFolderTree = (nodes: FolderNode[], search: string): FolderNode[] => {
  const query = search.trim().toLocaleLowerCase();

  if (!query) {
    return nodes;
  }

  return nodes.flatMap((node) => {
    const children = filterFolderTree(node.children, query);

    if (node.name.toLocaleLowerCase().includes(query) || children.length > 0) {
      return [{ ...node, children }];
    }

    return [];
  });
};

export const collectFolderSubtreeIds = (folders: FolderItem[], folderId: string): string[] => {
  const ids = [folderId];

  for (const child of folders.filter((folder) => folder.parentId === folderId)) {
    ids.push(...collectFolderSubtreeIds(folders, child.id));
  }

  return ids;
};

export const folderPath = (folder: FolderItem, folders: FolderItem[]) => {
  const path = [folder.name];
  let parentId = folder.parentId;

  while (parentId) {
    const parent = folders.find((candidate) => candidate.id === parentId);

    if (!parent) {
      break;
    }

    path.unshift(parent.name);
    parentId = parent.parentId;
  }

  return path.join(" / ");
};

export const folderPathSegments = (folder: FolderItem, folders: FolderItem[]) => {
  const path = [folder];
  let parentId = folder.parentId;

  while (parentId) {
    const parent = folders.find((candidate) => candidate.id === parentId);

    if (!parent) {
      break;
    }

    path.unshift(parent);
    parentId = parent.parentId;
  }

  return path;
};
