# Category photos

Header photos for the homepage category cards.

- **Source:** [Pexels](https://www.pexels.com)
- **License:** [Pexels License](https://www.pexels.com/license/) — free to use,
  including commercially, no attribution required.

Files are named `<category-slug>.jpg` and wired up via the `image` field in
`apps/frontend/src/lib/categories.tsx` (`CATEGORY_META`). Categories without a
file here fall back to an illustrated banner (gradient + icon). To add or swap a
photo, drop a `<slug>.jpg` here and set its path in the meta.
