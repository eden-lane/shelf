import type { FolderItem } from "@shelf/shared";

export type FolderNode = FolderItem & {
  children: FolderNode[];
};

export type FolderFormValue = {
  name: string;
  iconName: string | null;
  iconColor: string | null;
};
