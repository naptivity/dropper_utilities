import { CommandInstance } from "../commands/CommandInstance.js"

export class CustomCommands {
  constructor(clientHandler) {
    this.clientHandler = clientHandler
    this.userClient = clientHandler.userClient
    this.proxyClient = clientHandler.proxyClient

    this.bindModifiers()
  }

  bindModifiers() {
    this.clientHandler.outgoingModifiers.push(this.handleOutgoingPacket.bind(this))
  }

  handleOutgoingPacket(data, meta) { //1.19.1+
    if (meta.name === "chat_command") { 
      let command = new CommandInstance(this.clientHandler, data.command, this.userClient.trimmedUUID, "slash", this.clientHandler.proxy)
      if (command.isCommand) return {
        type: "cancel"
      }
    }
    if (meta.name === "chat") { //<1.19.1
      let trim = data.message.trim()
      if (!trim.startsWith("/")) return
      let string = trim.substring(1)
      let command = new CommandInstance(this.clientHandler, string, this.userClient.trimmedUUID, "slash", this.clientHandler.proxy)
      if (command.isCommand) return {
        type: "cancel"
      }
    }
  }
}