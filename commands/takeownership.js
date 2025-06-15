export const name = "takeownership"
export const aliases = ["to"]
export const allowedSources = ["party"]
export const description = "Gives you ownership of the party"
export const requireTrust = true
export async function run(commandHandler) {
  if (commandHandler.runnerUUID === commandHandler.clientHandler.userClient.trimmedUUID) {
    commandHandler.reply("§cYou can't do this!")
    return
  }
  commandHandler.reply(`§7Attempting to give you party ownership...`)
  commandHandler.clientHandler.partyChatThrottle.addToQueue(`/p transfer ${commandHandler.runnerUUID}`)
}