'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Input } from '@repo/ui';
import { ApiError } from '@/lib/api';
import {
  listCategories,
  createCategory,
  type AdminCategory,
} from '@/lib/api/categories';

const categoriesKey = ['categories'] as const;

export function CategoriesManager() {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: categories, isPending } = useQuery({
    queryKey: categoriesKey,
    queryFn: listCategories,
  });

  const create = useMutation({
    mutationFn: () =>
      createCategory({
        name: name.trim(),
        parentId: parentId || undefined,
      }),
    onSuccess: () => {
      setName('');
      setParentId('');
      setError(null);
      void qc.invalidateQueries({ queryKey: categoriesKey });
    },
    onError: (err) =>
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Failed to create category',
      ),
  });

  const roots = categories ?? [];

  return (
    <div className="space-y-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim().length > 0) create.mutate();
        }}
        className="rounded-xl border border-border p-4"
      >
        <h2 className="text-lg font-medium">Add a trade category</h2>
        <p className="text-sm text-muted-foreground">
          The slug is generated from the name. Optionally nest it under a parent
          category.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1 space-y-1.5">
            <span className="text-sm font-medium">Name</span>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Appliance repair"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium">Parent (optional)</span>
            <select
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="h-8 w-full min-w-48 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            >
              <option value="">— None (top level) —</option>
              {roots.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nameEn}
                </option>
              ))}
            </select>
          </label>
          <Button
            type="submit"
            disabled={name.trim().length === 0 || create.isPending}
          >
            {create.isPending ? 'Adding…' : 'Add category'}
          </Button>
        </div>
        {error ? (
          <p className="mt-3 text-sm text-destructive">{error}</p>
        ) : null}
      </form>

      <div className="rounded-xl border border-border p-4">
        <h2 className="text-lg font-medium">Trade categories</h2>
        {isPending ? (
          <p className="mt-3 text-sm text-muted-foreground">Loading…</p>
        ) : roots.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No categories yet.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {roots.map((c) => (
              <CategoryRow key={c.id} category={c} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function CategoryRow({ category }: { category: AdminCategory }) {
  return (
    <li>
      <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2">
        <span className="text-sm font-medium">{category.nameEn}</span>
        <code className="text-xs text-muted-foreground">{category.slug}</code>
      </div>
      {category.children && category.children.length > 0 ? (
        <ul className="mt-2 ml-4 space-y-2 border-l border-border pl-4">
          {category.children.map((child) => (
            <CategoryRow key={child.id} category={child} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
