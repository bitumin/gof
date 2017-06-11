/**
 * Created by Mitxel on 09/06/2017.
 */
const express = require('express');
const app = express();
const appPort = 8138;
const winreg = require('winreg');
const promisify = require("promisify-node");
const fs = require('fs');
const path = require('path');
const _ = require('underscore-node');
const gogGalaxyPathsReg = new winreg({hive: winreg.HKLM, key: '\\SOFTWARE\\Wow6432Node\\GOG.com\\GalaxyClient\\paths'});

gogGalaxyPathsReg.get('client', function (err, gogGalaxyClientPath) {
    if (err) {
        console.error(err);
        process.exit(1);
    }

    const backupsPath = '' + gogGalaxyClientPath.value + '\\Games\\!Downloads\\';
    if (!fs.existsSync(backupsPath)) {
        console.error('Could not find path ' + backupsPath);
        process.exit(1);
    }

    console.info('INFO: Backup path found ' + backupsPath);

    app.get('/list', function (req, res) {
        let gameDirs = fs.readdirSync(backupsPath);
        // Normalize gameDirs
        gameDirs = _.filter(gameDirs, function (gameDir) {
            return gameDir !== 'temp' && fs.statSync(backupsPath + gameDir).isDirectory();
        });
        console.info('INFO RESPONSE: Listing ' + gameDirs.length + ' game directories');

        // Prepare response
        let games = [];

        _.each(gameDirs, function (gameDir) {
            // Prepare this game data defaults
            let name = gameDir.replace(/_/g, ' ');
            let version = null;
            let size = 0;
            let files = [];

            let gameFiles = fs.readdirSync(backupsPath + '\\' + gameDir);
            // Normalize files and collect game data
            _.each(gameFiles, function (file) {
                let fileStats = fs.statSync(backupsPath + '\\' + gameDir + '\\' + file);
                if (!fileStats.isFile()) {
                    return;
                }
                // Add file size to total game size
                size += fileStats.size;
                // Fetch game version
                if (null === version && '.exe' === path.extname(file)) {
                    let rawVersion = file.match(/([0-9]?[0-9]?[0-9][0-9]?)\.([0-9]?[0-9]?[0-9][0-9]?)\.([0-9]?[0-9]?[0-9][0-9]?)\.([0-9]?[0-9]?[0-9][0-9]?)/);
                    if (Array.isArray(rawVersion)) {
                        version = rawVersion[0];
                    }
                }
                // Add file to files list
                files.push(file);
            });

            games.push({
                'name': name,
                'dir': gameDir,
                'version': version,
                'size': size,
                'files': files,
                'nfiles': files.length
            });
        });

        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(games));
    });

    app.get('/download/:dir/:file', function (req, res) {
        const filePath = backupsPath + '\\' + req.params.dir + '\\' + req.params.file;
        if (!fs.existsSync(filePath)) {
            console.error('ERROR RESPONSE: Could not find path ' + backupsPath);
            res.setHeader('Content-Type', 'application/json');
            res.send({error:{code: 404, msg: 'Requested file not found in server.'}});
            return;
        }
        console.info('INFO RESPONSE: Serving ' + filePath + ' file to ' + req.ip);

        res.sendFile(filePath);
    });

    app.listen(appPort, function () {
        console.log('Listening on port ' + appPort + '...')
    });
});
