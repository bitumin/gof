// app config
const appPort = 8138;

// dependencies
const fs = require('fs');
const url = require('url');
const http = require('http');
const path = require('path');
const nwPath = process.execPath;
const nwDir = path.dirname(nwPath);

// lib
const unableToConnectMsg = '<strong>Unable to connect!</strong> You friend seems to not be available... is he running the app?';
const invalidIpMsg = '<strong>Invalid IP!</strong> The IP you have written does not have a valid format, try again.';
function validateIP(ip) {
    return /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(ip);
}
function dimBody() {
    $('.loading-screen').removeClass('hidden');
}
function unDimBody() {
    $('.loading-screen').addClass('hidden');
}
function notifyError(msg) {
    let $container = $('.pages-container');
    $container.prepend('<div class="alert alert-danger">' + msg + '</div>');
    $container.find('.alert').first().delay(3500).fadeOut(2500);
}
function notifySuccess(msg) {
    let $container = $('.pages-container');
    $container.prepend('<div class="alert alert-success">' + msg + '</div>');
    $container.find('.alert').first().delay(3500).fadeOut(2500);
}
function setConnectionToConnected() {
    $('.connection-status').removeClass('label-danger').addClass('label-success').html('Connected');
}
function setConnectionToNotConnected() {
    $('.connection-status').removeClass('label-success').addClass('label-danger').html('Not connected');
}
function startDownload(ip, dir, file, nfile, $progressBar, cb) {
    let fileUrl = 'http://' + ip + '/download/' + dir + '/' + file;
    let options = {
        host: url.parse(fileUrl).host,
        port: appPort,
        path: url.parse(fileUrl).pathname
    };

    if (!fs.existsSync(nwDir + '/Downloads/')){
        fs.mkdirSync(nwDir + '/Downloads/');
    }
    if (!fs.existsSync(nwDir + '/Downloads/' + dir)){
        fs.mkdirSync(nwDir + '/Downloads/' + dir);
    }
    let File = fs.createWriteStream(nwDir + '/Downloads/' + dir + '/' + file);

    http.get(options, function (res) {
        let fsize = res.headers['content-length'];
        res.on('data', function (data) {
            File.write(data);
            updateProgress(100 - (((fsize - File.bytesWritten) / fsize) * 100), nfile, $progressBar);
        }).on('end', function () {
            cb();
            File.end();
        }).on('error', function (err) {
            notifyError('Error downloading ' + file + '. Downloading process interrupted.');
            $progressBar.parent().find('.status-label').empty().html('<span class="label label-danger">Error</span>');
            File.end();
        });
    });
}
function downloadQueue(name, dir, files, $progressBar, nCurrentFile) {
    let currentFile = files.shift();
    if (typeof currentFile === 'undefined') {
        notifySuccess(name + ' download finished.');
        $progressBar.addClass('hidden');
        $progressBar.parent().find('.status-label').empty().html('<span class="label label-success">Downloaded</span>');
        $progressBar.parent().data('status', 'idle');
        return;
    }

    $progressBar.parent().find('.status-label').empty();
    $progressBar.removeClass('hidden');
    nCurrentFile = typeof nCurrentFile === 'undefined' ? 1 : nCurrentFile;
    startDownload(ip, dir, currentFile, nCurrentFile, $progressBar, function() {
        downloadQueue(name, dir, files, $progressBar, ++nCurrentFile);
    });
}
function updateProgress(percent, nfile, $progressBar) {
    $progressBar.find('.progress-bar').css('width', percent * $progressBar.width() / 100);
    $progressBar.find('.current-file-number').html(nfile);
}
function formatBytes(bytes, precision) {
    if (0 === bytes) return "0 Bytes";
    let c = 1e3, d = precision || 2, e = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"],
        f = Math.floor(Math.log(bytes) / Math.log(c));
    return parseFloat((bytes / Math.pow(c, f)).toFixed(d)) + " " + e[f]
}
function $gameItemFactory(name, dir, version, size, files, nfiles) {
    return $(
        '<a href="javascript:" class="list-group-item game-item" id="name"' +
        ' data-name="' + name + '"' +
        ' data-dir="' + dir + '"' +
        ' data-version="' + version + '"' +
        ' data-size="' + size + '"' +
        ' data-files="' + files.join() + '"' +
        ' data-nfiles="' + nfiles + '"' +
        ' data-status="idle"' +
        '>' +
            '<b>' + name + '</b> ' +
            '<small>' +
                version + ' ' +
                '(' + formatBytes(size) + ')' +
            '</small> ' +
            '<span class="status-label"></span>' +
            '<div class="progress progress-container hidden">' +
                '<div class="progress-bar" role="progressbar">' +
                    '<span>file <span class="current-file-number">1</span> of ' + nfiles + '</span>' +
                '</div>' +
            '</div>' +
        '</a>'
    );
}
function loadPage(page) {
    let availablePages = ['home', 'list'];

    let loadingPageIndex = availablePages.indexOf(page);
    if (loadingPageIndex === -1) {
        console.error('CODING ERROR: Trying to load an unavailable page!');
        return;
    }

    availablePages.splice(loadingPageIndex, 1);
    _.each(availablePages, function (other) {
        $('#' + other + '-page').addClass('hidden');
    });

    $('#' + page + '-page').removeClass('hidden');
}
function loadList(games) {
    let $gamesList = $('.games-list');
    $gamesList.empty();
    _.each(games, function (game) {
        $gamesList.append($gameItemFactory(game.name, game.dir, game.version, game.size, game.files, game.nfiles));
    });
}

// main
let ip = null;
$('.connect-btn').click(function (e) {
    dimBody();

    let rawIp = $('#ip').val();

    if (!validateIP(rawIp)) {
        unDimBody();
        notifyError(invalidIpMsg);
        return;
    }

    ip = rawIp;

    $.getJSON('http://' + ip + ':' + appPort + '/list').done(function (gamesList) {
        console.info('Successfully connected to ' + ip);
        setConnectionToConnected();
        loadList(gamesList);
        loadPage('list');
    }).fail(function () {
        notifyError(unableToConnectMsg);
        setConnectionToNotConnected();
    }).always(function () {
        unDimBody();
    });
});
$('.games-list').on('click', '.game-item', function(e) {
    let $this = $(this);

    // fetch data
    let status = $this.data('status');
    let name = $this.data('name');
    let dir = $this.data('dir');
    let files = $this.data('files').split(',');
    let $progressBar = $this.find('.progress-container');

    if ("downloading" === status) {
        return;
    }
    $this.data('status', 'downloading');

    downloadQueue(name, dir, files, $progressBar);
});
