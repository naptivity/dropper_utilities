export const name = "autoqueue"
export const aliases = ["aq", "arq"]
export const allowedSources = ["slash", "party"]
export const description = "Configures automatic re-queueing"
export const requireTrust = false
export async function run(commandHandler) {
  let autoQueue = commandHandler.clientHandler.autoQueue

  if (!commandHandler.runnerTrusted) {
    commandHandler.reply("§cYou don't have permission to configure automatic requeueing.")
    return
  }

  if (commandHandler.args.length === 0) {
    let prefix = `§7Automatic re-queueing is currently set to §c`
    if (autoQueue.requeueOnOtherFinish) {
      commandHandler.reply(prefix + `requeue on any player finishing`)
    }
    else if (autoQueue.requeueOnFinish) {
      commandHandler.reply(prefix + `requeue on finish`)
    }
    else if (autoQueue.requeueAfterTime) {
      commandHandler.reply(prefix + `requeue after ${autoQueue.reQueueTime / 1000} seconds`)
    }
    else {
      commandHandler.reply(prefix + `disabled`)
    }

    if (commandHandler.runnerTrusted) {
      commandHandler.reply(`§7Usage: ${commandHandler.prefix}aq off | ${commandHandler.prefix}aq time <time in seconds> | ${commandHandler.prefix}aq finish OR ${commandHandler.prefix}aq f | ${commandHandler.prefix}aq afinish OR ${commandHandler.prefix}aq af.`)
    }
    return
  }

  if (commandHandler.args[0]) {
    let prefix = `§7Automatic re-queueing is now set to §c`
    
    if (commandHandler.args[0] === "off") {
      autoQueue.setConfig("off")
      commandHandler.reply(prefix + `disabled§7.`)
    }
    else if (commandHandler.args[0] === "time") {
      if (commandHandler.args.length < 2) {
        commandHandler.reply(`§7You must specify a time.`)
        return
      }
      let time = parseFloat(commandHandler.args[1])
      if (isNaN(time) || time < 27.3 || time > 600) {
        commandHandler.reply(`§7You must specify a valid time.`)
        return
      }
      autoQueue.setConfig("time", time * 1000)
      commandHandler.reply(prefix + `requeue after ${time} seconds§7.`)
    }
    else if (commandHandler.args[0] === "finish" || commandHandler.args[0] === "f") {
      autoQueue.setConfig("finish")
      commandHandler.reply(prefix + `requeue on finish§7.`)
    }
    else if (commandHandler.args[0] === "afinish" || commandHandler.args[0] === "af") {
      autoQueue.setConfig("any_finish")
      commandHandler.reply(prefix + `requeue on any player finishing§7.`)
    }
    else {
      commandHandler.reply(`§cInvalid subcommand.`)
    }
  }
}