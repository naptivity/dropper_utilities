import { config } from "../configHandler.js"
import { close_window, held_item_slot, use_item, window_click } from "../utils/templatePackets.js"

let enabled = config["auto-vote"]
let autoVoteMapsLists = config["auto-vote-maps"]
//yes you have to fix the lists because yaml lists dont work like that idk why the perfect map reqs config was formatted like that
autoVoteMapsLists.fantasy = autoVoteMapsLists.fantasy[0].split(",").map(item => item.trim())
autoVoteMapsLists.abstract = autoVoteMapsLists.abstract[0].split(",").map(item => item.trim())
autoVoteMapsLists.landscape = autoVoteMapsLists.landscape[0].split(",").map(item => item.trim())
autoVoteMapsLists.futuristic = autoVoteMapsLists.futuristic[0].split(",").map(item => item.trim())


export class AutoVote {
  constructor(clientHandler) {
    this.clientHandler = clientHandler
    this.userClient = clientHandler.userClient
    this.proxyClient = clientHandler.proxyClient

    this.use_item_sequence = 0 //used to track 
    this.windowId = null
    this.stateId = null
    this.completedWindowIds = []

    this.trackChat = false
    this.recentMessages = []

    this.autoVoted = false


    this.bindEventListeners()
    this.bindModifiers()
  }

  bindModifiers() {
    this.clientHandler.outgoingModifiers.push(this.handleOutgoingPacketChecks.bind(this))
    this.clientHandler.incomingModifiers.push(this.handleIncomingPacketChecks.bind(this))
  }



  handleOutgoingPacketChecks(data, meta) {
    if (meta.name === "use_item") {
      this.use_item_sequence = data.sequence
    }
    else if (meta.name === "close_window" && this.windowId && !this.autoVoted) { //if the user closed the window while we are autovoting
      this.windowId = null //stop autovote by nullify windowid
    }
  }



  handleIncomingPacketChecks(data, meta) {
    if (!enabled) return
    if (this.autoVoted) return //if autovoting is over we shouldnt do it again
    if (meta.name === "open_window" && JSON.parse(data.windowTitle).translate === "Map Voting") { //if its an open window packet specifically for map voting gui
      this.windowId = data.windowId //set the window id to the window id of the detected map voting gui
    }
    else if (meta.name === "window_items" && data.windowId === this.windowId && !this.completedWindowIds.includes(data.windowId)) { //make sure getting window items for previously registered opened map voting window, and also make sure we arent retriggering auto vote on a window thats already been opened
      if (data.stateId >= 0) { //dont know if stateid -1 ever happens with window_items but might as well make sure
        this.stateId = data.stateId //gotta keep stateid updated because we need updated stateid for sending window_click packet
        this.triggerAutoVote(data, meta)
      }
    }
    else if (meta.name === "set_slot" && data.windowId === this.windowId){
      if (data.stateId >= 0) { //if stateId -1 then its one of the useless set_slot packets that get sent for whatever reason
        this.stateId = data.stateId //gotta keep stateid updated because we need updated stateid for sending window_click packet
      }
    }
    else if (this.trackChat && (meta.name === "chat" || meta.name === "system_chat")){ //logging chat when verifying if votes went thru
      let actualMessage
      if (meta.name === "chat") {
        if (data.position === 2) return
        actualMessage = data.message
      }
      else if (meta.name === "system_chat") {
        if ("type" in data && data.type !== 1) return
        if ("isActionBar" in data && data.isActionBar === true) return
        actualMessage = data.content
      }

      actualMessage = JSON.parse(actualMessage)
      // console.log(actualMessage)
      // console.log("\n\n")

      if (actualMessage.extra) { //if it has extra field
        if (actualMessage.extra[0].text === "You voted for ") { //if chat message is saying you voted for a map
          this.recentMessages.push(actualMessage.extra[1].text) //put map name in recentmessages array for autovote to access
        }
        else if (actualMessage.extra[0].text === "You have no remaining votes!") { //if chat message is saying you have no votes left
          this.recentMessages.push(actualMessage.extra[0].text) //put no remaining votes message in recentmessages array for autovote to access
        }
        else if (actualMessage.extra[0].text.includes("few seconds")) {
          this.recentMessages.push("few seconds") //if chat message is saying cooldown, put cooldown message in recentmessages array for autovote to access
        }
      }
    }
    
    // if (data.windowId === this.windowId) { //if the packet has to do with a map voting window
    //   return {
    //     type: "cancel" //drop it (dont send to user, making the auto vote process completely invisible. risky because if you move hypixel might think you are cheating by having a window open and also moving)
    //   }
    // }

    return
  }


  standardizeMapName(mapName) {
    mapName = mapName.replace("'", "")
    mapName = mapName.replace(" ", "")
    mapName = mapName.toLowerCase()
    return mapName
  }


  async triggerAutoVote(data, meta) {
    this.completedWindowIds.push(data.windowId)
    let autoVoteMaps = null
    
    let mapset = this.clientHandler.stateHandler.mapset //get mapset from statehandler
    autoVoteMaps = autoVoteMapsLists[mapset.toLowerCase()] //get appropriate mapset autovote list from config
    this.clientHandler.sendClientMessage({
      text: `§9DropperUtilities > §rMapset: ` + mapset //inform of mapset
    })

    //here is where it should figure out which 3 to vote
    if (autoVoteMaps.length > 3) {
      autoVoteMaps = autoVoteMaps.slice(0, 3)
    }

    autoVoteMaps = autoVoteMaps.map(item => item.toLowerCase()) //make the autovote lists lowercase for standardization

    for (let i = 0; i < data.items.length; i++) {
      if (data.items[i].present === true && data.items[i].itemId === 907) { //if item exists and it is GRAY dye (not green because that means we voted alr and it would undo the vote)
        let item_name_data = data.items[i].nbtData.value.display.value.Name.value
        let name = JSON.parse(item_name_data).extra[0].text
        // console.log(i, name.toLowerCase(), autoVoteMaps, autoVoteMaps.includes(name.toLowerCase()))
        if (autoVoteMaps.includes(name.toLowerCase())) { //comparing lowercase item names to lowercase list items to see if map is to be voted
          //construct window_click packet since this is a map we want to vote
          let window_click_packet = window_click
          window_click_packet.windowId = this.windowId
          window_click_packet.stateId = this.stateId
          window_click_packet.slot = i
          window_click_packet.changedSlots[0].location = i
          window_click_packet.cursorItem = data.items[i]
          
          this.recentMessages = []
          let startLength = this.recentMessages.length
          this.trackChat = true

          let success = false
          let attempts = 0

          while (!success && attempts < 5) { //retries 5 times (5 seconds)
            startLength = this.recentMessages.length

            if (!this.windowId) { //if windowid was nullified due to closing window, cancel auto vote. can try again by opening the voting menu
              this.clientHandler.sendClientMessage({
                text: `§9DropperUtilities > §rCancelled auto vote! Keep the window open for auto vote to work. Retry by opening the voting menu again.`
              })
              return
            }

            this.clientHandler.sendCustomServerPacket("window_click", window_click_packet) //sends window click packet
            attempts++
            while (this.recentMessages.length === startLength) { //waits until new relevant message is recieved
              await new Promise(resolve => setTimeout(resolve, 50))
            }

            // console.log(this.recentMessages)
            if (this.recentMessages.includes(name)) { //if we find the map name in the recent messages
              this.trackChat = false
              success = true
            }
            else if (this.recentMessages.includes("few seconds")) { //if we find a throttle message
              this.clientHandler.sendClientMessage({
                text: `§9DropperUtilities > §rAuto vote throttled, waiting 2 seconds!`
              })
              await new Promise(r => setTimeout(r, 2000)) //wait 2 seconds to try again
            }
            else if (this.recentMessages.includes("You have no remaining votes!")) { //if we find no remaining votes message for some reason
              this.clientHandler.sendClientMessage({
                text: `§9DropperUtilities > §rNo votes available for some reason. Auto vote failed`
              })
              throw new Error("No votes available auto vote error")
            }
            this.recentMessages = []
          }

          if (success) {
            this.clientHandler.sendClientMessage({
              text: `§9DropperUtilities > §rAuto voted for map ${name}!`
            })
            // console.log("Auto voted for map " + name + "!")
          }
          else {
            this.clientHandler.sendClientMessage({
              text: `§9DropperUtilities > §rAuto vote failed! Retry by opening the voting menu again.`
            })
            throw new Error("Auto vote failed")
          }
        }
      }
      else {
        // console.log(i, "empty")
      }
    }

    let close_window_packet = close_window
    close_window_packet.windowId = this.windowId
    this.clientHandler.sendCustomServerPacket("close_window", close_window_packet) //tell the server that the window was closed after auto voting
    this.clientHandler.sendCustomClientPacket("close_window", close_window_packet) //tell the client that the window was closed after auto voting (or else it will remain open clientside)
    this.windowId = null //to prevent the auto window reopening from happening after auto voting finished, windowId not null basically means auto voting is currently happening
    this.autoVoted = true //stop processing the packets to let the user open the voting gui themselves
  }



  bindEventListeners() {
    this.clientHandler.stateHandler.on("game_state", state => {
      if (!enabled) return
      if (state === "waiting") { //when entered a game lobby and waiting
        this.autoVoted = false //make sure we are able to process the necessary packets
        this.completedWindowIds = [] //reset windows that have been seen before since it resets on server transfer
        this.clientHandler.sendCustomServerPacket("held_item_slot", held_item_slot) //sets hand slot to 0 (for server)
        this.clientHandler.sendCustomClientPacket("held_item_slot", held_item_slot) //sets hand slot to 0 (for client, to prevent desync)
        let use_item_packet = use_item //because hand is a 1.9+ thing i think (mainhand 0, offhand 1) this might break in 1.8
        use_item_packet.sequence = this.use_item_sequence + 1 //increased by one by the client each time its used (might break if user decides to use item again since the real mc client doesnt keep track... lol)
        this.clientHandler.sendCustomServerPacket("use_item", use_item_packet) //use item in slot 0 (nametag for voting), will trigger window_open and window_items packets which will actually do auto voting

      }
    })
  }

}