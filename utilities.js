const TradeOfferManager = require('steam-tradeoffer-manager')
const SteamUser = require('steam-user')
const SteamCommunity = require('steamcommunity')
const fs = require('fs')
const chalk = require('chalk')
const Currencies = require('tf2-currencies') 
const config = require('./config.js')
const SKU = require('tf2-sku');
const getSKU = require('./utils/getSKU.js')
const log = console.log



// ** DATABASE

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


// ** VALUE OF ITEMS

// Value of items to give 
const getValueItemsToGive = (offer, database, itemsToGive) => {  
            
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
            sellKeys += 1
        } else {
            let found = false
            let sku = getSKU.getSKUfromObjectToGive(offer, itemName)
            //console.log(sku)
            database.find((dataItem) => {
                if (sku == dataItem.itemSku) {
                    sellKeys += dataItem.sell.keys
                    sellScrap += Currencies.toScrap(dataItem.sell.metal)
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

// Value of items to receive
const getValueItemsToReceive = (offer, database, itemsToReceive) => {

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
            buyKeys += 1
        } else {
            let found = false
            let sku = getSKU.getSKUfromObjectToReceive(offer, itemName)
            console.log(sku)
            database.find((dataItem) => {
                if (sku == dataItem.itemSku) {
                    buyKeys += dataItem.buy.keys
                    buyScrap += Currencies.toScrap(dataItem.buy.metal)
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

// ** COUNTERS

const countItems = (itemsToGive, itemsToReceive) => {
    let weGive = []
    let weReceive = []

    let itemsSent = itemsToGive.filter(item => !item.includes('Metal') && !item.includes('Mann Co. Supply Crate Key'))
    let itemsReceived = itemsToReceive.filter(item => !item.includes('Metal') && !item.includes('Mann Co. Supply Crate Key'))


    let scrapSent = itemsToGive.filter(item => item.includes('Scrap Metal'))
    let scrapReceived = itemsToReceive.filter(item => item.includes('Scrap Metal'))
  

    let recSent = itemsToGive.filter(item => item.includes('Reclaimed Metal'))
    let recReceived = itemsToReceive.filter(item => item.includes('Reclaimed Metal'))
 

    let refSent = itemsToGive.filter(item => item.includes('Refined Metal'))
    let refReceived = itemsToReceive.filter(item => item.includes('Refined Metal'))
   

    let keysSent = itemsToGive.filter(item => item.includes('Mann Co. Supply Crate Key'))
    let keysReceived = itemsToReceive.filter(item => item.includes('Mann Co. Supply Crate Key'))

    if (itemsSent.length > 0) {
        weGive.push(itemsSent)
    }
    if (itemsReceived.length > 0) {
        weReceive.push(itemsReceived)
    }
    if (keysSent.length > 0) {
        weGive.push(`${keysSent.length}x Mann Co. Supply Crate Key`)
    }
    if (keysReceived.length > 0) {
        weReceive.push(`${keysReceived.length}x Mann Co. Supply Crate Key`)
    }
    if (refSent.length > 0) {
        weGive.push(`${refSent.length}x Refined Metal`)
    }
    if (refReceived.length > 0) {
        weReceive.push(`${refReceived.length}x Refined Metal`)
    }
    if (recSent.length > 0) {
        weGive.push(`${recSent.length}x Reclaimed Metal`)
    }
    if (recReceived.length > 0) {
        weReceive.push(`${recReceived.length}x Reclaimed Metal`)
    }
    if (scrapSent.length > 0) {
        weGive.push(`${scrapSent.length}x Scrap Metal`)
    }
    if (scrapReceived.length > 0) {
        weReceive.push(`${scrapReceived.length}x Scrap Metal`)
    }

    return {
        weGive: weGive,
        weReceive: weReceive
    }

}


module.exports = {
    loadDatabase: loadDatabase,
    saveDatabase: saveDatabase,
    getValueItemsToGive: getValueItemsToGive,
    getValueItemsToReceive: getValueItemsToReceive,
    countItems: countItems
}

