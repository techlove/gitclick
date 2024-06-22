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
    }

    async setup() {
        await this.lib.getTeamId()
        await this.handleCommand()
    }

    async handleCommand() {
        if (!this.command) {
            this.command = 'sync'
        }

        if (this.command === 'sync') {
            console.log(chalk.bold('Syncing task to pull request...'))
            const {
                branchName,
                task,
                taskId,
                isNewBranch,
                error
            } = await this.lib.getSyncData(args)

            if (error === 'taskIdNotFound') {
                return this.lib.log('Branch name must include a Custom Task ID at the start or after an optional branch type', true)
            }

            this.lib.log(`Fetching task "${taskId}"...`)

            if (error === 'taskNotFound') {
                return this.lib.log(`Could not find a task with the Custom ID "${taskId}"`, true)
            }

            if (isNewBranch) {
                console.log(chalk.bold(`Checking out, and pulling base branch "${this.lib.data.github.base}" from origin remote...`))
                await this.lib.checkoutBaseBranch()
                console.log(chalk.bold(`Creating new branch "${branchName}"...`))
                await this.lib.createBranch(branchName)
            }

            console.log(chalk.bold(`Pushing branch to origin remote...`))
            await this.lib.pushBranchToRemote(branchName)

            console.log(chalk.bold(`Checking if pull request already exists...`))
            const existingPullRequest = await this.lib.getPullRequest()

            let response

            if (existingPullRequest) {
                console.log(chalk.bold('Updating existing pull request...'))
                if (this.flags.undraft) {
                    console.log(chalk.bold('Undrafting pull request...'))
                    await this.lib.undraftPullRequest(existingPullRequest)
                }
                response = await this.lib.updatePullRequest()
            } else {
                console.log(chalk.bold('Creating a new pull request...'))
                response = await this.lib.createSyncedPullRequest(!this.flags.undraft, false, true)
            }

            const pullRequest = response?.data

            const taskIsConnected = await this.lib.isTaskConnectedToPullRequest(task, pullRequest)

            if (!taskIsConnected) {
                console.log(chalk.bold('Creating a pull request link comment in task...'))
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

