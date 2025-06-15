export const name = "recordpackets"
export const aliases = ["w", "rec", "pcap"]
export const allowedSources = ["slash", "console"]
export const description = "Toggles whether both incoming and outgoing packets are being written to [username]packetcap.txt (for analysis). Add \"clear\" or \"c\" as argument to clear packet"
export const requireTrust = true

export async function run(commandHandler) {
  let cleared = false
  if ((!commandHandler.clientHandler.logPackets && commandHandler.args[0] === "c" || commandHandler.args[0] === "clear")) {
    commandHandler.clientHandler.clearPacketLogs()
    cleared = true
  }
  commandHandler.clientHandler.logPackets = !commandHandler.clientHandler.logPackets
  commandHandler.reply(`§7Packet logging is now §c${commandHandler.clientHandler.logPackets ? "enabled" : "disabled"}${cleared ? "§7 and the log file was cleared" : ""}§7.`)
}