// Get SKU 
const SKU = require('tf2-sku');

const getSKUfromObjectToReceive = (offer, itemName) => {
    itemObj = {
        defindex: null,
        quality: null,
        craftable: true,
        killstreak: 0,
        australium: false,
        festive: false,
        effect: null,
        paintkit: null,
        wear: null,
        quality2: null,
        target: null,
        craftnumber: null
    }
    offer.itemsToReceive.forEach(item => {


        if (item.market_hash_name === itemName) {
            // defindex
            itemObj.defindex = item.app_data.def_index 
            
            // quality
            itemObj.quality = item.app_data.quality
            
            // craftable
            let isUncraftable = item.descriptions.find(element => element.value === '( Not Usable in Crafting )')
            if (isUncraftable) { 
                itemObj.craftable = false 
            } 
            
            // Killstreaker
            let specKS = item.descriptions.findIndex(element => element.value.includes('Sheen: ')) 
            let basicKS = item.descriptions.findIndex(element => element.value.includes('Killstreaks Active')) 
            let proKS = item.descriptions.findIndex(element => element.value.includes('Killstreaker: ')) 

            if (basicKS > -1) {
                itemObj.killstreak = 1
                if (specKS > -1) {
                    itemObj.killstreak = 2
                }
                if (proKS > -1) {
                    itemObj.killstreak = 3
                }
            }
            
            // Australium
            let isAussie = item.market_hash_name.includes('Strange Australium')
            let isAussieKS = item.market_hash_name.includes('Strange Killstreak Australium')
            let isAussieSpecKS = item.market_hash_name.includes('Strange Specialized Killstreak Australium')
            let isAussieProKS = item.market_hash_name.includes('Strange Professional Killstreak Australium')
            if (isAussie || isAussieKS || isAussieSpecKS || isAussieProKS) {
                itemObj.australium = true
            }
        }
        
    })
    console.log('getting sku... ')
    let sku = SKU.fromObject(itemObj)
    console.log(`SKU is: ${sku}`)
    return sku
}


const getSKUfromObjectToGive = (offer, itemName) => {
    itemObjToGive = {
        defindex: null,
        quality: null,
        craftable: true,
        killstreak: 0,
        australium: false,
        festive: false,
        effect: null,
        paintkit: null,
        wear: null,
        quality2: null,
        target: null,
        craftnumber: null
    }
    offer.itemsToGive.forEach(item => {


        if (item.market_hash_name === itemName) {
            // defindex
            itemObjToGive.defindex = item.app_data.def_index 
            
            // quality
            itemObjToGive.quality = item.app_data.quality
            
            // craftable
            let isUncraftable = item.descriptions.find(element => element.value === '( Not Usable in Crafting )')
            if (isUncraftable) { 
                itemObjToGive.craftable = false 
            } 
            
            // Killstreaker
            let specKS = item.descriptions.findIndex(element => element.value.includes('Sheen: ')) 
            let basicKS = item.descriptions.findIndex(element => element.value.includes('Killstreaks Active')) 
            let proKS = item.descriptions.findIndex(element => element.value.includes('Killstreaker: ')) 

            if (basicKS > -1) {
                itemObjToGive.killstreak = 1
                if (specKS > -1) {
                    itemObjToGive.killstreak = 2
                }
                if (proKS > -1) {
                    itemObjToGive.killstreak = 3
                }
            }
            
            // Australium
            let isAussie = item.market_hash_name.includes('Strange Australium')
            let isAussieKS = item.market_hash_name.includes('Strange Killstreak Australium')
            let isAussieSpecKS = item.market_hash_name.includes('Strange Specialized Killstreak Australium')
            let isAussieProKS = item.market_hash_name.includes('Strange Professional Killstreak Australium')
            if (isAussie || isAussieKS || isAussieSpecKS || isAussieProKS) {
                itemObjToGive.australium = true
            }
        }
        
    })
    console.log('getting sku... ')
    let sku = SKU.fromObject(itemObjToGive)
    console.log(`SKU is: ${sku}`)
    return sku
}

module.exports = {
    getSKUfromObjectToReceive: getSKUfromObjectToReceive,
    getSKUfromObjectToGive: getSKUfromObjectToGive
}
