import { commandListString, commandList } from "./commandList.js"

export const name = "commands"
export const aliases = ["cmds", "cmdinfo"]
export const allowedSources = ["slash"] //specifically for slash commands, does not include "help" or "h"
export const description = "View the list of commands or help for a specific command"
export const requireTrust = false
export async function run(commandHandler) {
  if (commandHandler.argsString !== "") {
    //requesting info about a command
    let lowercase = commandHandler.argsString.toLowerCase()
    let command = commandList.find(c => c.allowedSources.includes(commandHandler.source) && (c.name === lowercase || c.aliases.includes(lowercase)))
    if (!command) {
      commandHandler.reply("§7That command doesn't exist.")
      return
    }
    commandHandler.reply(`§c${command.name}§7: Requires trust: §c${command.requireTrust ? "yes" : "no"}${command.aliases.length > 0 ? `§7, Aliases: §c${command.aliases.join(", ")}` : ""}§7, Description: §c${command.description}§7.`)
    return
  }
  commandHandler.reply(`§7Commands: §c${commandListString(commandHandler.source, commandHandler.prefix)}`)
}