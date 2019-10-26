const fs = require('fs')

// DATABASE

// Load Database
const loadDatabase = () => {
    try {
        const databaseBuffer = fs.readFileSync('database.json') 
        const databaseJSON = databaseBuffer.toString()
        return JSON.parse(databaseJSON)
    } catch (error) {
        return []
    }
}

// Save Database
const saveDatabase = (database) => {
    const databaseJSON = JSON.stringify(database)
    fs.writeFileSync('database.json', databaseJSON)
}




// VALUE OF ITEMS

// Value of items to give 
const getValueItemsToGive = (database, itemsToGive) => {  
            
    sellItem = {
        keys: 0,
        metal: 0
    }
        
    let found = false

    itemsToGive.forEach((item) => {

        database.find((dataItem) => {
            if (item == dataItem.name) {
                sellItem.keys += dataItem.sell.keys
                sellItem.metal += dataItem.sell.metal
                found = true
            } 
        })
    })

    if (!found) {
        sellItem.keys += 1000
        sellItem.metal += 1000
        console.log('Buyer is taking an item we dont sell')
    }
    return sellItem

}

const getValueItemsToReceive = (database, itemsToReceive) => {

    buyItem = {
        keys: 0,
        metal: 0
    }

    let found = false 

    itemsToReceive.forEach((item) => {

        database.find((dataItem) => {
            if (item == dataItem.name) {
                buyItem.keys += dataItem.buy.keys
                buyItem.metal += dataItem.buy.metal
                found = true
            }
        })
    })

    if (!found) {
        buyItem.keys += 0
        buyItem.metal += 0
        console.log('Buyer is offering an item we dont buy')
    }
    return buyItem
}


module.exports = {
    loadDatabase: loadDatabase,
    saveDatabase: saveDatabase,
    getValueItemsToGive: getValueItemsToGive,
    getValueItemsToReceive: getValueItemsToReceive
}

