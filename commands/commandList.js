export let commandList = []
export function commandListString(source, prefix) {
  let commands = commandList.filter(c => c.allowedSources.includes(source))
  commands = commands.sort((a, b) => a.name.localeCompare(b.name))
  return commands.map(c => prefix + c.name).join(", ")
}

import * as commandHelp from "./help.js"
commandList.push(commandHelp)
import * as commandHelp2 from "./help2.js"
commandList.push(commandHelp2)
import * as commandTogglecommands from "./togglecommands.js"
commandList.push(commandTogglecommands)
import * as commandQueue from "./queue.js"
commandList.push(commandQueue)
import * as commandAutoqueue from "./autoqueue.js"
commandList.push(commandAutoqueue)
import * as commandRequireperfectmaps from "./requireperfectmaps.js"
commandList.push(commandRequireperfectmaps)
import * as commandTakeownership from "./takeownership.js"
commandList.push(commandTakeownership)
import * as commandTrust from "./trust.js"
commandList.push(commandTrust)
import * as commandEval from "./eval.js"
commandList.push(commandEval)
import * as commandExit from "./exit.js"
commandList.push(commandExit)
import * as commandPing from "./ping.js"
commandList.push(commandPing)
import * as commandStatistics from "./statistics.js"
commandList.push(commandStatistics)
import * as commandRecordpackets from "./recordpackets.js"
commandList.push(commandRecordpackets)