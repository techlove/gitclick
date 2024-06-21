import axios from 'axios';
import { Clickup } from 'clickup.js';
import { Octokit } from '@octokit/rest';

class GitClick {
    constructor({ env }) {
        this.octokit = new Octokit()
        this.clickup = new Clickup(env.GITCLICK_CLICKUP_PERSONAL_TOKEN);
        this.data = {
            github: {

            },
            clickup: {

            }
        }
    }

    async getTeamId() {
        if (this.data.clickup.teamId) return this.data.clickup.teamId
        const { body } = await this.clickup.teams.get()
        const teamId = body.teams[0].id
        this.data.clickup.teamId = teamId
        return teamId
    }

    async getTask(taskId) {
        return this.clickup.tasks.get(taskId)
    }

    async getRepo() {
        return this.octokit.rest.repos
            .listForOrg({
                org: "octokit",
                type: "public",
            })
            .then(({ data }) => {
                console.log(data)
                // handle data
            });
    }
}

export default GitClick
