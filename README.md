# gitclick

## Install
```bash
npm install -g @zentus/gitclick
```

## Setup
- [Generate a Clickup Personal API Token](https://clickup.com/api/developer-portal/authentication#generate-your-personal-api-token)
- [Generate a GitHub Personal Access Token](https://github.com/settings/tokens)

Add the following environment variables to `./.env`:
```
GITCLICK_CLICKUP_PERSONAL_TOKEN="your_clickup_token"
GITCLICK_GITHUB_PERSONAL_TOKEN="your_github_token"
GITCLICK_GITHUB_BASE_BRANCH="your_base_branch" # default: "main"
```

Or export them from your shell rc file, (`~/.bashrc` or `~/.zshrc` etc):
```
export GITCLICK_CLICKUP_PERSONAL_TOKEN="your_clickup_token"
export GITCLICK_GITHUB_PERSONAL_TOKEN="your_github_token"
export GITCLICK_GITHUB_BASE_BRANCH="your_base_branch" # default: "main"
```

If you added them to a shell rc file, restart your terminal to start using the program

## Use
### Create a new branch, and pull request based on a Clickup task
Prefix the branch name with a Custom ID, i.e "SOME-1337"
```bash
gitclick SOME-1337-important-changes
```

- A new branch will be created, based on `GITCLICK_GITHUB_BASE_BRANCH`
- A new pull request (draft) will be created using data from the corresponding Clickup task

### Sync current branch
Make sure the current branch name is prefixed with a Custom ID, i.e "SOME-1337"
```bash
gitclick
```

If an open pull request exists for this branch:
- The pull request will be updated using data from the corresponding Clickup task
  
Otherwise:
- A new pull request (draft) will be created using data from the corresponding Clickup task
