import { isTrusted } from "../data/trusted.js"
import { removeFormattingCodes } from "../utils/utils.js"
import { list as commandList } from "./commandList.js"

export class UsageInstance {
  constructor(clientHandler, string, uuid, source, proxy) {
    this.clientHandler = clientHandler
    this.fullString = string
    this.runnerUUID = uuid
    this.source = source
    this.proxy = proxy
  }

  handle() {
    if (this.source === "slash") {
      this.prefix = "/"
    }
    else if (this.source === "party") {
      this.prefix = "!"
    }
    else if (this.source === "console") {
      this.prefix = ""
    }
    this.fullStringTrim = this.fullString.trim()
    this.fullStringSplit = this.fullStringTrim.split(" ")
    this.commandBase = this.fullStringSplit[0].toLowerCase()
    this.args = this.fullStringSplit.slice(1)
    this.argsString = this.args.join(" ")
    if (this.source === "slash" || this.source === "console") {
      this.runnerTrusted = true
    }
    else {
      if (this.clientHandler.userClient.trimmedUUID === this.runnerUUID) {
        this.runnerTrusted = true
      }
      else {
        this.runnerTrusted = isTrusted(this.runnerUUID)
      }
    }
    let command = commandList.find(c => c.allowedSources.includes(this.source) && (c.name === this.commandBase || c.aliases.includes(this.commandBase)))
    this.command = command
    if (!command) return false
    if (command.requireTrust && !this.runnerTrusted) {
      this.reply("§cYou don't have permission to use this command.")
      return true
    }
    this.runAsync()
    return true
  }

  async runAsync() {
    this.running = true
    try {
      await this.command.run(this)
    }
    catch (error) {
      console.log("--- An exception occurred, please report this to Lapis#7110 on Discord ---")
      console.error(error)
      console.log("--- An exception occurred, please report this to Lapis#7110 on Discord ---")
      this.reply("§cAn error occured while running that command, check the console window for more information.")
    }
    this.running = false
  }

  reply(text) {
    if (this.source === "slash") {
      if (this.clientHandler.destroyed) return
      this.clientHandler.sendClientMessage({
        text: `§9DropperUtilities > §r${text}`
      })
    }
    else if (this.source === "party") {
      if (this.clientHandler.destroyed) return
      text = removeFormattingCodes(text)
      this.clientHandler.partyChatThrottle.addToQueue("/pc " + text)
    }
    else if (this.source === "console") {
      //TODO: translate to ANSI color codes for console
      text = removeFormattingCodes(text)
      console.log(text)
    }
  }
}