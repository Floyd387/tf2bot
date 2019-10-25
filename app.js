const SteamUser = require('steam-user')
const SteamTotp = require('steam-totp')
const SteamCommunity = require('steamcommunity');
const TradeOfferManager = require('steam-tradeoffer-manager');
const chalk = require('chalk')
//const Schema = require('tf2-schema');
const SKU = require('tf2-sku');
const fs = require('fs')

const config = require('./config.js')
const utils = require('./utilities.js')

const log = console.log
//const schemaManager = new Schema({ apiKey: 'api key here'});

let client = new SteamUser();
const community = new SteamCommunity();
const manager = new TradeOfferManager({
	steam: client,
	community: community,
    language: 'en',
    cancelTime: 600000
});

log(chalk.bold.blue.bgWhite(`<-------- TF2 BOT -------->`))

// Information

const logOnOptions = {
    accountName: config.accountName,
    password: config.password,
    twoFactorCode: SteamTotp.getAuthCode(config.sharedSecret)
}

// Log into Steam
client.logOn(logOnOptions)

client.on('loggedOn', () => {
    log(chalk.blue.bold('[ info ] ') + `Success: Connected to Steam as ${config.botName}`)
    client.setPersona(SteamUser.EPersonaState.Online, config.botName) 
    client.gamesPlayed(440)
    client.chat.sendFriendMessage(config.botAdminAccount, "[ info ] I have successfully logged into Steam!", (error) => {
        if (error) {
            console.log(error)
        }
    })
})

// Error Handling
client.on('error', (error) => {
	log(chalk.red.bold('[ info ] ') + 'Error: Could not log into Steam ' + error)
})

let signingIn = true

// Web Session
client.on('webSession', (sessionID, cookies) => {
    manager.setCookies(cookies, (error) => {
        if (error) {
            log(chalk.red.bold('[ info ] ') + 'Error: Could not set cookies ' + error)
            process.exit(1) // Fatal error since we couldn't get our API key
			return
        }
        log(chalk.blue.bold('[ info ] ') + `Got steam API key: ${manager.apiKey}`)
    })
    community.setCookies(cookies)
    log(chalk.blue.bold('[ info ] ') + `Received a web session and set cookies!`)
    signingIn = false
});

community.on('sessionExpired' , () => {
    if (signingIn) {
        return
    }

    signingIn = true
    client.webLogOn()

})

// -----------------------------------TRADE OFFERS ----------------------------------- //

/*  work on algorithm for trades
    * make a handleOffer function and call it on 'newOffer' event , the function should contain the following:
    ---> decide if the offer is from admin
    -----> yes? accept it
    ---> if from other user proceed to analyze the offer
    -------> analyze offer game, offer status
    -------> analyze if trade partner is scammer if not proceed to 
    -------> analyze our offer values ? accept : decline .. etc
    ... keep my sanity if code fails
*/


// New offer
manager.on('newOffer', (offer) => {

    // I should probably wrap this into a big function that is called on event fire config.botAdminAccount
    if (offer.partner.getSteamID64() === 1) {
        log(chalk.green.bold('[ trade ] ') + `New offer #${offer.id} from ADMIN`)
        
        acceptOffer(offer).catch((error) => {
            throw new Error(error)
        })

    } else {
        log(chalk.green.bold('[ trade ] ') + `New offer #${offer.id} from #${offer.partner.getSteamID64()}`)
        let database = utils.loadDatabase()
        
        const itemsToGive = offer.itemsToGive.map(item => item.market_hash_name) // this is an arry of item names // market hash name
        const itemsToReceive = offer.itemsToReceive.map(item => item.market_hash_name) // this is an array of item names // market Hash name

    
        // Value of items to give (takes sell.metal and sell.keys)
        const itemsToGiveValue = (database, itemsToGive) => {  
            
            sellItem = {
                keys: 0,
                metal: 0
            }
            
            itemsToGive.forEach((item) => {

                database.find((dataItem) => {
                    if (item == dataItem.name) {
                        sellItem.keys += dataItem.sell.keys
                        sellItem.metal += dataItem.sell.metal
                    }
                })

            })
            return sellItem

        }

        let sellValue = itemsToGiveValue(database, itemsToGive)
        console.log(sellValue.keys)
       // const itemsToGiveValue = sellValue(database, itemsToGive)
        


        // console.log('Items to give: ' + itemsToGive + ' value: ' + itemsToGiveValue)
        // console.log('Items to receive: ' + itemsToReceive)
    }
})

// Accept offer
const acceptOffer = (offer) => new Promise((resolve, reject) => {
    offer.accept((error, status) => {
        if (error) {
            reject(log(chalk.red.bold('[ trade ]') + `Unable to accept a trade offer: ${error.message}`))
        } else {
            if (status == 'pending') {
                community.acceptConfirmationForObject(config.identitySecret, offer.id, (error) => {
                    if (error) {
                        log(chalk.red.bold('[ trade ]') + `Unable to confirm a trade offer: ${error.message}`)
                    } else {
                        log(chalk.green.bold('[ trade ] ') + `Confirmed a trade offer #${offer.id}!`) 
                    }
                })
            }
            log(chalk.green.bold('[ trade ] ') + `Accepted a trade offer #${offer.id} from #${offer.partner.getSteamID64()}!`)
            resolve(offer) 
        } 
    })  
})

manager.on('receivedOfferChanged', (offer, oldState) => {
    if (offer.state === 3) { // Accepted
        log(chalk.green.bold('[ trade ] ') + `Trade offer #${offer.id} changed: ${TradeOfferManager.ETradeOfferState[oldState]} -> ${TradeOfferManager.ETradeOfferState[offer.state]}`)
        notifyAdmin(offer)
        log(chalk.green.bold('[ trade ] ') + `Notified admin!`)

        offer.getExchangeDetails((error, status, tradeInitTime, receivedItems, sentItems) => {
            if (error) {
                log(chalk.red.bold('[ trade ] ') + 'Error: Could not get traded items ' + error)
                return
            } 
                let newReceivedItems = receivedItems.map(item => item.market_hash_name);
                let newSentItems = sentItems.map(item => item.market_hash_name);
                log(chalk.green.bold('[ trade ] ') + 'Items received: ' + newReceivedItems.join(', '))
                log(chalk.green.bold('[ trade ] ') + 'Items sent: ' + newSentItems.join(', '))
          
        })
    }
})


// Admin notification messages
const notifyAdmin = (offer) => {
    //console.log(offer.state)
    switch (offer.state) {
        case 3: // Accepted
            client.chat.sendFriendMessage(config.botAdminAccount, `[ info ] Accepted trade offer #${offer.id} from #${offer.partner.getSteamID64()}`, (error) => {
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


// schemaManager.init(function (err) {
//     if (err) {
//         throw err;
//     }
// });

// // const testItem = {
// //     defindex: 976,
// //     quality: 6
// // }

// const testItem = {
//     defindex: 976,
//     quality: 6
// }


// schemaManager.on('ready', function () {
//     // item object to get the name off, only the defindex and quality is required
//     // const item = {
//     //     defindex: 5021,
//     //     quality: 6
//     // };
//     const item = testItem

//     // get the name of the item
//     const name = schemaManager.schema.getName(item);

//     console.log(name); // -> Mann Co. Supply Crate Key
// });



