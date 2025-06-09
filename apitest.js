let response = await fetch("https://api.hydropper.info/user", {
      body: JSON.stringify({
        username: "naptivity"
      }),
      method: "POST",
      headers: {
        "User-Agent": "DropperUtilities",
        "Content-Type": "application/json"
      }
    })
let json = await response.json()
console.log(json)