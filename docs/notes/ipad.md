# iPad Adaptation Plan

## Core Problem

The app is built with hardcoded pixel values (font sizes, widths, tile counts) designed for a ~375px wide iPhone screen. On iPad (~768–1024px), everything stretches to fill the extra space rather than adapting.

---

## Changes Needed (priority order)

### 1. Max-width content container — quick win, fixes stretching everywhere

Wrap all screen content in a centered container:

```ts
<View style={{ maxWidth: 680, width: '100%', alignSelf: 'center' }}>
  {/* screen content */}
</View>
```

This alone makes most screens look reasonable without touching individual components.

---

### 2. Font scaling — most important for IDD users

Every `fontSize` is hardcoded. Add a single `scale()` utility in `responsive.ts`:

```ts
const BASE_WIDTH = 375;
export const scale = (size: number) =>
  Math.round(size * (Dimensions.get('window').width / BASE_WIDTH));
```

Then replace `fontSize: 22` with `fontSize: scale(22)`. On iPad (~820px wide) that becomes ~48px — properly readable for IDD users.

---

### 3. Dynamic tile grid columns

Currently tiles always use 2 columns:

```ts
const TILE_W = (screenWidth - 40 - 12) / 2;
```

Should adapt based on screen width:

```ts
const numCols = screenWidth >= 768 ? 3 : 2;
const TILE_W = (screenWidth - 40 - (numCols - 1) * 12) / numCols;
```

---

### 4. Modals and bottom sheets

Full-screen modals (slideshow player, filter sheet) look awkward on iPad. Should be constrained to a centered max-width with rounded corners rather than edge-to-edge.

---

### 5. Navigation sidebar (optional, large effort)

On iPad, React Navigation could show a persistent sidebar (drawer) instead of the current tab/stack pattern. Not strictly necessary — current nav works, just doesn't feel native iPad. Skip unless iPad becomes a primary target.

---

## Recommended Implementation Order

1. `responsive.ts` utility with `scale()` and `isTablet` constant
2. Max-width centered wrapper on all screens
3. Dynamic tile columns using `numCols`
4. Constrained modals
5. (Future) Sidebar navigation

The IDD audience makes font scaling especially important — large, readable text is a core accessibility need.
