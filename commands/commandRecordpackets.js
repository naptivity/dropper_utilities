export const name = "recordpackets"
export const aliases = ["w", "rec"]
export const allowedSources = ["slash", "console"]
export const description = "Toggles whether both incoming and outgoing packets are being written to packets.txt (for analysis). Add \"clear\" or \"c\" as argument to clear packet"
export const requireTrust = true

export async function run(usageInstance) {
  let cleared = false
  if ((!usageInstance.clientHandler.logPackets && usageInstance.args[0] === "c" || usageInstance.args[0] === "clear")) {
    usageInstance.clientHandler.clearPacketLogs()
    cleared = true
  }
  usageInstance.clientHandler.logPackets = !usageInstance.clientHandler.logPackets
  usageInstance.reply(`§7Packet logging is now §c${usageInstance.clientHandler.logPackets ? "enabled" : "disabled"}${cleared ? "§7 and the log file was cleared" : ""}§7.`)
}