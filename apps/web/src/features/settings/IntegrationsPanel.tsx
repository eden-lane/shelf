import { Popover } from "@base-ui/react/popover";
import type { FolderItem, TagItem } from "@shelf/shared";
import {
  IconBrandGithub,
  IconCheck,
  IconChevronDown,
  IconInbox,
  IconPencil,
  IconPlus,
  IconSearch,
  IconTag,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { getFolders, getTags } from "../../api";
import { DEFAULT_FOLDER_ICON_COLOR, getFolderIconComponent } from "../folders/folderIcons";
import { buildFolderTree, folderPath } from "../folders/folderTree";
import type { FolderNode } from "../folders/types";

interface GitHubConditionalRule {
  id: string;
  kind: "conditional";
  ifField: string;
  ifOperator: string;
  ifValue: string;
  thenType: "addTag" | "moveToFolder";
  thenValue: string;
}

interface GitHubDefaultRule {
  id: "default";
  kind: "default";
  thenType: "moveToFolder";
  thenValue: string;
}

type GitHubRule = GitHubDefaultRule | GitHubConditionalRule;
type GitHubRuleAction = Pick<GitHubRule, "thenType" | "thenValue">;

const GITHUB_IF_FIELDS = [
  { value: "language", label: "Language", type: "string" as const },
  { value: "topics", label: "Topic contains", type: "string" as const },
  { value: "name", label: "Name contains", type: "string" as const },
  { value: "stargazers_count", label: "Stars count", type: "number" as const },
  { value: "forks_count", label: "Forks count", type: "number" as const },
  { value: "private", label: "Private", type: "boolean" as const },
  { value: "archived", label: "Archived", type: "boolean" as const },
];

function getOperators(type: "string" | "number" | "boolean") {
  if (type === "string") return ["is", "contains"];
  if (type === "number") return [">", ">=", "<", "<=", "=="];
  return ["is"];
}

function getFieldLabel(field: string) {
  return GITHUB_IF_FIELDS.find((f) => f.value === field)?.label || field;
}

const initialRules: GitHubRule[] = [
  {
    id: "default",
    kind: "default",
    thenType: "moveToFolder",
    thenValue: "inbox",
  },
  {
    id: "r1",
    kind: "conditional",
    ifField: "language",
    ifOperator: "is",
    ifValue: "TypeScript",
    thenType: "addTag",
    thenValue: "typescript",
  },
  {
    id: "r2",
    kind: "conditional",
    ifField: "private",
    ifOperator: "is",
    ifValue: "true",
    thenType: "moveToFolder",
    thenValue: "GitHub / Private",
  },
  {
    id: "r3",
    kind: "conditional",
    ifField: "topics",
    ifOperator: "contains",
    ifValue: "cli",
    thenType: "addTag",
    thenValue: "cli",
  },
];

type FolderOption =
  | { kind: "inbox"; libraryId: null }
  | { kind: "folder"; folder: FolderItem; path: string; depth: number };

const buildFolderOptions = (folders: FolderItem[]): FolderOption[] => {
  const options: FolderOption[] = [{ kind: "inbox", libraryId: null }];
  const appendNode = (node: FolderNode, depth: number) => {
    options.push({
      kind: "folder",
      folder: node as unknown as FolderItem,
      path: folderPath(node as unknown as FolderItem, folders),
      depth,
    });
    for (const child of node.children ?? []) appendNode(child, depth + 1);
  };
  for (const root of buildFolderTree(folders)) appendNode(root, 0);
  return options;
};

const getFolderLabel = (option: FolderOption) =>
  option.kind === "inbox" ? "Inbox" : option.folder.name;

const getFolderDisplayValue = (thenValue: string, folders: FolderItem[] | undefined): string => {
  if (!thenValue) return "";
  if (thenValue === "inbox") return "Inbox";
  if (!folders?.length) return thenValue;
  const folder = folders.find((f) => f.id === thenValue);
  if (folder) return folderPath(folder, folders);
  return thenValue;
};

const getFolderOptionValue = (option: FolderOption) =>
  option.kind === "inbox" ? "inbox" : option.folder.id;

const FolderOptionIcon = ({ option, size = 15 }: { option: FolderOption; size?: number }) => {
  if (option.kind === "inbox") {
    return (
      <IconInbox
        size={size}
        stroke={1.7}
        className="shrink-0"
        color="#697080"
        aria-hidden="true"
        focusable="false"
      />
    );
  }

  const FolderIcon = getFolderIconComponent(option.folder.iconName);
  const iconColor = option.folder.iconColor ?? DEFAULT_FOLDER_ICON_COLOR;

  return (
    <span
      className="grid shrink-0 place-items-center"
      data-settings-folder-picker-icon={option.folder.id}
      data-settings-folder-picker-icon-color={iconColor}
      aria-hidden="true"
    >
      <FolderIcon size={size} stroke={1.7} color={iconColor} aria-hidden="true" focusable="false" />
    </span>
  );
};

const FallbackFolderIcon = ({ size = 15 }: { size?: number }) => {
  const FolderIcon = getFolderIconComponent(null);

  return (
    <FolderIcon
      size={size}
      stroke={1.7}
      color={DEFAULT_FOLDER_ICON_COLOR}
      className="shrink-0"
      aria-hidden="true"
      focusable="false"
    />
  );
};

const Toggle = ({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={() => onChange(!checked)}
    className={[
      "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5]",
      checked ? "bg-[#3b8df5]" : "bg-gray-300",
    ].join(" ")}
  >
    <span
      className={[
        "inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition",
        checked ? "translate-x-[18px]" : "translate-x-[3px]",
      ].join(" ")}
    />
  </button>
);

type RuleFormProps = {
  folders?: FolderItem[];
  tags?: TagItem[];
  initialRule?: GitHubConditionalRule | GitHubDefaultRule;
  variant?: "conditional" | "default";
  submitLabel: string;
  onRefreshLibraryItems: () => void;
  onSubmit: (data: Omit<GitHubConditionalRule, "id" | "kind"> | GitHubRuleAction) => void;
  onCancel: () => void;
};

const RuleForm = ({
  folders = [],
  tags = [],
  initialRule,
  variant = "conditional",
  submitLabel,
  onRefreshLibraryItems,
  onSubmit,
  onCancel,
}: RuleFormProps) => {
  const initialConditionalRule = initialRule?.kind === "conditional" ? initialRule : undefined;
  const isDefaultRule = variant === "default";
  const [ifField, setIfField] = useState(initialConditionalRule?.ifField ?? "language");
  const [ifOperator, setIfOperator] = useState(initialConditionalRule?.ifOperator ?? "is");
  const [ifValue, setIfValue] = useState(initialConditionalRule?.ifValue ?? "");
  const [thenType, setThenType] = useState<"addTag" | "moveToFolder">(
    initialRule?.thenType ?? "addTag",
  );
  const [thenValue, setThenValue] = useState(initialRule?.thenValue ?? "");

  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  const [tagSearch, setTagSearch] = useState("");
  const tagSearchRef = useRef<HTMLInputElement>(null);

  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [folderSearch, setFolderSearch] = useState("");
  const folderSearchRef = useRef<HTMLInputElement>(null);

  const fieldDef = GITHUB_IF_FIELDS.find((f) => f.value === ifField);
  const fieldType = fieldDef?.type ?? "string";
  const operators = getOperators(fieldType);

  const handleFieldChange = (newField: string) => {
    setIfField(newField);
    const def = GITHUB_IF_FIELDS.find((f) => f.value === newField);
    if (!def) {
      return;
    }
    const ops = getOperators(def.type);
    setIfOperator(ops[0]);
    setIfValue(def.type === "boolean" ? "true" : def.type === "number" ? "100" : "");
  };

  const handleThenTypeChange = (next: "addTag" | "moveToFolder") => {
    setThenType(next);
    setThenValue("");
  };

  const displayedTags = useMemo(() => {
    const q = tagSearch.trim().toLowerCase();
    return q ? tags.filter((t) => t.name.toLowerCase().includes(q)) : tags;
  }, [tags, tagSearch]);

  const folderOptions = useMemo(() => buildFolderOptions(folders), [folders]);
  const selectedFolderOption = useMemo(
    () => folderOptions.find((option) => getFolderOptionValue(option) === thenValue) ?? null,
    [folderOptions, thenValue],
  );

  const displayedFolderOptions = useMemo(() => {
    const q = folderSearch.trim().toLowerCase();
    if (!q) return folderOptions;
    return folderOptions.filter((o) => {
      const text = o.kind === "inbox" ? "inbox" : o.path.toLowerCase();
      return text.includes(q);
    });
  }, [folderOptions, folderSearch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!thenValue.trim()) return;
    if (isDefaultRule) {
      onSubmit({ thenType: "moveToFolder", thenValue: thenValue.trim() });
      return;
    }
    if (!ifValue.trim()) return;
    onSubmit({
      ifField,
      ifOperator,
      ifValue: ifValue.trim(),
      thenType,
      thenValue: thenValue.trim(),
    });
  };

  const selectClassName =
    "rounded-md border border-[#dfe4ef] bg-white px-2 py-1.5 text-sm text-[#242833] outline-none focus-visible:border-[#3b8df5] focus-visible:ring-2 focus-visible:ring-[#d9eaff]";

  const pickerTriggerClassName =
    "inline-flex h-8 min-w-0 flex-1 items-center gap-1.5 truncate rounded-md border border-[#dfe4ef] bg-white px-2.5 text-sm text-[#242833] outline-none hover:border-[#c8cfd9] focus-visible:border-[#3b8df5] focus-visible:ring-2 focus-visible:ring-[#d9eaff] data-[popup-open]:border-[#3b8df5]";

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 rounded-lg bg-[#f7f9fc] p-3 text-sm">
      {!isDefaultRule && (
        <div className="grid gap-1.5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-600">
            IF
          </div>
          <div className="flex flex-wrap gap-1.5">
            <select
              value={ifField}
              onChange={(e) => handleFieldChange(e.target.value)}
              className={selectClassName}
            >
              {GITHUB_IF_FIELDS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>

            {fieldType !== "boolean" && (
              <select
                value={ifOperator}
                onChange={(e) => setIfOperator(e.target.value)}
                className={selectClassName}
              >
                {operators.map((op) => (
                  <option key={op} value={op}>
                    {op}
                  </option>
                ))}
              </select>
            )}

            {fieldType === "boolean" ? (
              <select
                value={ifValue}
                onChange={(e) => setIfValue(e.target.value)}
                className={selectClassName}
              >
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            ) : fieldType === "number" ? (
              <input
                type="number"
                min="0"
                value={ifValue}
                onChange={(e) => setIfValue(e.target.value)}
                className={`${selectClassName} w-24`}
                placeholder="e.g. 1000"
              />
            ) : (
              <input
                type="text"
                value={ifValue}
                onChange={(e) => setIfValue(e.target.value)}
                className={`${selectClassName} min-w-[8rem] flex-1`}
                placeholder="e.g. TypeScript"
              />
            )}
          </div>
        </div>
      )}

      {/* THEN row */}
      <div className="grid gap-1.5">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600">
          THEN
        </div>
        <div className="flex gap-1.5">
          {!isDefaultRule && (
            <select
              value={thenType}
              onChange={(e) => handleThenTypeChange(e.target.value as "addTag" | "moveToFolder")}
              className={selectClassName}
            >
              <option value="addTag">Add tag</option>
              <option value="moveToFolder">Move to folder</option>
            </select>
          )}

          {thenType === "addTag" ? (
            <Popover.Root
              open={tagPickerOpen}
              onOpenChange={(open) => {
                setTagPickerOpen(open);
                if (open) {
                  onRefreshLibraryItems();
                  setTagSearch("");
                }
              }}
            >
              <Popover.Trigger className={pickerTriggerClassName} type="button">
                {thenValue ? (
                  <>
                    {tags.find((t) => t.name === thenValue) ? (
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{
                          backgroundColor:
                            tags.find((t) => t.name === thenValue)?.color ?? "#697080",
                        }}
                        aria-hidden="true"
                      />
                    ) : (
                      <IconTag
                        size={13}
                        stroke={1.7}
                        className="shrink-0 text-[#697080]"
                        aria-hidden="true"
                      />
                    )}
                    <span className="min-w-0 flex-1 truncate text-left">{thenValue}</span>
                  </>
                ) : (
                  <span className="text-[#9aa1ad]">Select tag…</span>
                )}
                <IconChevronDown
                  size={12}
                  stroke={1.8}
                  className="ml-auto shrink-0 text-[#697080]"
                  aria-hidden="true"
                />
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Positioner className="z-[70] outline-none" align="start" sideOffset={4}>
                  <Popover.Popup className="w-[min(260px,var(--available-width))] overflow-hidden rounded-xl border border-[#dfe4ef] bg-white shadow-[0_16px_48px_rgb(22_28_43_/_0.18)] outline-none">
                    <div className="border-b border-[#eef1f6] p-2">
                      <label className="flex min-h-8 items-center gap-2 rounded-lg bg-[#f7f8fc] px-2 text-[#697080] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#d9eaff]">
                        <IconSearch size={14} stroke={1.7} aria-hidden="true" />
                        <input
                          ref={tagSearchRef}
                          className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-[#242833] outline-none placeholder:text-[#9aa1ad]"
                          placeholder="Search tags…"
                          autoComplete="off"
                          value={tagSearch}
                          onChange={(e) => setTagSearch(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              const name = tagSearch.trim();
                              if (name) {
                                setThenValue(name);
                                setTagPickerOpen(false);
                              }
                            }
                          }}
                        />
                      </label>
                    </div>
                    <div className="max-h-[200px] overflow-y-auto py-1">
                      {tagSearch.trim() &&
                        !tags.some(
                          (t) => t.name.toLowerCase() === tagSearch.trim().toLowerCase(),
                        ) && (
                          <button
                            type="button"
                            className="flex min-h-9 w-full items-center gap-2 px-3 py-1.5 text-left text-sm font-medium text-[#3b8df5] outline-none hover:bg-[#f0f6ff]"
                            onClick={() => {
                              setThenValue(tagSearch.trim());
                              setTagPickerOpen(false);
                            }}
                          >
                            <IconPlus size={14} stroke={1.8} aria-hidden="true" />
                            Create "{tagSearch.trim()}"
                          </button>
                        )}
                      {displayedTags.map((tag) => (
                        <button
                          key={tag.id}
                          type="button"
                          className="flex min-h-9 w-full items-center gap-2 px-3 py-1.5 text-left text-sm font-medium text-[#4b5262] outline-none hover:bg-[#f0f6ff] hover:text-[#242833]"
                          onClick={() => {
                            setThenValue(tag.name);
                            setTagPickerOpen(false);
                          }}
                        >
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ backgroundColor: tag.color ?? "#697080" }}
                            aria-hidden="true"
                          />
                          <span className="min-w-0 flex-1 truncate">{tag.name}</span>
                          {thenValue === tag.name && (
                            <IconCheck
                              size={14}
                              stroke={2}
                              className="shrink-0 text-[#3b8df5]"
                              aria-hidden="true"
                            />
                          )}
                        </button>
                      ))}
                      {displayedTags.length === 0 && !tagSearch.trim() && (
                        <p className="px-3 py-2 text-sm text-[#697080]">No tags yet.</p>
                      )}
                    </div>
                  </Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            </Popover.Root>
          ) : (
            <Popover.Root
              open={folderPickerOpen}
              onOpenChange={(open) => {
                setFolderPickerOpen(open);
                if (open) {
                  onRefreshLibraryItems();
                  setFolderSearch("");
                }
              }}
            >
              <Popover.Trigger className={pickerTriggerClassName} type="button">
                {thenValue ? (
                  <>
                    {selectedFolderOption ? (
                      <FolderOptionIcon option={selectedFolderOption} size={14} />
                    ) : (
                      <FallbackFolderIcon size={14} />
                    )}
                    <span className="min-w-0 flex-1 truncate text-left">
                      {getFolderDisplayValue(thenValue, folders)}
                    </span>
                  </>
                ) : (
                  <span className="text-[#9aa1ad]">Select folder…</span>
                )}
                <IconChevronDown
                  size={12}
                  stroke={1.8}
                  className="ml-auto shrink-0 text-[#697080]"
                  aria-hidden="true"
                />
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Positioner className="z-[70] outline-none" align="start" sideOffset={4}>
                  <Popover.Popup className="w-[min(260px,var(--available-width))] overflow-hidden rounded-xl border border-[#dfe4ef] bg-white shadow-[0_16px_48px_rgb(22_28_43_/_0.18)] outline-none">
                    <div className="border-b border-[#eef1f6] p-2">
                      <label className="flex min-h-8 items-center gap-2 rounded-lg bg-[#f7f8fc] px-2 text-[#697080] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#d9eaff]">
                        <IconSearch size={14} stroke={1.7} aria-hidden="true" />
                        <input
                          ref={folderSearchRef}
                          className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-[#242833] outline-none placeholder:text-[#9aa1ad]"
                          placeholder="Search folders…"
                          autoComplete="off"
                          value={folderSearch}
                          onChange={(e) => setFolderSearch(e.target.value)}
                        />
                      </label>
                    </div>
                    <div className="max-h-[200px] overflow-y-auto py-1">
                      {displayedFolderOptions.map((option) => {
                        const label = getFolderLabel(option);
                        const value = getFolderOptionValue(option);
                        const selected = thenValue === value;
                        return (
                          <button
                            key={value}
                            type="button"
                            className="flex min-h-9 w-full items-center gap-2 px-3 py-1.5 text-left text-sm font-medium text-[#4b5262] outline-none hover:bg-[#f0f6ff] hover:text-[#242833]"
                            style={{
                              paddingLeft: option.kind === "folder" ? 12 + option.depth * 12 : 12,
                            }}
                            onClick={() => {
                              setThenValue(value);
                              setFolderPickerOpen(false);
                            }}
                          >
                            <FolderOptionIcon option={option} size={14} />
                            <span className="min-w-0 flex-1 truncate">{label}</span>
                            {selected && (
                              <IconCheck
                                size={14}
                                stroke={2}
                                className="shrink-0 text-[#3b8df5]"
                                aria-hidden="true"
                              />
                            )}
                          </button>
                        );
                      })}
                      {displayedFolderOptions.length === 0 && (
                        <p className="px-3 py-2 text-sm text-[#697080]">No folders found.</p>
                      )}
                    </div>
                  </Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            </Popover.Root>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-xs font-medium text-[#697080] hover:bg-white hover:text-[#242833]"
        >
          <IconX size={12} stroke={2} aria-hidden="true" />
          Cancel
        </button>
        <button
          type="submit"
          className="inline-flex h-7 items-center gap-1 rounded-md bg-[#3b8df5] px-2.5 text-xs font-medium text-white hover:bg-[#2f7ad8]"
        >
          <IconCheck size={12} stroke={2.5} aria-hidden="true" />
          {submitLabel}
        </button>
      </div>
    </form>
  );
};

const IntegrationsPanel = ({
  folders = [],
  tags = [],
  onRefreshLibraryItems,
}: {
  folders: FolderItem[];
  tags: TagItem[];
  onRefreshLibraryItems: () => void;
}) => {
  const foldersQuery = useQuery({
    initialData: folders,
    queryFn: getFolders,
    queryKey: ["folders"],
    refetchOnMount: "always",
  });
  const tagsQuery = useQuery({
    initialData: tags,
    queryFn: getTags,
    queryKey: ["tags"],
    refetchOnMount: "always",
  });
  const [githubEnabled, setGithubEnabled] = useState(false);
  const [githubExpanded, setGithubExpanded] = useState(true);
  const [rules, setRules] = useState<GitHubRule[]>(initialRules);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const panelFolders = foldersQuery.data ?? folders;
  const panelTags = tagsQuery.data ?? tags;
  const orderedRules = useMemo(() => {
    const defaultRule = rules.find((rule) => rule.kind === "default");
    const conditionalRules = rules.filter((rule) => rule.kind === "conditional");

    return defaultRule ? [defaultRule, ...conditionalRules] : conditionalRules;
  }, [rules]);

  const refreshLibraryItems = () => {
    onRefreshLibraryItems();
    void foldersQuery.refetch();
    void tagsQuery.refetch();
  };

  const handleToggle = (enabled: boolean) => {
    if (!enabled) {
      setIsAdding(false);
      setEditingId(null);
    }
    setGithubEnabled(enabled);
    setGithubExpanded(enabled);
  };

  const startEdit = (rule: GitHubRule) => {
    setEditingId(rule.id);
    setIsAdding(false);
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = (
    id: string,
    data: Omit<GitHubConditionalRule, "id" | "kind"> | GitHubRuleAction,
  ) => {
    setRules((prev) =>
      prev.map((rule) => {
        if (rule.id !== id) {
          return rule;
        }

        if (rule.kind === "default") {
          return {
            ...rule,
            thenType: "moveToFolder",
            thenValue: data.thenValue,
          };
        }

        return {
          id,
          kind: "conditional",
          ...(data as Omit<GitHubConditionalRule, "id" | "kind">),
        };
      }),
    );
    setEditingId(null);
  };

  const deleteRule = (id: string) => {
    if (id === "default") {
      return;
    }
    setRules((prev) => prev.filter((r) => r.id !== id));
    if (editingId === id) setEditingId(null);
  };

  const startAdd = () => {
    setIsAdding(true);
    setEditingId(null);
  };

  const saveAdd = (data: Omit<GitHubConditionalRule, "id" | "kind"> | GitHubRuleAction) => {
    setRules((prev) => [
      ...prev,
      {
        id: `r${Date.now()}`,
        kind: "conditional",
        ...(data as Omit<GitHubConditionalRule, "id" | "kind">),
      },
    ]);
    setIsAdding(false);
  };

  return (
    <section className="grid gap-5">
      <p className="m-0 text-sm leading-5 text-[#697080]">
        Connect external services to import and sync content.
      </p>

      <div className="grid gap-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 text-[#242833]">
            <IconBrandGithub size={20} stroke={1.75} aria-hidden="true" focusable="false" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="m-0 text-sm font-medium text-slate-950">GitHub</h4>
            <p className="m-0 mt-0.5 text-sm leading-5 text-gray-500">
              Sync your starred repositories as saved items. Import stars and organize them using
              folders and tags.
            </p>
          </div>
          <div className="flex items-center gap-1.5 pt-0.5">
            <Toggle
              checked={githubEnabled}
              onChange={handleToggle}
              label="Enable GitHub integration"
            />
            {githubEnabled && (
              <button
                type="button"
                aria-expanded={githubExpanded}
                aria-label={githubExpanded ? "Collapse GitHub settings" : "Expand GitHub settings"}
                className="grid h-7 w-7 place-items-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5]"
                onClick={() => setGithubExpanded(!githubExpanded)}
              >
                <IconChevronDown
                  size={16}
                  stroke={2}
                  className={`transition-transform ${githubExpanded ? "rotate-180" : ""}`}
                  aria-hidden="true"
                />
              </button>
            )}
          </div>
        </div>

        {githubEnabled && githubExpanded && (
          <div className="grid gap-5">
            <button
              type="button"
              className="inline-flex h-8 items-center gap-2 self-start rounded-lg bg-[#f2f6fb] px-3 text-sm font-medium text-slate-950 outline-none hover:bg-[#eaf1fa] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5]"
              onClick={() => {}}
            >
              Connect an account
            </button>

            <div className="grid gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="m-0 text-sm font-medium text-slate-950">Rules</p>
                  <p className="m-0 text-xs text-gray-500">
                    Define how starred repositories are organized on import.
                  </p>
                </div>
                {!isAdding && (
                  <button
                    type="button"
                    onClick={startAdd}
                    className="inline-flex h-7 items-center gap-1 rounded-md bg-[#f2f6fb] px-2 text-xs font-medium text-gray-600 hover:bg-[#eaf1fa]"
                  >
                    <IconPlus size={13} stroke={2.5} aria-hidden="true" />
                    Add rule
                  </button>
                )}
              </div>

              <div className="grid gap-2">
                {isAdding && (
                  <RuleForm
                    folders={panelFolders}
                    tags={panelTags}
                    submitLabel="Add rule"
                    onRefreshLibraryItems={refreshLibraryItems}
                    onSubmit={saveAdd}
                    onCancel={() => setIsAdding(false)}
                  />
                )}

                {orderedRules.map((rule) =>
                  editingId === rule.id ? (
                    <RuleForm
                      key={rule.id}
                      folders={panelFolders}
                      tags={panelTags}
                      initialRule={rule}
                      variant={rule.kind === "default" ? "default" : "conditional"}
                      submitLabel="Save"
                      onRefreshLibraryItems={refreshLibraryItems}
                      onSubmit={(data) => saveEdit(rule.id, data)}
                      onCancel={cancelEdit}
                    />
                  ) : rule.kind === "default" ? (
                    <div
                      key={rule.id}
                      className="group relative grid gap-2 rounded-lg bg-[#eef5ff] p-3 pr-12 text-sm"
                      data-settings-rule-row="default"
                    >
                      <div className="flex items-start gap-3">
                        <span className="w-16 shrink-0 text-[11px] font-semibold uppercase tracking-wider text-[#3b8df5]">
                          Default
                        </span>
                        <div className="min-w-0 flex-1 font-medium leading-snug text-slate-950">
                          Save bookmarks to{" "}
                          <span className="font-semibold">
                            "{getFolderDisplayValue(rule.thenValue, panelFolders)}"
                          </span>
                        </div>
                      </div>
                      <div className="absolute right-3 top-3 flex items-center gap-1 opacity-70 transition group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => startEdit(rule)}
                          className="grid h-6 w-6 place-items-center rounded text-gray-500 hover:bg-white/70 hover:text-slate-700"
                          aria-label="Edit default rule"
                        >
                          <IconPencil size={14} stroke={2} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      key={rule.id}
                      className="group relative grid gap-2 rounded-lg bg-[#f7f9fc] p-3 pr-16 text-sm"
                      data-settings-rule-row="conditional"
                    >
                      <div className="flex items-start gap-3">
                        <span className="w-16 shrink-0 text-[11px] font-semibold uppercase tracking-wider text-amber-600">
                          IF
                        </span>
                        <div className="min-w-0 flex-1 font-medium leading-snug text-slate-950">
                          {getFieldLabel(rule.ifField)} {rule.ifOperator}{" "}
                          <span className="font-semibold">{rule.ifValue}</span>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <span className="w-16 shrink-0 text-[11px] font-semibold uppercase tracking-wider text-emerald-600">
                          THEN
                        </span>
                        <div className="min-w-0 flex-1 font-medium leading-snug text-slate-950">
                          {rule.thenType === "addTag" ? "Add tag" : "Move to folder"}{" "}
                          <span className="font-semibold">
                            "
                            {rule.thenType === "moveToFolder"
                              ? getFolderDisplayValue(rule.thenValue, panelFolders)
                              : rule.thenValue}
                            "
                          </span>
                        </div>
                      </div>
                      <div className="absolute right-3 top-3 flex items-center gap-1 opacity-60 transition group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => startEdit(rule)}
                          className="grid h-6 w-6 place-items-center rounded text-gray-500 hover:bg-gray-100 hover:text-slate-700"
                          aria-label="Edit rule"
                        >
                          <IconPencil size={14} stroke={2} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteRule(rule.id)}
                          className="grid h-6 w-6 place-items-center rounded text-red-500 hover:bg-red-50"
                          aria-label="Delete rule"
                        >
                          <IconTrash size={14} stroke={2} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

export default IntegrationsPanel;
