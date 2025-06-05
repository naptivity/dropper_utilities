import EventEmitter from "events" //https://nodejs.org/en/learn/asynchronous-work/the-nodejs-event-emitter 
import { createClient, states } from "minecraft-protocol" //import client functionality from minecraft-protocol so it can create a client that will connect to hypixel
import { CustomCommands } from "./internalModules/CustomCommands.js" 
import { AutoQueue } from "./internalModules/AutoQueue.js"
import { StateHandler } from "./internalModules/StateHandler.js"
import { PartyCommands } from "./internalModules/PartyCommands.js"
import { PartyChatThrottle } from "./internalModules/PartyChatThrottle.js"
import { TimeDetail } from "./internalModules/TimeDetail.js"
import { BetterGameInfo } from "./internalModules/BetterGameInfo.js"
import { TickCounter } from "./internalModules/TickCounter.js"
import { WorldTracker } from "./internalModules/WorldTracker.js"
import { ServerAgeTracker } from "./internalModules/ServerAgeTracker.js"
import { CustomModules } from "./internalModules/CustomModules.js"
import { ChunkPreloader } from "./internalModules/ChunkPreloader.js"
import { TabListHandler } from "./internalModules/TabListHandler.js"
import { random64BitBigInt } from "./utils/utils.js"

import fs from "fs" //for writing packets to a file for easier viewing
fs.writeFileSync("./packets.txt", "")

export class ClientHandler extends EventEmitter { //basically just allow the class to .emit event
  constructor(userClient, proxy, id) {
    super() //inherit eventemitter constructor

    this.userClient = userClient //get client object from proxy, which represents the user (real minecraft client) that joined the proxy
    this.proxy = proxy //parent proxy object (only ever used to delete itself from the client map on user leave)
    this.id = id //client id assigned in the map that holds all client objects
    //https://github.com/PrismarineJS/node-minecraft-protocol/blob/master/docs/API.md#mccreateclientoptions
    this.proxyClient = createClient({ //create the actual mineraft-protocol client object that connects to hypixel on behalf of the user
      host: "hypixel.net",
      username: userClient.username,
      keepAlive: false, //dont send packets to see if hypixel is alive
      version: userClient.protocolVersion, //this is what gets the proxy connected to hypixel with the same version that the user connected with to the proxy
      auth: "microsoft", //obviously need to use microsoft auth, since we arent using password or profilesfolder you just need the link that appears
      hideErrors: false, //true //need to debug
      debug: true //turn off after debug
    }) //the client automatically tries to connect once its created

    //add trimmed UUIDs
    this.userClient.trimmedUUID = this.userClient.uuid.replaceAll("-", "")
    this.proxyClient.trimmedUUID = this.userClient.trimmedUUID

    this.destroyed = false

    this.outgoingModifiers = []
    this.incomingModifiers = []

    //due to issues with chunk parsing on 1.18, this does not currently support tick counting on 1.18.
    this.disableTickCounter = userClient.protocolVersion >= 757

    //------------------------------------------------------------------
    // if (!this.disableTickCounter) this.worldTracker = new WorldTracker(this)
    // this.stateHandler = new StateHandler(this)
    // if (!this.disableTickCounter) {
    //   this.tickCounter = new TickCounter(this)
    //   this.stateHandler.bindTickCounter()
    // }
    // //previously used just for party chat, now it throttles every party command
    // this.partyChatThrottle = new PartyChatThrottle(this)
    // this.customCommands = new CustomCommands(this)
    // this.autoQueue = new AutoQueue(this)
    // this.partyCommands = new PartyCommands(this)
    // this.timeDetail = new TimeDetail(this)
    // this.betterGameInfo = new BetterGameInfo(this)
    // this.serverAgeTracker = new ServerAgeTracker(this)
    // this.chunkPreloader = new ChunkPreloader(this)
    // this.customModules = new CustomModules(this)
    // this.tabListHandler = new TabListHandler(this)
    //------------------------------------------------------------------

    console.log(userClient.username + " connected to the proxy")

    this.bindEventListeners()
  }

  destroy() {
    if (this.destroyed) return
    this.destroyed = true
    this.proxy.removeClientHandler(this.id)
    this.emit("destroy")
  }

  bindEventListeners() {
    let userClient = this.userClient
    let proxyClient = this.proxyClient

    userClient.on("packet", (data, meta, buffer) => { //happens when recieving a packet from the USER (the real minecraft client)
      fs.appendFileSync("./packets.txt",
        "\n\n\n\n\n\n\n\nUSERCLIENT - OUTGOING\n\n" +
        "DATA\n" + JSON.stringify(data, null, 2) +"\n\n" +
        "META\n" + JSON.stringify(meta, null, 2) + "\n\n" +
        "BUFFER\n" + buffer.toString("hex"))
      let replaced = false
      for (let modifier of this.outgoingModifiers) {
        let result = modifier(data, meta)
        if (result) {
          let type = result.type
          if (type === "cancel") {
            return
          }
          else if (type === "replace") {
            data = result.data
            meta = result.meta
            replaced = true
          }
        }
      }
      if (replaced) {
        proxyClient.write(meta.name, data, meta) //forwards edited player packet to hypixel through our connected fake minecraft client
      }
      else {
        proxyClient.writeRaw(buffer) //forwards unedited player packet to hypixel through our connected fake minecraft client
      }
    })

    proxyClient.on("packet", (data, meta, buffer) => { //happens when recieving a packet from hypixel (sent to our fake minecraft client)
      fs.appendFileSync("./packets.txt",
        "\n\n\n\n\n\n\n\nPROXYCLIENT - INCOMING\n\n" +
        "DATA\n" + JSON.stringify(data, null, 2) +"\n\n" +
        "META\n" + JSON.stringify(meta, null, 2) + "\n\n" +
        "BUFFER\n" + buffer.toString("hex"))
      let replaced = false
      for (let modifier of this.incomingModifiers) {
        let result = modifier(data, meta)
        if (result) {
          let type = result.type
          if (type === "cancel") {
            return
          } else if (type === "replace") {
            data = result.data
            meta = result.meta
            replaced = true
          }
        }
      }
      if (meta.state !== states.PLAY) return
      if (replaced) {
        userClient.write(meta.name, data) //forwards edited hypixel server packet to real minecraft client through our local proxy
      }
      else {
        userClient.writeRaw(buffer) //forwards unedited hypixel server packet to real minecraft client through our local proxy
      }
    })

    userClient.on("end", (reason) => {
      proxyClient.end()
      console.log(reason)
      this.destroy()
    })

    proxyClient.on("end", (reason) => {
      userClient.end(`§cProxy lost connection to Hypixel: §r${reason}`)
      console.log(`§cProxy lost connection to Hypixel: §r${reason}`)
    })

    userClient.on("error", () => {})
    proxyClient.on("error", () => {})
    proxyClient.once("disconnect", data => { //if the proxy client gets kicked while logging in, kick the user client
      userClient.write("kick_disconnect", data)
    })
  }



  sendClientMessage(content) {
    if (this.userClient.protocolVersion < 759) {
      this.userClient.write("chat", {
        position: 1,
        message: JSON.stringify(content),
        sender: "00000000-0000-0000-0000-000000000000"
      })
    } else if (this.userClient.protocolVersion < 760) {
      this.userClient.write("system_chat", {
        content: JSON.stringify(content),
        type: 1
      })
    } else {
      this.userClient.write("system_chat", {
        content: JSON.stringify(content),
        isActionBar: false
      })
    }
  }


  sendClientActionBar(content) {
    if (this.userClient.protocolVersion < 759) {
      this.userClient.write("chat", {
        position: 2,
        message: JSON.stringify(content),
        sender: "00000000-0000-0000-0000-000000000000"
      })
    } else if (this.userClient.protocolVersion < 760) {
      this.userClient.write("system_chat", {
        content: JSON.stringify(content),
        type: 2
      })
    } else {
      this.userClient.write("system_chat", {
        content: JSON.stringify(content),
        isActionBar: true
      })
    }
  }


  sendServerCommand(content) {
    if (this.userClient.protocolVersion < 759) {
      this.proxyClient.write("chat", {
        message: "/" + content
      })
    } else if (this.userClient.protocolVersion < 760) {
      this.proxyClient.write("chat_command", {
        command: content,
        timestamp: BigInt(Date.now()),
        salt: 0n,
        argumentSignatures: [],
        signedPreview: false
      })
    } else if (this.userClient.protocolVersion < 761) {
      this.proxyClient.write("chat_command", {
        command: content,
        timestamp: BigInt(Date.now()),
        salt: random64BitBigInt(),
        argumentSignatures: [],
        signedPreview: false,
        previousMessages: [],
        lastRejectedMessage: undefined
      })
    } else {
      this.proxyClient.write("chat_command", {
        command: content,
        timestamp: BigInt(Date.now()),
        salt: random64BitBigInt(),
        argumentSignatures: [],
        messageCount: 0,
        acknowledged: Buffer.alloc(3)
      })
    }
  }
}

