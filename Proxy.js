import { createServer } from "minecraft-protocol"  //minecraft-protocol is https://github.com/PrismarineJS/node-minecraft-protocol which is just the mc packet interfacing library
import { ClientHandler } from "./ClientHandler.js" 
import faviconText from "./favicon.js" //import base 64 encoded version of the favicon image
import minecraftData from "minecraft-data"
import { config } from "./configHandler.js" 

const supportedString = "Please use 1.8.9 or 1.19-1.21.5"

export class Proxy {
  constructor() {
    this.version = "2.0.0" //i feel like all the changes im making and the fact im revamping a 2 year old program deserves a 2.0

    this.proxyServer = createServer({
      "online-mode": true, //of course this is a legit mc server so online mode gotta be on
      keepAlive: false, //stops the proxy server from checking if the client is alive with keep alive packets, so it wont know when a client dcs
      version: false, //since this server should support several different versions obviously not specifying one 
      port: config["server-port"], //what port will be used to connect to localhost
      host: config["server-host"], //honestly dont know what changing this would do
      motd: `§a§lHypixel Dropper Proxy §7(Version ${this.version})\n§bTab stats and chunk caching added`, //ill change this to whatever
      favicon: faviconText, //base  64 encoded version of the favicon image (should be changed, maybe add customizability including motd)
      hideErrors: false, //true, //i want to debug
      beforePing: this.handlePing.bind(this)
    })
    this.clientId = 0
    this.clients = new Map()

    this.destroyed = false
    
    this.bindEventListeners()
  }

  destroy() {
    if (this.destroyed) return
    this.destroyed = true
    this.proxyServer.close()
  }

  bindEventListeners() {
    this.proxyServer.on("connection", client => {
      client.once("set_protocol", data => {
        //check if newer than 1.21.5
        if (client.protocolVersion > 770) {
          client.incompatible = true
          if (data.nextState === 1) return
          console.log("A connection attempt was made with a newer Minecraft version than supported. " + supportedString)
          client.end("§cYou're using a newer Minecraft version than currently supported.\n" + supportedString)
          return
        }
        //check if older than 1.8
        if (client.protocolVersion < 47) {
          client.incompatible = true
          if (data.nextState === 1) return
          console.log("A connection attempt was made with an older Minecraft version than supported. " + supportedString)
          client.end("§cYou're using an older Minecraft version than currently supported.\n" + supportedString)
          return
        }
      
        let versionData = minecraftData(client.protocolVersion)
        if (versionData) {
          client.minecraftVersion = versionData.version.minecraftVersion
        } else {
          client.incompatible = true
          if (data.nextState === 1) return
          console.log("A connection attempt was made with an unsupported Minecraft version. " + supportedString)
          client.end("§cYou're using an unsupported Minecraft version.\n" + supportedString)
          return
        }
        if (!["1.8", "1.11", "1.12", "1.14", "1.15", "1.16", "1.17", "1.18", "1.19", "1.20", "1.21"].includes(versionData.version.majorVersion)) {
          client.incompatible = true
          if (data.nextState === 1) return
          client.end("§cHypixel doesn't support this Minecraft version.\n" + supportedString)
          return
        }
      })
    })
    this.proxyServer.on("login", userClient => {
      let handler = new ClientHandler(userClient, this, this.clientId)
      this.clients.set(this.clientId, handler)
      this.clientId++
    })
    this.proxyServer.on("error", error => {
      if (error.code === "EADDRINUSE") {
        console.log("Proxy was unable to start, port 25565 is already in use.")
        console.log("Make sure you don't have this already open in another window, and make sure you don't have any real Minecraft servers running on your computer.")
      } else {
        throw error
      }
    })
    this.proxyServer.on("listening", () => {
      console.log("Proxy started. You may now join localhost in Minecraft. Keep this window open in the background.")
    })
  }

  handlePing(response, client) {
    if (client.incompatible) {
      response.version.name = "1.8-1.8.9, 1.11-1.12.2, 1.14-1.21.5" 
      response.version.protocol = -1
    }
    return response
  }

  removeClientHandler(id) {
    this.clients.delete(id)
  }
}