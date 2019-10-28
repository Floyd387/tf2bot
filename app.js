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
//const schemaManager = new Schema({ apiKey: 'api key'});

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
    log(chalk.magenta.bold('[ info ] ') + `Success: Connected to Steam as ${config.botName}`)
    client.setPersona(SteamUser.EPersonaState.Online, config.botName) 
    client.gamesPlayed(440)
    client.chat.sendFriendMessage(config.botAdminAccount, "[ info ] I have successfully logged into Steam!", (error) => {
        if (error) {
            console.log(error)
        }
    })
})

// Error Handling
client.on('error', (error) => log(chalk.magenta.bold('[ info ] ') + 'Error: Could not log into Steam ' + error))



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
        log(chalk.blue.bold('[ trade ] ') + `New offer #${offer.id} from ADMIN`)
        
        acceptOffer(offer).catch((error) => {
            throw new Error(error)
        })

    } else {
        log(chalk.blue.bold('[ trade ] ') + chalk.bold(`New offer #${offer.id} from #${offer.partner.getSteamID64()}`))
        
        let database = utils.loadDatabase()
        
        const itemsToGive = offer.itemsToGive.map(item => item.market_hash_name) // this is an arry of item names // market hash name
        const itemsToReceive = offer.itemsToReceive.map(item => item.market_hash_name) // this is an array of item names // market Hash name
        let itemsToGiveValue = utils.getValueItemsToGive(database, itemsToGive) // <- got the value
        let itemsToReceiveValue = utils.getValueItemsToReceive(database, itemsToReceive) // <- Got the value

        log(chalk.blue.bold('[ trade ] ') + chalk.green.bold(`Items to give: `) + `${itemsToGive.join(', ')} -> value: ${itemsToGiveValue.keys} keys ${itemsToGiveValue.refined} refined --> (scrap: ${itemsToGiveValue.scrap})`)
        log(chalk.blue.bold('[ trade ] ') + chalk.red.bold(`Items to receive: `) + `${itemsToReceive.join(', ')} --> value: ${itemsToReceiveValue.keys} keys ${itemsToReceiveValue.refined} refined --> (scrap: ${itemsToReceiveValue.scrap})`)
        
        itemsToReceiveValue.scrap >= itemsToGiveValue.scrap ? acceptOffer(offer) : declineOffer(offer)
        
    }
})

manager.on('receivedOfferChanged', (offer, oldState) => {
    if (offer.state === 3) { // Accepted
        log(chalk.blue.bold('[ trade ] ') + `Trade offer #${offer.id} changed: ${TradeOfferManager.ETradeOfferState[oldState]} -> ${TradeOfferManager.ETradeOfferState[offer.state]}`)
        notifyAdmin(offer)

        offer.getExchangeDetails((error, status, tradeInitTime, receivedItems, sentItems) => {
            if (error) {
                log(chalk.magenta.bold('[ trade ] ') + 'Error: Could not get traded items ' + error)
                return
            } 
                let newReceivedItems = receivedItems.map(item => item.market_hash_name);
                let newSentItems = sentItems.map(item => item.market_hash_name);
                log(chalk.blue.bold('[ trade ] ') + 'Items received: ' + newReceivedItems.join(', '))
                log(chalk.blue.bold('[ trade ] ') + 'Items sent: ' + newSentItems.join(', '))
          
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



// ACCEPTING AND DECLINING OFFERS

// Accept offer
const acceptOffer = (offer) => new Promise((resolve, reject) => {
    offer.accept((error, status) => {
        if (error) {
            reject(log(chalk.magenta.bold('[ trade ]') + `Unable to accept a trade offer: ${error.message}`))
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
            resolve(offer) 
        } 
    })  
})

// Decline offer
const declineOffer = (offer) => new Promise((resolve, reject) => {
    offer.decline((error, status) => {
        if (error) {
            reject(log(chalk.magenta.bold('[ trade ]') + `Unable to reject a trade offer: ${error.message}`))
        } else {
            log(chalk.blue.bold('[ trade ] ') + `Rejected a trade offer #${offer.id} from #${offer.partner.getSteamID64()}!`)
            resolve(offer) 
        }
    })
})



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



