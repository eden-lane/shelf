import * as TablerIcons from "@tabler/icons-react";
import {
  IconArchive,
  IconBook,
  IconBookmark,
  IconBriefcase,
  IconBulb,
  IconCalendar,
  IconCode,
  IconCoffee,
  IconDeviceGamepad2,
  IconFileText,
  IconFolder,
  IconHeart,
  IconHome,
  IconInbox,
  IconLink,
  IconMap,
  IconMovie,
  IconMusic,
  IconPalette,
  IconPhoto,
  IconPlane,
  IconSchool,
  IconShoppingCart,
  IconStar,
  IconTag,
  IconWorld
} from "@tabler/icons-react";

export const DEFAULT_FOLDER_ICON_NAME = "IconFolder";
export const DEFAULT_FOLDER_ICON_COLOR = "#697080";
export type TablerIconComponent = typeof IconFolder;

const TABLER_ICON_COMPONENTS = TablerIcons as unknown as Record<
  string,
  TablerIconComponent | undefined
>;
const TABLER_ICON_IDS =
  ((TablerIcons.iconsList as unknown as { default?: string[] }).default ?? []).filter(Boolean);

type FolderIconOption = { id?: string; name: string; label: string };

export const FOLDER_ICON_OPTIONS: FolderIconOption[] = [
  { name: "IconFolder", label: "Folder" },
  { name: "IconInbox", label: "Inbox" },
  { name: "IconArchive", label: "Archive" },
  { name: "IconBookmark", label: "Bookmark" },
  { name: "IconBook", label: "Book" },
  { name: "IconFileText", label: "Document" },
  { name: "IconBriefcase", label: "Work" },
  { name: "IconCode", label: "Code" },
  { name: "IconBulb", label: "Ideas" },
  { name: "IconHeart", label: "Favorites" },
  { name: "IconHome", label: "Home" },
  { name: "IconLink", label: "Links" },
  { name: "IconPhoto", label: "Photos" },
  { name: "IconMovie", label: "Movies" },
  { name: "IconMusic", label: "Music" },
  { name: "IconPalette", label: "Design" },
  { name: "IconPlane", label: "Travel" },
  { name: "IconMap", label: "Places" },
  { name: "IconSchool", label: "Learning" },
  { name: "IconShoppingCart", label: "Shopping" },
  { name: "IconDeviceGamepad2", label: "Games" },
  { name: "IconCoffee", label: "Coffee" },
  { name: "IconCalendar", label: "Calendar" },
  { name: "IconStar", label: "Star" },
  { name: "IconTag", label: "Tag" },
  { name: "IconWorld", label: "World" }
];
export const FOLDER_ICON_RESULT_LIMIT = FOLDER_ICON_OPTIONS.length;
export const ALL_FOLDER_ICON_OPTIONS = TABLER_ICON_IDS.map((id) => ({
  id,
  name: toFolderIconComponentName(id),
  label: formatFolderIconLabel(id)
}))
  .filter(({ name }) => TABLER_ICON_COMPONENTS[name])
  .sort((first, second) => first.label.localeCompare(second.label));

export const FOLDER_ICON_COLORS = [
  "#697080",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#3b82f6",
  "#6366f1",
  "#a855f7",
  "#ec4899"
];

function formatFolderIconLabel(iconNameOrId: string) {
  return iconNameOrId
    .replace(/^Icon/, "")
    .replace(/-/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/(\d+)/g, " $1")
    .replace(/\s+/g, " ")
    .trim();
}

function toFolderIconComponentName(iconId: string) {
  return `Icon${iconId
    .split("-")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : ""))
    .join("")}`;
}

export const normalizeFolderIconName = (iconName: string | null | undefined) =>
  iconName && TABLER_ICON_COMPONENTS[iconName] ? iconName : DEFAULT_FOLDER_ICON_NAME;

export const getFolderIconComponent = (iconName: string | null | undefined) =>
  TABLER_ICON_COMPONENTS[normalizeFolderIconName(iconName)] ?? IconFolder;

export const folderRowIndent = (level: number) => level * 12;
