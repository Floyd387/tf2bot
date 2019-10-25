const fs = require('fs')

// ----- ITEM DATABASE ------- // 

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

module.exports = {
    loadDatabase: loadDatabase,
    saveDatabase: saveDatabase
}