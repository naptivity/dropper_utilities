export const name = "queue"
export const aliases = ["rq", "q", "dropper"]
export const allowedSources = ["slash", "party"]
export const description = "Sends you to a game of Dropper"
export const requireTrust = true
export async function run(commandHandler) {
  commandHandler.clientHandler.autoQueue.queueNewGame()
  commandHandler.reply(`§7Queueing a game of Dropper...`)
}