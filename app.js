const SteamUser = require('steam-user')
const SteamTotp = require('steam-totp')
const SteamCommunity = require('steamcommunity')
const TradeOfferManager = require('steam-tradeoffer-manager')
const BptfListings = require('bptf-listings')
const Schema = require('tf2-schema')
const async = require('async');
const chalk = require('chalk')
const SKU = require('tf2-sku')
const fs = require('fs')
const config = require('./config.js')
const utils = require('./utilities.js')
const api = require('./utils/api.js')
const listings = require('./listings.js')
const log = console.log
const client = new SteamUser();
const schemaManager = new Schema({ apiKey: config.mySteamAPIkey});
const community = new SteamCommunity()

const database = utils.loadDatabase()

const manager = new TradeOfferManager({
	steam: client,
	community: community,
    language: 'en',
    cancelTime: 600000
});

const listingManager = new BptfListings({
    token: config.bpTfToken,
    steamid: config.botSteamID,
    batchSize: 10 // only create 10 listings at a time
});

const logOnOptions = {
    accountName: config.accountName,
    password: config.password,
    twoFactorCode: SteamTotp.getAuthCode(config.sharedSecret)
}

client.logOn(logOnOptions)
client.on('error', (error) => log(chalk.magenta.bold('[ info ] ') + 'Error: Could not log into Steam ' + error)) // Error Handling

client.on('loggedOn', () => {
    log(chalk.magenta.bold('[ info ] ') + `Success: Connected to Steam as ${config.botName}`)
    client.setPersona(SteamUser.EPersonaState.Online, config.botName) 
    client.gamesPlayed(440)
    client.chat.sendFriendMessage(config.botAdminAccount, "🔴🔵 I have successfully logged into Steam!", (error) => {
        if (error) {
            console.log(error)
        }
    })
    
})

// Web Session
let signingIn = true
client.on('webSession', (sessionID, cookies) => {
    manager.setCookies(cookies, (error) => {
        if (error) {
            log(chalk.magenta.bold('[ info ] ') + 'Error: Could not set cookies ' + error)
            process.exit(1) // Fatal error since we couldn't get our API key
			return
        }
        log(chalk.magenta.bold('[ info ] ') + `Got steam API key: ${manager.apiKey}`)
    })
    community.setCookies(cookies)
    log(chalk.magenta.bold('[ info ] ') + `Received a web session and set cookies!`)
    updateStockAtStartup()
    signingIn = false
});

community.on('sessionExpired' , () => {
    if (signingIn) {
        return
    }

    signingIn = true
    client.webLogOn()

})

manager.on('newOffer', (offer) =>  checkOffer(offer))
manager.on('receivedOfferChanged', (offer, oldState) => getOfferState(offer, oldState))

// ** OFFERS --------------------------------------------------------------------------------------------------------------------------------------

const checkOffer = (offer) => {
    log(chalk.blue.bold('[ trade ] ') + chalk.bold(`New offer #${offer.id} from #${offer.partner.getSteamID64()}`))
    
    let fromAdmin = offer.partner.getSteamID64() === 1 // config.botAdminAccount
    let receiveNothing = offer.itemsToReceive.length === 0
       
    // const testItem = offer.itemsToReceive.map(item => item)
    // console.log(testItem)

    if (fromAdmin) {
        log(chalk.blue.bold('[ trade ] ') + `New offer #${offer.id} from ADMIN`)
        acceptOffer(offer)
    } else if (offer.isGlitched() || receiveNothing || offer.state === 1 || offer.state === 3 || offer.state === 6 || offer.state === 7 || offer.state === 8 ) {
        if (receiveNothing) {
            log(chalk.magenta.bold('[ trade ] ') + `We are receiving nothing in trade!`)
            declineOffer(offer)
        } else {
            log(chalk.magenta.bold('[ trade ] ') + `Declined trade offer #${offer.id} with state: ${offer.state}`)
            declineOffer(offer)
        }
    } else {
        handleOffer(offer)
    }
}

const handleOffer = async function (offer) {
   // try {
        let scammerSR = await api.isSteamRepScammer(offer.partner.getSteamID64())
       // console.log(scammerSR)
           
        //let database = utils.loadDatabase()


        const itemsToGive = offer.itemsToGive.map(item => item.market_hash_name) // this is an arry of item names // market hash name
        const itemsToReceive = offer.itemsToReceive.map(item => item.market_hash_name) // this is an array of item names // market Hash name

        let tradeInfo = utils.countItems(itemsToGive, itemsToReceive)
        let itemsToGiveValue = utils.getValueItemsToGive(offer, database, itemsToGive) // <- got the value
        let itemsToReceiveValue = utils.getValueItemsToReceive(offer, database, itemsToReceive) // <- Got the value
        
        log(chalk.blue.bold('[ trade ] ') + chalk.green.bold(`Items to give: `) + `${tradeInfo.weGive.join(', ')} -> value: ${itemsToGiveValue.keys} keys ${itemsToGiveValue.refined} refined. (scrap: ${itemsToGiveValue.scrap})`)
        log(chalk.blue.bold('[ trade ] ') + chalk.red.bold(`Items to receive: `) + `${tradeInfo.weReceive.join(', ')} -> value: ${itemsToReceiveValue.keys} keys ${itemsToReceiveValue.refined} refined. (scrap: ${itemsToReceiveValue.scrap})`)
        

        
        if (itemsToReceiveValue.scrap >= itemsToGiveValue.scrap && !scammerSR) {
            acceptOffer(offer)
        } else {
            declineOffer(offer)
        }

   /* } catch (error) {
        log(chalk.magenta.bold('[ info ] ') + 'Error: Something went wrong. ' + error)
    }*/
}

// Get Offers
const getOfferState = (offer, oldState) => {
    if (offer.state === 3) { // Accepted
        log(chalk.blue.bold('[ trade ] ') + `Trade offer #${offer.id} changed: ${TradeOfferManager.ETradeOfferState[oldState]} -> ${TradeOfferManager.ETradeOfferState[offer.state]}`)
        

        offer.getExchangeDetails((error, status, tradeInitTime, receivedItems, sentItems) => {
            if (error) {
                log(chalk.magenta.bold('[ trade ] ') + 'Error: Could not get traded items ' + error)
                return
            } 
                let newReceivedItems = receivedItems.map(item => item.market_hash_name);
                let newSentItems = sentItems.map(item => item.market_hash_name);
                let tradeInfo = utils.countItems(newSentItems, newReceivedItems)
                notifyAdmin(offer, tradeInfo.weGive, tradeInfo.weReceive)
                console.log(database)
          
        })
    } else {
        log(chalk.blue.bold('[ trade ] ') + `Trade offer #${offer.id} changed: ${TradeOfferManager.ETradeOfferState[oldState]} -> ${TradeOfferManager.ETradeOfferState[offer.state]}`)
    }
}


// Accept offer
const acceptOffer = (offer) => {
    offer.accept((error, status) => {
        if (error) {
            log(chalk.magenta.bold('[ trade ]') + `Unable to accept a trade offer: ${error.message}`)
        } else {
            if (status == 'pending') {
                community.acceptConfirmationForObject(config.identitySecret, offer.id, (error) => {
                    if (error) {
                        log(chalk.magenta.bold('[ trade ]') + `Unable to confirm a trade offer: ${error.message}`)
                    } else {
                        log(chalk.blue.bold('[ trade ] ') + `Confirmed a trade offer #${offer.id}!`) 
                    }
                })
            }
            log(chalk.blue.bold('[ trade ] ') + `Accepted a trade offer #${offer.id} from #${offer.partner.getSteamID64()}!`)
        } 
    })  
}

// Decline offer
const declineOffer = (offer) => {
    offer.decline((error, status) => {
        if (error) {
            log(chalk.magenta.bold('[ trade ]') + `Unable to reject a trade offer: ${error.message}`)
        } else {
            log(chalk.blue.bold('[ trade ] ') + `Declined a trade offer #${offer.id} from #${offer.partner.getSteamID64()}!`)
        }
    })
}


// ** ADMIN NOTIFICATION MESSAGES
const notifyAdmin = (offer, sentItems, receivedItems) => {
    switch (offer.state) {
        case 3: // Accepted
            client.chat.sendFriendMessage(config.botAdminAccount, `🔴🔵 Accepted trade offer #${offer.id} from #${offer.partner.getSteamID64()} 🔽 ${receivedItems.join(', ')} 🔼 ${sentItems.join(', ')}`, (error) => {
                if (error) {
                console.log(error)
                }
            })
            break

        case 7: // Declined
            client.chat.sendFriendMessage(config.botAdminAccount, "[ info ] Accepted a trade offer", (error) => {
                if (error) {
                console.log(error)
                }
            })
            break     
        
        default: 
            client.chat.sendFriendMessage(config.botAdminAccount, `[ info ] ${offer.state}`, (error) => {
                if (error) {
                console.log(error)
                }
            })
    }
}



/// ** LISTINGS ---------------------------------------------------------------------------------------------------------------------------------
async.series([
    function (callback) {
        schemaManager.init(callback);
    },
    function (callback) {
        listingManager.schema = schemaManager.schema;
        listingManager.init(callback);
    }
], function (err) {
    if (err) {
        throw err;
    }

    // tf2-schema and bptf-listings are now ready to be used
    
});

schemaManager.on('ready', function () {
    console.log('tf2-schema is ready!');
});

listingManager.on('ready', function () {
    console.log('bptf-listings is ready!');
    listAllSell()
    
});

listingManager.on('actions', function (actions) {
    console.log(actions);
});

// listingManager.on('error', function () {

// });




// * INVENTORY ---------------------------------------------------------------------

const getOurInv = () => new Promise((resolve, reject) => {
    return manager.getInventoryContents(440, 2, true, (error, inventory) => {
        if (error) {
            reject (error)
        } else {
            inventory = inventory.map(item => item)
            resolve (inventory)
        }
    })
}).catch ((error) => {
    console.log(error)
})


const updateStockAtStartup = async () => {
    
    let ourInv = await getOurInv()
    let ourInvItems = ourInv.map(item => item.market_hash_name)
    //let database = utils.loadDatabase()
    database.forEach(dataitem => {
        dataitem.stock = 0
    })

    ourInvItems.forEach(item => {
        database.forEach(dataItem => {
            if (item === dataItem.name) {
                dataItem.stock += 1
            }
        })
    })
    //utils.saveDatabase(database)
    // try {
    //     database.some(item => {
    //         let match = ourInvItems.includes(item.name)
    //         if (match) {
    //             item.stock = 1

    //         } else {
    //             item.stock = 0
    //         }
    //     }) 
    //     utils.saveDatabase(database)
    // } catch (e) {
    //     console.log('Could not get Our Invnentory')
    // }
}

const listAllSell = async () => {
    let ourInv = await getOurInv()
    // let assetid = ourInv.map(item => item.assetid)
    // let itemName = ourInv.map(item => item.market_hash_name)

   // let database = utils.loadDatabase()
    let itemsToList = []

    ourInv.forEach(item => {
        database.find(dataItem => {
            if (item.market_hash_name === dataItem.name) {
                itemsToList.push({
                    id: item.assetid,
                    intent: 1,
                    details: `I am selling this for ${dataItem.sell.keys} keys ${dataItem.sell.metal} ref`,
                    buyout: false,
                    currencies: {
                        keys: dataItem.sell.keys,
                        metal: dataItem.sell.metal
                    }
                })               
            }
        })
    })

    listingManager.createListing(itemsToList, true)
    console.log(itemsToList.length)
    console.log(database)
    // database.forEach(dataItem => {
    //     ourInv.find(itemName => {
    //         if (itemName.market_hash_name === dataItem.name) {
    //             console.log('hi')
    //         }
    //     })
    // })
}

listingManager.on('error', function () {

});