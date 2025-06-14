export let list = []
export function commandListString(source, prefix) {
  let commands = list.filter(c => c.allowedSources.includes(source))
  commands = commands.sort((a, b) => a.name.localeCompare(b.name))
  return commands.map(c => prefix + c.name).join(", ")
}

import * as commandHelp from "./help.js"
list.push(commandHelp)
import * as commandHelp2 from "./help2.js"
list.push(commandHelp2)
import * as commandTogglecommands from "./togglecommands.js"
list.push(commandTogglecommands)
import * as commandQueue from "./queue.js"
list.push(commandQueue)
import * as commandAutoqueue from "./autoqueue.js"
list.push(commandAutoqueue)
import * as commandRequireperfectmaps from "./requireperfectmaps.js"
list.push(commandRequireperfectmaps)
import * as commandTakeownership from "./takeownership.js"
list.push(commandTakeownership)
import * as commandTrust from "./trust.js"
list.push(commandTrust)
import * as commandEval from "./eval.js"
list.push(commandEval)
import * as commandExit from "./exit.js"
list.push(commandExit)
import * as commandPing from "./ping.js"
list.push(commandPing)
import * as commandStatistics from "./statistics.js"
list.push(commandStatistics)
import * as commandRecordpackets from "./recordpackets.js"
list.push(commandRecordpackets)