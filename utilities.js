const fs = require('fs')
const chalk = require('chalk')
const Currencies = require('tf2-currencies') 
const config = require('./config.js')

const log = console.log


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
            
    let sellKeys = 0
    let sellScrap = 0
        
    itemsToGive.forEach((itemName) => {
        if (itemName === 'Scrap Metal') {
            sellScrap += 1
        } else if (itemName === 'Reclaimed Metal') {
            sellScrap += 3
        } else if (itemName === 'Refined Metal') {
            sellScrap += 9
        } else if (itemName === 'Mann Co. Supply Crate Key') {
            sellKeys = 1
        } else {
            let found = false
            database.find((dataItem) => {
                if (itemName == dataItem.name) {
                    sellKeys += dataItem.sell.keys
                    let sellMetal = dataItem.sell.metal
                    sellScrap = Currencies.toScrap(sellMetal)
                    found = true
                } 
            })
            if (found === false) {
                console.log('User is taking an item we are not selling: ' + itemName)
                sellKeys += 10000
                sellScrap += 1
            }
        }
    })
    
    let keyToScrap = new Currencies({keys: sellKeys, metal: 0}).toValue(config.keyToMetalConversionRate)
    let sellPriceScrap = keyToScrap + sellScrap
    let currency = Currencies.toCurrencies(sellPriceScrap, config.keyToMetalConversionRate)

    return {
        scrap: sellPriceScrap,
        keys: currency.keys,
        refined: currency.metal
    }

}

const getValueItemsToReceive = (database, itemsToReceive) => {

    let buyKeys = 0
    let buyScrap = 0
    
    itemsToReceive.forEach((itemName) => {
        if (itemName === 'Scrap Metal') {
            buyScrap += 1
        } else if (itemName === 'Reclaimed Metal') {
            buyScrap += 3
        } else if (itemName === 'Refined Metal') {
            buyScrap += 9
        } else if (itemName === 'Mann Co. Supply Crate Key') {
            buyKeys = 1
        } else {
            let found = false
            database.find((dataItem) => {
                if (itemName == dataItem.name) {
                    buyKeys += dataItem.buy.keys
                    let buyMetal = dataItem.buy.metal
                    buyScrap += Currencies.toScrap(buyMetal)
                    found = true
                }
            })
            if (found === false) {
                console.log('User is giving an item we are not buying: ' + itemName)
                buyKeys += 0
                buyScrap += 0
            }
        }
    })
   
    let keyToScrap = new Currencies({keys: buyKeys, metal: 0}).toValue(config.keyToMetalConversionRate)
    let buyPriceScrap = keyToScrap + buyScrap
    let currency = Currencies.toCurrencies(buyPriceScrap, config.keyToMetalConversionRate)

    return {
        scrap: buyPriceScrap,
        keys: currency.keys,
        refined: currency.metal
    }

}

module.exports = {
    loadDatabase: loadDatabase,
    saveDatabase: saveDatabase,
    getValueItemsToGive: getValueItemsToGive,
    getValueItemsToReceive: getValueItemsToReceive,
}

