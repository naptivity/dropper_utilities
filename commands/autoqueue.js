export const name = "autoqueue"
export const aliases = ["aq", "arq"]
export const allowedSources = ["slash", "party"]
export const description = "Configures automatic re-queueing"
export const requireTrust = false
export async function run(usageInstance) {
  let autoQueue = usageInstance.clientHandler.autoQueue

  if (!usageInstance.runnerTrusted) {
    usageInstance.reply("§cYou don't have permission to configure automatic requeueing.")
    return
  }

  if (usageInstance.args.length === 0) {
    let prefix = `§7Automatic re-queueing is currently set to §c`
    if (autoQueue.requeueOnOtherFinish) {
      usageInstance.reply(prefix + `requeue on any player finishing`)
    }
    else if (autoQueue.requeueOnFinish) {
      usageInstance.reply(prefix + `requeue on finish`)
    }
    else if (autoQueue.requeueAfterTime) {
      usageInstance.reply(prefix + `requeue after ${autoQueue.reQueueTime / 1000} seconds`)
    }
    else {
      usageInstance.reply(prefix + `disabled`)
    }

    if (usageInstance.runnerTrusted) {
      usageInstance.reply(`§7Usage: ${usageInstance.prefix}aq off | ${usageInstance.prefix}aq time <time in seconds> | ${usageInstance.prefix}aq finish OR ${usageInstance.prefix}aq f | ${usageInstance.prefix}aq ofinish OR ${usageInstance.prefix}aq of.`)
    }
    return
  }

  if (usageInstance.args[0]) {
    let prefix = `§7Automatic re-queueing is now set to §c`
    
    if (usageInstance.args[0] === "off") {
      autoQueue.setConfig("off")
      usageInstance.reply(prefix + `disabled§7.`)
    }
    else if (usageInstance.args[0] === "time") {
      if (usageInstance.args.length < 2) {
        usageInstance.reply(`§7You must specify a time.`)
        return
      }
      let time = parseFloat(usageInstance.args[1])
      if (isNaN(time) || time < 27.3 || time > 600) {
        usageInstance.reply(`§7You must specify a valid time.`)
        return
      }
      autoQueue.setConfig("time", time * 1000)
      usageInstance.reply(prefix + `requeue after ${time} seconds§7.`)
    }
    else if (usageInstance.args[0] === "finish" || usageInstance.args[0] === "f") {
      autoQueue.setConfig("finish")
      usageInstance.reply(prefix + `requeue on finish§7.`)
    }
    else if (usageInstance.args[0] === "afinish" || usageInstance.args[0] === "af") {
      autoQueue.setConfig("any_finish")
      usageInstance.reply(prefix + `requeue on any player finishing§7.`)
    }
    else {
      usageInstance.reply(`§cInvalid subcommand.`)
    }
  }
}