#!/usr/bin/env node
import { config } from 'dotenv'
config()
import GitClick from '../src/lib.js'
import yargs from 'yargs/yargs'
import chalk from 'chalk'

const yarg = yargs(process.argv.slice(2)).argv
const [command, ...args] = yarg._

class CLI {
    constructor(overrides = {}) {
        this.overrides = overrides
        this.command = overrides.command || command
        this.args = overrides.args || args
        this.flags = {
            base: overrides?.flags?.base || yarg.base,
            undraft: overrides?.flags?.undraft || yarg.undraft
        }
        this.lib = new GitClick({
            env: overrides.env || process.env,
            base: overrides.base || this.flags.base
        })
        this.commands = [
            'sync'
        ]
        this.handleSyncShorthand()
    }

    handleSyncShorthand() {
        if (this.command && !this.commands.includes(this.command)) {
            this.args = [this.command, ...this.args]
            this.command = 'sync'
        }

        if (!this.command) {
            this.command = 'sync'
        }
    }

    async setup() {
        await this.lib.getTeamId()
        await this.handleCommand()
    }

    async handleCommand() {
        if (this.command === 'sync') {
            this.lib.log('Syncing task to pull request...')
            const {
                branchName,
                task,
                taskId,
                isNewBranch,
                error
            } = await this.lib.getSyncData(this.args, true)

            if (error === 'taskIdNotFound') {
                return this.lib.log('Branch name must include a Custom Task ID at the start or after an optional branch type', true)
            }

            if (error === 'taskNotFound') {
                return this.lib.log(`Could not find a task with the Custom ID "${taskId}"`, true)
            }

            if (isNewBranch) {
                this.lib.log(`Checking out, and pulling base branch "${this.lib.data.github.base}" from origin remote...`)
                await this.lib.checkoutBaseBranch()
                this.lib.log(`Creating new branch "${branchName}"...`)
                await this.lib.createBranch(branchName)
            }

            this.lib.log(`Pushing branch to origin remote...`)
            await this.lib.pushBranchToRemote(branchName)

            this.lib.log(`Checking if pull request already exists...`)
            const existingPullRequest = await this.lib.getPullRequest()

            let response

            if (existingPullRequest) {
                this.lib.log('Updating existing pull request...')
                if (this.flags.undraft) {
                    this.lib.log('Undrafting pull request...')
                    await this.lib.undraftPullRequest(existingPullRequest)
                }
                response = await this.lib.updatePullRequest()
            } else {
                this.lib.log('Creating a new pull request...')
                response = await this.lib.createSyncedPullRequest(!this.flags.undraft, false, true)
            }

            const pullRequest = response?.data

            const taskIsConnected = await this.lib.isTaskConnectedToPullRequest(task, pullRequest)

            if (!taskIsConnected) {
                this.lib.log('Creating a pull request link comment in task...')
                await this.lib.createTaskComment(pullRequest.html_url)
            }

            const b = chalk.bold
            const prLabel = chalk.bold.green(`Pull Request (#${pullRequest.number})`)
            const taskLabel = chalk.bold.blue(`Task (${task.custom_id})`)

            console.log(`\n${prLabel}\n${b(pullRequest.title)}\n${pullRequest?.html_url}\n\n${taskLabel}\n${b(task.name)}\n${task.url}`)
            return
        }
    }
}

const cli = new CLI()
cli.setup()

