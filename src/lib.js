import { Clickup } from 'clickup.js';
import { Octokit } from '@octokit/rest';
import fs from 'node:fs/promises'
import path from 'node:path'
import { exec } from 'node:child_process';
import { graphql } from "@octokit/graphql";
import chalk from 'chalk';

class GitClick {
    constructor({ env, base }) {
        this.dir = process.cwd()
        this.env = env
        this.octokit = new Octokit({
            auth: env.GITCLICK_GITHUB_PERSONAL_TOKEN
        })
        this.octoKitGraphQL = graphql.defaults({
            headers: {
                authorization: 'token ' + env.GITCLICK_GITHUB_PERSONAL_TOKEN,
            },
        });
        this.clickup = new Clickup(env.GITCLICK_CLICKUP_PERSONAL_TOKEN);
        this.data = {
            github: {
                org: null,
                base: base || env.GITCLICK_GITHUB_BASE_BRANCH || 'main',
                remoteUrl: null,
                branchName: null,
                repo: null,
                pullRequest: null
            },
            clickup: {
                teamId: null,
                task: null,
                taskId: null
            }
        }

        this.branchTypes = [
            'feature',
            'feat',
            'bugfix',
            'hotfix',
            'fix',
            'bug',
            'release',
            'docs',
            'refactor',
            'chore',
            'build',
            'ci',
            'perf',
            'performance',
            'style',
            'naming',
            'test',
            'temp',
            'temporary'
        ]

        this.regex = {
            startsWithTaskId: /^([a-zA-Z]+\-[\d]+).*$/g,
            isTaskId: /^([a-zA-Z]+\-[\d]+)$/g,
            markdownImageEmbed: /\!\[.*\]\(.*\)/gm
        }
    }

    getBranchTypeOverride(branchType) {
        if (!branchType) return null

        const overrides = [
            ['bug', 'bugfix'],
            ['fix', 'bugfix'],
            ['feat', 'feature'],
            ['perf', 'performance'],
            ['temp', 'temporary']
        ]

        const foundOverride = overrides.find(([from, to]) => branchType.includes(from))
        return foundOverride
            ? foundOverride[1]
            : branchType
    }

    async getBranchTypeFromTaskTags(task) {
        task = task || await this.getCurrentTask()

        if (!task) return null

        const tags = task.tags.map(tag => tag.name.toLowerCase())
        const type = this.branchTypes.find(type => tags.some(tag => tag.includes(type) || type.includes(tag)))
        return type
    }

    async interpolateBranchName(args) {
        const isNewBranch = Boolean(args[0])
        const branchName = isNewBranch
            ? this.normalizeBranchName(args.join('-').trim())
            : await this.getCurrentBranchName()

        if (!branchName) {
            return this.log('The current working directory is not a repository, or ./.git is corrupted', true)
        }

        let { branchType, separator } = this.getBranchType(branchName)

        const branchNameWithoutType = branchName.replace(branchType + separator, '')

        const taskId = this.extractTaskId(branchType
            ? branchNameWithoutType
            : branchName)

        return {
            isNewBranch,
            branchNameWithoutType,
            taskId,
            branchType,
            separator,
            branchName
        }
    }

    getBranchType(branchName) {
        const separatorIndex = branchName.indexOf('/')
        const branchType = (
            (separatorIndex >= 0 && branchName.slice(0, separatorIndex)) ||
            this.branchTypes.find(branchType => branchName.startsWith(branchType))
        )

        if (!branchType) return {
            branchType: null,
            separator: null
        }

        return {
            branchType: branchType,
            separator: branchName.replace(branchType, '')[0]
        }
    }

    normalizeBranchName(branchName = '') {
        branchName = branchName
            .trim()
            .toLowerCase()
            .replace(/[\s]/gi, '-')
            .replace(/[^a-z0-9\-\/]/gi, '')
            .replace(/[\-]+/g, '-')
            .trim();
        if (branchName.endsWith('-')) return branchName.slice(0, -1)
        return branchName
    }

    async getCurrentBranchName() {
        if (this.data.github.branchName) return this.data.github.branchName
        try {
            const HEAD = await fs.readFile(path.join(this.dir, '.git', 'HEAD'), 'utf8') || ''
            const branchName = HEAD
                .trim()
                .split('ref: refs/heads/')[1] || ''
            this.data.github.branchName = branchName
            return branchName
        } catch (error) {
            return null
        }
    }

    async createBranch(branchName) {
        return new Promise((resolve, reject) => {
            exec(`git checkout -b ${branchName}`, (error, stdout, stderr) => {
                if (error) return reject(error)
                resolve(stdout)
            })
        })
    }

    async checkoutBaseBranch(baseBranch) {
        baseBranch = baseBranch || this.data.github.base

        return new Promise((resolve, reject) => {
            exec(`git checkout ${baseBranch} && git pull origin`, (error, stdout, stderr) => {
                if (error) return reject(error)
                resolve(stdout)
            })
        })
    }

    singleGroupMatch(string, regex) {
        let m;
        let match

        while ((m = regex.exec(string)) !== null) {
            if (m.index === regex.lastIndex) {
                regex.lastIndex++;
            }
            m.forEach((n, groupIndex) => {
                if (groupIndex === 1) {
                    match = n
                }
            });
        }

        return match
    }

    extractTaskId(branchName) {
        const taskId = this.singleGroupMatch(branchName, this.regex.startsWithTaskId)
        return taskId?.toUpperCase()
    }

    async getTeamId() {
        if (this.data.clickup.teamId) return this.data.clickup.teamId
        const { body } = await this.clickup.teams.get()
        const teamId = body.teams[0].id
        this.data.clickup.teamId = Number(teamId)
        return Number(teamId)
    }

    log(message, isError = false) {
        if (!message) return
        const chalker = isError ? chalk.bold.red : chalk.bold
        message = chalker(message)
        console[isError ? 'error' : 'log'](message)
        if (isError) return process.exit(1)
    }

    async getTask(taskId) {
        taskId = taskId.toUpperCase()
        try {
            const { body } = await this.clickup.tasks.get(taskId, {
                custom_task_ids: 'true',
                include_markdown_description: 'true',
                team_id: await this.getTeamId()
            })
            return body
        } catch (error) {
            return null
        }
    }

    async getTaskImages(task, pullRequest) {
        task = task || await this.getCurrentTask()
        pullRequest = pullRequest || await this.getPullRequest()
        if (!pullRequest.head.repo.private) {
            return this.log('Images can only be uploaded to Pull Requests of private repositories', true)
        }

        const imageUrls = task.attachments
            .filter(attachment => attachment.mimetype.includes('image') && attachment.url)
            .map(attachment => attachment.url)

        console.log(imageUrls)
    }

    async getCurrentTask() {
        if (this.data.clickup.task) return this.data.clickup.task
        const branchName = await this.getCurrentBranchName()
        const taskId = this.extractTaskId(branchName)
        if (!taskId) return null
        const task = await this.getTask(taskId)

        if (!task) {
            return null
        }

        this.data.clickup.taskId = taskId
        this.data.clickup.task = task
        return task
    }

    async pushBranchToRemote(branchName) {
        const _branchName = branchName || await this.getCurrentBranchName()
        return new Promise((resolve, reject) => {
            exec(`git push --set-upstream origin ${_branchName}`, (error, stdout, stderr) => {
                if (error) return reject(error)
                return resolve(stdout)
            })
        })
    }

    async getOrgAndRepo() {
        if (this.data.github.org && this.data.github.repo) {
            return {
                org: this.data.github.org,
                repo: this.data.github.repo
            }
        }
        const gitRemoteUrl = await this.getGitRemoteUrl()
        const [org, r] = gitRemoteUrl
            .replace('git@github.com:', '')
            .split('/')
        const orgAndRepo = {
            org,
            repo: r.replace('.git', '')
        }

        this.data.github.org = orgAndRepo.org
        this.data.github.repo = orgAndRepo.repo

        return orgAndRepo
    }

    async createPullRequest({ title, body, draft }, dry = false, skipPush = false) {
        const branchName = await this.getCurrentBranchName()
        const { repo, org } = await this.getOrgAndRepo()

        if (!skipPush) await this.pushBranchToRemote(branchName)

        const request = {
            owner: org,
            repo,
            title,
            head: branchName,
            base: this.data.github.base,
            body,
            draft
        }

        return dry ? request : this.octokit.pulls.create(request)
    }

    async normalizePullRequestBody(body = '') {
        return body
            .replace(this.regex.markdownImageEmbed, '')
            .trim()
    }

    async createSyncedPullRequest(draft = true, dry = false, skipPush = false) {
        const task = await this.getCurrentTask()

        if (!task) return null

        const bodyHeading = `### [${task.name}](${task.url})`
        const bodyDescription = `#### ${task.custom_id}\n${task.markdown_description}\n`
        const body = this.normalizePullRequestBody(`${bodyHeading}\n${bodyDescription}`)

        const response = await this.createPullRequest({
            title: task.name,
            body,
            draft
        }, dry, skipPush)

        return response
    }

    async getGitRemoteUrl() {
        if (this.data.github.remoteUrl) return this.data.github.remoteUrl
        const config = await fs.readFile(path.join(this.dir, '.git', 'config'), 'utf8')
        const regex = /\[remote"origin"\]url=(.+)fetch/g
        const startIndex = config.indexOf(`[remote "origin"]\n\turl`)
        let string = config.slice(startIndex)
        string = string.replaceAll(/\s/g, '')
        const url = this.singleGroupMatch(string, regex)
        this.data.github.remoteUrl = url
        return url
    }

    async getPullRequest() {
        try {
            if (this.data.github.pullRequest) return this.data.github.pullRequest
            const { repo, org } = await this.getOrgAndRepo()
            const branchName = await this.getCurrentBranchName()
            const response = await this.octokit.rest.pulls.list({
                owner: org,
                repo,
                state: 'open',
                base: this.data.github.base,
                head: `${org}:${branchName}`
            })
            const pullRequest = response.data[0]
            this.data.github.pullRequest = pullRequest
            return pullRequest
        } catch (error) {
            console.error(error)
        }
    }

    async updatePullRequest(draft = true) {
        const pullRequest = await this.getPullRequest()
        const request = await this.createSyncedPullRequest(draft, true)
        return this.octokit.pulls.update({
            ...request,
            pull_number: pullRequest.number
        })
    }

    async createTaskComment(text, taskId) {
        taskId = taskId || (await this.getCurrentTask()).id

        if (!taskId) return null

        await this.clickup.tasks.addComment(taskId, {
            comment_text: text,
            notify_all: false
        })
    }

    async isTaskConnectedToPullRequest(task, pullRequest) {
        if (!task || !pullRequest) throw new Error('isTaskConnectedToPullRequest expected task and pullRequest as arguments, got', JSON.stringify(task, pullRequest))
        const res = await this.clickup.tasks.getComments(task.id)
        const comments = res?.body?.comments || []
        return comments.some(comment => comment.comment_text === pullRequest.html_url)
    }

    async undraftPullRequest(pullRequest) {
        pullRequest = pullRequest || await this.getPullRequest()
        return this.octoKitGraphQL(`
            mutation($data:MarkPullRequestReadyForReviewInput!) {
                markPullRequestReadyForReview(input:$data) {
                    pullRequest {
                        title
                    }
                }
            }
        `,
            {
                data: {
                    "pullRequestId": pullRequest.node_id
                }
            }
        )
    }

    async getSyncData(args, log = false) {
        const {
            taskId,
            branchType: branchTypeFromArgs,
            branchName: initBranchName,
            branchNameWithoutType,
            isNewBranch
        } = await this.interpolateBranchName(args)

        if (!taskId) return { error: 'taskIdNotFound' }

        if (log) this.log(`Fetching task "${taskId}"...`)

        const task = await this.getTask(taskId)

        if (!task) return { error: 'taskNotFound' }

        const branchType = this.getBranchTypeOverride(branchTypeFromArgs || await this.getBranchTypeFromTaskTags(task))
        const prependBranchType = Boolean(isNewBranch && !branchTypeFromArgs && branchType)
        const branchNameFromBranchType = isNewBranch && branchType
            ? `${branchType}/${branchNameWithoutType}`
            : initBranchName
        const branchName = prependBranchType
            ? `${branchType}/${initBranchName}`
            : branchNameFromBranchType

        return {
            branchName,
            branchType,
            task,
            taskId,
            isNewBranch
        }

    }

    async handleSync(args, flags, log = false) {
        if (log) this.log('Syncing task to pull request...')
        const {
            branchName,
            task,
            taskId,
            isNewBranch,
            error
        } = await this.getSyncData(args, true)

        if (error === 'taskIdNotFound') {
            return log && this.log('Branch name must include a Custom Task ID at the start or after an optional branch type', true)
        }

        if (error === 'taskNotFound') {
            return log && this.log(`Could not find a task with the Custom ID "${taskId}"`, true)
        }

        if (isNewBranch) {
            if (log) this.log(`Checking out, and pulling base branch "${this.data.github.base}" from origin remote...`)
            await this.checkoutBaseBranch()
            if (log) this.log(`Creating new branch "${branchName}"...`)
            await this.createBranch(branchName)
        }

        if (log) this.log(`Pushing branch to origin remote...`)
        await this.pushBranchToRemote(branchName)

        if (log) this.log(`Checking if pull request already exists...`)
        const existingPullRequest = await this.getPullRequest()

        let response

        if (existingPullRequest) {
            if (log) this.log('Updating existing pull request...')
            if (flags.undraft) {
                if (log) this.log('Undrafting pull request...')
                await this.undraftPullRequest(existingPullRequest)
            }
            response = await this.updatePullRequest()
        } else {
            if (log) this.log('Creating a new pull request...')
            response = await this.createSyncedPullRequest(!flags.undraft, false, true)
        }

        const pullRequest = response?.data

        const taskIsConnected = await this.isTaskConnectedToPullRequest(task, pullRequest)

        if (!taskIsConnected) {
            if (log) this.log('Creating a pull request link comment in task...')
            await this.createTaskComment(pullRequest.html_url)
        }

        const b = chalk.bold
        const prLabel = chalk.bold.green(`Pull Request (#${pullRequest.number})`)
        const taskLabel = chalk.bold.blue(`Task (${task.custom_id})`)

        if (log) console.log(`\n${prLabel}\n${b(pullRequest.title)}\n${pullRequest?.html_url}\n\n${taskLabel}\n${b(task.name)}\n${task.url}`)
        return
    }
}

export default GitClick
