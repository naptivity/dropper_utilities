import EventEmitter from "events"
import { randomString, removeFormattingCodes } from "../utils/utils.js"

export class StateHandler extends EventEmitter {
  constructor(clientHandler) {
    super()

    this.clientHandler = clientHandler
    this.userClient = clientHandler.userClient
    this.proxyClient = clientHandler.proxyClient

    this.game_state = null


    this.mapset = null
    this.maps = null //map1, map2, map3, map4, map5

    this.mapFails = null //map1, map2, map3, map4, map5
    this.currentFails = null
    this.totalFails = null

    this.mapStartTime = null //time we started the current map
    this.gameStartTime = null //time we started the match

    this.realMapTimes = null //map1, map2, map3, map4, map5
    this.hypixelMapTimes = null //map1, map2, map3, map4, map5

    this.realTotalTime = null
    this.hypixelTotalTime = null


    this.isFirstLogin = true

    this.requestedLocraw = false
    this.locrawRequestTimeout = null

    this.isPartyLeader = null
    this.partyObject = null
    
    this.requestedPartyList = false //flag that specifies that /party chat command was sent out and parse the incoming messages
    this.updatedPartyList = false //flag that specifies that /party chat messages were parsed and this.requestedPartyList can flip back once the next blue line is seen
    this.partyUpdate = false //flag that enables when some chat message reported a change to the party, so once the next blue line is seen another party list update will be triggered and the flag will be flipped back
    this.partyListRequestTimeout = null

    this.requestedUtilsCheck = false
    this.utilsCheckPassword = null
    this.utilsCheckRequestTimeout = null
    

    //a lot of the stuff i want to add would greatly benefit from having a fleshed out, well written statehandler
    //so i am rewriting this and adding several things that it should track

    //these are all the events:
      //"game_state" (state) events, which update based on what state of dropper gameplay the player is in
        //✅"none": in hypixel lobby or anything that isnt a dropper server
        //✅"waiting": waiting in a dropper lobby
        //✅"countdown": waiting in the countdown sequence
        //✅"playing": playing the game
        //✅"finished": done with the game
      
      //"player_join" (username) event, which emits when any player joins the dropper lobby
      //"player_leave" (username) event, which emits when any player leaves the dropper lobby

      //✅"player_finish" (username) event, which emits when any player finishes the game, providing their name
      //✅"map_finished" event, which emits when the player finishes (or skips) a map and provides information about that map run

      //✅"fail" event, which emits when the player fails

      //"party_update" event, which emits when the party list is updated + utils check was done (only the party leader can start a utils check)


    //the statehandler will also keep track of:
      //✅if the player is in a party (party member list is null or not)
      //✅who is in the party
      //✅who the party leader is
      //who in the party is also running dropperutils (for distributed auto voting)

      //the names and amount of players in your dropper lobby (for dodging and lobby hopping)
      //the amount of time left for the dropper match to start (if any)

      //✅the mapset for the dropper server
      //✅the selected maps of the current game

      //✅the players time on each map as hypixel calculates it
      //✅the players time on each map as we calculate it
      
      //✅the players fails on each map
      //✅the players total fails

      //✅the players final time as hypixel calculates it
      //✅the players final time as we calculate it

    
    

    this.bindEventListeners()
    this.bindModifiers()
  }



  bindModifiers() {
    this.clientHandler.incomingModifiers.push(this.handleIncomingPacketForChat.bind(this)) //analyzes chat packets to send corresponding events
    this.clientHandler.incomingModifiers.push(this.handleIncomingPacketForActionBar.bind(this)) //analyzes actionbar to send corresponding events
  }



  handleIncomingPacketForChat(data, meta) {
    //get chat data standardized for versions
    let actualMessage //where standardized message string will be stored
    if (meta.name === "chat") { //<1.19.1
      if (data.position === 2) return 
      actualMessage = data.message
    }
    else if (meta.name === "system_chat") { //1.19.1+
      if ("type" in data && data.type !== 1) return //1.19.1
      if ("isActionBar" in data && data.isActionBar === true) return //1.19.2+
      actualMessage = data.content
    }
    else return //not chat packet

    let parsedMessage
    try {
      parsedMessage = JSON.parse(actualMessage) //parse message json
    }
    catch (error) { //invalid JSON, Hypixel sometimes sends invalid JSON with unescaped newlines
      return
    }

    
    // console.log(parsedMessage) //crazy how useful this is for chat packet reading and debug lmaoooo


    locraw_response_check: { //checking if chat is a locraw response and parsing it if so
      if (!this.requestedLocraw) break locraw_response_check //we didnt request a locraw check
      if (parsedMessage.extra) break locraw_response_check //locraw is just text field
      if (parsedMessage.color !== "white") break locraw_response_check //locraw is always white
      let locraw_content = parsedMessage.text 
      try {
        locraw_content = JSON.parse(locraw_content) //parse locraw text since its json format
      }
      catch (error) {
        break locraw_response_check
      }

      if (!locraw_content.server) break locraw_response_check //locraw string didnt respond with server field (shouldnt happen but doesnt hurt to check)
      if (typeof locraw_content.server !== "string") break locraw_response_check //locraw should always be string
      this.requestedLocraw = false //we are handling the locraw response so we can reset the flag
      clearTimeout(this.locrawRequestTimeout) //clear the locraw retry timeout

      if (!locraw_content.gametype || !locraw_content.mode || locraw_content.gametype !== "ARCADE" || locraw_content.mode !== "DROPPER") { //checking if locraw says we aren't in dropper lobby
        this.setGameState("none")
      }
      else { //we are in dropper lobby
        this.mapset = locraw_content.map //locraw provides the mapset
        if (this.game_state === "none") {
          this.setGameState("waiting") //since we are in a dropper lobby, set the state to waiting (state gets reset to none on every login so this check wont break stuff)
        }
        
      }
      return {
        type: "cancel" //stops locraw packet from reaching user
      }
    }


    party_list_response_check: { //checking if chat is one of the many party list responses and parsing/hiding if so
      if (!this.requestedPartyList) break party_list_response_check //we didnt request a party list check

      if (!parsedMessage.extra) { //message has no extra field
        if (parsedMessage.color === "blue") { //the lines at top and bottom are blue
          if (!parsedMessage.strikethrough) break party_list_response_check //the lines at top and bottom are strikethrough
          if (parsedMessage.text === "-----------------------------------------------------") { //the text of the lines at top and bottom
            if (this.updatedPartyList) { //if the party list was updated, this is the second instance of this message
              this.updatedPartyList = false //flip the flag, preventing other lines like this from being hidden
              this.requestedPartyList = false //the party list request was handled, so flip the flag
              clearTimeout(this.partyListRequestTimeout) //clear the party list retry timeout
              // console.log("\n\nParty list check completed for", this.clientHandler.userClient.username)
              // console.log("isPartyLeader:", this.isPartyLeader)
              // console.log("partyObject:", this.partyObject)

              if (this.isPartyLeader && this.game_state === "waiting" && !this.requestedUtilsCheck) { //request utils check if party leader, only when waiting in dropper lobby (for voting), and only if one isnt already going on
                setTimeout(() => { //wait a second because if you /p list and /pc in close succession a retry is forced
                  this.requestUtilsCheck()
                }, 1000) 
                
              }
                
            }
            return {
              type: "cancel" //stops party list packet from reaching user
            }
          }
          else break party_list_response_check
        }
        else if (parsedMessage.color === "gold") { //the "party members (x)" title is gold
          if (parsedMessage.text.startsWith("Party Members (")) {
            this.partyObject = {} //make the partyObject go from null to an object, indicating we indeed are in a party and allow us to add members
            return { //the text of "party members (x)"
              type: "cancel" //stops party list packet from reaching user
            }
          }
          else break party_list_response_check
        }
        else if (parsedMessage.color === "white" && parsedMessage.text === "") return { //random empty message sent between "party members (x)" and the list of people
          type: "cancel" //stops party list packet from reaching user
        }
        else if (parsedMessage.color === "red" && parsedMessage.text === "You are not currently in a party.") { //we are not in a party
          this.isPartyLeader = null //cant be party leader if there is no party
          this.partyObject = null //set party member list to null (should be null when no one in party)
          this.updatedPartyList = true //we updated the party list
          return {
            type: "cancel" //stops party list packet from reaching user
          }
        } 
        else break party_list_response_check
      }
      else if (parsedMessage.color === "yellow") { //message has extra field, and color is yellow (all member list messages are yellow)
        if (parsedMessage.text === "Party Leader: ") { //if we are parsing the party leader message
          this.updatedPartyList = true //we finished updating the party list, so make sure to let the last party list message know
          //reason the above change happens here and not during "party members: " is because you can have a one player party if you invite someone
          //and also the only guaranteed spot to have someone is leader (you can have only party moderators too)

          let onlineStatus = null

          if (parsedMessage.extra[parsedMessage.extra.length - 1].color === "green") { //online status indicator is green
            onlineStatus = true //party leader is online
          }
          else if (parsedMessage.extra[parsedMessage.extra.length - 1].color === "red") { //online status indicator is red
            onlineStatus = false //party leader is offline
          }
          else {
            throw new Error("Party list check online indicator color wasn't red or green somehow")
          }

          let name = parsedMessage.extra[parsedMessage.extra.length - 2].text.split(" ").at(-2) //extract name from message
          if (name === this.clientHandler.userClient.username) { //if this is us
            this.isPartyLeader = true //we are party leader
          }
          else this.isPartyLeader = false //not us, we are not party leader

          this.partyObject[name] = { //create the party member property with the appropriate object properties
            online_status: onlineStatus,
            party_leader: true, //we know its true cause this check is only for party leader
            running_utils: null
          }
        }
        else if (parsedMessage.text === "Party Moderators: " || parsedMessage.text === "Party Members: ") {
          let nextFieldIsName = false
          let lastIndicatorOnlineStatus = null
          for (let i = parsedMessage.extra.length - 1; i >= 0; i--) { //parse message extra in reverse order
            if (nextFieldIsName) {
              let name = parsedMessage.extra[i].text.split(" ").at(-1) //extract name from message

              this.partyObject[name] = { //create the party member property with the appropriate object properties
                online_status: lastIndicatorOnlineStatus,
                party_leader: false, //we know its false because party leader check is handled separately
                running_utils: null
              }

              nextFieldIsName = false
              lastIndicatorOnlineStatus = null
            }
            else if (parsedMessage.extra[i].text === " ● ") { //we found an online status indicator
              nextFieldIsName = true //since a name always comes before the online status indicator, we know the next field is a name

              if (parsedMessage.extra[i].color === "green") { //online status indicator is green
                lastIndicatorOnlineStatus = true //next name we see is online
              }
              else if (parsedMessage.extra[i].color === "red") { //online status indicator is red
                lastIndicatorOnlineStatus = false //next name we see is offline
              }
              else {
                throw new Error("Party list check online indicator color wasn't red or green somehow")
              }
            }
          }
        }
        else break party_list_response_check
        return {
          type: "cancel" //stops party list packet from reaching user
        }
      }
      else break party_list_response_check
    }


    party_update_check: { //logic that will retrigger party list check if someone leaves/joins party (or various other changes that can happen), refreshing member list, leader statuses, and online/offline statuses
      if (this.requestedPartyList) break party_update_check //what are the odds that any of these happen while a check is happening... well reasonably high but i guess we'll just ignore it worst case the variables are a little outdated shouldnt affect much

      if (this.partyUpdate) { //if we already saw a party update message
        if (!parsedMessage.extra && parsedMessage.color === "blue" && parsedMessage.strikethrough && parsedMessage.text === "-----------------------------------------------------") { //finds the lines at the top and bottom of a party update message
          //if the party was updated, this is the second instance of this message, so trigger the party list refresh again
          //we dont trigger it right when we see the message because the party update logic will hide the second blue line and it will look ugly lol
          //i believe this might also stop the check from running multiple times if multiple people get kicked from /p kickoffline? no clue tho
          //also noticed that this prevents a timed out party update request from getting rid of blue lines on duplicate update messages (like a player leaving and the party also disbanding, but the disband message has no blue lines)

          //waits 2 seconds to request party list because Hypixel tends to reject the command if we send it right after another command (if you are the person kicking someone else, you send the p list command in quick succession to p kick)
          //also, only after adding this delay, i discovered the online status in /p list doesnt update for a bit after someone leaves, so this delay is necessary to get accurate online info lol (1.5 was too quick but 2 seems to be slow enough)
          //the delay shouldnt affect much, as long as it eventually makes the update
          setTimeout(() => {
            this.partyUpdate = false
            this.requestPartyList() //actually request the update
            // console.log("Party update retriggered party list update")
          }, 2000) 
          return
        }
      }

      if (!parsedMessage.text) break party_update_check //party messages always have normal text fields
      
      if (!parsedMessage.extra) { //party update messages always have extra unless its the disband one or you left one
        if (parsedMessage.color === "red" && parsedMessage.text === "The party was disbanded because all invites expired and the party was empty.") this.partyUpdate = true
        else if (parsedMessage.color === "yellow" && parsedMessage.text === "You left the party.") this.partyUpdate = true 
        else break party_update_check
        if (this.partyUpdate) return
      }
      else {
        if (parsedMessage.color === "yellow") { //check for the messages that have consistent beginnings
          if (parsedMessage.text === "You have joined " && parsedMessage.extra[parsedMessage.extra.length - 1].text === "party!") this.partyUpdate = true
          else if (parsedMessage.text === "The party leader " && parsedMessage.extra[parsedMessage.extra.length - 1].text === "has rejoined.") this.partyUpdate = true
          else if (parsedMessage.text === "The party leader, " && parsedMessage.extra[parsedMessage.extra.length - 1].text === "minutes to rejoin before the party is disbanded.") this.partyUpdate = true
          else if (parsedMessage.text === "The party was transferred to ") this.partyUpdate = true
          else if (parsedMessage.text === "You have been kicked from the party by ") this.partyUpdate = true
          else if (parsedMessage.text === "Kicked " && parsedMessage.extra[parsedMessage.extra.length - 1].text === " because they were offline.") this.partyUpdate = true
          else break party_update_check
        }
        else { //check for the messages that have consistent endings
          let lastText = parsedMessage.extra[parsedMessage.extra.length - 1].text
          if (parsedMessage.extra[parsedMessage.extra.length - 1].color === "yellow") {
            if (lastText === "has been removed from the party.") this.partyUpdate = true
            else if (lastText === "has rejoined.") this.partyUpdate = true
            else if (lastText === "minutes to rejoin before they are removed from the party.") this.partyUpdate = true
            else if (lastText === "has disbanded the party!") this.partyUpdate = true
            else if (lastText === "joined the party.") this.partyUpdate = true
            else if (lastText === "to Party Leader") this.partyUpdate = true
            else if (lastText === "has left the party.") this.partyUpdate = true
            else break party_update_check
          }
          else break party_update_check
        }
        if (this.partyUpdate) return
      }
    }


    party_member_utils_check: {
      if (parsedMessage.text !== "") break party_member_utils_check //party chat has no normal text
      if (!parsedMessage.extra) break party_member_utils_check //party chat always has extra
      if (parsedMessage.extra.length !== 2) break party_member_utils_check //party chat always has extra length 2
      if (!parsedMessage.extra[0].text.startsWith("§9Party §8> ")) break party_member_utils_check //will always start with that string

      if (this.requestedPartyList) throw new Error("Party chat sent during party list update")

      let partyMessage = parsedMessage.extra[1].text //extract party chat message
      let partyMessageSender = parsedMessage.extra[0].text.split(" ").at(-2).slice(0, parsedMessage.extra[0].text.split(" ").at(-2).length - 3) //extract name from party chat message
      if (partyMessageSender.startsWith("§")) partyMessageSender = partyMessageSender.slice(2) //if theyre a non they have a formatting code so remove it

      if (!this.partyObject) throw new Error("Party chat somehow sent without being in party")

      let partyLeader //variable that will hold who the party leader is
      for (const user in this.partyObject) { //go thru each player in party
        if (this.partyObject[user] && this.partyObject[user]["party_leader"] === true) { //if theyre leader
          partyLeader = user //set variable
          break //break loop obviously theres only one leader
        }
      }
      if (!partyLeader) throw new Error("No party leader found in party list somehow")

      if (partyMessage.startsWith("[DropperUtils check]") && partyMessageSender === partyLeader) { //if party chat is dropperutils check and if message came from party leader
        this.partyObject[partyMessageSender]["running_utils"] = true //update party leader to have utils
        this.utilsCheckPassword = partyMessage.slice(partyMessage.lastIndexOf(" ")) //get password for utils check

        if (this.clientHandler.userClient.username !== partyLeader) { //we are not party leader
          setTimeout(() => {
            this.clientHandler.sendServerPartyChat("[DropperUtils response]" + this.utilsCheckPassword) //respond with the provided random string
          }, Math.floor(Math.random() * 250)) //random delay to try and reduce ban/mute risk
        }
        else { //we are party leader
          clearTimeout(this.utilsCheckRequestTimeout) //clear the retry timeout
        }
        
        this.requestedUtilsCheck = true //set requestedutilscheck to true

        setTimeout(() => { //set 500ms timeout for it to go back to false so no fake responses
          this.requestedUtilsCheck = false
          this.utilsCheckPassword = null

          for (const user in this.partyObject) { //go thru each player in party
            if (this.partyObject[user] && this.partyObject[user]["running_utils"] === null) { //if their utils status wasnt updated after timeout
              this.partyObject[user]["running_utils"] = false //set utils status to false
            }
          }
          console.log("Utils check complete for " + this.clientHandler.userClient.username)
          console.log(this.partyObject)
        }, 500) //timeout will not interfere with check retry because this entire thing triggers if it sees our own message (if we are leader/triggered the check)

        return
      }
      else if (this.requestedUtilsCheck && partyMessage.startsWith("[DropperUtils response]") && partyMessage.endsWith(this.utilsCheckPassword)) { //requestedutilscheck true, is dropperutils response, and password is correct 
        this.partyObject[partyMessageSender]["running_utils"] = true //set utils status to true
      }
      else return //irrelevant party chat message, packet wont have anything else useful 


      
        //update member to have utils
        //return
    }


    countdown_started_check: { //checking if game countdown started and subsequently getting map list
      //dont check if state waiting because apparently player can sometimes join after countdown starts
      if (!parsedMessage.extra) break countdown_started_check //map list has extra property
      if (parsedMessage.extra.length !== 10) break countdown_started_check //extra length is always 10 
      if (parsedMessage.extra[0].text !== "Selected Maps: ") break countdown_started_check //text always starts with that string
      if (parsedMessage.extra[0].color !== "gray") break countdown_started_check //color is always gray
      let maps = [ //every odd number index is a map name so we create map list like that
        parsedMessage.extra[1].text,
        parsedMessage.extra[3].text,
        parsedMessage.extra[5].text,
        parsedMessage.extra[7].text,
        parsedMessage.extra[9].text
      ]
      this.maps = maps //set list of maps for this game
      this.mapFails = [] //reset list of fails for each map this game
      this.currentFails = 0 //reset per-map fail count
      this.totalFails = 0 //reset total fail count
      this.realMapTimes = [] //reset list of real times for each map this game
      this.hypixelMapTimes = [] //reset list of Hypixel times for each map this game
      
      this.setGameState("countdown")
    }


    game_start_check: { //checking that the game started (glass open, countdown done)
      if (this.game_state !== "countdown") break game_start_check //should be checking this only if we are in countdown phase
      if (!parsedMessage.extra) break game_start_check //will have extra
      if (parsedMessage.extra.length !== 1) break game_start_check //extra length will be 1
      if (parsedMessage.text !== "") break game_start_check //shouldnt have any normal text
      if (parsedMessage.extra[0].text !== "DROP!") break game_start_check //extra[0] text should be "DROP!"
      if (parsedMessage.extra[0].bold !== true) break game_start_check //extra[0] text should be bold
      if (parsedMessage.extra[0].color !== "green") break game_start_check //extra[0] text should be green

      this.gameStartTime = performance.now() //set game start time to now
      this.mapStartTime = this.gameStartTime //set map start time to now

      this.setGameState("playing")
    }

    
    map_completed_check: { //checking that a map was completed (skip or not)
      if (this.game_state !== "playing") break map_completed_check //only do this check while playing
      if (parsedMessage.text !== "") break map_completed_check //will have no normal text
      if (!parsedMessage.extra) break map_completed_check //will have exctra

      if (parsedMessage.extra.length === 5) { //map completion length will be 5
        if (!parsedMessage.extra[0].text.startsWith("You finished Map ")) break map_completed_check //finish message starts with that string
        if (parsedMessage.extra[0].color !== "gray") break map_completed_check //color will be gray
        
        //calculate real map time first to prevent overhead delay
        let time = performance.now()
        this.realMapTimes.push(time - this.mapStartTime)
        this.mapStartTime = time
        
        //extract Hypixel map time and convert to ms
        let hypixelTimeText = parsedMessage.extra[3].text //time will always be in extra idx 3
        let split = hypixelTimeText.split(":")
        let minutes = parseInt(split[0])
        let seconds = parseInt(split[1])
        let milliseconds = parseInt(split[2])
        let durationMS = minutes * 60000 + seconds * 1000 + milliseconds

        this.hypixelMapTimes.push(durationMS) //put Hypixel time in list
      }
      else if (parsedMessage.extra.length !== 3) { //skip usage length will be 3
        if (!parsedMessage.extra[0].text.startsWith("You have skipped ahead to Map ")) break map_completed_check //skip message starts with that string
        if (parsedMessage.extra[0].color !== "gray") break map_completed_check //color will be gray

        //calculate real map time first to prevent overhead delay
        let time = performance.now()
        this.realMapTimes.push(time - this.mapStartTime)
        this.mapStartTime = time

        this.hypixelMapTimes.push(null) //since there is no Hypixel time, push null
      }
      else break map_completed_check

      this.mapFails.push(this.currentFails) //add map-specific failcount to fails list
      this.currentFails = 0 //reset currentFails to 0

      this.emit("map_finished")
      // console.log("emitted map_finished")
    }
    

    player_finish_check: { //checks if a player has completed the game (both other players and local player)
      if (this.game_state !== "playing" && this.game_state !== "finished") break player_finish_check //must be in playing or finished state (finished to keep tracking other players after finishing yourself)
      if (parsedMessage.text !== "") break player_finish_check //no normal text in message
      if (!parsedMessage.extra) break player_finish_check //message will have extra
      //no length check because extra is variable based on rank
      if (parsedMessage.extra.length > 3 && parsedMessage.extra[parsedMessage.extra.length - 3].text === "finished all maps in ") { //someone else completed game
        this.emit("player_finish", parsedMessage.extra[parsedMessage.extra.length - 5].text.split(" ").at(-1)) //length can change based on rank, this is a standardized way to get it
        // console.log("emitted player_finish", parsedMessage.extra[parsedMessage.extra.length - 5].text.split(" ").at(-1))
      }
      else if (parsedMessage.extra.length === 3 && parsedMessage.extra[0].text === "You finished all maps in ") { //we completed game
        this.emit("player_finish", this.clientHandler.userClient.username)
        // console.log("emitted player_finish", this.clientHandler.userClient.username)

        //calculate real map time first to prevent overhead delay
        this.realTotalTime = performance.now() - this.gameStartTime

        //extract Hypixel map time and convert to ms
        let hypixelTimeText = parsedMessage.extra[1].text
        let split = hypixelTimeText.split(":")
        let minutes = parseInt(split[0])
        let seconds = parseInt(split[1])
        let milliseconds = parseInt(split[2])
        let durationMS = minutes * 60000 + seconds * 1000 + milliseconds

        this.hypixelTotalTime = durationMS
        
        this.setGameState("finished")
      }
    }
  }

  

  handleIncomingPacketForActionBar(data, meta) {
    let actualMessage
    if (meta.name === "chat") { //<1.19.1
      if (data.position !== 2) return
      actualMessage = data.message
    }
    else if (meta.name === "system_chat") { //1.19.1+
      if (data.type !== 2 && !data.isActionBar) return
      actualMessage = data.content
    }
    else return //not actionbar packet
    
    let parsedMessage
    try {
      parsedMessage = JSON.parse(actualMessage) //parse actionbar json
    }
    catch (error) { //invalid JSON, Hypixel sometimes sends invalid JSON with unescaped newlines
      return 
    }
    

    fail_count_check: { //get fail count from game info bar
      if (this.game_state !== "playing") break fail_count_check //should be in playing state when checking this
      if (!parsedMessage.text.startsWith("§fMap Time: §a") && !parsedMessage.text.startsWith("§fTotal Time: §a")) break fail_count_check //action bar will always begin with either map time or total time (when done with game)
      let split = parsedMessage.text.split(" ") //split actionbar message into list
      if (split.length !== 6) break fail_count_check //will always be 6 regardless of finish or not
      let noFormatting = removeFormattingCodes(split[split.length - 1]) //last item in list will always be failcount, remove formatting to just get text
      let failCount = parseInt(noFormatting) //convert str to int
      if (failCount > this.currentFails) { //if failcount has increase since we last updated it
        let difference = failCount - this.currentFails //get increase
        for (let i = 0; i < difference; i++) { //repeat for each increase
          this.currentFails++ //add fail to currentfails
          this.totalFails++ //add fail to totalfails
          this.emit("fail")
          // console.log("emitted fail")
        }
      }
    }
  }



  bindEventListeners() {
    this.clientHandler.on("destroy", () => { //happens when client leaves game, reset state
      this.setGameState("none")
    })

    this.proxyClient.on("login", () => {
      this.setGameState("none") //sets state back to none when changing servers
      if (this.isFirstLogin) { //if its the first login to the server (should wait longer to request locraw for it to not break)
        this.isFirstLogin = false //specify that it isnt the first login anymore
        setTimeout(() => {
          this.requestLocraw()
        }, 1500) //waits a second and a half before sending the command requests
      }
      else {
        setTimeout(() => {
          this.requestLocraw()
        }, 150) //waits 150ms before sending the locraw request
      }
    })
  }



  requestLocraw() {
    if (this.clientHandler.destroyed) return //doesnt do locraw if the client left or crashed
    this.requestedLocraw = true //flips the flag that lets statehandler know that a locraw chat was requested so it can parse it
    this.clientHandler.sendServerCommand("locraw") //sends locraw command

    this.locrawRequestTimeout = setTimeout(() => {
      if (this.requestedLocraw) { //if the 2 second timeout completes and we are still requesting locraw then the command probably failed
        // console.log("Retrying locraw request")
        this.requestLocraw() //so retry the locraw request
      }
    }, 2000)
  }



  requestPartyList() {
    if (this.clientHandler.destroyed) return //doesnt do party list if the client left or crashed
    this.requestedPartyList = true //flips the flag that lets statehandler know that a party list chat was requested so it can parse it
    
    //reset everything so that we arent duplicating stuff lol, we're running a full check anyway
    this.isPartyLeader = null
    this.partyObject = null
    
    this.updatedPartyList = false

    //should also cancel any running utils check when we are doing this, will retrigger after done if necessary
    this.requestedUtilsCheck = false
    this.utilsCheckPassword = null
    clearTimeout(this.utilsCheckRequestTimeout)

    this.clientHandler.sendServerCommand("party list") //sends party list command

    this.partyListRequestTimeout = setTimeout(() => {
      if (this.requestedPartyList) { //if the 2 second timeout completes and we are still requesting the party list then the command probably failed
        // console.log("Retrying party list update")
        this.requestPartyList() //so retry the party list
      }
    }, 2000)
  }



  requestUtilsCheck() {
    if (this.clientHandler.destroyed) return //doesnt do party list if the client left or crashed
    // console.log("requested utils check")
    this.requestedUtilsCheck = true
    if (this.partyObject) this.clientHandler.sendServerPartyChat("[DropperUtils check] " + randomString(12))
    else throw new Error("RequestUtilsCheck called when there was no party? How????")
    

    this.utilsCheckRequestTimeout = setTimeout(() => {
      if (this.requestedUtilsCheck) { //if the 3 second timeout completes and we are still requesting the utils check then the chat probably failed
        // console.log("Retrying utils check")
        this.requestUtilsCheck() //so retry the utils check
      }
    }, 3000)
  }



  setGameState(state) { //whenever changing game state, this function is used to emit the game state event and update corresponding variables
    if (this.game_state === state) return //no need to change state if the state is already set
    this.game_state = state
    if (state === "none") {
      this.mapset = null
      this.maps = null
      this.mapFails = null
      this.currentFails = null
      this.totalFails = null
      this.mapStartTime = null
      this.gameStartTime = null
      this.realMapTimes = null
      this.hypixelMapTimes = null
      this.realTotalTime = null
      this.hypixelTotalTime = null
    }
    if (state === "waiting") {
      this.requestPartyList()
    }
    // else if (state === "finished") {
    //   console.log(this.mapset)
    //   console.log(this.maps)
    //   console.log(this.mapFails)
    //   console.log(this.currentFails)
    //   console.log(this.totalFails)
    //   console.log(this.mapStartTime)
    //   console.log(this.gameStartTime)
    //   console.log(this.realMapTimes)
    //   console.log(this.hypixelMapTimes)
    //   console.log(this.realTotalTime)
    //   console.log(this.hypixelTotalTime)
    // console.log(this.isPartyLeader)
    // console.log(this.partyObject)
    // }
    this.emit("game_state", state) //emit game state event
    console.log("emitted game_state", state)
  }
}