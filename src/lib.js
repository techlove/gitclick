import axios from 'axios';
import { Clickup } from 'clickup.js';
import { Octokit } from '@octokit/rest';
import fs from 'node:fs/promises'
import path from 'node:path'

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
                org: env.GITCLICK_GITHUB_ORG
            },
            clickup: {
                teamId: null
            }
        }
    }

    async getBranchName() {
        const HEAD = await fs.readFile(path.join(this.dir, '.git', 'HEAD'), 'utf8') || ''
        const branchName = HEAD
            .trim()
            .split('ref: refs/heads/')[1] || ''
        return branchName
    }

    async extractTaskId(branchName) {
        const regex = /.*([A-Z]+\-[\d]+).*/g;
        let m;
        let match

        while ((m = regex.exec(branchName)) !== null) {
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

    async getTeamId() {
        if (this.data.clickup.teamId) return this.data.clickup.teamId
        const { body } = await this.clickup.teams.get()
        const teamId = body.teams[0].id
        this.data.clickup.teamId = teamId
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

    async getRepo() {
        return this.octokit.rest.repos.get({
            owner: 'techlove'
        })
        // .listForOrg({
        //     org: this.github.org,
        //     type: "private",
        // })
        // .then(({ data }) => {
        //     console.log(data)
        //     // handle data
        // });
    }
}

export default GitClick
