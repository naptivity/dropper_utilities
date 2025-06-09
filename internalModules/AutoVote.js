import { fantasyMapset, abstractMapset, futuristicMapset, landscapeMapset } from "../utils/mapsets.js"
import { config } from "../configHandler.js"
import { window_click } from "../utils/sampleWindowClickPacket.js"

let autoVoteMapsLists = config["auto-vote-maps"]
autoVoteMapsLists.fantasy = autoVoteMapsLists.fantasy[0].split(",").map(item => item.trim())
autoVoteMapsLists.abstract = autoVoteMapsLists.abstract[0].split(",").map(item => item.trim())
autoVoteMapsLists.landscape = autoVoteMapsLists.landscape[0].split(",").map(item => item.trim())
autoVoteMapsLists.futuristic = autoVoteMapsLists.futuristic[0].split(",").map(item => item.trim())


export class AutoVote {
  constructor(clientHandler) {
    this.clientHandler = clientHandler
    this.userClient = clientHandler.userClient
    this.proxyClient = clientHandler.proxyClient

    this.use_item_sequence = 0
    this.windowId = null
    this.windowTitle = null
    this.stateId = null
    this.completedWindowIds = []


    this.bindEventListeners()
    this.bindModifiers()
  }

  bindModifiers() {
    this.clientHandler.outgoingModifiers.push(this.handleOutgoingPacketValues.bind(this))
    this.clientHandler.incomingModifiers.push(this.handleIncomingPacketValues.bind(this))
  }



  handleOutgoingPacketValues(data, meta) { //come up with better function names gangalangey
    if (meta.name === "use_item") {
      this.use_item_sequence = data.sequence
    }
  }



  handleIncomingPacketValues(data, meta) {
    if (meta.name === "open_window") {
      this.windowId = data.windowId
      this.windowTitle = data.windowTitle //should be "{\"translate\":\"Map Voting\"}" for dropper voting menu
    }
    else if (meta.name === "window_items" && data.windowId === this.windowId && JSON.parse(this.windowTitle).translate === "Map Voting" && !this.completedWindowIds.includes(data.windowId)) { //make sure not getting window items for like inventory or some non-open menu, also make sure its the map voting gui not some random window, and also make sure we arent retriggering this auto vote after sending a slot select packet (that mistake was scary)
      if (data.stateId >= 0) { //dont know if stateid -1 ever happens with window_items but might as well make sure
        this.stateId = data.stateId
        this.completedWindowIds.push(data.windowId)
        let sampleMap = this.standardizeMapName(JSON.parse(data.items[11].nbtData.value.display.value.Name.value).extra[0].text) //slot 11 will always have a map name item so we use that to determine mapset
        let autoVoteMaps = null
        if (fantasyMapset[sampleMap]) {
          autoVoteMaps = autoVoteMapsLists.fantasy
        }
        else if (abstractMapset[sampleMap]) {
          autoVoteMaps = autoVoteMapsLists.abstract
        }
        else if (landscapeMapset[sampleMap]) {
          autoVoteMaps = autoVoteMapsLists.landscape
        }
        else if (futuristicMapset[sampleMap]) {
          autoVoteMaps = autoVoteMapsLists.futuristic
        }
        else {
          throw new Error("The sample map item in the voting GUI (item slot 11, top-leftmost apparently isn't in any mapset or wasn't standardized correctly") //the name isnt in any of the mapsets??
        }

        autoVoteMaps = autoVoteMaps.map(item => item.toLowerCase()) //make the autovote lists lowercase for standardization

        for (let i = 0; i < data.items.length; i++) {
          if (data.items[i].present === true && data.items[i].itemId === 907) { //if item exists and it is GRAY dye (not green because that means we voted alr and it would undo the vote)
            let item_name_data = data.items[i].nbtData.value.display.value.Name.value
            let name = JSON.parse(item_name_data).extra[0].text
            // console.log(i, name.toLowerCase(), autoVoteMaps, autoVoteMaps.includes(name.toLowerCase()))
            if (autoVoteMaps.includes(name.toLowerCase())) { //comparing lowercase item names to lowercase list items
              let packet_data = window_click
              packet_data.windowId = this.windowId
              packet_data.stateId = this.stateId
              packet_data.slot = i
              packet_data.changedSlots[0].location = i
              packet_data.cursorItem = data.items[i]
              this.clientHandler.sendCustomServerPacket("window_click", packet_data)
              this.clientHandler.sendClientMessage({
              text: `§9DropperUtilities > §rAuto voted for map ${name}!`
              })
              // console.log("DropperUtilities > Auto voted for map " + name + "!")
            }
            

          }
          else {
            // console.log(i, "empty")
          }
          
        }
      }
      
    }
    else if (meta.name === "set_slot" && data.windowId === this.windowId){
      if (data.stateId >= 0) { //if stateId -1 then its one of the useless set_slot packets that get sent for whatever reason
        this.stateId = data.stateId
      }
    }
    else return

    return
  }

  standardizeMapName(mapName) {
    mapName = mapName.replace("'", "")
    mapName = mapName.replace(" ", "")
    mapName = mapName.toLowerCase()
    return mapName
  }


  bindEventListeners() {
    
  }

}