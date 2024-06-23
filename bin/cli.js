#!/usr/bin/env node
import { config } from 'dotenv'
config()
import GitClick from '../src/lib.js'
import yargs from 'yargs/yargs'
import chalk from 'chalk'

const yarg = yargs(process.argv.slice(2)).argv
const [command, ...args] = yarg._

class Command {
    constructor(CLI) {
        this.CLI = CLI
        this.sync = this.sync.bind(this)
        this.test = this.test.bind(this)
    }

    async sync() {
        return this.CLI.lib.handleSync(this.CLI.args, this.CLI.flags, true)
    }

    async test() {
        const taskImages = await this.CLI.lib.getTaskImages()
    }
}

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
        this.commands = Object
            .keys(new Command(this))
            .filter(key => key !== 'CLI')

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
        const command = new Command(this)
        const method = command[this.command] && command[this.command]
        if (!method) {
            this.lib.log(`${this.command} is not a valid command`, true)
        }
        return method()
    }
}

const cli = new CLI()
cli.setup()

