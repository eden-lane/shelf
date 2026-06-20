import { useEffect, useMemo, useState } from "react";
import { Popover } from "@base-ui/react/popover";
import { IconSearch } from "@tabler/icons-react";
import {
  ALL_FOLDER_ICON_OPTIONS,
  FOLDER_ICON_COLORS,
  FOLDER_ICON_OPTIONS,
  FOLDER_ICON_RESULT_LIMIT,
  getFolderIconComponent,
  normalizeFolderIconName
} from "./folderIcons";

export const FolderIconPickerDropdown = ({
  iconColor,
  iconName,
  isOpen,
  onCancel,
  onCommit,
  onOpenChange
}: {
  iconColor: string;
  iconName: string;
  isOpen: boolean;
  onCancel: () => void;
  onCommit: (iconName: string, iconColor: string) => void;
  onOpenChange: (open: boolean) => void;
}) => {
  const [search, setSearch] = useState("");
  const [draftIconName, setDraftIconName] = useState(iconName);
  const [draftIconColor, setDraftIconColor] = useState(iconColor);
  const TriggerIcon = getFolderIconComponent(iconName);
  const selectedIcon = normalizeFolderIconName(draftIconName);
  const filteredIcons = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return FOLDER_ICON_OPTIONS;
    }

    return ALL_FOLDER_ICON_OPTIONS.filter(
      (icon) =>
        icon.label.toLowerCase().includes(query) ||
        icon.name.toLowerCase().includes(query) ||
        icon.id?.toLowerCase().includes(query)
    ).slice(0, FOLDER_ICON_RESULT_LIMIT);
  }, [search]);

  useEffect(() => {
    if (isOpen) {
      setSearch("");
      setDraftIconName(normalizeFolderIconName(iconName));
      setDraftIconColor(iconColor);
    }
  }, [iconColor, iconName, isOpen]);

  return (
    <Popover.Root open={isOpen} onOpenChange={onOpenChange}>
      <Popover.Trigger
        className="grid h-8 w-[21px] shrink-0 place-items-center rounded-lg border border-transparent bg-transparent outline-none hover:bg-[#f7f8fc] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5]"
        aria-label="Choose folder icon"
        type="button"
      >
        <TriggerIcon
          size={19}
          stroke={1.5}
          color={iconColor}
          aria-hidden="true"
          focusable="false"
        />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner className="z-[80]" side="bottom" align="start" sideOffset={6}>
          <Popover.Popup
            className="grid max-h-[min(420px,calc(100vh-24px))] w-[312px] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-lg border border-[#dfe4ef] bg-white text-[#242833] shadow-[0_16px_48px_rgb(22_28_43_/_0.18)] outline-none"
            aria-label="Folder icon picker"
          >
            <div className="grid gap-2 border-b border-[#eef1f6] p-2.5">
              <label className="flex min-h-10 min-w-0 items-center gap-2.5 rounded-lg border border-[#dfe4ef] bg-white px-2.5 text-[#697080] outline-none focus-within:border-[#3b8df5] focus-within:ring-3 focus-within:ring-[#d9eaff]">
                <IconSearch size={16} stroke={1.5} aria-hidden="true" focusable="false" />
                <input
                  className="min-w-0 flex-1 bg-transparent text-xs font-medium text-[#242833] outline-none placeholder:text-[#9aa1ad]"
                  aria-label="Search icons"
                  placeholder="Search icons..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
              <div className="flex flex-wrap gap-1.5" aria-label="Icon colors">
                {FOLDER_ICON_COLORS.map((color) => (
                  <button
                    className={[
                      "grid h-6 w-6 place-items-center rounded-full border outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5]",
                      draftIconColor === color ? "border-[#242833]" : "border-[#dfe4ef]"
                    ].join(" ")}
                    aria-label={`Select color ${color}`}
                    key={color}
                    type="button"
                    onClick={() => setDraftIconColor(color)}
                  >
                    <span
                      className="block h-4 w-4 rounded-full"
                      style={{ backgroundColor: color }}
                      aria-hidden="true"
                    />
                  </button>
                ))}
              </div>
            </div>
            <div className="min-h-0 overflow-y-auto p-2">
              <div className="grid grid-cols-[repeat(auto-fill,40px)] justify-start gap-1.5">
                {filteredIcons.map(({ label, name }) => {
                  const PickerIcon = getFolderIconComponent(name);
                  const isSelected = selectedIcon === name;

                  return (
                    <button
                      className={[
                        "grid h-9 w-10 place-items-center rounded-md border bg-white p-1 text-[#4b5262] outline-none hover:bg-[#f7f8fc] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5]",
                        isSelected ? "border-[#3b8df5] ring-3 ring-[#d9eaff]" : "border-[#dfe4ef]"
                      ].join(" ")}
                      aria-label={label}
                      aria-pressed={isSelected}
                      key={name}
                      type="button"
                      onClick={() => setDraftIconName(name)}
                    >
                      <PickerIcon
                        size={18}
                        stroke={1.5}
                        color={draftIconColor}
                        aria-hidden="true"
                        focusable="false"
                      />
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-[#eef1f6] bg-white p-2">
              <button
                className="h-8 rounded-md px-3 text-xs font-medium text-[#697080] outline-none hover:bg-[#f7f8fc] hover:text-[#242833] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5]"
                type="button"
                onClick={onCancel}
              >
                Cancel
              </button>
              <button
                className="h-8 rounded-md bg-[#3b8df5] px-3 text-xs font-medium text-white outline-none hover:bg-[#2f7fe6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5]"
                type="button"
                onClick={() => onCommit(selectedIcon, draftIconColor)}
              >
                Okay
              </button>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
};
