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
            this.lib.handleSync(this.args, this.flags, true)
        }
    }
}

const cli = new CLI()
cli.setup()

