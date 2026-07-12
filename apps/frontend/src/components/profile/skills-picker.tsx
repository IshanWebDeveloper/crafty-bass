'use client';

import { Combobox, Tag } from '@repo/ui';
import type { Skill } from '@/lib/api/profiles';

/**
 * Skills editor shared by the tradesman profile form and the onboarding wizard.
 *
 * A single searchable dropdown filters the seeded catalog; if the query matches
 * nothing, a "create" row lets the tradesman add their own skill. Selected skills
 * (catalog picks + typed names) show as removable tags. The backend find-or-creates
 * each typed name into the shared catalog on save.
 *
 * State is owned by the parent so it can be submitted: `selectedIds` are catalog
 * picks; `customSkills` are the not-yet-persisted typed names. `createLabel` may
 * contain `{q}` - replaced with the typed query.
 */
export function SkillsPicker({
  skills,
  selectedIds,
  onToggleId,
  customSkills,
  onAddCustom,
  onRemoveCustom,
  searchPlaceholder,
  createLabel,
  emptyText,
}: {
  skills: Skill[] | undefined;
  selectedIds: Set<string>;
  onToggleId: (id: string, on: boolean) => void;
  customSkills: string[];
  onAddCustom: (name: string) => void;
  onRemoveCustom: (name: string) => void;
  searchPlaceholder: string;
  createLabel: string;
  emptyText: string;
}) {
  const selectedCatalog = (skills ?? []).filter((s) => selectedIds.has(s.id));
  // Only offer catalog skills that aren't already selected in the dropdown.
  const items = (skills ?? [])
    .filter((s) => !selectedIds.has(s.id))
    .map((s) => ({ value: s.id, label: s.nameEn }));

  // A typed name that matches a catalog skill selects that chip instead of adding
  // a duplicate custom entry; otherwise it becomes a pending custom tag.
  function handleCreate(raw: string) {
    const name = raw.trim();
    if (!name) return;
    const match = skills?.find(
      (s) => s.nameEn.toLowerCase() === name.toLowerCase(),
    );
    if (match) {
      onToggleId(match.id, true);
    } else if (
      !customSkills.some((s) => s.toLowerCase() === name.toLowerCase())
    ) {
      onAddCustom(name);
    }
  }

  const hasSelection = selectedCatalog.length > 0 || customSkills.length > 0;

  return (
    <div className="space-y-2.5">
      {/* Remount on each add so the input/query resets after a pick. */}
      <Combobox
        key={`${selectedIds.size}-${customSkills.length}`}
        items={items}
        value={null}
        onValueChange={(id) => {
          if (id) onToggleId(id, true);
        }}
        onCreate={handleCreate}
        createLabel={(q) => createLabel.replace('{q}', q)}
        placeholder={searchPlaceholder}
        emptyText={emptyText}
        aria-label={searchPlaceholder}
      />

      {hasSelection ? (
        <div className="flex flex-wrap gap-2">
          {selectedCatalog.map((s) => (
            <Tag
              key={s.id}
              variant="active"
              onRemove={() => onToggleId(s.id, false)}
              removeLabel={`Remove ${s.nameEn}`}
            >
              {s.nameEn}
            </Tag>
          ))}
          {customSkills.map((name) => (
            <Tag
              key={name}
              variant="soft"
              onRemove={() => onRemoveCustom(name)}
              removeLabel={`Remove ${name}`}
            >
              {name}
            </Tag>
          ))}
        </div>
      ) : null}
    </div>
  );
}
