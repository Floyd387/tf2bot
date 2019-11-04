const rp = require('request-promise-native')

const isSteamRepScammer = (steamID64) =>  new Promise((resolve, reject) => {
    let options = {
        uri: `http://steamrep.com/api/beta4/reputation/${steamID64}`, // 76561198130630626 <- scammer test steamID
        qs: {
            json: 1
        },
        headers: {
            'User-Agent': 'Request-Promise'
        },
        gzip: true,
        json: true // Automatically parses the JSON string in the response
    };
    
    rp(options).then((data) => {
        let scammer = false
        const isMarked = data.steamrep.reputation.summary.toLowerCase().indexOf('scammer') !== -1
        //console.log(isMarked)
        if (isMarked) {
            scammer = true
        } 
        return resolve(scammer)
    }).catch( (err) => {
        return reject(err) // API call failed...
    });
    
})

module.exports = {
    isSteamRepScammer: isSteamRepScammer
}