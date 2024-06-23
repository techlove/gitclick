# [@zentus/gitclick](https://github.com/zentus/gitclick)
A CLI tool for **Clickup** **Task** to **GitHub** **Pull Request** syncing and cross-referencing.

Slightly opinionated.

### Why do I need this?
I got tired of doing it manually, maybe you are too.

## Installation
```bash
npm install -g @zentus/gitclick
```

## Setup
- [Generate a **Clickup** **Personal API Token**](https://clickup.com/api/developer-portal/authentication#generate-your-personal-api-token)
- [Generate a **GitHub** **Personal Access Token**](https://github.com/settings/tokens)

Add the following environment variables to `./.env`:
```bash
GITCLICK_CLICKUP_PERSONAL_TOKEN="your_clickup_token"
GITCLICK_GITHUB_PERSONAL_TOKEN="your_github_token"
GITCLICK_GITHUB_BASE_BRANCH="your_base_branch" # (optional) default: "main"
```

Or export them from your shell rc file, (`~/.bashrc` or `~/.zshrc` etc):
```bash
export GITCLICK_CLICKUP_PERSONAL_TOKEN="your_clickup_token"
export GITCLICK_GITHUB_PERSONAL_TOKEN="your_github_token"
export GITCLICK_GITHUB_BASE_BRANCH="your_base_branch" # (optional) default: "main"
```

If you added them to a shell rc file, restart your terminal to start using the program.

## Usage
### Sync current **Branch**  
```bash
glick
```

### Sync current **Branch** and undraft **Pull Request**
```bash
glick --undraft
```

### Sync new **Branch**
```bash
glick SOME-1337
```
**Task** **Tag**s will be used to try to set a `branchType` prefix.
  
If the **Task** with **Task** **Custom ID** `SOME-1337` has the **Task** **Tag** `bug`, the **Branch** **Name** will be `bugfix/some-1337`
  
If the **Task** with **Task** **Custom ID** `SOME-1337` has the **Task** **Tag** `Feature`, the **Branch** **Name** will be `feature/some-1337`

If no matching **Task** **Tag**s are found, the **Branch** **Name** will be `some-1337`.  

### Sync new **Branch** as non-draft
```bash
glick SOME-1337 --undraft
```
  
### Commands
#### `gitclick sync`
- A **Pull Request** will be created, if it doesn't already exist.
- The **Pull Request** **Title** will be set to the current **Task** **Name**, and the **Pull Request** **Body** will include a link to the **Task** and the current **Markdown Description** of the **Task** corresponding to either the current **Branch** or a new **Branch** to be created.
- The **Pull Request** **URL** will be referenced in a **Task** **Comment** in the **Task**, if such a **Task** **Comment** doesn't already exist in the **Task**.
  
#### Arguments
##### 1. Create new **Branch** (Optional)
Format: `{branchType}{separator}{taskId}{freetext}`  
  
If not provided, the current **Branch** will be used. The current **Branch** must include a **Task** **Custom ID** of an existing **Task**.
  
If provided, a new **Branch** will be created with `GITCLICK_GITHUB_BASE_BRANCH` as its **Base** **Branch**. At least subargument `taskId` must be included.
  
##### Subarguments
  
###### `branchType` (Optional)  
  
A string to use as prefix of the new **Branch** **Name**. Commonly `feature`, `bugfix`, `refactor` or `docs` etc (See [GitClick.branchTypes](https://github.com/zentus/gitclick/blob/main/src/lib.js#L38)). If not provided, current **Task** **Tag**s will be used to try to set a `branchType`.
  
###### `separator` (Optional)  
  
A character separating `branchType` and `taskId`. Commonly `/` or `-`. Must be `/` if using an uncommon `branchType` string.
  
###### `taskId` (Required)  
  
The **Task** **Custom ID** of an existing **Task**.

###### `freetext` (Optional)  
  
A **Branch** **Name** suffix. May include spaces, as it will be normalized.
  
#### Example
```bash
gitclick sync SOME-1337

# gitclick sync feat/SOME-1337 do very important things
# Branch Name will be "feature/some-1337-do-very-important-things"
```

##### Flags
###### `undraft` (Optional)  
If provided, the **Pull Request** will be set to `Ready for review` 

(Note: If you want to set a `Ready for review` **Pull Request** back to `Draft`, you currently need to do it manually in **GitHub** due to **GitHub** **API** limitations)
  
```bash
gitclick sync SOME-1337 --undraft
gitclick sync --undraft
```

###### `base` (Optional)
If provided, will override `GITCLICK_GITHUB_BASE_BRANCH`
  
```bash
gitclick sync SOME-1337 --base mybasebranch
gitclick sync --base mybasebranch
```

## More Examples

With suffixed **Branch** **Name**
```bash
glick SOME-1337-important-changes
# Branch Name will be "some-1337-important-changes"
```

With suffixed **Branch** **Name** as free text
```bash
glick SOME-1337 lots of stuff
# Branch Name will be "some-1337-lots-of-stuff"
```

With specified common `branchType`
```bash
glick bug/SOME-1337 important changes
# Branch Name will be "bugfix/some-1337-important-changes"
# Overrides any branchType that could be determined from Task Tags
```

With specified uncommon `branchType`
```bash
glick what/SOME-1337 are you sure
# Branch Name will be "what/some-1337-are-you-sure"
# Overrides any branchType that could be determined from Task Tags
```

### Shorthand Aliases
`glick` is a bundled alias for `gitclick`

If a valid command is not passed as the first argument, it will default to `sync`
  
The following commands are all valid aliases for the `sync` command:
```bash
glick
gitclick
glick SOME-1337
gitclick SOME-1337
glick feature/SOME-1337
gitclick feature/SOME-1337
glick SOME-1337-important-changes
gitclick SOME-1337-important-changes
glick bug/SOME-1337-important-changes
gitclick bug/SOME-1337-important-changes
glick feature/SOME-1337 important changes
gitclick feature/SOME-1337 important changes
```