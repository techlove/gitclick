# [@zentus/gitclick](https://github.com/zentus/gitclick)
A CLI tool for Clickup Task to GitHub Pull Request syncing and cross-referencing

### Why do I need this?
I got tired of doing it manually, maybe you are too.

## Installation
```bash
npm install -g @zentus/gitclick
```

## Setup
- [Generate a Clickup Personal API Token](https://clickup.com/api/developer-portal/authentication#generate-your-personal-api-token)
- [Generate a GitHub Personal Access Token](https://github.com/settings/tokens)

Add the following environment variables to `./.env`:
```bash
GITCLICK_CLICKUP_PERSONAL_TOKEN="your_clickup_token"
GITCLICK_GITHUB_PERSONAL_TOKEN="your_github_token"
GITCLICK_GITHUB_BASE_BRANCH="your_base_branch" # default: "main"
```

Or export them from your shell rc file, (`~/.bashrc` or `~/.zshrc` etc):
```bash
export GITCLICK_CLICKUP_PERSONAL_TOKEN="your_clickup_token"
export GITCLICK_GITHUB_PERSONAL_TOKEN="your_github_token"
export GITCLICK_GITHUB_BASE_BRANCH="your_base_branch" # default: "main"
```

If you added them to a shell rc file, restart your terminal to start using the program

## Usage
### Shorthand
If a valid command is not passed as the first argument, it will default to `sync`
  
The following commands are all valid shorthand:
```bash
gitclick
gitclick SOME-1337
gitclick feature/SOME-1337
gitclick SOME-1337-important-changes
gitclick feature/SOME-1337-important-changes
gitclick feature/SOME-1337 important changes
```
### Commands
#### sync {branchNameOrTaskId} {freetext}
- A pull request will be created, if it doesn't already exist
- The pull request name and description will be set to the current name and description of the corresponding Clickup task
- The pull request will be referenced in a comment in the Clickup task, if comment doesn't already exist

#### Arguments
##### `branchNameOrTaskId` (Optional)  
If provided, a new branch will be created with `GITCLICK_GITHUB_BASE_BRANCH` as its base branch.
  
Task tags will be used to try to set a branch type (prefix).
  
If not provided, the current branch will be used.
  
`branchNameOrTaskId` or the current branch must include a Task Custom ID of an existing task.
  
Example:
```bash
gitclick sync SOME-1337
```

##### `freetext` (Optional)    
If provided, the branch name will include a normalized version of its value.
  
Example:
```bash
gitclick sync SOME-1337 do very important things
# Branch name will be "some-1337-do-very-important-things"
```

#### Flags
##### `undraft` (Optional)  
If provided, the pull request will be set to `Ready for review`
  
Example:
```bash
gitclick sync SOME-1337 --undraft
gitclick sync --undraft
```

##### `base` (Optional)
If provided, will override `GITCLICK_GITHUB_BASE_BRANCH`
  
Example:
```bash
gitclick sync SOME-1337 --base mybasebranch
gitclick sync --base mybasebranch
```

## More examples

### Sync new branch
Make sure the task exists, and prefix the branch name with a Task Custom ID, i.e "SOME-1337"

With Task Custom ID only
```bash
gitclick sync SOME-1337
# Branch name will be "some-1337"
# Task tags will be used to try to set a branch types (prefix)
# If the task "SOME-1337" has the tag "bug" on it
# Branch name will be "bugfix/some-1337"
# If the task "SOME-1337" has the tag "feature" on it
# Branch name will be "feature/some-1337"
```

With suffixed branch name
```bash
gitclick sync SOME-1337-important-changes
# Branch name will be "some-1337-important-changes"
```

With suffixed branch name as free text
```bash
gitclick sync SOME-1337 lots of stuff
# Branch name will be "some-1337-lots-of-stuff"
```

With specified branch type (prefix)
```bash
gitclick sync feature/SOME-1337-important-changes
# Branch name will be "feature/some-1337-important-changes"
# Overrides any branch type that could be determined from task tags
```

### Sync current branch
```bash
gitclick sync
```

### Sync current branch and undraft pull request
```bash
gitclick sync --undraft
```
