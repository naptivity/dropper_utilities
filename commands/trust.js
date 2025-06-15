import { isTrusted, addToTrusted, removeFromTrusted, getTrustedList } from "../data/trusted.js"
import { getName, getInfo } from "../mojangApi/identifierHandler.js"

export const name = "trust"
export const aliases = ["trusted"]
export const allowedSources = ["console", "slash", "party"]
export const description = "Configures or views the trusted user list"
export const requireTrust = false
export async function run(commandHandler) {
  if (commandHandler.args.length === 0) {
    commandHandler.reply(`§7Usage: ${commandHandler.prefix}trust list | ${commandHandler.prefix}trust add <user> | ${commandHandler.prefix}trust remove <user>.`)
    return
  }
  if (commandHandler.args[0] === "list") {
    let trustedList = getTrustedList()
    if (trustedList.length === 0) {
      commandHandler.reply(`§7There are no trusted users.`)
      return
    }
    let promises = trustedList.map(uuid => getName(uuid))
    let names
    try {
      names = await Promise.all(promises)
    }
    catch (error) {
      //as a backup, display UUIDs if name lookup failed
      commandHandler.reply(`§cUnable to fetch usernames. Trusted users: §c${trustedList.join(", ")}§7.`)
      return
    }
    commandHandler.reply(`§7Trusted users: §c${names.join(", ")}§7.`)
  }
  else if (commandHandler.args[0] === "add") {
    if (!commandHandler.runnerTrusted) {
      commandHandler.reply("§cYou don't have permission to add trusted users.")
      return
    }
    if (commandHandler.args.length < 2) {
      commandHandler.reply(`§7You must specify a user.`)
      return
    }
    let user = commandHandler.args[1]
    let info
    try {
      info = await getInfo(user)
    }
    catch (error) {
      commandHandler.reply(`§cUnable to fetch Mojang API data. Try again in a second.`)
      return
    }
    if (!info) {
      commandHandler.reply(`§cThat user does not exist.`)
      return
    }
    if (isTrusted(info.uuid)) {
      commandHandler.reply(`§c${info.name} is already trusted.`)
      return
    }
    addToTrusted(info.uuid)
    commandHandler.reply(`§7${info.name} is now trusted.`)
  }
  else if (commandHandler.args[0] === "remove") {
    if (!commandHandler.runnerTrusted) {
      commandHandler.reply("§cYou don't have permission to remove trusted users.")
      return
    }
    if (commandHandler.args.length < 2) {
      commandHandler.reply(`§7You must specify a user.`)
      return
    }
    let user = commandHandler.args[1]
    let info
    try {
      info = await getInfo(user)
    }
    catch (error) {
      commandHandler.reply(`§cUnable to fetch Mojang API data. Try again in a second.`)
      return
    }
    if (!info) {
      commandHandler.reply(`§cThat user does not exist.`)
      return
    }
    if (!isTrusted(info.uuid)) {
      commandHandler.reply(`§c${info.name} is not trusted.`)
      return
    }
    removeFromTrusted(info.uuid)
    commandHandler.reply(`§7${info.name} is no longer trusted.`)
  }
}