# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Obsidian plugin called "New Tab" that replaces the default new tab with a customizable home view featuring a search bar, recent files, and bookmarked files. The plugin is built with TypeScript and Svelte.

## Build Commands

- `npm run dev` - Start development mode with watch (uses esbuild)
- `npm run build` - Production build with type checking and minification
- `npm run lint` - Run ESLint on the codebase
- `npm i` - Install dependencies

## Critical Dependency Requirements

**IMPORTANT: This project requires Svelte 3, NOT Svelte 4 or 5.**

The exact working dependency versions are:
- `svelte: ^3.59.2` (Svelte 3 only - Svelte 4+ causes appendChild DOM errors)
- `esbuild-svelte: ^0.7.4` (compatible with Svelte 3)
- `svelte-preprocess: ^4.10.7` (v5+ is for Svelte 5)
- `esbuild: ^0.14.47` (uses older `build()` API, not `context()`)
- `typescript: ^4.7.4` (v5+ features like `verbatimModuleSyntax` not supported)

Do NOT upgrade these dependencies without extensive testing. Svelte 4+ compilation produces code incompatible with this Obsidian plugin architecture.

## Development Workflow

The plugin must be tested in an Obsidian vault:
1. Copy `main.js`, `styles.css`, and `manifest.json` to `.obsidian/plugins/New Tab/` in a vault
2. Reload Obsidian or use hot-reload if available
3. Enable the plugin in Obsidian settings

## Architecture Overview

### Core Components

**Plugin Entry Point** ([src/main.ts](src/main.ts))
- Main class `HomeTab` extends Obsidian's `Plugin`
- Registers custom view type, commands, and event handlers
- Manages plugin lifecycle and settings
- Coordinates file managers (recent files, bookmarked files)
- Handles layout changes to replace empty tabs with home view

**View System** ([src/homeView.ts](src/homeView.ts))
- `HomeTabView` extends `FileView` - the main custom view displayed in tabs
- `EmbeddedHomeTab` extends `MarkdownRenderChild` - allows embedding the home view in markdown notes via code blocks
- Uses `VIEW_TYPE = "home-tab-view"` as the view identifier
- Integrates Svelte components with Obsidian's view system

**Search Bar** ([src/homeTabSearchbar.ts](src/homeTabSearchbar.ts))
- `HomeTabSearchBar` class manages search functionality
- Handles filter types: default, omnisearch, web search, file extension, file type
- Dynamically switches between suggester implementations based on active filter
- Uses Svelte stores for reactive UI state

**Suggester System** ([src/suggester/](src/suggester/))
- Base `Suggester` class provides foundation for autocomplete behavior
- `HomeTabFileSuggester` - default file search using Obsidian's vault
- `OmnisearchSuggester` - integrates with Omnisearch plugin API
- `SurfingSuggester` - integrates with Surfing plugin for web search
- Additional suggesters for icons, images, and fonts used in settings
- `fuzzySearch.ts` provides fuzzy matching utilities

**File Managers**
- `RecentFileManager` ([src/recentFiles.ts](src/recentFiles.ts)) - tracks recently opened files, persists to settings
- `bookmarkedFilesManager` ([src/bookmarkedFiles.ts](src/bookmarkedFiles.ts)) - syncs with Obsidian's bookmarks plugin, stores custom icons

**Settings** ([src/settings.ts](src/settings.ts))
- Extensive settings interface with appearance customization (logo, fonts, colors)
- Search behavior configuration (result count, delay, file filters)
- Display options for recent/bookmarked files
- All settings persist to plugin data

**State Management** ([src/store.ts](src/store.ts))
- Uses Svelte writable stores for reactive state
- `pluginSettingsStore` - settings accessible to Svelte components
- `bookmarkedFiles` and `recentFiles` - file lists for UI

**UI Components** ([src/ui/](src/ui/))
- Svelte components for the home view interface
- `homepage.svelte` - main container component
- `searchBar.svelte` - search input with filter display
- `suggesterView.svelte` - displays search results
- `bookmarkedFiles.svelte` and `recentFiles.svelte` - file list displays
- Subcomponents in `svelteComponents/` for individual suggestions and file items

**Utilities** ([src/utils/](src/utils/))
- Validation utilities for CSS units, fonts, links
- File type detection and filtering
- Lucide icon definitions
- HTML manipulation helpers

### Key Patterns

**Plugin Integration**
- Uses Obsidian's internal APIs accessed via `app.internalPlugins` for bookmarks
- Optional integration with community plugins (Omnisearch, Surfing) checked via `app.plugins.getPlugin()`
- Custom view registration with `this.registerView(VIEW_TYPE, ...)`

**Event Handling**
- Listens to `layout-change` to replace new tabs
- Listens to `active-leaf-change` to refocus search bar
- File managers register vault events (`file-open`, `delete`, `rename`)
- Bookmarks manager listens to bookmark changes via plugin events

**Svelte Component Mounting**
- Components are mounted directly to `contentEl`: `new Homepage({ target: this.contentEl, props: {...} })`
- Clear existing content before mounting: `this.contentEl.empty()`
- Always destroy components on cleanup: `this.homepage.$destroy()`
- Pass `view.app` to components instead of relying on global `app` reference

**Svelte Store Bindings** (Svelte 3 pattern)
- Cannot use `bind:this={$store}` directly on DOM elements
- Correct pattern:
  ```svelte
  let element: HTMLElement
  $: if (element) myStore.set(element)

  <div bind:this={element}></div>
  ```
- Use reactive declarations (`$:`) to update stores when local variables change

**Typescript Configuration**
- `baseUrl: "src"` allows imports like `import { ... } from 'src/...'`
- Strict null checks and other type safety flags enabled
- Includes Svelte files in compilation

**Build System** ([esbuild.config.mjs](esbuild.config.mjs))
- Uses esbuild 0.14 API: `esbuild.build({ watch: !prod })` (NOT `esbuild.context()`)
- Bundles TypeScript and Svelte into single `main.js`
- External modules: obsidian, electron, codemirror packages
- Development mode includes inline sourcemaps and watch mode
- Production mode minifies and removes sourcemaps

**Custom Build Plugins:**

1. **srcPathResolverPlugin** - Resolves `src/` prefixed imports to absolute paths
   - Handles imports like `import X from 'src/utils/...'`
   - Tries extensions: `.ts`, `.js`, `.svelte` in order

2. **font-list Shim** - Replaces Node.js `font-list` module with browser-compatible version
   - The `font-list` package uses Node.js APIs (`createRequire`) that fail in Obsidian
   - Custom shim at `src/font-list-shim.ts` uses browser's `queryLocalFonts()` API
   - Build plugin redirects `font-list` imports to the shim

**esbuild-svelte Configuration:**
```javascript
esbuildSvelte({
  preprocess: sveltePreprocess(),
  compilerOptions: {
    dev: !prod,
    generate: 'dom',
    hydratable: false,
    css: 'injected',  // Important: inject CSS at runtime
  },
})
```

## Common Modifications

**Adding New Settings**
1. Add interface property to `HomeTabSettings` in [src/settings.ts](src/settings.ts)
2. Add default value to `DEFAULT_SETTINGS`
3. Add UI control in `HomeTabSettingTab.display()`
4. Access in components via `pluginSettingsStore`

**Creating New Suggester**
1. Extend base `Suggester` class from [src/suggester/suggester.ts](src/suggester/suggester.ts)
2. Implement `getSuggestions()` method
3. Create Svelte component for suggestion rendering
4. Register in `HomeTabSearchBar.updateActiveSuggester()` switch statement

**Adding Plugin Integrations**
- Check plugin availability with `this.app.plugins.getPlugin('plugin-id')`
- Add conditional settings in settings tab
- Implement suggester or feature with plugin-specific APIs

## TypeScript Declarations

The project extends Obsidian's type definitions in [src/main.ts](src/main.ts) with custom interfaces for internal APIs not exposed in official types (e.g., `InternalPlugins`, `BookmarksPlugin`).

## Troubleshooting

**"Failed to execute 'appendChild' on 'Node': parameter 1 is not of type 'Node'"**
- This error occurs when using Svelte 4+ instead of Svelte 3
- Solution: Downgrade to `svelte@^3.59.2` and matching versions (see Critical Dependency Requirements)

**"esbuild.context is not a function"**
- esbuild 0.14 doesn't have the `context()` API (added in 0.17+)
- Solution: Use `esbuild.build({ watch: !prod })` instead of `esbuild.context()`

**"Unknown compiler option 'verbatimModuleSyntax'"**
- TypeScript 4.7 doesn't support this TypeScript 5.x feature
- Solution: Remove `verbatimModuleSyntax` from `tsconfig.json`

**"createRequire is not defined" or font-list errors**
- The `font-list` npm package requires Node.js APIs unavailable in Obsidian
- Solution: Already implemented via `src/font-list-shim.ts` and build plugin redirection

**Component props warnings in console**
- Svelte 3 requires all props to be declared in the component's `<script>` block
- Solution: Add `export let propName` for each prop passed to the component
