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
        className="grid h-8 w-[17px] shrink-0 place-items-center rounded-lg bg-transparent outline-none hover:bg-[#f7f8fc] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5]"
        aria-label="Choose folder icon"
        type="button"
      >
        <TriggerIcon
          size={17}
          stroke={1.5}
          color={iconColor}
          aria-hidden="true"
          focusable="false"
        />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          className="z-[80] max-md:!fixed max-md:!inset-0 max-md:!transform-none"
          side="bottom"
          align="start"
          sideOffset={6}
        >
          <Popover.Popup
            className="grid max-h-[min(420px,calc(100vh-24px))] w-[312px] grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden rounded-lg border border-[#dfe4ef] bg-white text-[#242833] shadow-[0_16px_48px_rgb(22_28_43_/_0.18)] outline-none max-md:h-dvh max-md:max-h-dvh max-md:w-screen max-md:rounded-none max-md:border-0 max-md:shadow-none"
            aria-label="Folder icon picker"
          >
            <div className="grid gap-3 border-b border-[#eef1f6] p-3 max-md:px-4 max-md:pt-[calc(1rem+env(safe-area-inset-top))]">
              <label className="flex min-h-10 min-w-0 items-center gap-2.5 rounded-lg border border-[#dfe4ef] bg-white px-2.5 text-[#697080] outline-none focus-within:border-[#3b8df5] focus-within:ring-3 focus-within:ring-[#d9eaff]">
                <IconSearch size={16} stroke={1.5} aria-hidden="true" focusable="false" />
                <input
                  className="min-w-0 flex-1 bg-transparent text-base font-medium text-[#242833] outline-none placeholder:text-[#9aa1ad] md:text-xs"
                  aria-label="Search icons"
                  autoComplete="off"
                  data-1p-ignore="true"
                  data-op-ignore="true"
                  placeholder="Search icons..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
              <div className="flex flex-wrap gap-2" aria-label="Icon colors">
                {FOLDER_ICON_COLORS.map((color) => (
                  <button
                    className={[
                      "grid h-8 w-8 place-items-center rounded-full border outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5] md:h-6 md:w-6",
                      draftIconColor === color ? "border-[#242833]" : "border-[#dfe4ef]"
                    ].join(" ")}
                    aria-label={`Select color ${color}`}
                    key={color}
                    type="button"
                    onClick={() => setDraftIconColor(color)}
                  >
                    <span
                      className="block h-5 w-5 rounded-full md:h-4 md:w-4"
                      style={{ backgroundColor: color }}
                      aria-hidden="true"
                    />
                  </button>
                ))}
              </div>
            </div>
            <div className="min-h-0 overflow-y-auto overscroll-contain p-3 max-md:px-4">
              <div className="grid grid-cols-[repeat(auto-fill,minmax(44px,1fr))] justify-start gap-2 md:grid-cols-[repeat(auto-fill,40px)] md:gap-1.5">
                {filteredIcons.map(({ label, name }) => {
                  const PickerIcon = getFolderIconComponent(name);
                  const isSelected = selectedIcon === name;

                  return (
                    <button
                      className={[
                        "grid h-11 min-w-0 place-items-center rounded-md border bg-white p-1 text-[#4b5262] outline-none hover:bg-[#f7f8fc] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5] md:h-9 md:w-10",
                        isSelected ? "border-[#3b8df5] ring-3 ring-[#d9eaff]" : "border-[#dfe4ef]"
                      ].join(" ")}
                      aria-label={label}
                      aria-pressed={isSelected}
                      key={name}
                      type="button"
                      onClick={() => setDraftIconName(name)}
                    >
                      <PickerIcon
                        size={20}
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
            <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-[#eef1f6] bg-white p-3 max-md:px-4 max-md:pb-[calc(1rem+env(safe-area-inset-bottom))] md:p-2">
              <button
                className="h-10 rounded-md px-3 text-sm font-medium text-[#697080] outline-none hover:bg-[#f7f8fc] hover:text-[#242833] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5] md:h-8 md:text-xs"
                type="button"
                onClick={onCancel}
              >
                Cancel
              </button>
              <button
                className="h-10 rounded-md bg-[#3b8df5] px-4 text-sm font-medium text-white outline-none hover:bg-[#2f7fe6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5] md:h-8 md:px-3 md:text-xs"
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
