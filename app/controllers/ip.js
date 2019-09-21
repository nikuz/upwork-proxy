'use strict';

var fs = require('fs');

var file = '/tmp/ip';

function pSave(req, res) {
    var ip = req.params.ip;

    if (ip) {
        fs.writeFile(file, ip, function(err) {
            var result = {};
            if (err) {
                result.error = err;
            }
            res.send(result);
        });
    }
}

function pGet(req, res) {
    fs.readFile(file, function(err, data) {
        var result = {};
        if (err) {
            result.error = err;
        } else {
            result = data;
        }
        res.send(result);
    });
}

function pGetCameraView(req, res) {
    fs.readFile(file, function(err, data) {
        if (err) {
            res.send({ error: err });
        } else {
            res.writeHead(307,
                { Location: 'http://' + data.toString() + ':88/webcam/?action=stream' }
            );
            res.end();
        }
    });
}

exports = module.exports = {
    save: pSave,
    get: pGet,
    getCameraView: pGetCameraView,
};
