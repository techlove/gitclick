import { Clickup } from 'clickup.js';
import { Octokit } from '@octokit/rest';
import fs from 'node:fs/promises'
import path from 'node:path'
import { exec } from 'node:child_process';

class GitClick {
    constructor({ env }) {
        this.dir = process.cwd()
        this.env = env
        this.octokit = new Octokit({
            auth: env.GITCLICK_GITHUB_PERSONAL_TOKEN
        })
        this.clickup = new Clickup(env.GITCLICK_CLICKUP_PERSONAL_TOKEN);
        this.data = {
            github: {
                org: null,
                base: env.GITCLICK_GITHUB_BASE_BRANCH || 'main',
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
    }

    async getBranchName() {
        if (this.data.github.branchName) return this.data.github.branchName
        const HEAD = await fs.readFile(path.join(this.dir, '.git', 'HEAD'), 'utf8') || ''
        const branchName = HEAD
            .trim()
            .split('ref: refs/heads/')[1] || ''
        this.data.github.branchName = branchName
        return branchName
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
        const taskId = this.singleGroupMatch(branchName, /^([A-Z]+\-[\d]+).*$/g)
        return taskId
    }

    async getTeamId() {
        if (this.data.clickup.teamId) return this.data.clickup.teamId
        const { body } = await this.clickup.teams.get()
        const teamId = body.teams[0].id
        this.data.clickup.teamId = Number(teamId)
        return Number(teamId)
    }

    async getTask(taskId) {
        try {
            const { body } = await this.clickup.tasks.get(taskId, {
                custom_task_ids: 'true',
                team_id: await this.getTeamId()
            })

            return body
        } catch (error) {
            console.error(error)
        }
    }

    async getCurrentTask() {
        if (this.data.clickup.task) return this.data.clickup.task
        const branchName = await this.getBranchName()
        const taskId = this.extractTaskId(branchName)
        if (!taskId) return null
        const task = await this.getTask(taskId)
        this.data.clickup.taskId = taskId
        this.data.clickup.task = task
        return task
    }

    async pushBranchToRemote(branchName) {
        const _branchName = branchName || await this.getBranchName()
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
        const branchName = await this.getBranchName()
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

    async createSyncedPullRequest(draft = true, dry = false, skipPush = false) {
        // const imageUrls = task.attachments
        //     .filter(attachment => attachment.mimetype.includes('image') && attachment.url)
        //     .map(attachment => attachment.url)
        const task = await this.getCurrentTask()

        const bodyHeading = `### [${task.name}](${task.url})`
        const bodyDescription = `#### ${task.custom_id}\n${task.description}\n`
        const bodyImages = ''
        // const bodyImages = imageUrls
        //     .map(imageUrl => `<img src="${imageUrl}" width="200"/>`)
        //     .join('\n')
        //     .trim()
        const body = `${bodyHeading}\n${bodyDescription}\n\n${bodyImages}`

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
            const branchName = await this.getBranchName()
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

    async updatePullRequest() {
        const pullRequest = await this.getPullRequest()
        const request = await this.createSyncedPullRequest(true, true)
        return this.octokit.pulls.update({
            ...request,
            pull_number: pullRequest.number
        })
    }

    async createTaskComment(text, taskId) {
        taskId = taskId || (await this.getCurrentTask()).id

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
}

export default GitClick
