import fs from "fs"
import fsPromises from "fs/promises"

export let data = {}
export let dataFileWorking = false
try {
  let tempData = fs.readFileSync("./data.json", "utf8")
  tempData = JSON.parse(tempData)
  replaceData(tempData)
  dataFileWorking = true
}
catch (error) {
  console.log("No valid data.json found. Creating a new file. (Error code: " + error.code + ")")
  //create fresh data
  let tempData = {
    trusted: []
  }
  replaceData(tempData)
  try {
    fs.writeFileSync("./data.json", JSON.stringify(data, null, 2))
    dataFileWorking = true
  }
  catch (error) {
    console.log("Unable to create data.json. (Error code: " + error.code + ")")
    console.log("Make sure this executable is being ran inside of a folder that it can write to.")
    console.log("Data (such as trusted users) will not be saved on restart.")
  }
}

export let saveInterval = setInterval(() => {
  saveData()
}, 60000)

export async function saveData() {
  if (dataFileWorking) await fsPromises.writeFile("./data.json", JSON.stringify(data, null, 2))
}

//replaces contents of data without replacing the reference so imports still work
function replaceData(newData) {
  for (let key in data) {
    delete data[key]
  }
  for (let key in newData) {
    data[key] = newData[key]
  }
}