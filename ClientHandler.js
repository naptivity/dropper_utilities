import EventEmitter from "events" //https://nodejs.org/en/learn/asynchronous-work/the-nodejs-event-emitter 
import { createClient, states } from "minecraft-protocol" //import client functionality from minecraft-protocol so it can create a client that will connect to hypixel
import { CustomCommands } from "./internalModules/CustomCommands.js" 
import { AutoQueue } from "./internalModules/AutoQueue.js"
import { StateHandler } from "./internalModules/StateHandler.js"
import { PartyCommands } from "./internalModules/PartyCommands.js"
import { PartyChatThrottle } from "./internalModules/PartyChatThrottle.js"
import { BetterGameInfo } from "./internalModules/BetterGameInfo.js"
import { ChunkPreloader } from "./internalModules/ChunkPreloader.js"
import { TabListHandler } from "./internalModules/TabListHandler.js"
import { AutoVote } from "./internalModules/AutoVote.js"
import { random64BitBigInt } from "./utils/utils.js"

import fs from "fs" //for writing packets to a file for easier viewing



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

    this.stateHandler = new StateHandler(this)

    this.partyChatThrottle = new PartyChatThrottle(this) //previously used just for party chat, now it throttles every party command
    this.customCommands = new CustomCommands(this)
    this.autoQueue = new AutoQueue(this)
    this.partyCommands = new PartyCommands(this)
    this.betterGameInfo = new BetterGameInfo(this)
    this.chunkPreloader = new ChunkPreloader(this)
    this.tabListHandler = new TabListHandler(this)
    this.autoVote = new AutoVote(this)

    
    console.log(userClient.username + " connected to the proxy")

    this.logPackets = false
    this.packetFilter = ["boss_bar", "ping", "pong", "keep_alive", "scoreboard_objective", "position",
                          "update_time", "entity_head_rotation", "entity_move_look", "rel_entity_move",
                          "sound_effect", "entity_teleport", "entity_metadata", "entity_update_attributes",
                          "teams", "look", "acknowledge_player_digging"]
    // this.withholdPackets = ["set_slot", ]
    this.packetFilePrefix = "./packetCaptures/" + userClient.username + "packetcap.txt"
    // this.clearPacketLogs()

    this.bindEventListeners()
  }

  clearPacketLogs() {
    fs.writeFileSync(this.packetFilePrefix, "")
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

    userClient.on("packet", (data, meta, buffer) => { //happens when recieving a packet from the USER (sent by the real minecraft client)
      if (this.logPackets && !this.packetFilter.includes(meta.name)) {
        fs.appendFileSync(this.packetFilePrefix,
          "\n\n\n\n\n\n\n\nUSERCLIENT (SERVERBOUND/OUTGOING) - " + meta.state + " | " + meta.name + "\n\n" +
          "DATA\n" + JSON.stringify(data, null, 2) +"\n\n" +
          "META\n" + JSON.stringify(meta, null, 2) + "\n\n" +
          "BUFFER\n" + buffer.toString("hex"))
        // console.log("\n\nUSERCLIENT (SERVERBOUND/OUTGOING) - " + meta.state + " | " + meta.name)
      }
      let replaced = false
      for (let modifier of this.outgoingModifiers) {
        let result = modifier(data, meta)
        if (result) {
          let type = result.type
          if (type === "cancel") { //completely drops packet instead of forwarding it to hypixel
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

    proxyClient.on("packet", (data, meta, buffer) => { //happens when recieving a packet from hypixel (sent to the fake minecraft client)
      if (this.logPackets && !this.packetFilter.includes(meta.name)) {
        fs.appendFileSync(this.packetFilePrefix,
          "\n\n\n\n\n\n\n\nPROXYCLIENT (CLIENTBOUND/INCOMING) - " + meta.state + " | " + meta.name + "\n\n" +
          "DATA\n" + JSON.stringify(data, null, 2) +"\n\n" +
          "META\n" + JSON.stringify(meta, null, 2) + "\n\n" +
          "BUFFER\n" + buffer.toString("hex"))
        // console.log("\n\nPROXYCLIENT (CLIENTBOUND/INCOMING) - " + meta.state + " | " + meta.name)
        // if (this.withholdPackets.includes(meta.name)) return
      }
      let replaced = false
      for (let modifier of this.incomingModifiers) {
        let result = modifier(data, meta)
        if (result) {
          let type = result.type
          if (type === "cancel") { //completely drops packet instead of sending it to client
            return
          }
          else if (type === "replace") {
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
      console.log(this.userClient.username + " disconnected from the proxy for reason " + reason)
      this.destroy()
    })

    proxyClient.on("end", (reason) => {
      userClient.end(`§cProxy lost connection to Hypixel: §r${reason}`)
      // console.log(`§cProxy lost connection to Hypixel: §r${reason}`)
    })

    userClient.on("error", () => {})
    proxyClient.on("error", () => {})
    proxyClient.once("disconnect", data => { //if the proxy client gets kicked while logging in, kick the user client
      userClient.write("kick_disconnect", data)
    })
  }



  sendCustomServerPacket(meta_name, data) {
    this.proxyClient.write(meta_name, data)
  }

  
  sendCustomClientPacket(meta_name, data) {
    this.userClient.write(meta_name, data)
  }



  sendClientMessage(content) {
    if (this.userClient.protocolVersion < 759) { //before 1.19.1
      this.userClient.write("chat", {
        position: 1,
        message: JSON.stringify(content),
        sender: "00000000-0000-0000-0000-000000000000"
      })
    }
    else if (this.userClient.protocolVersion < 760) { //1.19.1
      this.userClient.write("system_chat", {
        content: JSON.stringify(content),
        type: 1
      })
    }
    else {
      this.userClient.write("system_chat", { //beyond 1.19.1
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
    }
    else if (this.userClient.protocolVersion < 760) {
      this.userClient.write("system_chat", {
        content: JSON.stringify(content),
        type: 2
      })
    }
    else {
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
    }
    else if (this.userClient.protocolVersion < 760) {
      this.proxyClient.write("chat_command", {
        command: content,
        timestamp: BigInt(Date.now()),
        salt: 0n,
        argumentSignatures: [],
        signedPreview: false
      })
    }
    else if (this.userClient.protocolVersion < 761) {
      this.proxyClient.write("chat_command", {
        command: content,
        timestamp: BigInt(Date.now()),
        salt: random64BitBigInt(),
        argumentSignatures: [],
        signedPreview: false,
        previousMessages: [],
        lastRejectedMessage: undefined
      })
    }
    else {
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

