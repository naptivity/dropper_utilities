import fetch from "node-fetch"

export async function getPlayerStats(identifier) {
  try {
    let response = await fetch("https://api.hydropper.info/user", {
      body: JSON.stringify({
        username: identifier
      }),
      method: "POST",
      headers: {
        "User-Agent": "DropperUtilities",
        "Content-Type": "application/json"
      }
    })
    let json = await response.json()
    if (json.error) {
      throw new Error(JSON.stringify(json))
    }
    return json
  }
  catch (error) {
    console.log("Unexpected full Dropper API error - please report to lapisfloof/naptivity on Discord:")
    console.log(error)
    return null
  }
}