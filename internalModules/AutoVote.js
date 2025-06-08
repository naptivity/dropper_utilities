import EventEmitter from "events"
import { removeFormattingCodes } from "../utils/utils.js"

export class AutoVote {
  constructor(clientHandler) {
    this.clientHandler = clientHandler
    this.userClient = clientHandler.userClient
    this.proxyClient = clientHandler.proxyClient

    this.use_item_sequence = 0
    this.windowId = null
    this.windowTitle = null
    this.stateId = null


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
    else if (meta.name === "window_items" && data.windowId === this.windowId) { //make sure not getting window items for like inventory or some non-open menu
      // console.log(meta.name)
      // console.log(data.items[15].nbtData.value.display.value.Name, ) // data.items.length, data.items, data.stateId
      if (data.stateId >= 0) { //dont know if stateid -1 ever happens with window_items but might as well make sure
        this.stateId = data.stateId
        for (let i = 0; i < data.items.length; i++) {
          if (data.items[i].present === true) {
            let item = data.items[i].nbtData.value.display.value.Name.value
            // this.clientHandler.sendClientMessage({
            // text: `§9DropperUtilities > §r${data.items[i].nbtData.value.display.value.Name.value}`
            // })
            console.log(i, item, JSON.parse(item).extra[0].text)

          }
          else {
            console.log(i, "empty")
          }
          
        }
      }
      
    }
    else if (meta.name === "set_slot"){
      if (data.stateId >= 0) { //if stateId -1 then its one of the useless set_slot packets that get sent for whatever reason
        this.stateId = data.stateId
      }
    }
    else return

  }


  bindEventListeners() {
    
  }

}