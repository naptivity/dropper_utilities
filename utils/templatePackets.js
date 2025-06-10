export const window_click = { //serverbound packet
  "windowId": null,
  "stateId": null,
  "slot": null,
  "mouseButton": 0,
  "mode": 0,
  "changedSlots": [
    {
      "location": null,
      "item": {
        "present": false
      }
    }
  ],
  "cursorItem": null
}


export const held_item_slot = { //serverbound packet
  "slotId": 0
}


export const use_item = { //serverbound packet
  "hand": 0,
  "sequence": null
}

export const close_window = { //serverbound packet
  "windowId": null
}