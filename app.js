const cluster = require('cluster');
const numCPUs = require('os').cpus().length;
const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const upload = multer();
const app = express();
const log4js = require('log4js');
const request = require('request');
log4js.configure({
//  appenders: { tm_service: { type: 'dateFile', pattern: '.yyyy-MM-dd', filename: 'logs/tm_service.log' } },
  appenders: { tm_service: { type: 'stdout' } },
  categories: { default: { appenders: ['tm_service'], level: 'info' } }
});
const logger = log4js.getLogger();
logger.level = 'trace';


if (cluster.isMaster) {
    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }
} else {
    app.use(bodyParser.json()); // for parsing application/json
    app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

    app.get('/', (req, res) => res.send('Hello World!'));
    app.post('/template/send', sendMessage);
    app.post('/template/sendAsync', sendMessageAsync);

    app.listen(3000, () => console.log('Service Start'));
}


function validateTemplate(req) {
   var data = {
        code : 0,
        msg : 'success'
    };
    if (!req.body.hasOwnProperty('access_token') || !req.body.access_token) {
        logger.error('Got access_token failed');
        data.code = -1;
        data.msg = 'missing access_token';
        return data;
    }
    if (!req.body.hasOwnProperty('template') || !req.body.template) {
        logger.error('Got template failed');
        data.code = -1;
        data.msg = 'missing template';
        return data;
    }

    return data;
}



function sendMessage(req, res) {
    var data = validateTemplate(req);
    if (data.code == 0) {
        let access_token = req.body.access_token;
        let template = req.body.template;

        return send(req, access_token, template, function (err, result) {
            if (err) {
                data.code = -1;
                data.msg = result;
            }
            res.send(data);
        });
    } else {
        return res.send(data);
    }
}

function sendMessageAsync(req, res) {
    var data = validateTemplate(req);
    if (data.code == 0) {
        let access_token = req.body.access_token;
        let template = req.body.template;
        res.send(data);

        return send(req, access_token, template, ()=>{});
    } else {
        return res.send(data);
    }
}



function send(req, access_token, template, callback) {
    let url = 'http://api.weixin.qq.com/cgi-bin/message/template/send?access_token=' + access_token;
    request({
        url : url,
        method : 'POST',
        body : JSON.stringify(template)
    }, function (err, res, body) {
        if (err) {
            logger.info('Send Template Message Failed err=' + err + ' access_token=' + access_token + ' template=' + JSON.stringify(template));
            callback(err, body);
        } else {
            let data = JSON.parse(body);
            if (data.errcode == 0) {
                logger.info('Send Template Message Success access_token=' + access_token + ' template=' + JSON.stringify(template));
                callback(-1, body);
            } else {
                logger.info('Send Template Message Failed err=' + data.errmsg + ' access_token=' + access_token + ' template=' + JSON.stringify(template));
                callback(0, body);
            }
        }
    });
}
