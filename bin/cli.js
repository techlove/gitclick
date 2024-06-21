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
            const repo = await this.lib.getRepo()
            console.log({ repo })
        }
    }
}

const cli = new CLI()
cli.setup()

