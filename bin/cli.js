#!/usr/bin/env node
import { config } from 'dotenv'
config()
import GitClick from '../src/lib.js'
import yargs from 'yargs/yargs'
import chalk from 'chalk'

const yarg = yargs(process.argv.slice(2)).argv
const [command, ...args] = yarg._
const { help } = yarg

class CLI {
    constructor() {
        this.command = command
        this.args = args
        this.flags = {
            help
        }
        this.lib = new GitClick({
            env: process.env
        })
    }

    async setup() {
        const teamId = await this.lib.getTeamId()

        await this.handleCommand()
    }

    async handleCommand() {
        if (!this.command) {
            this.command = 'sync'
        }

        if (this.command === 'sync') {
            console.log(chalk.bold('Syncing task to pull request...'))
            const branchName = args[0] || await this.lib.getBranchName() || ''
            const isNewBranch = branchName === args[0]
            const taskId = this.lib.extractTaskId(branchName)

            if (branchName && !taskId) {
                console.error(chalk.bold.red('Branch name must start with a Custom Task ID, i.e "SOME-1337"'))
                return process.exit(1)
            }

            console.log(chalk.bold(`Fetching task "${taskId}"...`))
            const task = await this.lib.getTask(taskId)

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
                response = await this.lib.updatePullRequest()
            } else {
                console.log(chalk.bold('Creating a new pull request...'))
                response = await this.lib.createSyncedPullRequest(true, false, true)
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

