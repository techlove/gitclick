#!/usr/bin/env node
import { config } from 'dotenv'
config()
import GitClick from '../src/lib.js'
import yargs from 'yargs/yargs'

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
        if (this.command === 'sync') {
            // const repo = true || await this.lib.getRepo()
            const branchName = await this.lib.getBranchName()
            const taskId = await this.lib.extractTaskId(branchName)
            const task = await this.lib.getTask('ANDA-1726' || taskId)
            console.log(task.name)
        }
    }
}

const cli = new CLI()
cli.setup()

