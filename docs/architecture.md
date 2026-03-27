# Architecture

## Layers

wp-env-bin is organized into four distinct layers. Each layer has a single responsibility and only calls into layers below it.

```
┌─────────────────────────────────────┐
│  bin/wp-env-bin                     │  Entry point
│  Parse argv → dispatch to handlers  │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│  lib/prompts/                       │  Interactive layer
│  @inquirer/prompts + orchestration  │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│  commands/                          │  Business logic
│  Pure functions, no prompts         │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│  lib/                               │  Utilities
│  Shell execution, config, DB, etc.  │
└─────────────────────────────────────┘
```

### `bin/wp-env-bin`

Reads `process.argv[2]` (command) and `process.argv[3]` (subcommand). Parses any flags (e.g. `--path`, `--url`) and passes them as explicit arguments to handlers. Non-interactive commands (`clean`, `scaffold`, `info`, passthrough `env` args) are dispatched directly to `commands/` here. Everything else calls into `lib/prompts/`.

The goal of `bin/` is to be a thin router — no business logic, no prompts.

### `lib/prompts/`

One file per command area. Each file exports async handler functions that:
1. Run `@inquirer/prompts` interactions (`select`, `input`, `confirm`, `checkbox`)
2. Collect the user's choices
3. Call the appropriate `commands/` function(s) with those choices as plain arguments

| File | Handlers |
|---|---|
| `config.js` | `handleConfigInstall`, `handleConfigUpdate`, `handleConfigSwitch`, `handleConfigCreate`, `handleConfigDelete` + shared helpers |
| `db.js` | `handleDbGet`, `handleDbProcess`, `handleDbUse` |
| `composer.js` | `handleComposerGet`, `handleComposerMake` |
| `env.js` | `handleEnvSync` |
| `e2e.js` | `handleE2eScaffold` |
| `htaccess.js` | `handleHtaccessMake` |
| `visual.js` | `handleVisualCompare` |

### `commands/`

Pure business logic. Functions accept explicit parameters and return values or throw errors — they never prompt the user. This makes them directly unit-testable without mocking stdin.

| File | Exports |
|---|---|
| `config.js` | `configCreate`, `configUpdate`, `configSwitch`, `configDelete`, `getProfileList` |
| `db.js` | `getRemoteDb`, `processDb`, `useDb` |
| `composer.js` | `composerGet`, `composerMake`, `composerUpdate`, etc. |
| `scaffold.js` | `scaffoldCommand`, `scaffoldFiles` |
| `install.js` | `install`, `getInstallContext`, `applyProjectType` |
| `htaccess.js` | `makeHtaccess`, `putHtaccess` |
| `e2e.js` | `initE2e`, `getE2eDefaults`, `generateE2eTests`, `runE2eTests` |
| `compare.js` | `compare` |
| `env.js` | `runWpEnv`, `runWpEnvE2e` |
| `plugins.js` | `getInactivePlugins`, `activateComposerPlugins` |

### `lib/`

Low-level utilities with no prompts and no CLI-specific logic.

| File/Dir | Purpose |
|---|---|
| `lib/utils/run.js` | Shell execution: `run()`, `remote_wp()`, `buildRemoteCmd()`, `wpcli()` |
| `lib/utils/log.js` | `logger()` — coloured output with optional suppression |
| `lib/env/config.js` | `readLocalConfig()`, `readWpEnvJson()`, `readE2eConfig()` |
| `lib/env/check.js` | File presence checks: `checkDatabase()`, `checkHtaccess()`, `isWpEnvRunning()` |
| `lib/db.js` | `validateSqlFile()`, `renamePrefix()` |
| `lib/config.js` | `applyProjectType()`, `saveNamedProfile()` |
| `lib/plugins.js` | `readComposerPlugins()` |
| `lib/remote-composer.js` | `fetchRemoteData()`, `matchActivePlugins()`, `buildComposerJson()`, `makeComposerName()` |
| `lib/compare.js` | `diffScreenshots()`, `writeReport()`, arg parsing, URL utilities |
| `lib/e2e/` | TypeScript sources for Playwright block test helpers (compiled to JS) |

---

## Multi-Host Remote WP-CLI

All remote WP-CLI calls go through `remote_wp(config, cmd, opts)` in `lib/utils/run.js`. It delegates to `buildRemoteCmd(config, cmd)` which is a pure function — making it unit-testable without executing any shell commands.

```
remote_wp(config, cmd)
  └─ buildRemoteCmd(config, cmd)   ← pure, tested in remote-wp.test.js
       ├─ host: "pantheon"  →  "terminus wp <env> -- <cmd>"
       ├─ host: "ssh"       →  "wp --ssh=<env> <cmd>"
       └─ host: "wpvip"     →  "vip wp <env> -- <cmd>"
  └─ execSync(builtCmd, opts)
```

The `host` and `env` fields in `wp-env-bin.config.json` control this. `host` defaults to `"pantheon"` for backward compatibility with existing configs that have no `host` field.

---

## Configuration Files (user's project)

wp-env-bin reads config from the user's project, not from this repo:

```
<user-project>/
└── wp-env-bin/
    ├── wp-env-bin.config.json        ← active config (gitignored by users)
    ├── .wp-env.json                  ← @wordpress/env config
    ├── composer.json                 ← active Composer dependencies
    ├── composer.lock
    ├── assets/
    │   ├── database.sql
    │   └── .htaccess
    └── site-configs/                 ← named profiles (git-tracked by users)
        ├── mysite.live.wp-env-bin.config.json
        ├── mysite.live.composer.json
        └── mysite.live.composer.lock
```

`config switch` copies a profile's files to the active slots. `config create` writes directly to `site-configs/` without touching the active files unless the user opts in.

---

## Adding a New Command

1. Add the business logic function to the appropriate `commands/*.js` file (or create a new one).
2. Add an interactive handler to `lib/prompts/<area>.js` (or create a new file).
3. Add the route to `bin/wp-env-bin` — parse any flags, call the handler.
4. Add a `help` string to `commands/help.js`.
5. Update `README.md` and the relevant `docs/*.md` file.
6. Add unit tests for the business logic in `tests/unit-tests/`.
